import { newSegmentArchive, type SegmentArchive } from './segments.ts';
import { LONG_BUNDLE_VERSION } from '../../shared/source-segments.ts';
import { randomUUID } from 'node:crypto';
import type { Transaction } from 'firebase-admin/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Review } from '../../shared/review.ts';
import type { AssistanceView, AssistanceStatus, ValidatedSuggestions } from '../../shared/assistance.ts';
import { suggestionWireOutput } from '../../shared/assistance.ts';
import type { Services } from '../firebase.ts';
import { assertWritable, requireMember, membersRef, HttpError } from '../operations.ts';
import { readReview } from '../review-storage.ts';
import { digest } from '../evaluation.ts';
import { buildAnalysisRequest, validateSuggestions, MAX_OUTPUT_BYTES, type AnalysisRequest } from './contract.ts';
import { offlineProvider } from './offline.ts';
import { OperationDeadline } from './deadline.ts';
import type { VerifiedProposal } from '../evidence.ts';
import { ProviderFailure, providerResponseSchema, usageSchema, type AnalysisProvider, type ProviderResponse, type Usage } from './provider.ts';

type Job = Omit<AssistanceView, 'result'> & { reviewId: string; key: string; actorUid: string; actorEmail: string; providerVersion: string; resultId: string | null; lease: string; leaseUntil: number; dispatched: boolean; day: string; reservedMicros: number; usage: Usage | null; settled: boolean };
const root = (s: Services) => `districts/${s.config.districtId}`;
const jobs = (s: Services) => s.db.collection(`${root(s)}/assistanceJobs`);
const budget = (s: Services, day: string) => s.db.doc(`${root(s)}/assistanceBudgets/${day}`);
const keyRef = (s: Services, r: string, key: string) => s.db.doc(`${root(s)}/reviews/${r}/assistanceKeys/${key}`);
const resultRef = (s: Services, r: string, id: string) => s.db.doc(`${root(s)}/reviews/${r}/suggestions/${id}`);
const now = () => new Date().toISOString();
const limit = <T>(value: T, bytes: number): T => { if (Buffer.byteLength(JSON.stringify(value)) > bytes) throw new HttpError(413, 'Assistance record exceeds its byte limit.'); return value; };
const providerKey = (p: AnalysisProvider) => ({ provider: p.id, model: p.model, version: p.version, settings: p.settings });
export async function prepareAssistance(s: Services, tx: Transaction, actor: DecodedIdToken, r: Review, cancel = false) {
  const prior = r.assistanceId ? (await tx.get(jobs(s).doc(r.assistanceId))).data() as Job | undefined : undefined;
  if (cancel) {
    if (!prior || !['queued', 'running'].includes(prior.status)) throw new HttpError(409, 'There is no cancellable suggestion job.');
    const ledger = await tx.get(budget(s, prior.day));
    const safe = !prior.dispatched || prior.provider === offlineProvider.id;
    tx.update(jobs(s).doc(prior.id), { status: safe ? 'cancelled' : 'unknown', message: safe ? 'Cancelled.' : 'Cancellation requested; provider outcome is unknown.', updatedAt: now(), settled: safe });
    if (safe) {
      tx.update(budget(s, prior.day), { reservedMicros: Math.max(0, (ledger.get('reservedMicros') || 0) - prior.reservedMicros) });
      tx.set(keyRef(s, r.id, prior.key), { activeJob: null }, { merge: true });
    }
    return;
  }
  if (r.sourceBundle) throw new HttpError(409, 'Source bundles support manual review and prompt preview. No recorded bundle or live provider is enabled.');
  if (r.sourceKind !== 'pasted') throw new HttpError(409, 'Suggestions are available for pasted review sources.');
  if ((r.assistanceCount || 0) >= 20) throw new HttpError(429, 'This local review is limited to 20 suggestion requests.');
  if (prior && ['queued', 'running', 'unknown'].includes(prior.status)) throw new HttpError(409, 'Resolve the existing suggestion job before starting another.');
  const p = offlineProvider; // No live provider can be enabled by a browser or environment variable.
  const request = buildAnalysisRequest(r.sourceText, r.contract!);
  // Fail before reserving a job for arbitrary pasted policies; offline is an exact recording.
  const { ANALYSIS_EXAMPLE } = await import('../../shared/analysis-example.ts');
  if (r.sourceText !== ANALYSIS_EXAMPLE) throw new HttpError(409, 'Load the Cedar Intelligence Lab example to try offline suggestions. Other policies require a configured provider.');
  const key = digest({ request: request.key, ...providerKey(p) }); const ref = keyRef(s, r.id, key);
  const saved = await tx.get(ref); const day = now().slice(0, 10); const ledger = await tx.get(budget(s, day));
  if (saved.get('activeJob')) throw new HttpError(409, 'A prior provider outcome must be resolved before repeating this request.');
  const cached = saved.get('resultId') as string | undefined;
  if (!cached && (saved.get('attempts') || 0) >= 3) throw new HttpError(429, 'Three attempts reached for this exact request. Review the failure before changing the adapter.');
  if ((ledger.get('count') || 0) >= 100) throw new HttpError(429, 'The local suggestion limit is 100 requests per UTC day.');
  // This local milestone has a zero-dollar ceiling. A live rollout must explicitly configure its ledger.
  if (!p.offline || p.maxCostMicros !== 0) throw new HttpError(409, 'Live inference is not enabled.');
  const id = randomUUID(); const at = now();
  const job: Job = { id, reviewId: r.id, key, status: cached ? 'succeeded' : 'queued', provider: p.id, model: p.model, providerVersion: p.version, promptVersion: request.promptVersion,
    actorUid: actor.uid, actorEmail: actor.email!, baseRevision: r.revision + 1, createdAt: at, updatedAt: at, message: cached ? 'Reused the recorded suggestions; human review is still required.' : 'Queued offline example.', reused: !!cached,
    resultId: cached || null, lease: '', leaseUntil: 0, dispatched: false, day, reservedMicros: p.maxCostMicros, usage: null, settled: !!cached };
  tx.create(jobs(s).doc(id), limit(job, 16384));
  tx.set(budget(s, day), { count: (ledger.get('count') || 0) + 1, reservedMicros: (ledger.get('reservedMicros') || 0) + job.reservedMicros, spentMicros: ledger.get('spentMicros') || 0 });
  tx.set(ref, { activeJob: cached ? null : id, attempts: (saved.get('attempts') || 0) + (cached ? 0 : 1), resultId: cached || null });
  r.assistanceId = id; r.assistanceCount = (r.assistanceCount || 0) + 1;
}
async function readResult(s: Services, tx: Transaction, r: Review, j: Job): Promise<ValidatedSuggestions> {
  if (j.reviewId !== r.id || j.status !== 'succeeded' || !j.resultId) throw new HttpError(409, 'A completed suggestion for this review is required.');
  const saved = (await tx.get(resultRef(s, r.id, j.resultId))).data();
  if (!saved || digest(saved) !== j.resultId || saved.requestKey !== j.key) throw new HttpError(409, 'Suggestion integrity check failed.');
  const request = buildAnalysisRequest(r.sourceText, r.contract!, j.promptVersion, r.sourceBundle);
  if (saved.promptVersion !== j.promptVersion || saved.provider.provider !== j.provider || saved.provider.model !== j.model || saved.provider.version !== j.providerVersion || digest({ request: request.key, ...saved.provider }) !== j.key) throw new HttpError(409, 'Suggestion request version does not match its saved source and rubric.');
  return validateSuggestions(request, r.sourceText, saved.output);
}
/** Resolve the reference inside the evidence command's authorized transaction. Never trust client provenance. */
export async function verifiedProposal(s: Services, tx: Transaction, r: Review, jobId: string, measureId: string): Promise<VerifiedProposal> {
  const j = (await tx.get(jobs(s).doc(jobId))).data() as Job | undefined;
  if (!j) throw new HttpError(409, 'Suggestion job is unavailable.');
  const result = await readResult(s, tx, r, j);
  const f = result.findings.find(f => f.measureId === measureId);
  if (!f) throw new HttpError(409, 'This suggestion does not contain the selected measure.');
  return { context: { scope: f.scope, uncertainty: f.uncertainty, question: f.question }, ...(f.requirements ? { requirements: f.requirements } : {}), provenance: {
    jobId, resultId: j.resultId!, sourceHash: r.sourceHash!, rubricId: r.contract!.id, promptVersion: j.promptVersion,
    schemaVersion: result.schemaVersion, provider: j.provider, model: j.model, state: f.state, sourceStatus: result.sourceStatus,
  } };
}
export function assistanceDetail(s: Services, actor: DecodedIdToken, reviewId: string, preview?: false): Promise<AssistanceView | null>;
export function assistanceDetail(s: Services, actor: DecodedIdToken, reviewId: string, preview: true): Promise<AnalysisRequest | SegmentArchive>;
export function assistanceDetail(s: Services, actor: DecodedIdToken, reviewId: string, preview: boolean): Promise<AnalysisRequest | SegmentArchive | AssistanceView | null>;
export async function assistanceDetail(s: Services, actor: DecodedIdToken, reviewId: string, preview = false) {
  return s.db.runTransaction(async tx => {
    requireMember((await tx.get(membersRef(s).doc(actor.uid))).data(), actor, ['admin', 'reviewer', 'viewer']);
    const r = await readReview(s, tx, reviewId);
    if (preview && r.sourceBundle?.version === LONG_BUNDLE_VERSION) return newSegmentArchive(r.sourceBundle, r.contract!);
    if (preview) return buildAnalysisRequest(r.sourceText, r.contract!, undefined, r.sourceBundle);
    if (!r.assistanceId) return null;
    const j = (await tx.get(jobs(s).doc(r.assistanceId))).data() as Job | undefined;
    if (!j || j.reviewId !== r.id) throw new HttpError(409, 'Suggestion job is unavailable.');
    let result: ValidatedSuggestions | null = null;
    if (j.resultId) result = await readResult(s, tx, r, j);
    return { id: j.id, status: j.status, provider: j.provider, model: j.model, promptVersion: j.promptVersion, baseRevision: j.baseRevision,
      createdAt: j.createdAt, updatedAt: j.updatedAt, message: j.message, reused: j.reused, result } satisfies AssistanceView;
  });
}
async function actorValid(s: Services, j: Job) {
  const u = await s.auth.getUser(j.actorUid);
  if (u.disabled || !u.emailVerified || u.email !== j.actorEmail) throw new Error('Requester is unavailable.');
}
async function boundedTransaction<T>(s: Services, deadline: OperationDeadline, body: (tx: Transaction) => Promise<T>): Promise<T> {
  return deadline.wait(() => s.db.runTransaction(async tx => {
    deadline.check();
    const value = await body(tx);
    // Firestore buffers writes until the callback returns. Recheck after every async body,
    // including SDK retries: an expired callback must throw instead of submitting its writes.
    deadline.check();
    return value;
  }));
}

