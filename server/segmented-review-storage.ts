import { createHash } from 'node:crypto';
import { FieldPath, type Transaction, type DocumentReference, type DocumentSnapshot } from 'firebase-admin/firestore';
import { z } from 'zod';
import type { Services } from './firebase.ts';
import type { Review } from '../shared/review.ts';
import { measuresFor } from '../shared/evaluation.ts';
import { SEGMENTED_LIMITS as L, SEGMENTED_HANDOFF_QUESTION, SEGMENTED_HANDOFF_SCOPE, segmentedProvenanceSchema, segmentedReceiptEffectSchema,
  segmentedAttemptScopeSchema, segmentedHashSchema as hash } from '../shared/segmented-assistance.ts';
import { digest } from './evaluation.ts';
import { HttpError } from './operations.ts';
import { readReview, readEvaluation, reviewCollection } from './review-storage.ts';
import { commandIdentity } from './commands.ts';
import { newSegmentArchive, readSegmentArchive, buildSynthesisRequest, validateSynthesis, type SegmentArchive, type SegmentAttempt } from './analysis/segments.ts';
import { SEGMENTED_RECORDING, segmentedRecordingEligible } from './analysis/segmented-recording.ts';

const uuid = z.uuid(), number = z.number().int().nonnegative(), date = z.iso.datetime();
const actor = z.string().min(1).max(128), reason = z.string().max(1000);
export const segmentedCommandBindingSchema = z.object({ id: uuid, hash, route: z.string().max(256), actorUid: actor,
  appliedReviewRevision: number.positive(), appliedRunRevision: number.positive() }).strict();
export const segmentedSpecSchema = z.object({ version: z.literal('segmented-run-v1'), bundleId: hash, textHash: hash, definitionId: hash,
  planId: hash, planVersion: z.literal('source-segments-v1'), provider: z.literal('authored-recording'), model: z.literal('lantern-segmented-v1'),
  adapterVersion: z.literal('recording-v1'), segmentPrompt: z.literal('evidence-segment-v1'), segmentSchema: z.literal('segment-candidates-v1'),
  segmentValidator: z.literal('segment-validator-v1'), synthesisPrompt: z.literal('evidence-synthesis-v1'), synthesisSchema: z.literal('segment-synthesis-v1'),
  synthesisValidator: z.literal('synthesis-validator-v1') }).strict();
export const segmentedRunSchema = z.object({ version: z.literal('segmented-run-head-v1'), id: uuid, reviewId: uuid, specId: hash,
  actorUid: actor, actorEmail: z.email().max(320), baseReviewRevision: number.positive(), baselineFindings: z.record(z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/), hash),
  revision: number.positive(), status: z.enum(['open', 'cancelled']), createdAt: date, updatedAt: date, evidenceGeneration: number,
  attemptCount: number.max(L.attempts), activeAttemptId: uuid.nullable(), currentOutcomeId: hash.nullable(), currentSynthesisAttemptId: uuid.nullable(),
  admittedBytes: number.max(L.runBytes), admittedRecords: number.max(L.runRecords),
  startCommand: segmentedCommandBindingSchema, cancelCommand: segmentedCommandBindingSchema.nullable() }).strict();
export const segmentedRequestSchema = z.object({ version: z.literal('segmented-request-v1'), requestKey: hash, dispatchKey: hash,
  scope: segmentedAttemptScopeSchema, request: z.record(z.string(), z.unknown()) }).strict();
export const segmentedAttemptSchema = z.object({ version: z.literal('segmented-attempt-v1'), id: uuid, reviewId: uuid, runId: uuid,
  scope: segmentedAttemptScopeSchema, ordinal: number.positive().max(L.perScope), sequence: number.positive().max(L.attempts), requestId: hash,
  actorUid: actor, actorEmail: z.email().max(320), status: z.enum(['queued','running','unknown','completed','failed','cancelled']),
  lease: z.string().max(36), leaseUntil: number, dispatched: z.boolean(), dispatchKey: hash,
  createdAt: date, updatedAt: date, evidenceGeneration: number, evidenceRevision: hash, evidenceAttemptIds: z.array(uuid).max(72),
  outcomeId: hash.nullable(), outputId: hash.nullable(), eligibleAtCompletion: z.boolean(), ineligibleReason: reason, message: reason,
  knownCostMicros: z.literal(0), settled: z.boolean(), command: segmentedCommandBindingSchema }).strict();
export const segmentedOutputSchema = z.object({ version: z.literal('segmented-output-v1'), encoding: z.literal('base64'), sha256: hash,
  byteLength: number.max(L.transportBytes), base64: z.string().max(Math.ceil(L.transportBytes / 3) * 4) }).strict();
export const segmentedOutcomeSchema = z.object({ version: z.literal('segmented-outcome-v1'), attemptId: uuid, requestId: hash, specId: hash,
  outputId: hash.nullable(), state: z.enum(['validated','invalid','refused','incomplete','failed','cancelled','overflow']),
  validator: z.enum(['segment-validator-v1','synthesis-validator-v1']), scope: segmentedAttemptScopeSchema,
  evidenceGeneration: number, evidenceRevision: hash, reason, transportStatus: z.enum(['completed','refused','incomplete','not_returned']), transportByteLength: number.nullable() }).strict();
export const segmentedDispatchSchema = z.object({ version: z.literal('segmented-dispatch-v1'), id: uuid, reviewId: uuid, runId: uuid,
  compatibility: z.literal('authored-recording:lantern-segmented-v1:recording-v1'), ready: z.boolean(), leaseUntil: number, settled: z.boolean() }).strict();
