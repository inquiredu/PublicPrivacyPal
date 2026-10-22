import { randomUUID } from 'node:crypto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Services } from '../../server/firebase.ts';
import type { Review } from '../../shared/review.ts';
import { ANALYSIS_EXAMPLE } from '../../shared/analysis-example.ts';
import { buildAnalysisRequest, type AnalysisRequest } from '../../server/analysis/contract.ts';
import { recordedExample } from '../../server/analysis/offline.ts';
import { prepareAssistance } from '../../server/analysis/jobs.ts';
import { ProviderFailure, type AnalysisProvider, type ProviderResponse, type Usage } from '../../server/analysis/provider.ts';
import { practiceContract, digest } from '../../server/evaluation.ts';
import { sourceHash, editAnalysis } from '../../server/evidence.ts';
import { readReview, writeReview } from '../../server/review-storage.ts';

export const unknownUsage: Usage = { inputTokens: null, outputTokens: null, cachedInputTokens: null, reasoningTokens: null, costMicros: null };
export const knownUsage: Usage = { inputTokens: 200, outputTokens: 100, cachedInputTokens: 0, reasoningTokens: null, costMicros: 25 };
export const providerContract = practiceContract('community-evidence-v1');
export const providerRequest = buildAnalysisRequest(ANALYSIS_EXAMPLE, providerContract);
export function completedResponse(request = providerRequest, usage: Usage = knownUsage): ProviderResponse {
  return { status: 'completed', output: JSON.stringify({ ...recordedExample(request), schemaVersion: request.schemaVersion }), requestId: 'synthetic-provider-request', usage };
}
export function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

/** No network, credentials or vendor SDK: callbacks return authored envelopes only. */
export function scriptedProvider(options: {
  generate?: (request: AnalysisRequest, signal: AbortSignal) => Promise<ProviderResponse>;
  reconcile?: (attemptId: string, signal: AbortSignal) => Promise<ProviderResponse | null>;
  schemas?: string[];
} = {}) {
  const calls: { generate: string[]; reconcile: string[]; sent: string[] } = { generate: [], reconcile: [], sent: [] };
  const provider: AnalysisProvider = {
    id: 'synthetic-qualification', model: 'authored-response-v1', version: 'fake-transport-v1',
    settings: { retries: 0 }, maxCostMicros: 1000, offline: false,
    async generate(request, { attemptId, signal }) {
      calls.generate.push(attemptId);
      if (!(options.schemas || ['policy-suggestions-v1', 'policy-suggestions-v2']).includes(request.schemaVersion)) {
        throw new ProviderFailure('not_sent', 'Synthetic adapter does not support this wire version.');
      }
      signal.throwIfAborted();
      calls.sent.push(attemptId);
      return options.generate ? options.generate(request, signal) : completedResponse(request);
    },
    async reconcile(attemptId, signal) {
      calls.reconcile.push(attemptId);
      return options.reconcile ? options.reconcile(attemptId, signal) : null;
    },
  };
  return { provider, calls };
}

type Row = Record<string, any>;
class MemoryReference {
  constructor(readonly db: MemoryDatabase, readonly path: string) {}
  get id() { return this.path.split('/').at(-1)!; }
  collection(name: string) { return new MemoryQuery(this.db, `${this.path}/${name}`); }
}
class MemorySnapshot {
  constructor(readonly ref: MemoryReference, private readonly value: Row | undefined) {}
  get id() { return this.ref.id; }
  get exists() { return this.value !== undefined; }
  data() { return this.value === undefined ? undefined : structuredClone(this.value); }
  get(field: string) { return structuredClone(field.split('.').reduce<any>((v, key) => v?.[key], this.value)); }
}
class MemoryQuery {
  constructor(readonly db: MemoryDatabase, readonly path: string,
    private readonly filters: { field: string; values: unknown[] }[] = [], private readonly sort = '', private readonly count = Infinity) {}
  doc(id: string) { return new MemoryReference(this.db, `${this.path}/${id}`); }
  where(field: string, operator: string, value: unknown) {
    if (operator !== 'in') throw new Error('Qualification stub supports only the worker in-query.');
    return new MemoryQuery(this.db, this.path, [...this.filters, { field, values: value as unknown[] }], this.sort, this.count);
  }
  orderBy(field: string) { return new MemoryQuery(this.db, this.path, this.filters, field, this.count); }
  limit(count: number) { return new MemoryQuery(this.db, this.path, this.filters, this.sort, count); }
  async get() {
    const docs = [...this.db.rows].filter(([path, value]) => path.startsWith(`${this.path}/`) && !path.slice(this.path.length + 1).includes('/')
      && this.filters.every(f => f.values.includes(value[f.field])))
      .sort((a, b) => this.sort ? a[1][this.sort] - b[1][this.sort] : a[0].localeCompare(b[0]))
      .slice(0, this.count).map(([path, value]) => new MemorySnapshot(this.db.doc(path), structuredClone(value)));
    return { docs, empty: docs.length === 0, size: docs.length };
  }
}
class MemoryTransaction {
  readonly rows: Map<string, Row>;
  constructor(db: MemoryDatabase) { this.rows = structuredClone(db.rows); }
  async get(ref: MemoryReference) { return new MemorySnapshot(ref, this.rows.get(ref.path)); }
  async getAll(...refs: MemoryReference[]) { return Promise.all(refs.map(ref => this.get(ref))); }
  create(ref: MemoryReference, value: Row) {
    if (this.rows.has(ref.path)) throw new Error('Synthetic create collision.');
    this.rows.set(ref.path, structuredClone(value)); return this;
  }
  set(ref: MemoryReference, value: Row, options?: { merge: boolean }) {
    this.rows.set(ref.path, structuredClone(options?.merge ? { ...this.rows.get(ref.path), ...value } : value)); return this;
  }
  update(ref: MemoryReference, value: Row) {
    if (!this.rows.has(ref.path)) throw new Error('Synthetic update of missing document.');
    return this.set(ref, value, { merge: true });
  }
}
/** Narrow serial/atomic storage double, not Firestore rules, transaction retry or RPC emulation. */
class MemoryDatabase {
  rows = new Map<string, Row>();
  private pending: Promise<void> = Promise.resolve();
  doc(path: string) { return new MemoryReference(this, path); }
  collection(path: string) { return new MemoryQuery(this, path); }
  async runTransaction<T>(body: (tx: MemoryTransaction) => Promise<T>): Promise<T> {
    const previous = this.pending, done = deferred<void>(); this.pending = done.promise;
    await previous;
    try { const tx = new MemoryTransaction(this), value = await body(tx); this.rows = tx.rows; return value; }
    finally { done.resolve(); }
  }
}

