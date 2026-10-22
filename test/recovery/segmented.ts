import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { CollectionReference } from 'firebase-admin/firestore';
import type { Services } from '../../server/firebase.ts';
import { createReview, reviewAction } from '../../server/reviews.ts';
import { readReview } from '../../server/review-storage.ts';
import { commandIdentity, commandStatus } from '../../server/commands.ts';
import { acquireMaintenance, releaseMaintenance } from '../../server/maintenance.ts';
import { segmentedRunDetail, segmentedProposalDetail } from '../../server/segmented-reviews.ts';
import { processNextSegmentedRun } from '../../server/analysis/segmented-jobs.ts';
import { generateSegmentedRecording, type SegmentedTransportResult } from '../../server/analysis/segmented-recording.ts';
import { SEGMENTED_COLLECTIONS, SEGMENTED_START_RESERVATION, SEGMENTED_ATTEMPT_RESERVATION, segmentedCounterRef, segmentedRunRef,
  outputBytes, validateSegmentedInstallation, type SegmentedOutput } from '../../server/segmented-review-storage.ts';
import { SEGMENTED_LIMITS as L, segmentedExampleCapture, type SegmentedAction, type SegmentedAttemptScope } from '../../shared/segmented-assistance.ts';
import { saveBackup } from '../../scripts/backup-operations.ts';
import { verifyBackup } from '../../scripts/backup-files.ts';

type SavedCommand = { reviewId: string; commandId: string; input: SegmentedAction; attemptId?: string };
type RunIdentity = { reviewId: string; runId: string };
export type SegmentedRecoveryReceipt = {
  reviewed: RunIdentity; unavailable: RunIdentity; cancelled: RunIdentity;
  late: RunIdentity & { attemptId: string; humanAnalysisId: string };
  pending: Array<RunIdentity & { attemptId: string }>;
  historicalOutcomeId: string; savedOutcomeId: string; humanAnalysisId: string;
  rawOutputs: Array<{ path: string; base64: string }>;
  lostAck: SavedCommand; resumed: boolean;
};
const read = (s: Services, reviewId: string) => s.db.runTransaction(tx => readReview(s, tx, reviewId));
const route = (reviewId: string) => `/api/reviews/${reviewId}`;
const receiptPath = (s: Services, actor: DecodedIdToken, id: string) => `districts/${s.config.districtId}/commandReceipts/${actor.uid}/entries/${id}`;