export const segmentedCounterSchema = z.object({ version: z.literal('segmented-counters-v1'), admittedBytes: number.max(L.installationBytes), admittedRecords: number.max(L.installationRecords) }).strict();
export type SegmentedRun = z.infer<typeof segmentedRunSchema>;
export type SegmentedSpec = z.infer<typeof segmentedSpecSchema>;
export type SegmentedRequest = z.infer<typeof segmentedRequestSchema>;
export type SegmentedAttempt = z.infer<typeof segmentedAttemptSchema>;
export type SegmentedOutput = z.infer<typeof segmentedOutputSchema>;
export type SegmentedOutcome = z.infer<typeof segmentedOutcomeSchema>;
export type SegmentedDispatch = z.infer<typeof segmentedDispatchSchema>;
export type SegmentedCounter = z.infer<typeof segmentedCounterSchema>;
export const SEGMENTED_COLLECTIONS = { specs: 'segmentedSpecs', requests: 'segmentedRequests', attempts: 'segmentedAttempts', outputs: 'segmentedOutputs', outcomes: 'segmentedOutcomes' } as const;
export const segmentedRunRef = (s: Services, reviewId: string, runId: string) => reviewCollection(s).doc(uuid.parse(reviewId)).collection('segmentedRuns').doc(uuid.parse(runId));
export const segmentedDispatches = (s: Services) => s.db.collection(`districts/${s.config.districtId}/segmentedDispatches`);
export const segmentedCounterRef = (s: Services) => s.db.doc(`districts/${s.config.districtId}/segmentedCounters/current`);
export const segmentedBudgetRef = (s: Services, day: string) => s.db.doc(`districts/${s.config.districtId}/assistanceBudgets/${day}`);
export const bytes = (data: unknown) => Buffer.byteLength(JSON.stringify(data), 'utf8');
export function segmentedBound<T>(data: T, maximum: number, label = 'Segmented record'): T {
  if (bytes(data) > maximum) throw new HttpError(413, `${label} exceeds its complete JSON byte bound; nothing was truncated.`);
  return data;
}
export function checked<T>(schema: z.ZodType<T>, value: unknown, maximum: number): T {
  try { return segmentedBound(schema.parse(value), maximum); }
  catch (e) { if (e instanceof HttpError) throw e; throw new HttpError(409, 'Invalid or unsupported segmented storage record.'); }
}
function required(snap: DocumentSnapshot) { if (!snap.exists) throw new HttpError(409, 'A segmented record is missing. Restore a verified backup.'); return snap.data(); }
export const rawHash = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
export function makeOutput(data: Uint8Array): SegmentedOutput {
  if (data.byteLength > L.transportBytes) throw new HttpError(413, 'Returned output exceeded the transport bound. No prefix was accepted.');
  return checked(segmentedOutputSchema, { version: 'segmented-output-v1', encoding: 'base64', sha256: rawHash(data), byteLength: data.byteLength, base64: Buffer.from(data).toString('base64') }, L.output);
}
export function outputBytes(raw: SegmentedOutput, id = raw.sha256): Buffer {
  checked(segmentedOutputSchema, raw, L.output); const result = Buffer.from(raw.base64, 'base64');
  if (result.toString('base64') !== raw.base64 || result.byteLength !== raw.byteLength || rawHash(result) !== id || raw.sha256 !== id) throw new HttpError(409, 'Original output bytes or hash changed.');
  return result;
}
export function outputText(raw: SegmentedOutput): string {
  const data = outputBytes(raw); new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(data);
  return data.toString('utf8');
}
export const findingBaseline = (review: Review, measureId: string) => {
  const found = review.analysis?.findings.find(f => f.id === measureId);
  // Saving one criterion creates blank rows for others. Those rows are still unreviewed.
  return digest(found || { id: measureId, finding: 'unresolved', quote: '', start: null, end: null });
};
export function createSegmentedSpec(review: Review): SegmentedSpec {
  if (!segmentedRecordingEligible(review)) throw new HttpError(409, 'Only the exact Lantern segmented review lab and its original practice definition have an authored recording.');
  const archive = newSegmentArchive(review.sourceBundle!, review.contract!);
  return checked(segmentedSpecSchema, { version: 'segmented-run-v1', bundleId: archive.bundle.id, textHash: archive.bundle.textHash,
    definitionId: archive.contract.id, planId: archive.plan.id, planVersion: archive.plan.version, ...SEGMENTED_RECORDING,
    segmentPrompt: 'evidence-segment-v1', segmentSchema: 'segment-candidates-v1', segmentValidator: 'segment-validator-v1',
    synthesisPrompt: 'evidence-synthesis-v1', synthesisSchema: 'segment-synthesis-v1', synthesisValidator: 'synthesis-validator-v1' }, L.spec);
}
export function makeRequest(scope: SegmentedRequest['scope'], request: { key: string } & Record<string, unknown>): SegmentedRequest {
  return checked(segmentedRequestSchema, { version: 'segmented-request-v1', scope, requestKey: request.key,
    dispatchKey: digest({ requestKey: request.key, ...SEGMENTED_RECORDING }), request }, L.request);
}
// Conservative, permanent admission charges include the whole future output/outcome envelopes,
// mutable lifecycle/index records, a quota record, and parent-owned history + command receipts.
// Unused reservation is not recycled, so failure/retry cannot evade retention limits.
export const SEGMENTED_START_RESERVATION = { bytes: L.head + L.spec + 8 * 4096, records: 10 };
export const SEGMENTED_ATTEMPT_RESERVATION = { bytes: L.request + L.attempt + L.output + L.outcome + 6 * 4096, records: 11 };
export function reserveSegmented(run: SegmentedRun, counter: SegmentedCounter, reservation: { bytes: number; records: number }) {
  const nextRun = { ...run, admittedBytes: run.admittedBytes + reservation.bytes, admittedRecords: run.admittedRecords + reservation.records };
  const nextCounter = { ...counter, admittedBytes: counter.admittedBytes + reservation.bytes, admittedRecords: counter.admittedRecords + reservation.records };
  if (nextRun.admittedBytes > L.runBytes || nextRun.admittedRecords > L.runRecords || nextCounter.admittedBytes > L.installationBytes || nextCounter.admittedRecords > L.installationRecords) throw new HttpError(429, 'Segmented retention admission limit reached. No records were discarded or truncated.');
  return { run: checked(segmentedRunSchema, nextRun, L.head), counter: checked(segmentedCounterSchema, nextCounter, 4096) };
}
export const emptySegmentedCounter = (): SegmentedCounter => ({ version: 'segmented-counters-v1', admittedBytes: 0, admittedRecords: 0 });
export type LoadedSegmentedRun = { ref: DocumentReference; run: SegmentedRun; spec: SegmentedSpec; review: Review; archive: SegmentArchive;
  attempts: SegmentedAttempt[]; requests: Map<string, SegmentedRequest>; outputs: Map<string, SegmentedOutput>; outcomes: Map<string, SegmentedOutcome>; logicalBytes: number };
