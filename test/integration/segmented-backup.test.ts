import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { DocumentReference } from 'firebase-admin/firestore';
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { loadConfig } from '../../server/config.ts';
import { localServices, type Services } from '../../server/firebase.ts';
import { bootstrap } from '../../server/operations.ts';
import { createReview, reviewAction } from '../../server/reviews.ts';
import { commandIdentity } from '../../server/commands.ts';
import { acquireMaintenance, releaseMaintenance } from '../../server/maintenance.ts';
import { SEGMENTED_COLLECTIONS, segmentedCounterRef, outputBytes, validateSegmentedInstallation, type SegmentedOutput } from '../../server/segmented-review-storage.ts';
import { processNextSegmentedRun } from '../../server/analysis/segmented-jobs.ts';
import { segmentedExampleCapture, SEGMENTED_LIMITS } from '../../shared/segmented-assistance.ts';
import { saveBackup, finishRestore } from '../../scripts/backup-operations.ts';
import { verifyBackup, type BackupManifest } from '../../scripts/backup-files.ts';

const config = loadConfig('config/test.example.json');
const base = `districts/${config.districtId}`;
let s: Services;
let environment: RulesTestEnvironment;
let actor: DecodedIdToken;
let reviewId: string;
let runId: string;
let retained: { review: DocumentReference; run: DocumentReference; request: DocumentReference; output: DocumentReference;
  spec: DocumentReference; receipt: DocumentReference; sourcePart: DocumentReference; attemptId: string };

// These tests target the semantic post-import gate. Native archive verification and actual
// shutdown/import are covered separately by backup-files tests and test:recovery.
function importedManifest(dataSchema: BackupManifest['dataSchema'], backupId: string): BackupManifest {
  return { format: 'privacypal-local-backup-v1', dataSchema, backupId, config,
    createdAt: new Date().toISOString(), dependencyHash: '0'.repeat(64), files: [] };
}
async function rejectedRestore(dataSchema: BackupManifest['dataSchema'], expected?: RegExp) {
  const lock = await acquireMaintenance(s, 'Synthetic malformed import gate');
  try {
    const restore = finishRestore(s, importedManifest(dataSchema, lock));
    if (expected) await assert.rejects(restore, expected); else await assert.rejects(restore);
    assert.equal((await s.db.doc('installation/maintenance').get()).get('id'), lock, 'Failed restore must retain its exact fence.');
  } finally { await releaseMaintenance(s, lock); }
}
async function damage(ref: DocumentReference, change: () => Promise<unknown>, check: () => Promise<void>) {
  const before = await ref.get();
  try { await change(); await check(); }
  finally { if (before.exists) await ref.set(before.data()!); else await ref.delete(); }
}