// Only for known, disposable synthetic fixtures. Production graph validation lives in the
// storage module; this complete snapshot detects unexpected writes during replay/fencing tests.
export async function recoveryDocuments(s: Services) {
  const result: Record<string, unknown> = {};
  async function scan(collection: CollectionReference) {
    for (const ref of await collection.listDocuments()) {
      const snapshot = await ref.get();
      if (snapshot.exists && ref.path !== 'installation/maintenance') result[ref.path] = snapshot.data();
      for (const child of await ref.listCollections()) await scan(child);
    }
  }
  for (const collection of await s.db.listCollections()) await scan(collection);
  return JSON.parse(JSON.stringify(result)) as Record<string, unknown>;
}
async function act(s: Services, actor: DecodedIdToken, reviewId: string, input: SegmentedAction) {
  const commandId = randomUUID();
  await reviewAction(s, actor, reviewId, input, commandIdentity(commandId, route(reviewId), input));
  const receipt = await commandStatus(s, actor, commandId);
  assert.equal(receipt.state, 'applied'); assert.ok('segmented' in receipt && receipt.segmented);
  return { reviewId, commandId, input, attemptId: receipt.segmented.attemptId } satisfies SavedCommand;
}
async function start(s: Services, actor: DecodedIdToken): Promise<RunIdentity> {
  const review = await createReview(s, actor, segmentedExampleCapture());
  await act(s, actor, review.id, { action: 'start_segmented_run', revision: review.revision });
  const current = await read(s, review.id); assert.equal(current.segmentedStorageVersion, 1); assert.ok(current.segmentedRunId);
  return { reviewId: review.id, runId: current.segmentedRunId };
}
async function queue(s: Services, actor: DecodedIdToken, identity: RunIdentity, scope: SegmentedAttemptScope) {
  const review = await read(s, identity.reviewId);
  const detail = await segmentedRunDetail(s, actor, identity.reviewId, identity.runId);
  return act(s, actor, identity.reviewId, { action: 'run_segmented_attempt', revision: review.revision,
    runId: identity.runId, runRevision: detail.run.revision, scope });
}
async function cancel(s: Services, actor: DecodedIdToken, identity: RunIdentity) {
  const review = await read(s, identity.reviewId);
  const detail = await segmentedRunDetail(s, actor, identity.reviewId, identity.runId);
  await act(s, actor, identity.reviewId, { action: 'cancel_segmented_run', revision: review.revision,
    runId: identity.runId, runRevision: detail.run.revision });
}
async function currentOutcome(s: Services, actor: DecodedIdToken, identity: RunIdentity) {
  const detail = await segmentedRunDetail(s, actor, identity.reviewId, identity.runId);
  assert.ok(detail.run.currentOutcomeId); return detail.run.currentOutcomeId;
}
async function attemptRecord(s: Services, identity: RunIdentity, id: string) {
  const record = await segmentedRunRef(s, identity.reviewId, identity.runId).collection(SEGMENTED_COLLECTIONS.attempts).doc(id).get();
  assert.ok(record.exists); return record.data()!;
}
async function lifecycleSnapshot(s: Services, identity: RunIdentity) {
  const root = segmentedRunRef(s, identity.reviewId, identity.runId);
  const documents: Record<string, unknown> = { [root.path]: (await root.get()).data() };
  for (const collection of Object.values(SEGMENTED_COLLECTIONS)) {
    for (const doc of (await root.collection(collection).get()).docs) documents[doc.ref.path] = doc.data();
  }
  for (const doc of (await s.db.collection(`districts/${s.config.districtId}/segmentedDispatches`).where('runId', '==', identity.runId).get()).docs) documents[doc.ref.path] = doc.data();
  for (const doc of (await s.db.collection(`districts/${s.config.districtId}/assistanceBudgets`).get()).docs) documents[doc.ref.path] = doc.data();
  const counter = await segmentedCounterRef(s).get(); documents[counter.ref.path] = counter.data();
  return JSON.parse(JSON.stringify(documents)) as Record<string, unknown>;
}

