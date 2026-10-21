import { randomUUID } from 'node:crypto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Transaction } from 'firebase-admin/firestore';
import type { Services } from './firebase.ts';
import type { CommandIdentity } from './commands.ts';
import type { Review } from '../shared/review.ts';
import { measuresFor } from '../shared/evaluation.ts';
import { sourceCoverage } from '../shared/source-bundle.ts';
import { blankRequirementReview } from '../shared/requirements.ts';
import { SEGMENTED_LIMITS as L, SEGMENTED_HANDOFF_QUESTION, SEGMENTED_HANDOFF_SCOPE, segmentedActionSchema, segmentedProposalRefSchema,
  type SegmentedAction, type SegmentedReceiptEffect, type SegmentedRunSummary, type SegmentedRunsView, type SegmentedRunView,
  type SegmentedAttemptView, type SegmentedProposalRef, type SegmentedProposalView, type SegmentedProvenance, type SegmentedDraftSeed,
  type SegmentedRequestView, type SegmentedOutputView, type SegmentedReviewMarker } from '../shared/segmented-assistance.ts';
import { HttpError, assertWritable, requireMember, membersRef } from './operations.ts';
import { readReview, reviewCollection } from './review-storage.ts';
import { digest } from './evaluation.ts';
import { buildSynthesisRequest, readSegmentArchive, validateSynthesis } from './analysis/segments.ts';
import { segmentedRecordingEligible } from './analysis/segmented-recording.ts';
import { SEGMENTED_COLLECTIONS as C, SEGMENTED_START_RESERVATION, SEGMENTED_ATTEMPT_RESERVATION, segmentedRunRef, segmentedDispatches,
  segmentedCounterRef, segmentedBudgetRef, emptySegmentedCounter, segmentedCounterSchema, segmentedRunSchema, segmentedAttemptSchema, segmentedDispatchSchema,
  loadSegmentedRun, checked, segmentedBound, reserveSegmented, createSegmentedSpec, makeRequest, findingBaseline, scopeKey,
  durableEvidence, archiveForAttempts, outputText, completeSegmentedAttempt, type LoadedSegmentedRun, type SegmentedRun, type SegmentedAttempt } from './segmented-review-storage.ts';

