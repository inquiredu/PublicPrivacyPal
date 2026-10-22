import { randomUUID } from 'node:crypto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Transaction } from 'firebase-admin/firestore';
import type { Services } from '../firebase.ts';
import { assertWritable, HttpError, membersRef, requireMember } from '../operations.ts';
import { readReview } from '../review-storage.ts';
import { SEGMENTED_LIMITS as L } from '../../shared/segmented-assistance.ts';
import { OperationDeadline } from './deadline.ts';
import { generateSegmentedRecording, type SegmentedTransportInput, type SegmentedTransportResult } from './segmented-recording.ts';
import { SEGMENTED_COLLECTIONS as C, segmentedDispatches, segmentedDispatchSchema, segmentedAttemptSchema, checked,
  loadSegmentedRun, archiveForAttempts, completeSegmentedAttempt, makeOutput, evaluateSegmentedOutput,
  type LoadedSegmentedRun, type SegmentedAttempt, type SegmentedOutcome, type SegmentedOutput } from '../segmented-review-storage.ts';

export type SegmentedWorkerOptions = { leaseMs?: number; timeoutMs?: number; cleanupTimeoutMs?: number; signal?: AbortSignal;
  /** Trusted test seam only. The application registers solely the exact zero-network recording. */
  transport?: (input: SegmentedTransportInput, signal: AbortSignal) => Promise<SegmentedTransportResult> };
const now = () => new Date().toISOString();
async function transaction<T>(s: Services, deadline: OperationDeadline, fn: (tx: Transaction) => Promise<T>) {
  return deadline.wait(() => s.db.runTransaction(async tx => { deadline.check(); const value = await fn(tx); deadline.check(); return value; }));
}
async function identityValid(s: Services, a: { actorUid: string; actorEmail: string }) {
  try { const user = await s.auth.getUser(a.actorUid); return !user.disabled && user.emailVerified && user.email === a.actorEmail; }
  catch { return false; }
}
async function membershipValid(s: Services, tx: Transaction, a: { actorUid: string; actorEmail: string }) {
  try { requireMember((await tx.get(membersRef(s).doc(a.actorUid))).data(), { uid: a.actorUid, email: a.actorEmail } as DecodedIdToken, ['admin','reviewer']); return true; }
  catch { return false; }
}
function transportInput(loaded: LoadedSegmentedRun, attempt: SegmentedAttempt): SegmentedTransportInput {
  if (attempt.scope.kind === 'synthesis') return { kind: 'synthesis', archive: archiveForAttempts(loaded, attempt.evidenceAttemptIds) };
  const id = attempt.scope.segmentId; return { kind: 'segment', request: loaded.archive.requests.find(r => r.segment.id === id)! };
}
function activeLease(a: SegmentedAttempt, lease: string) { return !a.outcomeId && a.status === 'running' && a.lease === lease && a.leaseUntil > Date.now(); }

/** One invocation processes at most one persisted attempt. Unknown authored recordings recover
 * under the same attempt identity; new attempts always require an explicit receipt-bearing action. */