export async function seedSegmentedRecovery(s: Services, actor: DecodedIdToken): Promise<SegmentedRecoveryReceipt> {
  const reviewed = await start(s, actor);
  const initial = await segmentedRunDetail(s, actor, reviewed.reviewId, reviewed.runId);
  assert.ok(initial.segments.length > 1, 'The authored fixture must include multiple Unicode source ranges.');
  for (const segment of initial.segments) {
    await queue(s, actor, reviewed, { kind: 'segment', segmentId: segment.id });
    assert.equal(await processNextSegmentedRun(s), true);
  }
  await queue(s, actor, reviewed, { kind: 'synthesis' }); await processNextSegmentedRun(s);
  const historicalOutcomeId = await currentOutcome(s, actor, reviewed);
  const earlier = await segmentedProposalDetail(s, actor, reviewed.reviewId, reviewed.runId, historicalOutcomeId, 'deletion');
  assert.ok(earlier.current); assert.ok(earlier.candidates.items.some(candidate => candidate.role === 'opposing'));

  const invalidBytes = Buffer.from(' \n\t{ "deliberatelyInvalid": true } \r\n', 'utf8');
  const invalid = await queue(s, actor, reviewed, { kind: 'segment', segmentId: initial.segments[0].id });
  await processNextSegmentedRun(s, { transport: async () => ({ status: 'completed', bytes: invalidBytes }) });
  const invalidAttempt = await attemptRecord(s, reviewed, invalid.attemptId!);
  assert.ok(invalidAttempt.outputId); assert.ok(invalidAttempt.outcomeId);
  const invalidOutput = segmentedRunRef(s, reviewed.reviewId, reviewed.runId).collection(SEGMENTED_COLLECTIONS.outputs).doc(invalidAttempt.outputId);
  assert.deepEqual(outputBytes((await invalidOutput.get()).data() as SegmentedOutput), invalidBytes);
  assert.equal((await segmentedRunRef(s, reviewed.reviewId, reviewed.runId).collection(SEGMENTED_COLLECTIONS.outcomes).doc(invalidAttempt.outcomeId).get()).get('state'), 'invalid');

  const failed = await queue(s, actor, reviewed, { kind: 'segment', segmentId: initial.segments.at(-1)!.id });
  const member = s.db.doc(`districts/${s.config.districtId}/members/${actor.uid}`);
  const priorMember = (await member.get()).data()!;
  try {
    await member.update({ active: false });
    await processNextSegmentedRun(s); // Explicitly fails before dispatch when its requester is revoked.
  } finally { await member.set(priorMember); }
  const failedAttempt = await attemptRecord(s, reviewed, failed.attemptId!);
  assert.equal(failedAttempt.status, 'failed'); assert.equal(failedAttempt.dispatched, false);
  await queue(s, actor, reviewed, { kind: 'synthesis' }); await processNextSegmentedRun(s);
  const savedOutcomeId = await currentOutcome(s, actor, reviewed);
  assert.notEqual(savedOutcomeId, historicalOutcomeId);
  const historical = await segmentedProposalDetail(s, actor, reviewed.reviewId, reviewed.runId, historicalOutcomeId, 'deletion');
  assert.equal(historical.current, false); assert.equal(historical.seed, null);
  const proposal = await segmentedProposalDetail(s, actor, reviewed.reviewId, reviewed.runId, savedOutcomeId, 'deletion');
  assert.ok(proposal.seed); assert.equal(proposal.seed.finding, 'unresolved'); assert.deepEqual(proposal.seed.citations, []);
  assert.ok(proposal.targets.some(target => !target.derived.ready));
  const beforeHuman = await read(s, reviewed.reviewId);
  const evidence = { ...proposal.seed, rationale: 'Human partial review: retain the contradiction and request the missing annex.',
    sourceReview: { version: 'human-source-review-v1' as const, bundleId: beforeHuman.sourceBundle!.id, segmentIds: [initial.segments[0].id] } };
  const input = { action: 'edit_evidence' as const, revision: beforeHuman.revision, evidence };
  const human = await reviewAction(s, actor, reviewed.reviewId, input, commandIdentity(randomUUID(), route(reviewed.reviewId), input));
  assert.equal(human.evidenceVersion, 7); assert.equal(human.analysis!.schemaVersion, 'findings-v7');
  assert.equal(human.analysis!.score.total, null); assert.equal(human.published, false);
  let humanAnalysisId = human.analysis!.id;

  // Preserve the original attribution while testing a late response on the second retained
  // run. A first handoff cannot bypass queue invalidation, but an existing correction keeps
  // its historical reference even after cancellation of the original run.
  await cancel(s, actor, reviewed);
  const afterCancel = await read(s, reviewed.reviewId);
  await act(s, actor, reviewed.reviewId, { action: 'start_segmented_run', revision: afterCancel.revision });
  const secondRun = await read(s, reviewed.reviewId);
  const lateIdentity = { reviewId: reviewed.reviewId, runId: secondRun.segmentedRunId! };
  const lateCommand = await queue(s, actor, lateIdentity, { kind: 'segment', segmentId: 's1' });
  let lateHumanAnalysisId = '';
  await processNextSegmentedRun(s, { transport: async (recording, signal) => {
    const current = await read(s, lateIdentity.reviewId);
    const correction = { action: 'edit_evidence' as const, revision: current.revision,
      evidence: { ...evidence, rationale: 'Human correction retains the original proposal while the second run is returning.' } };
    const changed = await reviewAction(s, actor, current.id, correction, commandIdentity(randomUUID(), route(current.id), correction));
    lateHumanAnalysisId = changed.analysis!.id;
    return generateSegmentedRecording(recording, signal);
  } });
  const lateAttempt = await attemptRecord(s, lateIdentity, lateCommand.attemptId!);
  assert.ok(lateAttempt.outputId); assert.equal(lateAttempt.eligibleAtCompletion, false);
  assert.equal((await read(s, lateIdentity.reviewId)).analysis!.id, lateHumanAnalysisId);
  humanAnalysisId = lateHumanAnalysisId;
  const late = { ...lateIdentity, attemptId: lateCommand.attemptId!, humanAnalysisId: lateHumanAnalysisId };

  // Keep a separate current unavailable synthesis; the edited run above is deliberately stale.
  const unavailable = await start(s, actor);
  await queue(s, actor, unavailable, { kind: 'synthesis' }); await processNextSegmentedRun(s);
  const unavailableOutcome = await currentOutcome(s, actor, unavailable);
  const unavailableProposal = await segmentedProposalDetail(s, actor, unavailable.reviewId, unavailable.runId, unavailableOutcome, 'deletion');
  assert.ok(unavailableProposal.current); assert.ok(unavailableProposal.targets.every(target => !target.derived.ready));

  const cancelled = await start(s, actor); await cancel(s, actor, cancelled);
  assert.equal((await segmentedRunDetail(s, actor, cancelled.reviewId, cancelled.runId)).run.attemptCount, 0);

  const fenced = await start(s, actor);
  const fencedCommand = await queue(s, actor, fenced, { kind: 'segment', segmentId: 's1' });
  let lock: string | undefined; let fencedDocuments: Record<string, unknown> | undefined;
  try {
    await processNextSegmentedRun(s, { leaseMs: 5000, transport: async (input, signal) => {
      const output = await generateSegmentedRecording(input, signal);
      lock = await acquireMaintenance(s, 'Synthetic completion held at backup fence');
      assert.equal((await attemptRecord(s, fenced, fencedCommand.attemptId!)).dispatched, true);
      fencedDocuments = await lifecycleSnapshot(s, fenced);
      return output;
    } });
  } catch (error) {
    assert.equal((error as { status?: number }).status, 503);
  } finally {
    assert.ok(lock); assert.ok(fencedDocuments);
    try { assert.deepEqual(await lifecycleSnapshot(s, fenced), fencedDocuments, 'No raw output, eligibility, settlement or cleanup write may cross maintenance.'); }
    finally { await releaseMaintenance(s, lock); }
  }

  // Interruption after dispatch preserves the same authored attempt. This is not paid-provider
  // unknown-spend settlement; unsupported provider identities must fail storage validation.
  // Finish the earlier fenced attempt first, after its real lease expires (no forged counter
  // or lease edits). This bounded wait is at most the five-second test lease above.
  const fencedAttempt = await attemptRecord(s, fenced, fencedCommand.attemptId!);
  await new Promise(resolve => setTimeout(resolve, Math.max(0, fencedAttempt.leaseUntil - Date.now()) + 25));
  await processNextSegmentedRun(s);
  assert.equal((await attemptRecord(s, fenced, fencedCommand.attemptId!)).settled, true);
  const interrupted = await start(s, actor);
  const interruptedCommand = await queue(s, actor, interrupted, { kind: 'segment', segmentId: 's1' });
  const interruptedOperation = new AbortController();
  await processNextSegmentedRun(s, { signal: interruptedOperation.signal,
    transport: async (_input, signal) => {
      assert.equal((await attemptRecord(s, interrupted, interruptedCommand.attemptId!)).dispatched, true);
      interruptedOperation.abort(new Error('Synthetic interruption after the durable dispatch marker'));
      throw signal.reason;
    } });
  const interruptedRecord = await attemptRecord(s, interrupted, interruptedCommand.attemptId!);
  assert.equal(interruptedRecord.dispatched, true); assert.equal(interruptedRecord.status, 'unknown');
  assert.equal(interruptedRecord.settled, false);

  const queued = await start(s, actor);
  const lostAck = await queue(s, actor, queued, { kind: 'segment', segmentId: 's1' });
  assert.equal((await attemptRecord(s, queued, lostAck.attemptId!)).dispatched, false);
  const rawOutputs: SegmentedRecoveryReceipt['rawOutputs'] = [];
  for (const doc of (await s.db.collectionGroup(SEGMENTED_COLLECTIONS.outputs).get()).docs) {
    const output = doc.data() as SegmentedOutput;
    outputBytes(output, doc.id); rawOutputs.push({ path: doc.ref.path, base64: output.base64 });
  }
  await validateSegmentedInstallation(s);
  return { reviewed, unavailable, cancelled, late, pending: [{ ...interrupted, attemptId: interruptedCommand.attemptId! }, { ...queued, attemptId: lostAck.attemptId! }],
    historicalOutcomeId, savedOutcomeId, humanAnalysisId, rawOutputs, lostAck, resumed: false };
}

