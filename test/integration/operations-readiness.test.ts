import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import type { CollectionReference } from 'firebase-admin/firestore';
import { loadConfig } from '../../server/config.ts';
import { localServices, type Services } from '../../server/firebase.ts';
import { bootstrap } from '../../server/operations.ts';
import { acquireMaintenance, releaseMaintenance } from '../../server/maintenance.ts';
import { inspectOperationsReadiness, readinessReport } from '../../server/operations-readiness.ts';
import { runOperationsCheck } from '../../scripts/operations-check.ts';
import { finishRestore } from '../../scripts/backup-operations.ts';
import type { BackupManifest } from '../../scripts/backup-files.ts';

const config = loadConfig('config/test.example.json');
let s: Services; let environment: RulesTestEnvironment; let uid: string;
const member = () => s.db.doc(`districts/${config.districtId}/members/${uid}`);
const setup = () => s.db.doc('installation/config');

// Compare before any sign-in: Auth login timestamps are mutable even when application records are not.
async function snapshot() {
  const documents: Record<string, unknown> = {};
  async function walk(collection: CollectionReference) {
    for (const ref of await collection.listDocuments()) {
      const snap = await ref.get(); if (snap.exists) documents[ref.path] = snap.data();
      for (const child of await ref.listCollections()) await walk(child);
    }
  }
  for (const collection of await s.db.listCollections()) await walk(collection);
  const users = (await s.auth.listUsers(1000)).users.sort((a, b) => a.uid.localeCompare(b.uid)).map(user => user.toJSON());
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value !== null && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
  // Compare every Auth field without letting assertion diagnostics print exported password material.
  const authDigest = createHash('sha256').update(JSON.stringify(canonical(users))).digest('hex');
  return { documents, authCount: users.length, authDigest };
}
function restoredManifest(backupId: string): BackupManifest {
  // Direct post-import gate fixture, not a valid native archive or a shutdown/import rehearsal.
  return { format: 'privacypal-local-backup-v1', dataSchema: 3, backupId, config,
    createdAt: new Date().toISOString(), dependencyHash: '0'.repeat(64), files: [] };
}
before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, config.projectId);
  s = localServices(config);
  environment = await initializeTestEnvironment({ projectId: config.projectId,
    firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
});
beforeEach(async () => {
  await environment.clearFirestore();
  assert.ok((await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${config.projectId}/accounts`, { method: 'DELETE' })).ok);
  uid = (await bootstrap(s, randomBytes(24).toString('base64url'))).uid;
});
after(async () => { await environment?.cleanup(); await s?.close(); });

test('healthy local inspection is read-only and absence of a second administrator is advisory', async () => {
  const before = await snapshot();
  const checks = await inspectOperationsReadiness(s);
  assert.equal(readinessReport(checks).ok, true);
  assert.equal(checks.find(c => c.code === 'second_admin')?.status, 'warn');
  assert.deepEqual(await snapshot(), before);
  const output = JSON.stringify(checks);
  assert.equal(output.includes(uid), false); assert.equal(output.includes(config.bootstrapAdminEmail), false);
});

test('second administrator requires enabled verified Auth and exact active admin membership', async () => {
  const second = await s.auth.createUser({ email: 'second-operator@school.example', password: randomBytes(24).toString('base64url'), emailVerified: true });
  const ref = s.db.doc(`districts/${config.districtId}/members/${second.uid}`);
  await ref.set({ email: second.email, role: 'admin', active: true });
  for (const state of ['valid', 'disabled', 'unverified', 'inactive', 'mismatched', 'missing-auth'] as const) {
    if (state === 'disabled') await s.auth.updateUser(second.uid, { disabled: true });
    if (state === 'unverified') await s.auth.updateUser(second.uid, { disabled: false, emailVerified: false });
    if (state === 'inactive') { await s.auth.updateUser(second.uid, { emailVerified: true }); await ref.update({ active: false }); }
    if (state === 'mismatched') await ref.update({ active: true, email: 'wrong@school.example' });
    if (state === 'missing-auth') { await ref.update({ email: second.email }); await s.auth.deleteUser(second.uid); }
    const before = await snapshot();
    assert.equal((await inspectOperationsReadiness(s)).find(c => c.code === 'second_admin')?.status, state === 'valid' ? 'pass' : 'warn', state);
    assert.deepEqual(await snapshot(), before);
  }
});

test('active maintenance fails diagnostics without releasing its exact fence or changing records', async () => {
  const lock = await acquireMaintenance(s, 'Synthetic readiness fence');
  const before = await snapshot();
  const report = readinessReport(await inspectOperationsReadiness(s));
  assert.equal(report.ok, false); assert.equal(report.checks.find(c => c.code === 'maintenance')?.status, 'fail');
  assert.deepEqual(await snapshot(), before);
  assert.equal((await s.db.doc('installation/maintenance').get()).get('id'), lock);
  await releaseMaintenance(s, lock);
});

for (const damage of ['missing-installation', 'configuration-mismatch', 'malformed-protected-uid', 'missing-auth', 'disabled', 'unverified',
  'auth-email-mismatch', 'missing-membership', 'wrong-role', 'inactive-membership', 'membership-email-mismatch'] as const) {
  test(`${damage} fails inspection and finishRestore preserves Auth, Firestore and maintenance`, async () => {
    if (damage === 'missing-installation') await setup().delete();
    if (damage === 'configuration-mismatch') await setup().update({ allowedDomains: ['different.example'] });
    if (damage === 'malformed-protected-uid') await setup().update({ bootstrapAdminUid: 7 });
    if (damage === 'missing-auth') await s.auth.deleteUser(uid);
    if (damage === 'disabled') await s.auth.updateUser(uid, { disabled: true });
    if (damage === 'unverified') await s.auth.updateUser(uid, { emailVerified: false });
    if (damage === 'auth-email-mismatch') await s.auth.updateUser(uid, { email: 'different-admin@school.example' });
    if (damage === 'missing-membership') await member().delete();
    if (damage === 'wrong-role') await member().update({ role: 'viewer' });
    if (damage === 'inactive-membership') await member().update({ active: false });
    if (damage === 'membership-email-mismatch') await member().update({ email: 'wrong-member@school.example' });
    const lock = await acquireMaintenance(s, 'Synthetic restore refusal');
    const before = await snapshot();
    const checks = await inspectOperationsReadiness(s);
    const failed = ['missing-installation', 'configuration-mismatch', 'malformed-protected-uid'].includes(damage) ? 'installation' : 'protected_admin';
    assert.equal(checks.find(c => c.code === failed)?.status, 'fail');
    assert.deepEqual(await snapshot(), before);
    await assert.rejects(finishRestore(s, restoredManifest(lock)));
    assert.deepEqual(await snapshot(), before);
    assert.equal((await s.db.doc('installation/maintenance').get()).get('id'), lock);
    await releaseMaintenance(s, lock);
  });
}

test('CLI orchestration uses actual loopback probes and reads without changing the installation', async () => {
  const before = await snapshot();
  const report = await runOperationsCheck(['--json'], { load: () => config });
  assert.equal(report.ok, true, JSON.stringify(report));
  assert.equal(report.checks.find(c => c.code === 'emulators')?.status, 'pass');
  assert.equal(report.checks.find(c => c.code === 'backup')?.status, 'not_checked');
  assert.deepEqual(await snapshot(), before);
  const invalid = await runOperationsCheck(['--backup', `/nonexistent/synthetic-${randomUUID()}`], { load: () => config });
  assert.equal(invalid.ok, false); assert.equal(invalid.checks.find(c => c.code === 'backup')?.status, 'fail');
  assert.deepEqual(await snapshot(), before);
});