/** Seeds a hypothetical non-offline job directly. Shipped prepareAssistance cannot register it. */
export async function qualificationHarness(provider: AnalysisProvider, request = providerRequest) {
  const db = new MemoryDatabase(), districtId = 'demo-provider-qualification', reviewId = randomUUID(), jobId = randomUUID();
  const actor = { uid: 'synthetic-reviewer', email: 'reviewer@school.example', email_verified: true } as DecodedIdToken;
  const root = `districts/${districtId}`, jobPath = `${root}/assistanceJobs/${jobId}`, reviewPath = `${root}/reviews/${reviewId}`;
  const day = '2026-10-18', budgetPath = `${root}/assistanceBudgets/${day}`, memberPath = `${root}/members/${actor.uid}`;
  let identityHook: (() => Promise<void>) | undefined;
  const services = { config: { projectId: districtId, districtId }, db, auth: { async getUser() {
    await identityHook?.(); return { uid: actor.uid, email: actor.email, emailVerified: true, disabled: false };
  } } } as unknown as Services;
  const at = '2026-10-18T20:00:00.000Z';
  const review: Review = { id: reviewId, name: 'Synthetic qualification review', fixtureId: null, sourceKind: 'pasted',
    sourceLabel: 'Authored Cedar source', sourceHash: sourceHash(ANALYSIS_EXAMPLE), sourceVersion: 1, sourceCapturedAt: at,
    sourceText: ANALYSIS_EXAMPLE, contract: providerContract, profileVersion: 'community-evidence-v1', revision: 2,
    assistanceId: jobId, assistanceCount: 1, analysis: null, decision: null, published: false, createdAt: at, updatedAt: at,
    job: { id: randomUUID(), status: 'awaiting_review', attempt: 0, actorUid: actor.uid, actorEmail: actor.email!, leaseUntil: 0, error: null },
  };
  await services.db.runTransaction(async tx => { writeReview(services, tx, review); });
  const key = digest({ request: request.key, provider: provider.id, model: provider.model, version: provider.version, settings: provider.settings });
  db.rows.set(memberPath, { email: actor.email, role: 'reviewer', active: true });
  db.rows.set(budgetPath, { count: 1, reservedMicros: provider.maxCostMicros, spentMicros: 0 });
  db.rows.set(`${reviewPath}/assistanceKeys/${key}`, { activeJob: jobId, attempts: 1, resultId: null });
  db.rows.set(jobPath, { id: jobId, reviewId, key, status: 'queued', provider: provider.id, model: provider.model,
    providerVersion: provider.version, promptVersion: request.promptVersion, actorUid: actor.uid, actorEmail: actor.email,
    baseRevision: 2, createdAt: at, updatedAt: at, message: 'Synthetic queued job', reused: false, resultId: null,
    lease: '', leaseUntil: 0, dispatched: false, day, reservedMicros: provider.maxCostMicros, usage: null, settled: false,
  });
  return {
    services, jobId, reviewId, db,
    job: () => structuredClone(db.rows.get(jobPath)!),
    budget: () => structuredClone(db.rows.get(budgetPath)!),
    results: () => [...db.rows].filter(([path]) => path.startsWith(`${reviewPath}/suggestions/`)).map(([, row]) => structuredClone(row)),
    patchJob: (patch: Row) => db.rows.set(jobPath, { ...db.rows.get(jobPath), ...patch }),
    revoke: () => db.rows.set(memberPath, { ...db.rows.get(memberPath), active: false }),
    maintenance: (active: boolean) => active ? db.rows.set('installation/maintenance', { id: 'synthetic-fence' }) : db.rows.delete('installation/maintenance'),
    identityWait: (hook: () => Promise<void>) => { identityHook = hook; },
    review: () => services.db.runTransaction(tx => readReview(services, tx, reviewId)),
    cancel: () => services.db.runTransaction(async tx => {
      const current = await readReview(services, tx, reviewId); await prepareAssistance(services, tx, actor, current, true);
    }),
    correct: () => services.db.runTransaction(async tx => {
      const prior = await readReview(services, tx, reviewId), next = structuredClone(prior), passage = request.source.passages[3];
      next.analysis = editAnalysis(prior.sourceText, prior.profileVersion!, prior.analysis, {
        criterionId: 'deletion', finding: 'partial', citations: [{ quote: passage.text, start: passage.start, end: passage.end }],
        rationale: 'Human correction preserves the backup exception.',
      }, randomUUID(), actor.uid, at, prior.contract);
      next.revision++; writeReview(services, tx, next, prior); return next;
    }),
  };
}