const now = () => new Date().toISOString();
const unchangedError = () => new HttpError(409, 'This run changed. Reload its saved status before issuing another command.');
async function requireEditor(s: Services, tx: Transaction, actor: DecodedIdToken) {
  await assertWritable(s, tx); requireMember((await tx.get(membersRef(s).doc(actor.uid))).data(), actor, ['admin','reviewer']);
}
function bindCommand(command: CommandIdentity | undefined, actor: DecodedIdToken, appliedReviewRevision: number, appliedRunRevision: number) {
  if (!command) throw new HttpError(400, 'Segmented commands require a durable command identity.');
  return { ...command, actorUid: actor.uid, appliedReviewRevision, appliedRunRevision };
}
export async function prepareSegmentedAction(s: Services, tx: Transaction, actor: DecodedIdToken, review: Review, raw: SegmentedAction, command?: CommandIdentity): Promise<{ details: Record<string, unknown>; effect: SegmentedReceiptEffect; reviewChanged: boolean }> {
  const input = segmentedActionSchema.parse(raw); await requireEditor(s, tx, actor);
  if (review.revision !== input.revision) throw new HttpError(409, 'This review changed. Keep the original draft and refresh before another action.');
  const r = review as Review & SegmentedReviewMarker;
  if (input.action === 'start_segmented_run') {
    const spec = createSegmentedSpec(review);
    const existing = await tx.get(reviewCollection(s).doc(review.id).collection('segmentedRuns').limit(L.runs + 1));
    const prior = existing.docs.map(d => checked(segmentedRunSchema, d.data(), L.head));
    if (prior.length !== (r.segmentedRunCount || 0) || prior.length >= L.runs) throw new HttpError(429, 'This review retains at most two segmented runs.');
    if (prior.some(v => v.status === 'open' || v.activeAttemptId)) throw new HttpError(409, 'Cancel the open run and settle its active attempt before starting another.');
    const counterSnap = await tx.get(segmentedCounterRef(s));
    const counter = counterSnap.exists ? checked(segmentedCounterSchema, counterSnap.data(), 4096) : emptySegmentedCounter();
    const id = randomUUID(), at = now();
    const head: SegmentedRun = { version: 'segmented-run-head-v1', id, reviewId: review.id, specId: digest(spec), actorUid: actor.uid, actorEmail: actor.email!,
      baseReviewRevision: review.revision + 1, baselineFindings: Object.fromEntries(measuresFor(review).map(m => [m.id, findingBaseline(review, m.id)])),
      revision: 1, status: 'open', createdAt: at, updatedAt: at, evidenceGeneration: 0, attemptCount: 0, activeAttemptId: null,
      currentOutcomeId: null, currentSynthesisAttemptId: null, admittedBytes: 0, admittedRecords: 0,
      startCommand: bindCommand(command, actor, review.revision + 1, 1), cancelCommand: null };
    const reserved = reserveSegmented(head, counter, SEGMENTED_START_RESERVATION), ref = segmentedRunRef(s, review.id, id);
    tx.create(ref, reserved.run); tx.create(ref.collection(C.specs).doc(head.specId), spec); tx.set(segmentedCounterRef(s), reserved.counter);
    r.segmentedStorageVersion = 1; r.segmentedRunId = id; r.segmentedRunCount = prior.length + 1;
    return { details: { runId: id }, effect: { version: 'segmented-command-v1', runId: id, runRevision: 1 }, reviewChanged: true };
  }
  const loaded = await loadSegmentedRun(s, tx, review, input.runId), run = loaded.run;
  if (r.segmentedRunId !== run.id || run.revision !== input.runRevision) throw unchangedError();
  if (run.status !== 'open') throw new HttpError(409, 'This run is cancelled. Its retained evidence is historical.');
  if (input.action === 'cancel_segmented_run') {
    const active = loaded.attempts.find(a => a.id === run.activeAttemptId);
    if (active) checked(segmentedDispatchSchema, (await tx.get(segmentedDispatches(s).doc(active.id))).data(), 4096);
    const cancelled = checked(segmentedRunSchema, { ...run, status: 'cancelled', updatedAt: now(), currentOutcomeId: null, currentSynthesisAttemptId: null,
      cancelCommand: bindCommand(command, actor, review.revision + 1, run.revision + 1) }, L.head);
    if (active && !active.dispatched) completeSegmentedAttempt(tx, { ...loaded, run: cancelled }, active,
      { state: 'cancelled', reason: 'Cancelled before dispatch. No recording was executed.', transportStatus: 'not_returned' }, false, 'run_cancelled');
    else tx.set(loaded.ref, { ...cancelled, revision: run.revision + 1 });
    return { details: { runId: run.id }, effect: { version: 'segmented-command-v1', runId: run.id, runRevision: run.revision + 1 }, reviewChanged: true };
  }
  if (run.activeAttemptId) throw new HttpError(409, 'An attempt is still active or has an unknown outcome. Resolve it before starting another.');
  if (review.revision !== run.baseReviewRevision) throw new HttpError(409, 'The review changed after this run started. Retained proposals may still be reviewed, but a new attempt requires a new run.');
  const ordinal = loaded.attempts.filter(a => scopeKey(a.scope) === scopeKey(input.scope)).length + 1;
  if (ordinal > L.perScope || run.attemptCount >= L.attempts) throw new HttpError(429, 'The preserved attempt limit has been reached.');
  const archive = archiveForAttempts(loaded);
  const request = input.scope.kind === 'segment' ? archive.requests.find(v => v.segment.id === (input.scope.kind === 'segment' ? input.scope.segmentId : '')) : buildSynthesisRequest(archive);
  if (!request) throw new HttpError(400, 'This segment does not belong to the frozen source plan.');
  const savedRequest = makeRequest(input.scope, request), requestId = digest(savedRequest), at = now();
  const counterSnap = await tx.get(segmentedCounterRef(s)), counter = checked(segmentedCounterSchema, counterSnap.data(), 4096);
  const quotaRef = segmentedBudgetRef(s, at.slice(0, 10)), ledger = await tx.get(quotaRef);
  if ((ledger.get('count') || 0) >= L.dailyDispatches) throw new HttpError(429, 'The local assistance admission limit is 100 attempts per UTC day.');
  const id = randomUUID(), evidenceGeneration = run.evidenceGeneration + 1;
  const attempt = checked(segmentedAttemptSchema, { version: 'segmented-attempt-v1', id, reviewId: review.id, runId: run.id, scope: input.scope,
    ordinal, sequence: run.attemptCount + 1, requestId, actorUid: actor.uid, actorEmail: actor.email!, status: 'queued', lease: '', leaseUntil: 0,
    dispatched: false, dispatchKey: savedRequest.dispatchKey, createdAt: at, updatedAt: at, evidenceGeneration,
    evidenceRevision: durableEvidence(loaded.attempts), evidenceAttemptIds: input.scope.kind === 'synthesis' ? loaded.attempts.filter(a => a.scope.kind === 'segment').map(a => a.id) : [],
    outcomeId: null, outputId: null, eligibleAtCompletion: false, ineligibleReason: '', message: 'Queued authored synthetic recording.', knownCostMicros: 0, settled: false,
    command: bindCommand(command, actor, review.revision, run.revision + 1) }, L.attempt);
  const next = { ...run, revision: run.revision + 1, updatedAt: at, attemptCount: run.attemptCount + 1, activeAttemptId: id, evidenceGeneration,
    currentOutcomeId: null, currentSynthesisAttemptId: null };
  const reserved = reserveSegmented(next, counter, SEGMENTED_ATTEMPT_RESERVATION);
  if (!loaded.requests.has(requestId)) tx.create(loaded.ref.collection(C.requests).doc(requestId), savedRequest);
  tx.create(loaded.ref.collection(C.attempts).doc(id), attempt); tx.set(loaded.ref, reserved.run); tx.set(segmentedCounterRef(s), reserved.counter);
  tx.create(segmentedDispatches(s).doc(id), checked(segmentedDispatchSchema, { version: 'segmented-dispatch-v1', id, reviewId: review.id, runId: run.id,
    compatibility: 'authored-recording:lantern-segmented-v1:recording-v1', ready: true, leaseUntil: 0, settled: false }, 4096));
  tx.set(quotaRef, { count: (ledger.get('count') || 0) + 1, reservedMicros: ledger.get('reservedMicros') || 0, spentMicros: ledger.get('spentMicros') || 0 });
  return { details: { runId: run.id, attemptId: id, scope: input.scope }, effect: { version: 'segmented-command-v1', runId: run.id, attemptId: id, runRevision: reserved.run.revision }, reviewChanged: false };
}

