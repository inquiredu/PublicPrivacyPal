import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, symlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { loadConfig } from '../../server/config.ts';
import { sealBackup, verifyBackup } from '../../scripts/backup-files.ts';

const config = loadConfig('config/test.example.json');
const cliVersion = JSON.parse(readFileSync('package.json', 'utf8')).devDependencies['firebase-tools'];
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'privacypal-backup-unit-'));
  mkdirSync(join(root, 'auth_export')); mkdirSync(join(root, 'firestore_export'));
  writeFileSync(join(root, 'firebase-export-metadata.json'), JSON.stringify({ version: cliVersion, auth: { version: cliVersion, path: 'auth_export' }, firestore: { version: 'local-test', path: 'firestore_export', metadata_file: 'firestore_export/firestore_export.overall_export_metadata' } }));
  writeFileSync(join(root, 'auth_export/accounts.json'), '{"users":[]}'); writeFileSync(join(root, 'auth_export/config.json'), '{}');
  writeFileSync(join(root, 'firestore_export/firestore_export.overall_export_metadata'), 'synthetic unit fixture');
  writeFileSync(join(root, 'firestore_export/output-0'), 'synthetic unit fixture');
  return root;
}
test('a complete backup verifies against the exact configuration and has private file modes', t => {
  const root = fixture(); t.after(() => rmSync(root, { recursive: true }));
  const manifest = sealBackup(root, config, randomUUID());
  assert.equal(manifest.dataSchema, 3);
  assert.deepEqual(verifyBackup(root, config), manifest);
  assert.equal(statSync(root).mode & 0o777, 0o700);
  for (const file of manifest.files) assert.equal(statSync(join(root, file.path)).mode & 0o777, 0o600);
  assert.throws(() => verifyBackup(root, { ...config, projectId: 'demo-another' }), /configuration/);
  assert.throws(() => sealBackup(root, config, randomUUID()), /EEXIST/);
});
for (const damage of ['changed', 'missing', 'extra', 'symlink', 'schema', 'traversal', 'dependencies'] as const) test(`backup rejects ${damage} before import`, t => {
  const root = fixture(); t.after(() => rmSync(root, { recursive: true }));
  sealBackup(root, config, randomUUID());
  if (damage === 'changed') writeFileSync(join(root, 'auth_export/accounts.json'), '{"users":[{}]}');
  if (damage === 'missing') rmSync(join(root, 'auth_export/accounts.json'));
  if (damage === 'extra') writeFileSync(join(root, 'unexpected'), 'extra');
  if (damage === 'symlink') { rmSync(join(root, 'auth_export/accounts.json')); symlinkSync('../firestore_export/output-0', join(root, 'auth_export/accounts.json')); }
  if (['schema', 'traversal', 'dependencies'].includes(damage)) {
    const path = join(root, 'privacypal-backup.json'); const manifest = JSON.parse(readFileSync(path, 'utf8'));
    if (damage === 'schema') manifest.dataSchema = 99;
    if (damage === 'traversal') manifest.files[0].path = '../outside';
    if (damage === 'dependencies') manifest.dependencyHash = '0'.repeat(64);
    writeFileSync(path, JSON.stringify(manifest));
  }
  assert.throws(() => verifyBackup(root, config));
});
test('incomplete native exports cannot receive a completion manifest', t => {
  const root = fixture(); t.after(() => rmSync(root, { recursive: true }));
  rmSync(join(root, 'auth_export/accounts.json'));
  assert.throws(() => sealBackup(root, config, randomUUID()), /Incomplete/);
  assert.throws(() => verifyBackup(root, config), /ENOENT/);
});

test('current reader accepts baseline schema-1 archives without relabeling them', t => {
  const root = fixture(); t.after(() => rmSync(root, { recursive: true }));
  const manifest = sealBackup(root, config, randomUUID());
  const path = join(root, 'privacypal-backup.json');
  writeFileSync(path, JSON.stringify({ ...manifest, dataSchema: 1 }));
  assert.equal(verifyBackup(root, config).dataSchema, 1);
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).dataSchema, 1);
});

test('service-aware schema-4 archives remain distinct from earlier formats', t => {
  const root = fixture(); t.after(() => rmSync(root, { recursive: true }));
  const manifest = sealBackup(root, config, randomUUID(), 4);
  assert.equal(manifest.dataSchema, 4); assert.equal(verifyBackup(root, config).dataSchema, 4);
});
test('suggestion-aware schema-5 archives identify their new private records', t => {
  const root = fixture(); t.after(() => rmSync(root, { recursive: true }));
  const manifest = sealBackup(root, config, randomUUID(), 5);
  assert.equal(manifest.dataSchema, 5); assert.equal(verifyBackup(root, config).dataSchema, 5);
});

test('context-aware schema-6 archives are explicit and unknown future schemas fail closed', t => {
  const root=fixture();t.after(()=>rmSync(root,{recursive:true}));
  const manifest=sealBackup(root,config,randomUUID(),6);assert.equal(verifyBackup(root,config).dataSchema,6);
  writeFileSync(join(root,'privacypal-backup.json'),JSON.stringify({...manifest,dataSchema:10}));
  assert.throws(()=>verifyBackup(root,config));
});

test('precision-aware schema-7 archives preserve requirement review data', t => {
  const root = fixture(); t.after(() => rmSync(root, { recursive: true }));
  const manifest = sealBackup(root, config, randomUUID(), 7);
  assert.equal(manifest.dataSchema, 7); assert.deepEqual(verifyBackup(root, config), manifest);
});

 test('source-bundle schema-8 archives retain manifest and coverage semantics', t => {
  const root = fixture(); t.after(() => rmSync(root, { recursive: true }));
  const manifest = sealBackup(root, config, randomUUID(), 8);
  assert.equal(manifest.dataSchema, 8); assert.deepEqual(verifyBackup(root, config), manifest);
});

test('long-source schema-9 archives retain segmented sources and human range acknowledgments', t => {
  const root = fixture(); t.after(() => rmSync(root, { recursive: true }));
  const manifest = sealBackup(root, config, randomUUID(), 9);
  assert.equal(manifest.dataSchema, 9); assert.deepEqual(verifyBackup(root, config), manifest);
});