export async function processNextSegmentedRun(s: Services, options: SegmentedWorkerOptions = {}): Promise<boolean> {
  const deadline = new OperationDeadline(options.timeoutMs ?? 60000, options.signal), leaseMs = options.leaseMs ?? 30000;
  if (!Number.isFinite(leaseMs) || leaseMs <= 0) { deadline.dispose(); throw new Error('Use a positive lease.'); }
  let claim: { reviewId: string; runId: string; attemptId: string; lease: string } | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined, heartbeatBusy = false;
  try {
    // Filter compatibility before limiting. Old/unsupported work cannot starve this worker.
    const candidates = await deadline.wait(() => segmentedDispatches(s).where('compatibility', '==', 'authored-recording:lantern-segmented-v1:recording-v1')
      .where('ready', '==', true).orderBy('leaseUntil').limit(20).get());
    for (const doc of candidates.docs) {
      const index = checked(segmentedDispatchSchema, doc.data(), 4096); if (index.leaseUntil > Date.now()) continue;
      const leased = await transaction(s, deadline, async tx => {
        await assertWritable(s, tx); const fresh = checked(segmentedDispatchSchema, (await tx.get(doc.ref)).data(), 4096);
        if (!fresh.ready || fresh.leaseUntil > Date.now()) return null;
        const loaded = await loadSegmentedRun(s, tx, await readReview(s, tx, fresh.reviewId), fresh.runId);
        const a = loaded.attempts.find(v => v.id === fresh.id);
        if (!a || a.outcomeId || a.settled || a.leaseUntil !== fresh.leaseUntil || loaded.run.activeAttemptId !== a.id) throw new HttpError(409, 'Dispatch index and attempt disagree.');
        const lease = randomUUID(), leaseUntil = Date.now() + leaseMs;
        const attempt = checked(segmentedAttemptSchema, { ...a, status: 'running', lease, leaseUntil, updatedAt: now() }, L.attempt);
        tx.set(loaded.ref.collection(C.attempts).doc(a.id), attempt); tx.set(doc.ref, { ...fresh, leaseUntil });
        return { ...loaded, attempts: loaded.attempts.map(v => v.id === a.id ? attempt : v), attempt };
      });
      if (!leased) continue;
      claim = { reviewId: leased.review.id, runId: leased.run.id, attemptId: leased.attempt.id, lease: leased.attempt.lease };
      const claimed = claim;
      heartbeat = setInterval(() => {
        if (heartbeatBusy || deadline.signal.aborted) return; heartbeatBusy = true;
        void transaction(s, deadline, async tx => {
          await assertWritable(s, tx); const ref = leased.ref.collection(C.attempts).doc(claimed.attemptId);
          const a = checked(segmentedAttemptSchema, (await tx.get(ref)).data(), L.attempt);
          const idx = checked(segmentedDispatchSchema, (await tx.get(segmentedDispatches(s).doc(a.id))).data(), 4096);
          if (!activeLease(a, claimed.lease) || idx.leaseUntil !== a.leaseUntil || !idx.ready) return;
          const leaseUntil = Date.now() + leaseMs; deadline.check(); tx.update(ref, { leaseUntil }); tx.update(segmentedDispatches(s).doc(a.id), { leaseUntil });
        }).catch(() => { /* Expired or maintenance-blocked leases are never renewed by a later callback. */ }).finally(() => { heartbeatBusy = false; });
      }, Math.max(10, Math.floor(leaseMs / 3)));
      const identities = await deadline.wait(async () => await identityValid(s, leased.run) && await identityValid(s, leased.attempt));
      const preflight = await transaction(s, deadline, async tx => {
        await assertWritable(s, tx); const loaded = await loadSegmentedRun(s, tx, await readReview(s, tx, claimed.reviewId), claimed.runId);
        const a = loaded.attempts.find(v => v.id === claimed.attemptId)!;
        if (!activeLease(a, claimed.lease)) return null;
        const member = await membershipValid(s, tx, loaded.run), attemptMember = await membershipValid(s, tx, a);
        const reason = loaded.run.status !== 'open' ? 'run_cancelled' : !identities || !member || !attemptMember ? 'requester_access_revoked'
          : loaded.review.revision !== loaded.run.baseReviewRevision ? 'review_revision_changed' : '';
        if (!a.dispatched && reason) {
          completeSegmentedAttempt(tx, loaded, a, { state: reason === 'run_cancelled' ? 'cancelled' : 'failed',
            reason: 'Attempt stopped before dispatch because its authorizing state changed.', transportStatus: 'not_returned' }, false, reason);
          return null;
        }
        // A persisted dispatch is recovered only because this one adapter is explicitly deterministic
        // and free. No live/non-offline adapter or possibly paid resend is accepted by these schemas.
        if (!a.dispatched) tx.update(loaded.ref.collection(C.attempts).doc(a.id), { dispatched: true, updatedAt: now() });
        return { loaded, attempt: { ...a, dispatched: true } };
      });
      if (!preflight) return true;
      const returned = await deadline.wait(() => (options.transport || generateSegmentedRecording)(transportInput(preflight.loaded, preflight.attempt), deadline.signal));
      if (!returned || !['completed','refused','incomplete'].includes(returned.status) || !(returned.bytes instanceof Uint8Array)) throw new Error('Invalid recording transport envelope.');
      let result: { state: SegmentedOutcome['state']; reason: string; transportStatus: SegmentedOutcome['transportStatus']; output?: SegmentedOutput; transportByteLength?: number };
      if (returned.bytes.byteLength > L.transportBytes) result = { state: 'overflow', reason: 'Transport output exceeded its byte bound. No prefix was accepted as a complete response.', transportStatus: returned.status, transportByteLength: returned.bytes.byteLength };
      else { const output = makeOutput(returned.bytes); result = { ...evaluateSegmentedOutput(preflight.loaded, preflight.attempt, output, returned.status), output, transportStatus: returned.status }; }
      const currentIdentities = await deadline.wait(async () => await identityValid(s, preflight.loaded.run) && await identityValid(s, preflight.attempt));
      await transaction(s, deadline, async tx => {
        await assertWritable(s, tx); const loaded = await loadSegmentedRun(s, tx, await readReview(s, tx, claimed.reviewId), claimed.runId);
        const a = loaded.attempts.find(v => v.id === claimed.attemptId)!;
        if (!activeLease(a, claimed.lease)) return;
        const member = await membershipValid(s, tx, loaded.run), attemptMember = await membershipValid(s, tx, a);
        const reason = loaded.run.status !== 'open' ? 'run_cancelled' : !currentIdentities || !member || !attemptMember ? 'requester_access_revoked'
          : loaded.review.revision !== loaded.run.baseReviewRevision ? 'review_revision_changed' : loaded.run.evidenceGeneration !== a.evidenceGeneration ? 'evidence_changed' : '';
        // Raw retention has the lease/maintenance fence. Eligibility additionally requires every
        // original authorizing condition. A stale or revoked return cannot replace human work.
        completeSegmentedAttempt(tx, loaded, a, result, !reason && result.state === 'validated', reason);
      });
      return true;
    }
    return false;
  } catch (error) {
    if (!claim) { if (error instanceof HttpError && error.status === 503) return false; if (deadline.signal.aborted) return false; throw error; }
    clearInterval(heartbeat);
    const claimed = claim, cleanup = new OperationDeadline(options.cleanupTimeoutMs ?? 5000);
    try {
      await transaction(s, cleanup, async tx => {
        await assertWritable(s, tx); const ref = s.db.doc(`districts/${s.config.districtId}/reviews/${claimed.reviewId}/segmentedRuns/${claimed.runId}/${C.attempts}/${claimed.attemptId}`);
        const a = checked(segmentedAttemptSchema, (await tx.get(ref)).data(), L.attempt);
        const index = checked(segmentedDispatchSchema, (await tx.get(segmentedDispatches(s).doc(a.id))).data(), 4096);
        if (a.outcomeId || a.lease !== claimed.lease || a.status !== 'running' || a.leaseUntil <= Date.now() || index.leaseUntil !== a.leaseUntil) return;
        // Close this lease before returning; a late transport promise cannot write. The same
        // persisted deterministic recording can be recovered later, without a new attempt.
        tx.update(ref, { status: 'unknown', leaseUntil: 0, updatedAt: now(), message: 'Operation outcome is unknown. Recover this exact authored recording before another attempt.' });
        tx.update(segmentedDispatches(s).doc(a.id), { leaseUntil: 0 });
      });
    } catch { /* Maintenance or uncertain RPC: retain the durable marker and let its lease expire. */ }
    finally { cleanup.dispose(); }
    return true;
  } finally { clearInterval(heartbeat); deadline.dispose(); }
}
export function startSegmentedWorker(s: Services) {
  let busy = false, pending: Promise<unknown> = Promise.resolve(); const stop = new AbortController();
  const timer = setInterval(() => { if (busy) return; busy = true; pending = processNextSegmentedRun(s, { signal: stop.signal })
    .catch(() => console.error('Segmented recording worker could not complete its bounded operation.')).finally(() => { busy = false; }); }, 1000);
  return async () => { clearInterval(timer); stop.abort(); await pending; };
}