export const scopeKey = (scope: SegmentedAttempt['scope']) => scope.kind === 'segment' ? scope.segmentId : 'synthesis';
export function durableEvidence(attempts: SegmentedAttempt[]) { return digest(attempts.filter(a => a.scope.kind === 'segment').map(a => ({ attemptId: a.id, sequence: a.sequence, outcomeId: a.outcomeId }))); }
function archiveAttempt(a: SegmentedAttempt, outcome: SegmentedOutcome, outputs: Map<string, SegmentedOutput>, requests: Map<string, SegmentedRequest>): SegmentAttempt {
  if (a.scope.kind !== 'segment') throw new HttpError(409, 'Synthesis is not segment evidence.');
  const request = requests.get(a.requestId)!;
  // Refused/incomplete/invalid UTF-8 are not usable evidence, but their original bytes remain stored.
  let raw: string | undefined;
  if (outcome.outputId && outcome.transportStatus === 'completed') {
    try { raw = outputText(outputs.get(outcome.outputId)!); } catch { /* Failed transport decoding. */ }
  }
  return { segmentId: a.scope.segmentId, requestKey: request.requestKey, outcome: raw === undefined ? { kind: 'failed', reason: outcome.reason || 'Attempt did not return usable text.' } : { kind: 'returned', raw } };
}
export function archiveForAttempts(loaded: LoadedSegmentedRun, ids?: string[]): SegmentArchive {
  const selected = ids ? ids.map(id => { const a = loaded.attempts.find(a => a.id === id); if (!a) throw new HttpError(409, 'Synthesis evidence reference is missing.'); return a; }) : loaded.attempts.filter(a => a.scope.kind === 'segment' && a.outcomeId);
  if (new Set(selected.map(a => a.id)).size !== selected.length || selected.some((a, i) => a.scope.kind !== 'segment' || !a.outcomeId || (i && a.sequence <= selected[i - 1].sequence))) throw new HttpError(409, 'Synthesis evidence order is invalid.');
  const archive = { ...loaded.archive, attempts: selected.map(a => archiveAttempt(a, loaded.outcomes.get(a.outcomeId!)!, loaded.outputs, loaded.requests)) };
  readSegmentArchive(archive); return archive;
}
export function evaluateSegmentedOutput(loaded: LoadedSegmentedRun, attempt: SegmentedAttempt, output: SegmentedOutput,
  status: 'completed' | 'refused' | 'incomplete'): { state: SegmentedOutcome['state']; reason: string } {
  if (status === 'refused') return { state: 'refused', reason: 'The recording refused this attempt. Original bytes are retained; no evidence was accepted.' };
  if (status === 'incomplete') return { state: 'incomplete', reason: 'The recording returned incomplete output. Original bytes are retained; no evidence was accepted.' };
  try {
    const raw = outputText(output);
    if (attempt.scope.kind === 'synthesis') validateSynthesis(archiveForAttempts(loaded, attempt.evidenceAttemptIds), raw);
    else {
      const view = readSegmentArchive({ ...loaded.archive, attempts: [{ segmentId: attempt.scope.segmentId,
        requestKey: loaded.requests.get(attempt.requestId)!.requestKey, outcome: { kind: 'returned', raw } }] });
      if (view.attempts[0].state !== 'validated') throw new Error();
    }
    return { state: 'validated', reason: 'Original output validated against its exact saved request. Human interpretation is still required.' };
  } catch { return { state: 'invalid', reason: 'Original output failed UTF-8, schema or evidence validation. Its complete bounded bytes remain inspectable.' }; }
}
export function completeSegmentedAttempt(tx: Transaction, loaded: LoadedSegmentedRun, attempt: SegmentedAttempt,
  result: { state: SegmentedOutcome['state']; reason: string; transportStatus: SegmentedOutcome['transportStatus']; output?: SegmentedOutput; transportByteLength?: number },
  eligible: boolean, ineligibleReason: string) {
  if (attempt.outcomeId) throw new HttpError(409, 'A final attempt outcome cannot be replaced.');
  const outputId = result.output?.sha256 || null;
  const outcome = checked(segmentedOutcomeSchema, { version: 'segmented-outcome-v1', attemptId: attempt.id, requestId: attempt.requestId,
    specId: loaded.run.specId, outputId, state: result.state, validator: attempt.scope.kind === 'segment' ? 'segment-validator-v1' : 'synthesis-validator-v1',
    scope: attempt.scope, evidenceGeneration: attempt.evidenceGeneration, evidenceRevision: attempt.evidenceRevision,
    reason: result.reason, transportStatus: result.transportStatus, transportByteLength: result.output?.byteLength ?? result.transportByteLength ?? null }, L.outcome);
  const outcomeId = digest(outcome), at = new Date().toISOString();
  const final = checked(segmentedAttemptSchema, { ...attempt, status: result.state === 'validated' ? 'completed' : result.state === 'cancelled' ? 'cancelled' : 'failed',
    outputId, outcomeId, eligibleAtCompletion: eligible, ineligibleReason, settled: true, leaseUntil: 0, updatedAt: at, message: result.reason }, L.attempt);
  const run = checked(segmentedRunSchema, { ...loaded.run, revision: loaded.run.revision + 1, activeAttemptId: null, updatedAt: at,
    ...(attempt.scope.kind === 'synthesis' && eligible && result.state === 'validated' ? { currentOutcomeId: outcomeId, currentSynthesisAttemptId: attempt.id } : {}) }, L.head);
  if (result.output && !loaded.outputs.has(outputId!)) tx.create(loaded.ref.collection(SEGMENTED_COLLECTIONS.outputs).doc(outputId!), result.output);
  tx.create(loaded.ref.collection(SEGMENTED_COLLECTIONS.outcomes).doc(outcomeId), outcome);
  tx.set(loaded.ref.collection(SEGMENTED_COLLECTIONS.attempts).doc(attempt.id), final);
  tx.set(loaded.ref, run);
  tx.set(loaded.ref.firestore.doc(`districts/${loaded.ref.path.split('/')[1]}/segmentedDispatches/${attempt.id}`),
    checked(segmentedDispatchSchema, { version: 'segmented-dispatch-v1', id: attempt.id, reviewId: run.reviewId, runId: run.id,
      compatibility: 'authored-recording:lantern-segmented-v1:recording-v1', ready: false, leaseUntil: 0, settled: true }, 4096));
  return { run, attempt: final, outcome, outcomeId };
}
export async function loadSegmentedRun(s: Services, tx: Transaction, review: Review, runId: string): Promise<LoadedSegmentedRun> {
  if (review.segmentedStorageVersion !== 1 || !review.segmentedRunId || !review.segmentedRunCount || review.segmentedRunCount > L.runs) throw new HttpError(409, 'Segmented review marker is missing or unsupported.');
  const heads = await tx.get(reviewCollection(s).doc(review.id).collection('segmentedRuns').limit(L.runs + 1));
  if (heads.size !== review.segmentedRunCount || !heads.docs.some(d => d.id === review.segmentedRunId)) throw new HttpError(409, 'Segmented run count or current pointer is inconsistent.');
  const ref = segmentedRunRef(s, review.id, runId), run = checked(segmentedRunSchema, required(await tx.get(ref)), L.head);
  if (run.id !== runId || run.reviewId !== review.id || Object.keys(run.baselineFindings).sort().join() !== measuresFor(review).map(m => m.id).sort().join()) throw new HttpError(409, 'Segmented run identity mismatch.');
  const spec = checked(segmentedSpecSchema, required(await tx.get(ref.collection(SEGMENTED_COLLECTIONS.specs).doc(run.specId))), L.spec);
  if (digest(spec) !== run.specId || digest(createSegmentedSpec(review)) !== run.specId) throw new HttpError(409, 'Segmented spec does not match the saved source and definition.');
  const snap = await tx.get(ref.collection(SEGMENTED_COLLECTIONS.attempts).limit(L.attempts + 1));
  const attempts = snap.docs.map(d => { const a = checked(segmentedAttemptSchema, d.data(), L.attempt); if (a.id !== d.id || a.runId !== runId || a.reviewId !== review.id) throw new HttpError(409, 'Attempt identity mismatch.'); return a; }).sort((a,b) => a.sequence - b.sequence);
  if (attempts.length !== run.attemptCount || run.evidenceGeneration !== run.attemptCount || attempts.some((a, i) => a.sequence !== i + 1 || a.evidenceGeneration !== a.sequence)) throw new HttpError(409, 'Attempt sequence, generation or count mismatch.');
  if (run.admittedBytes !== SEGMENTED_START_RESERVATION.bytes + run.attemptCount * SEGMENTED_ATTEMPT_RESERVATION.bytes
    || run.admittedRecords !== SEGMENTED_START_RESERVATION.records + run.attemptCount * SEGMENTED_ATTEMPT_RESERVATION.records) throw new HttpError(409, 'Run admission reservation does not match its exact retained attempt count.');
  const requests = new Map<string, SegmentedRequest>(), outputs = new Map<string, SegmentedOutput>(), outcomes = new Map<string, SegmentedOutcome>();
  let logicalBytes = bytes(run) + bytes(spec) + attempts.reduce((n, a) => n + bytes(a), 0);
  const get = async <T>(name: keyof typeof SEGMENTED_COLLECTIONS, ids: string[], schema: z.ZodType<T>, maximum: number, map: Map<string, T>) => {
    const unique = [...new Set(ids)]; if (!unique.length) return;
    const records = await tx.getAll(...unique.map(id => ref.collection(SEGMENTED_COLLECTIONS[name]).doc(hash.parse(id))));
    records.forEach((d, i) => { const value = checked(schema, required(d), maximum); if (name === 'outputs') outputBytes(value as SegmentedOutput, unique[i]); else if (digest(value) !== unique[i]) throw new HttpError(409, 'Immutable segmented record hash mismatch.'); map.set(unique[i], value); logicalBytes += bytes(value); });
  };
  await get('requests', attempts.map(a => a.requestId), segmentedRequestSchema, L.request, requests);
  await get('outcomes', attempts.flatMap(a => a.outcomeId ? [a.outcomeId] : []), segmentedOutcomeSchema, L.outcome, outcomes);
  await get('outputs', attempts.flatMap(a => a.outputId ? [a.outputId] : []), segmentedOutputSchema, L.output, outputs);
  const loaded: LoadedSegmentedRun = { ref, run, spec, review, archive: newSegmentArchive(review.sourceBundle!, review.contract!), attempts, requests, outcomes, outputs, logicalBytes };
  for (const a of attempts) {
    const sameScope = attempts.filter(b => scopeKey(b.scope) === scopeKey(a.scope) && b.sequence <= a.sequence);
    if (sameScope.length !== a.ordinal || sameScope.length > L.perScope) throw new HttpError(409, 'Attempt ordinal mismatch.');
    const request = requests.get(a.requestId)!;
    if (digest(request.scope) !== digest(a.scope) || request.dispatchKey !== a.dispatchKey) throw new HttpError(409, 'Attempt request identity mismatch.');
    const prefix = attempts.filter(v => v.scope.kind === 'segment' && v.sequence < a.sequence);
    if (prefix.some(v => !v.outcomeId) || durableEvidence(prefix) !== a.evidenceRevision
      || digest(a.evidenceAttemptIds) !== digest(a.scope.kind === 'synthesis' ? prefix.map(v => v.id) : [])) throw new HttpError(409, 'Attempt evidence must bind the complete ordered historical segment prefix.');
    const archive = a.scope.kind === 'synthesis' ? archiveForAttempts(loaded, a.evidenceAttemptIds) : loaded.archive;
    const expected = a.scope.kind === 'synthesis' ? buildSynthesisRequest(archive) : archive.requests.find(r => r.segment.id === (a.scope.kind === 'segment' ? a.scope.segmentId : ''));
    if (!expected || digest(makeRequest(a.scope, expected)) !== a.requestId) throw new HttpError(409, 'Stored request cannot be reconstructed from its immutable inputs.');
    if (a.scope.kind === 'synthesis' && durableEvidence(attempts.filter(v => a.evidenceAttemptIds.includes(v.id))) !== a.evidenceRevision) throw new HttpError(409, 'Synthesis durable evidence binding changed.');
    if (a.outcomeId) {
      const outcome = outcomes.get(a.outcomeId)!;
      if (outcome.attemptId !== a.id || outcome.requestId !== a.requestId || outcome.outputId !== a.outputId || outcome.specId !== run.specId || digest(outcome.scope) !== digest(a.scope) || outcome.evidenceGeneration !== a.evidenceGeneration || outcome.evidenceRevision !== a.evidenceRevision) throw new HttpError(409, 'Attempt outcome binding mismatch.');
      if (!a.settled || !['completed','failed','cancelled'].includes(a.status)) throw new HttpError(409, 'Final outcome has a non-final lifecycle.');
      if (outcome.outputId) {
        const output = outputs.get(outcome.outputId)!;
        if (!a.dispatched || outcome.transportByteLength !== output.byteLength || outcome.transportStatus === 'not_returned') throw new HttpError(409, 'Returned output transport metadata is inconsistent.');
        const classified = evaluateSegmentedOutput(loaded, a, output, outcome.transportStatus);
        if (classified.state !== outcome.state || classified.reason !== outcome.reason) throw new HttpError(409, 'Stored output classification cannot be reproduced.');
      } else if (!['failed','cancelled','overflow'].includes(outcome.state) || (outcome.state !== 'overflow' && (outcome.transportStatus !== 'not_returned' || outcome.transportByteLength !== null || a.dispatched))
        || (outcome.state === 'overflow' && (!a.dispatched || outcome.transportStatus === 'not_returned' || outcome.transportByteLength === null || outcome.transportByteLength <= L.transportBytes))) throw new HttpError(409, 'Outcome classification lacks its original return or overflow metadata.');
      if (a.status !== (outcome.state === 'validated' ? 'completed' : outcome.state === 'cancelled' ? 'cancelled' : 'failed') || (a.eligibleAtCompletion && outcome.state !== 'validated')) throw new HttpError(409, 'Outcome and lifecycle states disagree.');
    } else if (a.outputId || a.settled || ['completed','failed','cancelled'].includes(a.status)) throw new HttpError(409, 'Attempt lost its immutable outcome.');
  }
  const active = attempts.filter(a => !a.outcomeId);
  if (active.length > 1 || (active[0]?.id || null) !== run.activeAttemptId || (active.length && run.currentOutcomeId)) throw new HttpError(409, 'Active attempt pointer is inconsistent.');
  if (run.currentOutcomeId) {
    const a = attempts.find(a => a.id === run.currentSynthesisAttemptId);
    if (!a || a.scope.kind !== 'synthesis' || a.outcomeId !== run.currentOutcomeId || !a.eligibleAtCompletion || a.evidenceGeneration !== run.evidenceGeneration || outcomes.get(a.outcomeId)?.state !== 'validated') throw new HttpError(409, 'Current proposal pointer is inconsistent.');
  } else if (run.currentSynthesisAttemptId) throw new HttpError(409, 'Current synthesis pointer is incomplete.');
  if (logicalBytes > run.admittedBytes) throw new HttpError(409, 'Retained records exceed their admitted storage.');
  return loaded;
}