async function authorized<T>(s: Services, actor: DecodedIdToken, reviewId: string, read: (tx: Transaction, review: Review) => Promise<T>): Promise<T> {
  return s.db.runTransaction(async tx => { requireMember((await tx.get(membersRef(s).doc(actor.uid))).data(), actor, ['admin','reviewer','viewer']); return read(tx, await readReview(s, tx, reviewId)); });
}
export async function segmentedRequesterCurrent(s: Services, tx: Transaction, run: SegmentedRun): Promise<boolean> {
  try {
    const user = await s.auth.getUser(run.actorUid);
    if (user.disabled || !user.emailVerified || user.email !== run.actorEmail) return false;
    requireMember((await tx.get(membersRef(s).doc(run.actorUid))).data(), { uid: run.actorUid, email: run.actorEmail } as DecodedIdToken, ['admin','reviewer']); return true;
  } catch { return false; }
}
function summary(loaded: LoadedSegmentedRun): SegmentedRunSummary {
  const r = loaded.run; return { id: r.id, revision: r.revision, status: r.status, createdAt: r.createdAt, updatedAt: r.updatedAt,
    baseReviewRevision: r.baseReviewRevision, evidenceGeneration: r.evidenceGeneration, attemptCount: r.attemptCount, activeAttemptId: r.activeAttemptId,
    currentOutcomeId: r.currentOutcomeId, retainedBytes: loaded.logicalBytes, admittedBytes: r.admittedBytes, admittedRecords: r.admittedRecords };
}
export function segmentedAttemptView(a: SegmentedAttempt): SegmentedAttemptView {
  const { id, scope, ordinal, sequence, requestId, status, dispatched, createdAt, updatedAt, outcomeId, outputId, evidenceGeneration, evidenceRevision,
    eligibleAtCompletion, ineligibleReason, message, knownCostMicros, settled } = a;
  return { id, scope, ordinal, sequence, requestId, status, dispatched, createdAt, updatedAt, outcomeId, outputId, evidenceGeneration, evidenceRevision, eligibleAtCompletion, ineligibleReason, message, knownCostMicros, settled };
}
export function segmentedPage<T>(values: T[], scope: string, cursor: string | undefined, key: (v: T) => string) {
  let after = '';
  if (cursor) { try { if (cursor.length > 512) throw new Error(); const c = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
      if (Object.keys(c).sort().join() !== 'after,scope' || c.scope !== digest(scope) || typeof c.after !== 'string' || c.after.length > 80 || !values.some(v => key(v) === c.after)) throw new Error(); after = c.after;
    } catch { throw new HttpError(400, 'Invalid or cross-resource segmented page cursor.'); } }
  const offset = after ? values.findIndex(v => key(v) === after) + 1 : 0, selected = values.slice(offset, offset + L.page + 1), items: T[] = [];
  const next = (count: number) => offset + count < values.length && count ? Buffer.from(JSON.stringify({ scope: digest(scope), after: key(items[count - 1]) })).toString('base64url') : null;
  for (const value of selected.slice(0, L.page)) {
    items.push(value);
    if (Buffer.byteLength(JSON.stringify({ items, nextCursor: next(items.length) })) > L.pageBytes) {
      items.pop(); if (!items.length) throw new HttpError(413, 'One complete candidate exceeds the page bound; no evidence was truncated.'); break;
    }
  }
  return segmentedBound({ items, nextCursor: next(items.length) }, L.pageBytes, 'Segmented page');
}
const page = segmentedPage;
function handoffEligibility(loaded: LoadedSegmentedRun, attempt: SegmentedAttempt, measureId: string, requesterCurrent: boolean) {
  if (loaded.run.status !== 'open') return 'run_cancelled';
  if (!requesterCurrent) return 'requester_access_revoked';
  if (!attempt.eligibleAtCompletion) return attempt.ineligibleReason || 'not_eligible_at_completion';
  if (attempt.evidenceGeneration !== loaded.run.evidenceGeneration || loaded.run.currentOutcomeId !== attempt.outcomeId) return 'evidence_or_synthesis_changed';
  if (loaded.review.analysis?.findings.find(f => f.id === measureId)?.reviewedBy) return 'human_finding_already_reviewed';
  if (loaded.run.baselineFindings[measureId] !== findingBaseline(loaded.review, measureId)) return 'human_finding_changed';
  return '';
}
export async function segmentedRunSummary(s: Services, actor: DecodedIdToken, reviewId: string, cursor?: string): Promise<SegmentedRunsView> {
  return authorized(s, actor, reviewId, async (tx, review) => {
    const list = await tx.get(reviewCollection(s).doc(reviewId).collection('segmentedRuns').limit(L.runs + 1));
    if (list.size > L.runs) throw new HttpError(409, 'Too many retained runs.');
    const loaded: LoadedSegmentedRun[] = []; for (const d of list.docs) loaded.push(await loadSegmentedRun(s, tx, review, d.id));
    const eligible = segmentedRecordingEligible(review), runs = loaded.sort((a,b) => a.run.createdAt.localeCompare(b.run.createdAt) || a.run.id.localeCompare(b.run.id)).map(summary);
    return { eligible, eligibilityMessage: eligible ? 'Exact authored synthetic recording available. No live provider is enabled.' : 'Load the Lantern segmented review lab to use the authored recording.',
      currentRunId: review.segmentedRunId || null, runs: page(runs, `${s.config.districtId}/${reviewId}/runs`, cursor, r => r.id) };
  });
}
export async function segmentedRunDetail(s: Services, actor: DecodedIdToken, reviewId: string, runId: string, cursor?: string): Promise<SegmentedRunView> {
  return authorized(s, actor, reviewId, async (tx, review) => {
    const loaded = await loadSegmentedRun(s, tx, review, runId), archive = archiveForAttempts(loaded), state = readSegmentArchive(archive);
    const requester = await segmentedRequesterCurrent(s, tx, loaded.run), current = loaded.attempts.find(a => a.id === loaded.run.currentSynthesisAttemptId);
    return segmentedBound({ run: summary(loaded), spec: { id: loaded.run.specId, bundleId: loaded.spec.bundleId, textHash: loaded.spec.textHash, definitionId: loaded.spec.definitionId,
      planId: loaded.spec.planId, provider: loaded.spec.provider, model: loaded.spec.model },
      segments: state.ledger.map(segment => { const attempts = loaded.attempts.filter(a => a.scope.kind === 'segment' && a.scope.segmentId === segment.id);
        return { id: segment.id, documentId: segment.documentId, start: segment.start, end: segment.end, attempts: attempts.length,
          state: attempts.at(-1) && !attempts.at(-1)!.outcomeId ? attempts.at(-1)!.status : segment.state }; }),
      measures: measuresFor(review).map(m => { const targets = state.coverage.filter(c => c.target === m.id || c.target.startsWith(`${m.id}/`));
        const reason = current ? handoffEligibility(loaded, current, m.id, requester) : 'no_current_proposal';
        return { id: m.id, label: m.label, targetIds: targets.map(t => t.target), ready: targets.length > 0 && targets.every(t => t.ready), proposalOutcomeId: loaded.run.currentOutcomeId, eligible: !reason, reason }; }),
      synthesisAttempts: loaded.attempts.filter(a => a.scope.kind === 'synthesis').length,
      attempts: page(loaded.attempts.map(segmentedAttemptView), `${s.config.districtId}/${reviewId}/${runId}/attempts`, cursor, a => a.id),
    }, L.proposalBytes, 'Segmented run detail');
  });
}
export async function segmentedAttemptDetail(s: Services, actor: DecodedIdToken, reviewId: string, runId: string, attemptId: string): Promise<SegmentedAttemptView> {
  return authorized(s, actor, reviewId, async (tx, review) => { const loaded = await loadSegmentedRun(s, tx, review, runId), attempt = loaded.attempts.find(a => a.id === attemptId);
    if (!attempt) throw new HttpError(404, 'Attempt not found in this run.'); return segmentedAttemptView(attempt); });
}
export async function segmentedRequestDetail(s: Services, actor: DecodedIdToken, reviewId: string, runId: string, requestId: string): Promise<SegmentedRequestView> {
  return authorized(s, actor, reviewId, async (tx, review) => { const loaded = await loadSegmentedRun(s, tx, review, runId), request = loaded.requests.get(requestId);
    if (!request) throw new HttpError(404, 'Request not found in this run.'); return segmentedBound({ id: requestId, requestKey: request.requestKey, dispatchKey: request.dispatchKey, request: request.request }, L.request); });
}
export async function segmentedOutputDetail(s: Services, actor: DecodedIdToken, reviewId: string, runId: string, outputId: string): Promise<SegmentedOutputView> {
  return authorized(s, actor, reviewId, async (tx, review) => { const loaded = await loadSegmentedRun(s, tx, review, runId), output = loaded.outputs.get(outputId);
    if (!output) throw new HttpError(404, 'Original output not found in this run.');
    let text: string | null = null, decodeError: string | null = null;
    try { text = outputText(output); } catch { decodeError = 'Original bytes are not valid UTF-8. The complete base64 return is retained.'; }
    const statuses = [...new Set([...loaded.outcomes.values()].filter(o => o.outputId === outputId).flatMap(o => o.transportStatus === 'not_returned' ? [] : [o.transportStatus]))];
    const view: SegmentedOutputView = { id: outputId, encoding: 'base64', byteLength: output.byteLength, base64: output.base64, text, decodeError, statuses };
    if (Buffer.byteLength(JSON.stringify(view)) > L.output) { view.text = null; view.decodeError = 'Decoded preview omitted to keep this response bounded. The complete original base64 return is available.'; }
    return segmentedBound(view, L.output);
  });
}
function proposal(loaded: LoadedSegmentedRun, outcomeId: string, measureId: string, requester: boolean, cursor?: string): SegmentedProposalView {
  const attempt = loaded.attempts.find(a => a.outcomeId === outcomeId && a.scope.kind === 'synthesis'), outcome = loaded.outcomes.get(outcomeId);
  const measure = measuresFor(loaded.review).find(m => m.id === measureId);
  if (!attempt || !outcome?.outputId || outcome.state !== 'validated' || !measure) throw new HttpError(404, 'Validated proposal not found for this measure.');
  const archive = archiveForAttempts(loaded, attempt.evidenceAttemptIds), result = validateSynthesis(archive, outputText(loaded.outputs.get(outcome.outputId)!));
  const targets = result.findings.filter(f => f.target === measureId || f.target.startsWith(`${measureId}/`));
  if (!targets.length) throw new HttpError(404, 'This measure has no proposal targets.');
  const reference = segmentedProposalRefSchema.parse({ version: 'segmented-proposal-v1', runId: loaded.run.id, synthesisAttemptId: attempt.id,
    outcomeId, evidenceRevision: attempt.evidenceRevision, measureId, targetIds: targets.map(t => t.target) });
  const provenance: SegmentedProvenance = { version: 'segmented-provenance-v1', reference, bundleId: loaded.spec.bundleId, textHash: loaded.spec.textHash,
    definitionId: loaded.spec.definitionId, planId: loaded.spec.planId, provider: 'authored-recording', model: 'lantern-segmented-v1', adapterVersion: 'recording-v1',
    promptVersion: 'evidence-synthesis-v1', schemaVersion: 'segment-synthesis-v1', validatorVersion: 'synthesis-validator-v1' };
  const seed: SegmentedDraftSeed = { criterionId: measureId, finding: 'unresolved', citations: [], rationale: 'Review pending. Interpret the retained evidence and resolve the applicability question explicitly.',
    sourceReview: { version: 'human-source-review-v1', bundleId: loaded.spec.bundleId, segmentIds: [] }, segmentedProposal: reference,
    context: { scope: SEGMENTED_HANDOFF_SCOPE, uncertainty: 'scope', question: SEGMENTED_HANDOFF_QUESTION, resolution: 'retained', note: '', citations: [] },
    ...('requirements' in measure && measure.requirements ? { requirements: blankRequirementReview(measure.requirements, SEGMENTED_HANDOFF_SCOPE) } : {}) };
  const reason = handoffEligibility(loaded, attempt, measureId, requester);
  return segmentedBound({ reference, provenance, current: attempt.eligibleAtCompletion && loaded.run.currentOutcomeId === outcomeId && loaded.run.evidenceGeneration === attempt.evidenceGeneration,
    eligible: !reason, reason, scope: loaded.review.sourceBundle!.scope, requiredQuestion: SEGMENTED_HANDOFF_QUESTION,
    targets: targets.map(t => { const original = result.original.findings.find(f => f.target === t.target)!;
      return { target: t.target, original: { state: original.state, rationale: original.rationale, question: original.question, candidateIds: original.candidateIds, segmentIds: original.segmentIds },
        derived: { state: t.state, question: t.question, ready: t.coverage.ready, missing: t.coverage.missing }, candidateCount: t.candidates.length }; }),
    candidates: page(targets.flatMap(t => t.candidates).sort((a,b) => a.id.localeCompare(b.id)), `${loaded.ref.path}/${outcomeId}/${measureId}/candidates`, cursor, c => c.id),
    seed: reason ? null : seed }, L.proposalBytes, 'Segmented proposal detail');
}
export async function segmentedProposalDetail(s: Services, actor: DecodedIdToken, reviewId: string, runId: string, outcomeId: string, measureId: string, cursor?: string): Promise<SegmentedProposalView> {
  return authorized(s, actor, reviewId, async (tx, review) => { const loaded = await loadSegmentedRun(s, tx, review, runId); return proposal(loaded, outcomeId, measureId, await segmentedRequesterCurrent(s, tx, loaded.run), cursor); });
}
export async function verifiedSegmentedProposal(s: Services, tx: Transaction, review: Review, raw: SegmentedProposalRef, measureId: string) {
  const reference = segmentedProposalRefSchema.parse(raw);
  if (reference.measureId !== measureId) throw new HttpError(400, 'Segmented proposal measure mismatch.');
  const loaded = await loadSegmentedRun(s, tx, review, reference.runId), original = review.analysis?.findings.find(f => f.id === measureId)?.segmentedProvenance;
  const view = proposal(loaded, reference.outcomeId, measureId, await segmentedRequesterCurrent(s, tx, loaded.run));
  if (digest(reference) !== digest(view.reference)) throw new HttpError(409, 'Segmented proposal reference changed.');
  if (original) { if (digest(original) !== digest(view.provenance)) throw new HttpError(409, 'Retain the exact original segmented provenance when correcting a finding.'); }
  else if (!view.eligible) throw new HttpError(409, `This proposal cannot open new human work: ${view.reason}.`);
  // Historical corrections retain the same mandatory qualification even when the original run is
  // no longer eligible for new drafts. The full original questions remain in immutable output.
  const seed: SegmentedDraftSeed = view.seed || { criterionId: measureId, finding: 'unresolved', citations: [], rationale: 'Review pending.', segmentedProposal: reference,
    sourceReview: { version: 'human-source-review-v1', bundleId: loaded.spec.bundleId, segmentIds: [] },
    context: { scope: SEGMENTED_HANDOFF_SCOPE, uncertainty: 'scope', question: SEGMENTED_HANDOFF_QUESTION, resolution: 'retained', note: '', citations: [] } };
  const coverage = sourceCoverage(review.sourceBundle!, review.contract!).targets.filter(t => reference.targetIds.includes(t.target));
  return { provenance: view.provenance, seed, unavailable: coverage.some(t => !t.ready) };
}