type AttemptResult = { status: AssistanceStatus; message: string; output?: ValidatedSuggestions; response?: ProviderResponse; knownNoCharge: boolean };
async function saveAttempt(s: Services, tx: Transaction, j: Job, provider: AnalysisProvider, result: AttemptResult, startedAt: number) {
  const ledger = await tx.get(budget(s, j.day));
  const safeUsage = result.response ? usageSchema.safeParse(result.response.usage) : undefined;
  const usage = safeUsage?.success ? safeUsage.data : null;
  // Unknown charges remain reserved even when local findings are stale, rejected or revoked.
  const settled = provider.offline || usage?.costMicros != null || result.knownNoCharge;
  const saved = result.output ? { output: suggestionWireOutput(result.output), requestKey: j.key, provider: providerKey(provider), promptVersion: j.promptVersion } : null;
  const resultId = saved ? digest(saved) : null;
  if (saved) tx.set(resultRef(s, j.reviewId, resultId!), limit(saved, MAX_OUTPUT_BYTES + 8192));
  const providerRequestId = typeof result.response?.requestId === 'string' && result.response.requestId.length <= 200 ? result.response.requestId : null;
  tx.update(jobs(s).doc(j.id), limit({ status: result.status, message: result.message, resultId, usage, settled, providerRequestId, elapsedMs: Date.now() - startedAt, updatedAt: now(), leaseUntil: result.status === 'unknown' ? Date.now() + 30000 : 0 }, 16384));
  tx.set(keyRef(s, j.reviewId, j.key), { activeJob: settled ? null : j.id, ...(resultId ? { resultId } : {}) }, { merge: true });
  if (settled && !j.settled) tx.update(budget(s, j.day), { reservedMicros: Math.max(0, (ledger.get('reservedMicros') || 0) - j.reservedMicros), spentMicros: (ledger.get('spentMicros') || 0) + (usage?.costMicros || 0) });
}