/** Full bounded installation scan, read-only. Unique collection names let it reject orphaned child
 * records even when a run/review marker was removed. Maintenance remains the caller's authority. */
async function scanSegmentedInstallation(s: Services, options: { maintenanceId?: string } = {}) {
  if (options.maintenanceId && (await s.db.doc('installation/maintenance').get()).get('id') !== options.maintenanceId) throw new Error('Segmented validation requires the caller\'s maintenance lock.');
  const districtPrefix = `districts/${s.config.districtId}/`, records = new Map<string, unknown>();
  for (const name of ['segmentedRuns', ...Object.values(SEGMENTED_COLLECTIONS), 'segmentedDispatches', 'segmentedCounters']) {
    const page = await s.db.collectionGroup(name).limit(L.installationRecords + 1).get();
    if (page.size > L.installationRecords) throw new Error('Segmented installation exceeds its record scan bound.');
    for (const doc of page.docs) {
      if (!doc.ref.path.startsWith(districtPrefix)) throw new Error('Segmented record belongs to another installation district.');
      records.set(doc.ref.path, doc.data());
    }
  }
  const runs = [...records.keys()].filter(p => /^districts\/[^/]+\/reviews\/[^/]+\/segmentedRuns\/[^/]+$/.test(p));
  const consumed = new Set<string>(), reviewCounts = new Map<string, number>(), loadedRuns: LoadedSegmentedRun[] = [], reviewIds: string[] = [];
  const runTotals = new Map<string, { bytes: number; records: number }>(); let admittedBytes = 0, admittedRecords = 0;
  for (const path of runs) {
    const [, , , reviewId, , runId] = path.split('/');
    const loaded = await s.db.runTransaction(async tx => loadSegmentedRun(s, tx, await readReview(s, tx, reviewId), runId));
    loadedRuns.push(loaded);
    const expectedBytes = SEGMENTED_START_RESERVATION.bytes + loaded.run.attemptCount * SEGMENTED_ATTEMPT_RESERVATION.bytes;
    const expectedRecords = SEGMENTED_START_RESERVATION.records + loaded.run.attemptCount * SEGMENTED_ATTEMPT_RESERVATION.records;
    if (loaded.run.admittedBytes !== expectedBytes || loaded.run.admittedRecords !== expectedRecords) throw new Error('Run reservation does not match admitted commands.');
    const totals = { bytes: loaded.logicalBytes, records: 2 + loaded.requests.size + loaded.outputs.size + loaded.outcomes.size + loaded.attempts.length };
    runTotals.set(runId, totals);
    const marker = loaded.review as Review & { segmentedStorageVersion?: number; segmentedRunCount?: number; segmentedRunId?: string };
    if (marker.segmentedStorageVersion !== 1 || !marker.segmentedRunId || !marker.segmentedRunCount) throw new Error('Segmented review marker is missing.');
    reviewCounts.set(reviewId, (reviewCounts.get(reviewId) || 0) + 1); admittedBytes += loaded.run.admittedBytes; admittedRecords += loaded.run.admittedRecords;
    consumed.add(path); consumed.add(`${path}/${SEGMENTED_COLLECTIONS.specs}/${loaded.run.specId}`);
    for (const [kind, map] of [['requests', loaded.requests], ['outputs', loaded.outputs], ['outcomes', loaded.outcomes]] as const) for (const id of map.keys()) consumed.add(`${path}/${SEGMENTED_COLLECTIONS[kind]}/${id}`);
    for (const a of loaded.attempts) {
      consumed.add(`${path}/${SEGMENTED_COLLECTIONS.attempts}/${a.id}`);
      const p = segmentedDispatches(s).doc(a.id).path, index = checked(segmentedDispatchSchema, records.get(p), 4096);
      if (index.id !== a.id || index.reviewId !== reviewId || index.runId !== runId || index.settled !== a.settled || index.ready !== !a.settled || index.leaseUntil !== a.leaseUntil) throw new Error('Dispatch index does not match its retained attempt.');
      consumed.add(p);
      totals.bytes += bytes(index); totals.records++;
    }
  }
  // Check every review head in bounded pages: a marker with no run is corruption, too.
  let cursor: string | undefined;
  while (true) {
    let query = reviewCollection(s).orderBy(FieldPath.documentId()).limit(20); if (cursor) query = query.startAfter(cursor);
    const page = await query.get(); if (page.empty) break;
    for (const d of page.docs) {
      reviewIds.push(d.id);
      const count = reviewCounts.get(d.id) || 0;
      if (count > L.runs || (d.get('segmentedRunCount') || 0) !== count || (!!d.get('segmentedStorageVersion')) !== !!count || (count && !records.has(`${d.ref.path}/segmentedRuns/${d.get('segmentedRunId')}`))) throw new Error('Segmented review counts or current pointer are inconsistent.');
      if (d.get('evidenceVersion') === 7 && !count) throw new Error('Version-seven human evidence has lost its segmented run graph.');
    }
    cursor = page.docs.at(-1)!.id;
  }
  if (admittedBytes > L.installationBytes || admittedRecords > L.installationRecords) throw new Error('Total segmented admission exceeds installation limits.');
  const counterPath = segmentedCounterRef(s).path;
  if (records.has(counterPath)) {
    const counter = checked(segmentedCounterSchema, records.get(counterPath), 4096);
    if (counter.admittedBytes !== admittedBytes || counter.admittedRecords !== admittedRecords) throw new Error('Segmented installation reservation counters disagree.');
    consumed.add(counterPath);
  } else if (runs.length) throw new Error('Segmented installation reservation counter is missing.');
  if ([...records.keys()].some(p => !consumed.has(p))) throw new Error('Unreferenced or misplaced segmented records were found.');
  let logicalBytes = [...records.values()].reduce<number>((n, d) => n + bytes(d), 0), recordCount = records.size;
  // Parent receipts/history are part of the reservation. Their identities and bounded payloads
  // are retained independently, rather than an unbounded per-poll event stream.
  const parentCounts = new Map<string, number>();
  for (const collection of ['history', 'entries']) {
    const page = await s.db.collectionGroup(collection).where('segmented.version', '==', 'segmented-command-v1').limit(L.installationRecords + 1).get();
    if (page.size > L.installationRecords) throw new Error('Segmented command records exceed their scan bound.');
    for (const doc of page.docs) {
      const d = doc.data(), runId = d.segmented?.runId;
      if (!doc.ref.path.startsWith(districtPrefix) || !runs.some(p => p.endsWith(`/segmentedRuns/${runId}`))) throw new Error('Segmented command points at an unknown run.');
      segmentedBound(d, 4096, 'Segmented command record'); logicalBytes += bytes(d); recordCount++; parentCounts.set(runId, (parentCounts.get(runId) || 0) + 1);
      const totals = runTotals.get(runId)!; totals.bytes += bytes(d); totals.records++;
    }
  }
  // History uses details.segmented in the established event shape.
  const histories = await s.db.collectionGroup('history').where('details.segmented.version', '==', 'segmented-command-v1').limit(L.installationRecords + 1).get();
  if (histories.size > L.installationRecords) throw new Error('Segmented history exceeds its scan bound.');
  for (const doc of histories.docs) {
    const d = doc.data(), runId = d.details.segmented.runId;
    if (!doc.ref.path.startsWith(districtPrefix) || !runs.some(p => p.endsWith(`/segmentedRuns/${runId}`))) throw new Error('Segmented history points at an unknown run.');
    segmentedBound(d, 4096, 'Segmented history'); logicalBytes += bytes(d); recordCount++; parentCounts.set(runId, (parentCounts.get(runId) || 0) + 1);
    const totals = runTotals.get(runId)!; totals.bytes += bytes(d); totals.records++;
  }
  if (logicalBytes > L.installationBytes || recordCount > L.installationRecords || (records.size && (logicalBytes > admittedBytes || recordCount > admittedRecords))) throw new Error('Segmented installation exceeds admitted storage.');
  for (const path of runs) { const r = records.get(path) as SegmentedRun, total = runTotals.get(r.id)!;
    if ((parentCounts.get(r.id) || 0) > 2 * (r.attemptCount + 2)) throw new Error('Segmented command retention count exceeds its mutation bound.');
    if (total.bytes > r.admittedBytes || total.records > r.admittedRecords || total.bytes > L.runBytes || total.records > L.runRecords) throw new Error('Run retained storage exceeds its admission bounds.');
  }
  if (options.maintenanceId && (await s.db.doc('installation/maintenance').get()).get('id') !== options.maintenanceId) throw new Error('Segmented validation lost its maintenance lock.');
  return { hasArtifacts: records.size > 0, runCount: runs.length, recordCount, logicalBytes, loadedRuns, reviewIds };
}