export async function verifySegmentedRecovery(s: Services, actor: DecodedIdToken, receipt: SegmentedRecoveryReceipt) {
  const inspected = await validateSegmentedInstallation(s); assert.ok(inspected.hasArtifacts);
  for (const saved of receipt.rawOutputs) {
    const doc = await s.db.doc(saved.path).get(); assert.ok(doc.exists);
    const output = doc.data() as SegmentedOutput;
    assert.deepEqual(outputBytes(output, doc.id), Buffer.from(saved.base64, 'base64'), 'All original bytes, including invalid responses and whitespace, must survive.');
  }
  const review = await read(s, receipt.reviewed.reviewId);
  assert.equal(review.evidenceVersion, 7); assert.equal(review.analysis!.id, receipt.humanAnalysisId);
  assert.equal(review.analysis!.schemaVersion, 'findings-v7'); assert.equal(review.analysis!.adapterVersion, 'human-evidence-v6');
  const finding = review.analysis!.findings.find(f => f.id === 'deletion')!;
  assert.equal(finding.finding, 'unresolved'); assert.equal(finding.reviewedBy, actor.uid); assert.equal(review.analysis!.score.total, null);
  assert.equal(finding.segmentedProvenance!.reference.outcomeId, receipt.savedOutcomeId);
  assert.deepEqual(finding.sourceReview!.segmentIds, ['s1']); assert.equal(review.published, false);
  const historical = await segmentedProposalDetail(s, actor, receipt.reviewed.reviewId, receipt.reviewed.runId, receipt.historicalOutcomeId, 'deletion');
  assert.equal(historical.current, false); assert.equal(historical.seed, null);
  assert.ok(historical.candidates.items.some(candidate => candidate.role === 'opposing'));
  assert.equal((await segmentedRunDetail(s, actor, receipt.cancelled.reviewId, receipt.cancelled.runId)).run.status, 'cancelled');
  const late = await attemptRecord(s, receipt.late, receipt.late.attemptId);
  assert.ok(late.outputId); assert.equal(late.eligibleAtCompletion, false);
  assert.equal((await read(s, receipt.late.reviewId)).analysis!.id, receipt.late.humanAnalysisId);
  for (const pending of receipt.pending) {
    const attempt = await attemptRecord(s, pending, pending.attemptId);
    assert.equal(attempt.settled, receipt.resumed);
    assert.equal(attempt.knownCostMicros, 0);
  }
  const beforeReplay = await recoveryDocuments(s);
  const command = receipt.lostAck;
  await reviewAction(s, actor, command.reviewId, command.input, commandIdentity(command.commandId, route(command.reviewId), command.input));
  assert.deepEqual(await recoveryDocuments(s), beforeReplay, 'Lost acknowledgment replay cannot add dispatches, quota, receipts, history or another attempt.');
  const status = await commandStatus(s, actor, command.commandId);
  assert.equal(status.state, 'applied'); assert.ok('segmented' in status && status.segmented);
  assert.equal(status.segmented.attemptId, command.attemptId);
}