before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, config.projectId);
  s = localServices(config);
  environment = await initializeTestEnvironment({ projectId: config.projectId, firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
  await environment.clearFirestore();
  const cleared = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${config.projectId}/accounts`, { method: 'DELETE' });
  assert.ok(cleared.ok);
  const admin = await bootstrap(s, randomBytes(24).toString('base64url'));
  actor = { uid: admin.uid, email: config.bootstrapAdminEmail, email_verified: true } as DecodedIdToken;
  const review = await createReview(s, actor, segmentedExampleCapture());
  reviewId = review.id;
  const action = { action: 'start_segmented_run' as const, revision: review.revision };
  const result = await reviewAction(s, actor, review.id, action, commandIdentity(randomUUID(), `/api/reviews/${review.id}`, action));
  assert.equal(result.segmentedStorageVersion, 1);
  runId = result.segmentedRunId!;
});
after(async () => { await environment?.cleanup(); await s?.close(); });

test('an empty durable run selects schema 10 before any finding or output exists', async () => {
  const inspected = await validateSegmentedInstallation(s);
  assert.equal(inspected.hasArtifacts, true); assert.equal(inspected.runCount, 1);
  const backup = await saveBackup(s);
  assert.equal(verifyBackup(backup, config).dataSchema, 10);
  assert.equal((await s.db.doc('installation/maintenance').get()).exists, false);
});

for (const schema of [1, 2, 3, 4, 5, 6, 7, 8, 9] as const) test(`schema-${schema} cannot hide new segmented artifacts`, async () => {
  await rejectedRestore(schema, /schema 10/);
});

test('schema-10 validation requires the saved maintenance identity before releasing it', async () => {
  const lock = await acquireMaintenance(s, 'Synthetic wrong restore identity');
  try {
    await assert.rejects(finishRestore(s, importedManifest(10, randomUUID())));
    assert.equal((await s.db.doc('installation/maintenance').get()).get('id'), lock);
  } finally { await releaseMaintenance(s, lock); }
});

test('missing review markers cannot conceal an existing run from restore validation', async () => {
  const ref = s.db.doc(`${base}/reviews/${reviewId}`);
  const before = (await ref.get()).data()!;
  const { segmentedStorageVersion: _version, segmentedRunId: _run, segmentedRunCount: _count, ...withoutMarker } = before;
  await damage(ref, () => ref.set(withoutMarker), () => rejectedRestore(9));
});

test('a forged retained-run count fails restore instead of being repaired', async () => {
  const ref = s.db.doc(`${base}/reviews/${reviewId}`);
  await damage(ref, () => ref.update({ segmentedRunCount: 0 }), async () => {
    await rejectedRestore(10);
    assert.equal((await ref.get()).get('segmentedRunCount'), 0);
  });
});

test('missing run parent fails even when its immutable descendants remain', async () => {
  const ref = s.db.doc(`${base}/reviews/${reviewId}/segmentedRuns/${runId}`);
  await damage(ref, () => ref.delete(), () => rejectedRestore(10));
});

test('an output below a missing review and run is detected independently of current heads', async () => {
  const ref = s.db.doc(`${base}/reviews/${randomUUID()}/segmentedRuns/${randomUUID()}/${SEGMENTED_COLLECTIONS.outputs}/${'a'.repeat(64)}`);
  await damage(ref, () => ref.set({ version: 'forged-output', base64: 'eA==' }), () => rejectedRestore(9));
});

test('a cancelled empty run retains its schema-10 requirement and can be restored', async () => {
  const head = await s.db.doc(`${base}/reviews/${reviewId}`).get();
  const run = await s.db.doc(`${base}/reviews/${reviewId}/segmentedRuns/${runId}`).get();
  const action = { action: 'cancel_segmented_run' as const, revision: head.get('revision') as number, runId, runRevision: run.get('revision') as number };
  const result = await reviewAction(s, actor, reviewId, action, commandIdentity(randomUUID(), `/api/reviews/${reviewId}`, action));
  assert.equal(result.segmentedStorageVersion, 1); assert.equal(result.segmentedRunCount, 1);
  const backup = await saveBackup(s);
  assert.equal(verifyBackup(backup, config).dataSchema, 10);
  const lock = await acquireMaintenance(s, 'Synthetic restored cancelled run');
  await finishRestore(s, importedManifest(10, lock));
  assert.equal((await s.db.doc('installation/maintenance').get()).exists, false);
  assert.equal((await s.db.doc(`${base}/reviews/${reviewId}/segmentedRuns/${runId}`).get()).get('status'), 'cancelled');
});

test('an invalid UTF-8 return is preserved as original bytes and remains a valid recoverable failure', async () => {
  const review = await createReview(s, actor, segmentedExampleCapture());
  const start = { action: 'start_segmented_run' as const, revision: review.revision };
  const current = await reviewAction(s, actor, review.id, start, commandIdentity(randomUUID(), `/api/reviews/${review.id}`, start));
  const run = s.db.doc(`${base}/reviews/${review.id}/segmentedRuns/${current.segmentedRunId}`);
  const action = { action: 'run_segmented_attempt' as const, revision: current.revision, runId: current.segmentedRunId!,
    runRevision: (await run.get()).get('revision') as number, scope: { kind: 'segment' as const, segmentId: 's1' } };
  const commandId = randomUUID();
  await reviewAction(s, actor, review.id, action, commandIdentity(commandId, `/api/reviews/${review.id}`, action));
  const raw = Buffer.from([0x20, 0x0a, 0xff, 0x09]);
  await processNextSegmentedRun(s, { transport: async () => ({ status: 'completed', bytes: raw }) });
  const attempt = (await run.collection(SEGMENTED_COLLECTIONS.attempts).get()).docs[0];
  const output = run.collection(SEGMENTED_COLLECTIONS.outputs).doc(attempt.get('outputId'));
  assert.deepEqual(outputBytes((await output.get()).data() as SegmentedOutput), raw);
  const outcome = await run.collection(SEGMENTED_COLLECTIONS.outcomes).doc(attempt.get('outcomeId')).get();
  assert.equal(outcome.get('state'), 'invalid');
  const reviewRef = s.db.doc(`${base}/reviews/${review.id}`);
  const source = await reviewRef.collection('sources').doc((await reviewRef.get()).get('sourceId')).get();
  retained = { review: reviewRef, run, request: run.collection(SEGMENTED_COLLECTIONS.requests).doc(attempt.get('requestId')), output,
    spec: run.collection(SEGMENTED_COLLECTIONS.specs).doc((await run.get()).get('specId')),
    receipt: s.db.doc(`${base}/commandReceipts/${actor.uid}/entries/${commandId}`),
    sourcePart: reviewRef.collection('sourceParts').doc(source.get('partIds')[0]), attemptId: attempt.id };
  const lock = await acquireMaintenance(s, 'Synthetic invalid original output recovery');
  await finishRestore(s, importedManifest(10, lock));
  assert.equal((await s.db.doc('installation/maintenance').get()).exists, false);
});

for (const kind of ['output', 'request', 'sourcePart', 'receipt'] as const) test(`missing ${kind} stops recovery and keeps maintenance active`, async () => {
  const ref = retained[kind];
  await damage(ref, () => ref.delete(), () => rejectedRestore(10));
});

test('changing raw bytes while preserving the old output hash is rejected', async () => {
  await damage(retained.output, () => retained.output.update({ base64: Buffer.from('different original bytes').toString('base64') }), () => rejectedRestore(10));
});

test('unsupported saved request and provider versions are not normalized during recovery', async () => {
  await damage(retained.request, () => retained.request.update({ version: 'segmented-request-v999' }), () => rejectedRestore(10));
  await damage(retained.spec, () => retained.spec.update({ provider: 'unsupported-paid-provider' }), () => rejectedRestore(10));
});

test('forged admission totals and dangling dispatch indexes fail the imported graph check', async () => {
  const counter = segmentedCounterRef(s);
  await damage(counter, () => counter.update({ admittedRecords: 0 }), () => rejectedRestore(10));
  const dispatch = s.db.doc(`${base}/segmentedDispatches/${retained.attemptId}`);
  await damage(dispatch, () => dispatch.delete(), () => rejectedRestore(10));
});

test('the independent artifact scan rejects record-cap-plus-one before loading an unbounded graph', async () => {
  const parent = s.db.doc(`${base}/reviews/${randomUUID()}/segmentedRuns/${randomUUID()}`);
  const refs = Array.from({ length: SEGMENTED_LIMITS.installationRecords + 1 }, () => parent.collection(SEGMENTED_COLLECTIONS.outputs).doc());
  try {
    for (let offset = 0; offset < refs.length; offset += 400) {
      const batch = s.db.batch(); for (const ref of refs.slice(offset, offset + 400)) batch.set(ref, { syntheticCorruption: true }); await batch.commit();
    }
    await rejectedRestore(10, /scan bound/);
  } finally {
    // Remove only the deliberately malformed test records, restoring the prior test graph.
    for (let offset = 0; offset < refs.length; offset += 400) {
      const batch = s.db.batch(); for (const ref of refs.slice(offset, offset + 400)) batch.delete(ref); await batch.commit();
    }
  }
  await validateSegmentedInstallation(s);
});