const receiptSchema = z.object({ id: uuid, hash, route: z.string().max(256), actorUid: actor, reviewId: uuid,
  appliedRevision: number.positive(), at: date, segmented: segmentedReceiptEffectSchema }).strict();
const historySchema = z.object({ action: z.string(), actorUid: actor, at: date, revision: number.positive(), details: z.record(z.string(), z.unknown()) }).strict();
async function validateCommandBindings(s: Services, loaded: LoadedSegmentedRun, usedReceipts: Set<string>) {
  const r = loaded.run;
  if (r.startCommand.actorUid !== r.actorUid || r.startCommand.appliedReviewRevision !== r.baseReviewRevision || r.startCommand.appliedRunRevision !== 1
    || ((r.status === 'cancelled') !== !!r.cancelCommand)) throw new Error('Run command identity does not match its lifecycle.');
  const expected = [
    { binding: r.startCommand, action: 'start_segmented_run', body: { action: 'start_segmented_run', revision: r.baseReviewRevision - 1 },
      effect: { version: 'segmented-command-v1', runId: r.id, runRevision: 1 }, details: { runId: r.id } },
    ...loaded.attempts.map(a => ({ binding: a.command, action: 'run_segmented_attempt',
      body: { action: 'run_segmented_attempt', revision: a.command.appliedReviewRevision, runId: r.id, runRevision: a.command.appliedRunRevision - 1, scope: a.scope },
      effect: { version: 'segmented-command-v1', runId: r.id, attemptId: a.id, runRevision: a.command.appliedRunRevision }, details: { runId: r.id, attemptId: a.id, scope: a.scope } })),
    ...(r.cancelCommand ? [{ binding: r.cancelCommand, action: 'cancel_segmented_run',
      body: { action: 'cancel_segmented_run', revision: r.cancelCommand.appliedReviewRevision - 1, runId: r.id, runRevision: r.cancelCommand.appliedRunRevision - 1 },
      effect: { version: 'segmented-command-v1', runId: r.id, runRevision: r.cancelCommand.appliedRunRevision }, details: { runId: r.id } }] : []),
  ];
  const history = await reviewCollection(s).doc(r.reviewId).collection('history').where('details.segmented.runId', '==', r.id).limit(L.attempts + 3).get();
  if (history.size !== expected.length) throw new Error('Required segmented command history is missing or duplicated.');
  for (const e of expected) {
    const binding = e.binding, path = `districts/${s.config.districtId}/commandReceipts/${binding.actorUid}/entries/${binding.id}`;
    if (binding.route !== `/api/reviews/${r.reviewId}` || binding.appliedRunRevision > r.revision || commandIdentity(binding.id, binding.route, e.body).hash !== binding.hash || usedReceipts.has(path)) throw new Error('Segmented command binding is invalid or reused.');
    usedReceipts.add(path);
    const receipt = checked(receiptSchema, (await s.db.doc(path).get()).data(), 4096);
    if (receipt.id !== binding.id || receipt.hash !== binding.hash || receipt.route !== binding.route || receipt.actorUid !== binding.actorUid
      || receipt.reviewId !== r.reviewId || receipt.appliedRevision !== binding.appliedReviewRevision || digest(receipt.segmented) !== digest(e.effect)) throw new Error('Required segmented command receipt does not match its exact saved effect.');
    const events = history.docs.map(d => checked(historySchema, d.data(), 4096)).filter(d => digest(d.details.segmented) === digest(e.effect));
    if (events.length !== 1 || events[0].action !== e.action || events[0].actorUid !== binding.actorUid || events[0].revision !== binding.appliedReviewRevision
      || digest(events[0].details) !== digest({ ...e.details, segmented: e.effect })) throw new Error('Segmented history does not match its exact command effect.');
  }
  for (const a of loaded.attempts) if (a.command.actorUid !== a.actorUid || a.command.appliedReviewRevision !== r.baseReviewRevision) throw new Error('Attempt command actor or base review revision changed.');
}