export async function resumeSegmentedRecovery(s: Services, actor: DecodedIdToken, receipt: SegmentedRecoveryReceipt) {
  for (let i = 0; i < 10; i++) if (!await processNextSegmentedRun(s)) break;
  for (const pending of receipt.pending) {
    const record = await attemptRecord(s, pending, pending.attemptId);
    assert.equal(record.status, 'completed'); assert.equal(record.settled, true);
  }
  assert.equal(await processNextSegmentedRun(s), false, 'Settled attempts are not dispatched again.');
  receipt.resumed = true;
  await verifySegmentedRecovery(s, actor, receipt);
}

export async function maximumSegmentedRecovery(s: Services, actor: DecodedIdToken, directory: string, expectedSchema: 10 | 11 = 10) {
  let ordinal = 0; let exhausted = false;
  const maximalInvalid = async (): Promise<SegmentedTransportResult> => {
    const prefix = Buffer.from(` \ninvalid maximum fixture ${++ordinal}\t`, 'utf8');
    return { status: 'completed', bytes: Buffer.concat([prefix, Buffer.alloc(L.transportBytes - prefix.length, 0x20)]) };
  };
  // Use the real authored source, commands and permanent reservations, never forged counters
  // or inflated unknown fields. Fill the remaining installation admission including unused
  // capacity reserved for every eventual response. No live provider or deletion is involved.
  for (let trial = 0; trial < 500; trial++) {
    const review = await createReview(s, actor, segmentedExampleCapture());
    const commandId = randomUUID();
    const input = { action: 'start_segmented_run' as const, revision: review.revision };
    const before = await recoveryDocuments(s);
    try { await reviewAction(s, actor, review.id, input, commandIdentity(commandId, route(review.id), input)); }
    catch (error) {
      assert.equal((error as { status?: number }).status, 429); assert.match((error as Error).message, /retention admission/);
      assert.deepEqual(await recoveryDocuments(s), before, 'Overflowing run admission changes no record.');
      assert.equal((await s.db.doc(receiptPath(s, actor, commandId)).get()).exists, false);
      exhausted = true; break;
    }
    const current = await read(s, review.id); const identity = { reviewId: review.id, runId: current.segmentedRunId! };
    const detail = await segmentedRunDetail(s, actor, identity.reviewId, identity.runId);
    const scopes: SegmentedAttemptScope[] = [...detail.segments.map(segment => ({ kind: 'segment' as const, segmentId: segment.id })), { kind: 'synthesis' }];
    let refused = false;
    for (const scope of scopes) {
      for (let retry = 0; retry < L.perScope; retry++) {
        const admitted = (await segmentedCounterRef(s).get()).data()!;
        const currentRun = (await segmentedRunDetail(s, actor, identity.reviewId, identity.runId)).run;
        const cannotReserve = admitted.admittedBytes + SEGMENTED_ATTEMPT_RESERVATION.bytes > L.installationBytes
          || admitted.admittedRecords + SEGMENTED_ATTEMPT_RESERVATION.records > L.installationRecords
          || currentRun.admittedBytes + SEGMENTED_ATTEMPT_RESERVATION.bytes > L.runBytes
          || currentRun.admittedRecords + SEGMENTED_ATTEMPT_RESERVATION.records > L.runRecords;
        const snapshot = cannotReserve ? await recoveryDocuments(s) : undefined;
        try { await queue(s, actor, identity, scope); }
        catch (error) {
          assert.equal((error as { status?: number }).status, 429); assert.match((error as Error).message, /retention admission/);
          assert.ok(snapshot, 'Only an exhausted reservation may stop this fixture.');
          assert.deepEqual(await recoveryDocuments(s), snapshot, 'Overflowing attempt admission changes no record or quota.');
          refused = true; break;
        }
        assert.equal(await processNextSegmentedRun(s, { transport: maximalInvalid }), true);
      }
      if (refused) break;
    }
    await cancel(s, actor, identity);
  }
  assert.ok(exhausted, 'The bounded fixture must reach the actual installation admission maximum.');
  const counter = (await segmentedCounterRef(s).get()).data()!;
  assert.ok(counter.admittedBytes + SEGMENTED_START_RESERVATION.bytes > L.installationBytes
    || counter.admittedRecords + SEGMENTED_START_RESERVATION.records > L.installationRecords);
  const graph = await validateSegmentedInstallation(s);
  assert.ok(graph.logicalBytes <= L.installationBytes); assert.ok(graph.recordCount <= L.installationRecords);
  assert.ok(ordinal > 0, 'Maximum outputs must exercise real stored transport bytes.');
  const backup = await saveBackup(s); const manifest = verifyBackup(backup, s.config);
  assert.equal(manifest.dataSchema, expectedSchema);
  const exportedBytes = manifest.files.reduce((total, file) => total + file.bytes, 0);
  const largestFile = Math.max(...manifest.files.map(file => file.bytes));
  assert.ok(exportedBytes <= 64 * 1024 * 1024); assert.ok(largestFile <= 32 * 1024 * 1024); assert.ok(manifest.files.length <= 10000);
  writeFileSync(resolve(directory, 'segmented-maximum.json'), JSON.stringify({ graph, reservations: counter, maximalOutputs: ordinal, exportedBytes, largestFile, files: manifest.files.length, backup }, null, 2), { mode: 0o600 });
  console.log(`Maximum segmented admission verified: ${graph.recordCount} records, ${graph.logicalBytes} logical bytes, ${exportedBytes} native export bytes; overflow was atomic.`);
}
