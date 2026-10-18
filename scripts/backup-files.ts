import { createHash, randomUUID } from 'node:crypto';
import { chmodSync, cpSync, lstatSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { z } from 'zod';
import { configSchema, type LocalConfig } from '../shared/config.ts';

const MANIFEST = 'privacypal-backup.json';
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const fingerprint = () => sha(readFileSync('package-lock.json'));
const cliVersion = () => JSON.parse(readFileSync('package.json', 'utf8')).devDependencies['firebase-tools'] as string;
const entrySchema = z.object({ path: z.string().min(1).max(300), bytes: z.number().int().nonnegative(), sha256: z.string().regex(/^[a-f0-9]{64}$/) }).strict();
const manifestSchema = z.object({
  format: z.literal('privacypal-local-backup-v1'), dataSchema: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7), z.literal(8), z.literal(9)]),
  backupId: z.uuid(), createdAt: z.iso.datetime(), config: configSchema,
  dependencyHash: z.string().regex(/^[a-f0-9]{64}$/), files: z.array(entrySchema).min(4).max(10000),
}).strict();
export type BackupManifest = z.infer<typeof manifestSchema>;
const nativeMetadataSchema = z.object({
  version: z.string(),
  auth: z.object({ version: z.string(), path: z.literal('auth_export') }).strict(),
  firestore: z.object({ version: z.string(), path: z.literal('firestore_export'), metadata_file: z.literal('firestore_export/firestore_export.overall_export_metadata') }).strict(),
}).strict();

function safeRelative(path: string) {
  if (!/^[a-zA-Z0-9_./()-]+$/.test(path) || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..')) {
    throw new Error('Invalid backup file path.');
  }
}
function inventory(root: string) {
  const entries: z.infer<typeof entrySchema>[] = [];
  let total = 0;
  function walk(dir: string, prefix = '') {
    const stat = lstatSync(dir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Backup directories cannot be symlinks.');
    for (const name of readdirSync(dir).sort()) {
      if (!prefix && name === MANIFEST) continue;
      const relative = prefix + name; safeRelative(relative);
      const path = join(dir, name); const file = lstatSync(path);
      if (file.isSymbolicLink()) throw new Error('Backup files cannot be symlinks.');
      if (file.isDirectory()) walk(path, relative + '/');
      else {
        if (!file.isFile() || file.nlink !== 1) throw new Error('Only ordinary, unlinked backup files are supported.');
        total += file.size;
        if (file.size > 32 * 1024 * 1024 || total > 64 * 1024 * 1024 || entries.length >= 10000) throw new Error('Backup exceeds the local sandbox size limit.');
        entries.push({ path: relative, bytes: file.size, sha256: sha(readFileSync(path)) });
      }
    }
  }
  walk(resolve(root));
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}
function checkNative(root: string, files: z.infer<typeof entrySchema>[]) {
  const metadata = nativeMetadataSchema.parse(JSON.parse(readFileSync(join(root, 'firebase-export-metadata.json'), 'utf8')));
  if (metadata.version !== cliVersion() || metadata.auth.version !== cliVersion()) throw new Error('Use the same pinned Firebase CLI version as this backup.');
  for (const required of ['auth_export/accounts.json', 'auth_export/config.json', metadata.firestore.metadata_file]) {
    if (!files.some(f => f.path === required)) throw new Error(`Incomplete backup: missing ${required}.`);
  }
  if (!files.some(f => f.path.startsWith('firestore_export/') && f.path !== metadata.firestore.metadata_file)) throw new Error('Incomplete Firestore export.');
  if (!Array.isArray(JSON.parse(readFileSync(join(root, 'auth_export/accounts.json'), 'utf8')).users)) throw new Error('Invalid account export.');
}
export function sealBackup(root: string, config: LocalConfig, backupId: string, dataSchema: 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 3): BackupManifest {
  const files = inventory(root); checkNative(root, files);
  const manifest = manifestSchema.parse({ format: 'privacypal-local-backup-v1', dataSchema, backupId, createdAt: new Date().toISOString(), config, dependencyHash: fingerprint(), files });
  for (const f of files) chmodSync(join(root, f.path), 0o600);
  function protect(dir: string) {
    chmodSync(dir, 0o700);
    for (const e of readdirSync(dir, { withFileTypes: true })) if (e.isDirectory()) protect(join(dir, e.name));
  }
  protect(root);
  writeFileSync(join(root, MANIFEST), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  return manifest;
}
export function verifyBackup(root: string, config: LocalConfig): BackupManifest {
  const stat = lstatSync(join(root, MANIFEST));
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 2 * 1024 * 1024) throw new Error('Invalid or incomplete backup manifest.');
  const manifest = manifestSchema.parse(JSON.parse(readFileSync(join(root, MANIFEST), 'utf8')));
  if (JSON.stringify(manifest.config) !== JSON.stringify(configSchema.parse(config))) throw new Error('Backup configuration does not match. Restore only to its original synthetic installation.');
  if (manifest.dependencyHash !== fingerprint()) throw new Error('Dependency versions differ. Use the original lockfile; schema upgrades are not automatic.');
  for (const f of manifest.files) safeRelative(f.path);
  const files = inventory(root);
  if (JSON.stringify(files) !== JSON.stringify(manifest.files)) throw new Error('Backup integrity check failed: a file is missing, added, or changed.');
  checkNative(root, files);
  return manifest;
}
export function backupPaths() {
  const parent = resolve('.local/backups'); mkdirSync(parent, { recursive: true, mode: 0o700 });
  const name = `${new Date().toISOString().replaceAll(/[:.]/g, '-')}-${randomUUID()}`;
  const pending = join(parent, `.pending-${name}`);
  mkdirSync(pending, { mode: 0o700 });
  return { pending, complete: join(parent, name) };
}
export function finishBackup(pending: string, complete: string) { renameSync(pending, complete); }

/** Import a verified private copy; the source archive is never modified by Firebase. */
export function stageRestore(source: string, config: LocalConfig) {
  verifyBackup(source, config);
  const parent = resolve('.local/restores'); mkdirSync(parent, { recursive: true, mode: 0o700 });
  const target = join(parent, randomUUID());
  cpSync(resolve(source), target, { recursive: true, errorOnExist: true, force: false, dereference: false });
  const manifest = verifyBackup(target, config); // Includes copy/race verification.
  return { path: target, manifest };
}