/** Validates all historical evaluations independently of run markers. An installation with its
 * entire run graph deleted must not pass merely because only the dangling v7 findings remain. */
export async function validateSegmentedInstallation(s: Services, options: { maintenanceId?: string } = {}) {
  const { loadedRuns, reviewIds, ...result } = await scanSegmentedInstallation(s, options);
  const usedReceipts = new Set<string>(); for (const loaded of loadedRuns) await validateCommandBindings(s, loaded, usedReceipts);
  const referencedFindings = new Set<string>();
  for (const reviewId of reviewIds) {
    let cursor: string | undefined;
    while (true) {
      let query = reviewCollection(s).doc(reviewId).collection('evaluations').orderBy(FieldPath.documentId()).limit(20); if (cursor) query = query.startAfter(cursor);
      const page = await query.get(); if (page.empty) break;
      for (const doc of page.docs) {
        const stored = await s.db.runTransaction(tx => readEvaluation(s, tx, reviewId, doc.id));
        const analysis = stored.analysis, attributed = analysis.findings.filter(f => f.segmentedProvenance);
        if ((analysis.schemaVersion === 'findings-v7') !== (analysis.adapterVersion === 'human-evidence-v6') || (attributed.length && analysis.schemaVersion !== 'findings-v7')) throw new Error('Segmented human finding version pair is invalid.');
        if (analysis.schemaVersion === 'findings-v7' && !attributed.length) throw new Error('Version-seven evaluation lost every attributed finding.');
        for (const finding of attributed) {
          const provenance = segmentedProvenanceSchema.parse(finding.segmentedProvenance), ref = provenance.reference;
          const loaded = loadedRuns.find(r => r.review.id === reviewId && r.run.id === ref.runId);
          if (!loaded) throw new Error('Historical human provenance refers to a missing segmented run.');
          const attempt = loaded.attempts.find(a => a.id === ref.synthesisAttemptId), outcome = loaded.outcomes.get(ref.outcomeId);
          if (!attempt || attempt.scope.kind !== 'synthesis' || !attempt.eligibleAtCompletion || attempt.outcomeId !== ref.outcomeId || attempt.evidenceRevision !== ref.evidenceRevision
            || !outcome?.outputId || outcome.state !== 'validated' || finding.id !== ref.measureId || analysis.sourceHash !== provenance.bundleId
            || stored.contract.id !== provenance.definitionId || loaded.spec.bundleId !== provenance.bundleId || loaded.spec.textHash !== provenance.textHash || loaded.spec.planId !== provenance.planId) throw new Error('Historical human provenance does not match its immutable source, result or evidence snapshot.');
          const validated = validateSynthesis(archiveForAttempts(loaded, attempt.evidenceAttemptIds), outputText(loaded.outputs.get(outcome.outputId)!));
          const targetIds = validated.findings.filter(f => f.target === finding.id || f.target.startsWith(`${finding.id}/`)).map(f => f.target);
          if (digest(targetIds) !== digest(ref.targetIds) || !targetIds.length || !finding.reviewedBy || !finding.reviewedAt
            || finding.context?.scope !== SEGMENTED_HANDOFF_SCOPE || finding.context?.question !== SEGMENTED_HANDOFF_QUESTION || finding.context?.uncertainty !== 'scope') throw new Error('Historical human qualifications or complete target binding changed.');
          referencedFindings.add(`${reviewCollection(s).doc(reviewId).path}/findings/${digest(finding)}`);
        }
      }
      cursor = page.docs.at(-1)!.id;
    }
  }
  // Walk finding documents independently too. An orphaned attributed finding is corruption even
  // when every evaluation, review marker and run record that used to reference it was removed.
  // Existing human history is streamed in pages; the run-owned 1600-record admission cap does not
  // impose a new limit on valid old-format human corrections. Native backup remains size bounded.
  let findingCursor: DocumentReference | undefined;
  while (true) {
    let query = s.db.collectionGroup('findings').orderBy(FieldPath.documentId()).limit(20); if (findingCursor) query = query.startAfter(findingCursor);
    const page = await query.get(); if (page.empty) break;
    for (const doc of page.docs) {
      const finding = doc.data(); if (finding.segmentedProvenance === undefined) continue;
      segmentedProvenanceSchema.parse(finding.segmentedProvenance);
      if (!doc.ref.path.startsWith(`districts/${s.config.districtId}/reviews/`) || digest(finding) !== doc.id || !referencedFindings.has(doc.ref.path)) throw new Error('An orphaned or changed attributed finding has no verified historical evaluation and run graph.');
    }
    findingCursor = page.docs.at(-1)!.ref;
  }
  if (options.maintenanceId && (await s.db.doc('installation/maintenance').get()).get('id') !== options.maintenanceId) throw new Error('Segmented validation lost its maintenance lock.');
  return result;
}
