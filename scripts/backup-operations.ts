import { migrateReviews } from '../server/review-migration.ts';
import { FieldPath } from 'firebase-admin/firestore';
import { reviewCollection } from '../server/review-storage.ts';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Services } from '../server/firebase.ts';
import { installation } from '../server/operations.ts';
import { acquireMaintenance, releaseMaintenance } from '../server/maintenance.ts';
import { validateSegmentedInstallation } from '../server/segmented-review-storage.ts';
import { backupPaths, sealBackup, verifyBackup, finishBackup, type BackupManifest } from './backup-files.ts';

async function assertHub(s: Services) {
  // Match the pinned, loopback hub to this demo project's locator. Never follow its URLs.
  const locator = JSON.parse(readFileSync(join(tmpdir(), `hub-${s.config.projectId}.json`), 'utf8'));
  const response = await fetch('http://127.0.0.1:4400/', { redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('The local emulator hub is unavailable.');
  const hub = await response.json() as { pid: number; host: string; port: number; version: string };
  const expected = JSON.parse(readFileSync('package.json', 'utf8')).devDependencies['firebase-tools'];
  if (hub.pid !== locator.pid || hub.host !== '127.0.0.1' || hub.port !== 4400 || hub.version !== expected) throw new Error('Emulator hub does not match this installation and toolchain.');
}
export async function saveBackup(s: Services) {
  await installation(s); await assertHub(s);
  const paths = backupPaths();
  const lock = await acquireMaintenance(s, 'Installation backup');
  try {
    // Inspect the stored graph, including empty/cancelled runs and orphan descendants.
    // A current-head pointer alone cannot determine the archive's compatibility version.
    const durableSegments = await validateSegmentedInstallation(s, { maintenanceId: lock });
    // A pre-migration (or partly migrated) archive must request conversion on restore.
    const evaluationSettings = s.db.doc(`districts/${s.config.districtId}/settings/evaluation`);
    let precision = (await evaluationSettings.get()).get('values.starterProfile') === 'pef-precision-v1' || !(await evaluationSettings.collection('versions').where('values.starterProfile', '==', 'pef-precision-v1').limit(1).get()).empty;
    let segmented = false; let bundles = false; let evidenceV3 = false; let legacy = false; let serviceRecords = false; let assistanceRecords = false; let cursor: string | undefined;
    while (true) {
      let q = reviewCollection(s).orderBy(FieldPath.documentId()).limit(20);
      if (cursor) q = q.startAfter(cursor);
      const page = await q.get();
      if (page.docs.some(d => d.get('storageVersion') !== 3)) legacy = true;
      if (page.docs.some(d => !!d.get('serviceId'))) serviceRecords = true;
      if (page.docs.some(d => !!d.get('assistanceId'))) assistanceRecords = true;
      if (page.docs.some(d => d.get('evidenceVersion') === 3)) evidenceV3 = true;
      if (page.docs.some(d => d.get('evidenceVersion') === 4)) precision = true;
      if (page.docs.some(d => d.get('evidenceVersion') === 6 || d.get('sourceVersion') === 3)) segmented = true;
      if (page.docs.some(d => d.get('evidenceVersion') === 5 || d.get('sourceVersion') === 2 || d.get('sourceKind') === 'bundle')) bundles = true;
      if (page.size < 20) break;
      cursor = page.docs.at(-1)!.id;
    }
    const res = await fetch('http://127.0.0.1:4400/_admin/export', {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(120000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: paths.pending, initiatedBy: 'privacypal-local-backup', targets: ['auth', 'firestore'] }),
    });
    if (!res.ok) throw new Error('The emulator export did not complete successfully.');
    sealBackup(paths.pending, s.config, lock, durableSegments.hasArtifacts ? 10 : segmented ? 9 : bundles ? 8 : precision ? 7 : evidenceV3 ? 6 : assistanceRecords ? 5 : serviceRecords ? 4 : legacy ? 2 : 3);
    verifyBackup(paths.pending, s.config);
    finishBackup(paths.pending, paths.complete);
    await releaseMaintenance(s, lock);
    return paths.complete;
  } catch (error) {
    // A timeout may leave export running. Do not unfreeze writes or label a partial save successful.
    throw new Error(`Backup was not confirmed. Maintenance remains active (lock ${lock}). See docs/backup-recovery.md. ${error instanceof Error ? error.message : ''}`);
  }
}
/** Called after native import, before starting the API/worker/browser development server. */
export async function finishRestore(s: Services, manifest: BackupManifest) {
  const setup = await installation(s);
  const admin = await s.auth.getUser(setup.bootstrapAdminUid);
  const member = await s.db.doc(`districts/${s.config.districtId}/members/${admin.uid}`).get();
  if (admin.disabled || !admin.emailVerified || admin.email !== s.config.bootstrapAdminEmail || member.get('role') !== 'admin' || member.get('active') !== true || member.get('email') !== admin.email) {
    throw new Error('Restored administrator identity and membership do not agree. Recovery stopped.');
  }
  // Always inspect artifacts, even when the manifest advertises an older schema. This
  // runs before migration, so a mislabeled archive cannot be silently rewritten/promoted.
  const durableSegments = await validateSegmentedInstallation(s, { maintenanceId: manifest.backupId });
  if (manifest.dataSchema < 10 && durableSegments.hasArtifacts) {
    throw new Error('Segmented run records require backup schema 10. Recovery stopped; maintenance remains active. Do not relabel the archive.');
  }
  if (manifest.dataSchema < 3 || manifest.dataSchema >= 4) await migrateReviews(s, manifest.backupId);
  // Migration is idempotent for bounded reviews, but the final gate still validates the
  // imported immutable graph and its references before any worker can claim work.
  if (durableSegments.hasArtifacts) await validateSegmentedInstallation(s, { maintenanceId: manifest.backupId });
  await releaseMaintenance(s, manifest.backupId);
}