/** Whole-operation deadline, followed only by a bounded status-only recovery attempt.
 * No expired callback can dispatch or submit findings; unknown submitted RPC outcomes retain
 * their lease/dispatch identity for recovery instead of permitting a blind provider resend. */
export async function processNextAssistance(s: Services, provider: AnalysisProvider = offlineProvider, options: { leaseMs?: number; timeoutMs?: number; cleanupTimeoutMs?: number; signal?: AbortSignal } = {}) {
  const leaseMs = options.leaseMs ?? 30000;
  if (!Number.isFinite(leaseMs) || leaseMs < 30) throw new Error('Use a lease of at least 30 milliseconds.');
  const deadline = new OperationDeadline(options.timeoutMs ?? 60000, options.signal);
  const startedAt = Date.now();
  let claim: Job | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let didDispatch = false;
  let result: AttemptResult = { status: 'unknown', message: 'Provider outcome is unknown. Reconcile before retrying.', knownNoCharge: false };
  try {
    const candidates = await deadline.wait(() => jobs(s).where('status', 'in', ['queued', 'running', 'unknown']).orderBy('leaseUntil').limit(20).get());
    for (const doc of candidates.docs) {
      const candidate = await boundedTransaction(s, deadline, async tx => {
        await assertWritable(s, tx);
        const j = (await tx.get(doc.ref)).data() as Job;
        if (!['queued', 'running', 'unknown'].includes(j.status) || j.leaseUntil > Date.now()) return null;
        if (j.provider !== provider.id || j.model !== provider.model || j.providerVersion !== provider.version) return null;
        const lease = randomUUID(); const leaseUntil = Date.now() + leaseMs;
        tx.update(doc.ref, { status: 'running', lease, leaseUntil, updatedAt: now() });
        return { ...j, status: 'running' as const, lease, leaseUntil };
      }).catch(e => { if (e instanceof HttpError && e.status === 503) return null; throw e; });
      if (!candidate) continue;
      claim = candidate;
      didDispatch = claim.dispatched; result.knownNoCharge = !claim.dispatched;
      let heartbeatBusy = false;
      heartbeat = setInterval(() => {
        if (heartbeatBusy || deadline.signal.aborted) return;
        heartbeatBusy = true;
        void boundedTransaction(s, deadline, async tx => {
          await assertWritable(s, tx); const current = await tx.get(doc.ref);
          if (current.get('lease') !== candidate.lease || current.get('status') !== 'running' || current.get('leaseUntil') <= Date.now()) throw new Error('Lease lost.');
          tx.update(doc.ref, { leaseUntil: Date.now() + leaseMs });
        }).catch(() => deadline.abort()).finally(() => { heartbeatBusy = false; });
      }, Math.max(10, Math.floor(leaseMs / 3)));
      try {
        await deadline.wait(() => actorValid(s, candidate));
        const { r, request } = await boundedTransaction(s, deadline, async tx => {
          await assertWritable(s, tx);
          requireMember((await tx.get(membersRef(s).doc(candidate.actorUid))).data(), { uid: candidate.actorUid, email: candidate.actorEmail } as DecodedIdToken, ['admin', 'reviewer']);
          const r = await readReview(s, tx, candidate.reviewId); const current = await tx.get(doc.ref);
          if (current.get('lease') !== candidate.lease || current.get('status') !== 'running' || current.get('leaseUntil') <= Date.now()) throw new ProviderFailure('not_sent', 'Job no longer active.');
          if (r.revision !== candidate.baseRevision || r.assistanceId !== candidate.id) throw new ProviderFailure('not_sent', 'Review changed before dispatch.');
          const request = buildAnalysisRequest(r.sourceText, r.contract!, candidate.promptVersion, r.sourceBundle);
          if (digest({ request: request.key, ...providerKey(provider) }) !== candidate.key) throw new ProviderFailure('not_sent', 'Request version changed.');
          tx.update(doc.ref, { dispatched: true }); return { r, request };
        });
        const found = await deadline.wait(() => {
          // The wait checks the deadline before invoking this closure, including preflight's
          // uncertain acknowledgement window. Only this closure can invoke a provider.
          didDispatch = true; result.knownNoCharge = false;
          return candidate.dispatched && !provider.offline
            ? provider.reconcile?.(candidate.id, deadline.signal) ?? Promise.resolve(null)
            : provider.generate(request, { attemptId: candidate.id, signal: deadline.signal });
        });
        if (found) {
          result.response = found; providerResponseSchema.parse(found);
          if (found.status === 'completed') {
            result.output = validateSuggestions(request, r.sourceText, found.output);
            result.status = 'succeeded'; result.message = 'Recorded suggestions ready for human review.';
          } else {
            result.status = 'failed'; result.message = found.status === 'refused' ? 'Provider refused the request. No findings were accepted.' : 'Provider output was incomplete. No findings were accepted.';
          }
        }
      } catch (e) {
        deadline.check();
        if (e instanceof ProviderFailure) {
          result.knownNoCharge = !candidate.dispatched && e.kind === 'not_sent';
          result.status = e.kind === 'unknown' ? 'unknown' : 'failed';
          result.message = e.kind === 'unknown' ? 'Provider outcome is unknown. Reconcile before retrying.' : 'Request was not completed. Check the provider adapter before retrying.';
        } else {
          result.status = result.response ? 'failed' : didDispatch ? 'unknown' : 'failed';
          result.message = result.response ? 'Output failed evidence or schema validation. No suggestions were accepted.' : 'Requester, source or job is unavailable.';
        }
      }
      let validActor = true;
      try { await deadline.wait(() => actorValid(s, candidate)); }
      catch { deadline.check(); validActor = false; }
      await boundedTransaction(s, deadline, async tx => {
        await assertWritable(s, tx); const j = (await tx.get(doc.ref)).data() as Job;
        if (j.lease !== candidate.lease || j.status !== 'running' || j.leaseUntil <= Date.now()) return;
        const r = await readReview(s, tx, j.reviewId); const member = await tx.get(membersRef(s).doc(j.actorUid));
        const final = { ...result };
        try { if (!validActor) throw new Error(); requireMember(member.data(), { uid: j.actorUid, email: j.actorEmail } as DecodedIdToken, ['admin', 'reviewer']); }
        catch { final.status = 'failed'; final.message = 'Requester access is no longer valid.'; final.output = undefined; }
        if (r.revision !== j.baseRevision || r.assistanceId !== j.id) { final.status = 'stale'; final.message = 'The review changed. This result cannot replace current review work.'; final.output = undefined; }
        await saveAttempt(s, tx, j, provider, final, startedAt);
      }).catch(e => { if (!(e instanceof HttpError && e.status === 503)) throw e; });
      return true;
    }
    return false;
  } catch (e) {
    if (!deadline.signal.aborted) throw e;
    if (!claim) return false;
    // Identity or database reads may be stuck. Status-only cleanup must not repeat them or
    // accept a result. It has its own short bound and cannot prolong the provider's lease.
    clearInterval(heartbeat);
    const cleanup = new OperationDeadline(options.cleanupTimeoutMs ?? 5000);
    const claimed = claim;
    try {
      await boundedTransaction(s, cleanup, async tx => {
        await assertWritable(s, tx); const j = (await tx.get(jobs(s).doc(claimed.id))).data() as Job;
        if (j.lease !== claimed.lease || j.status !== 'running') return;
        await saveAttempt(s, tx, j, provider, {
          ...result, output: undefined, status: didDispatch ? 'unknown' : 'failed',
          message: didDispatch ? 'Operation deadline or cancellation; provider outcome must be reconciled.' : 'Operation ended before provider dispatch. No inference was sent.',
        }, startedAt);
      });
    } catch { /* Leave the durable claim/dispatch marker for lease recovery; never infer success. */ }
    finally { cleanup.dispose(); }
    return true;
  } finally { clearInterval(heartbeat); deadline.dispose(); }
}
export function startAssistanceWorker(s: Services) {
  let busy = false; let pending: Promise<unknown> = Promise.resolve(); const stop = new AbortController();
  const timer = setInterval(() => { if (busy) return; busy = true; pending = processNextAssistance(s, offlineProvider, { signal: stop.signal }).catch(() => console.error('Suggestion worker could not complete its local operation.')).finally(() => { busy = false; }); }, 1000);
  return async () => { clearInterval(timer); stop.abort(); await pending; };
}
