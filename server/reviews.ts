import { randomUUID } from 'node:crypto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { createReviewSchema, actionSchema, type Review } from '../shared/review.ts';
import type { Services } from './firebase.ts';
import { HttpError, membersRef, requireMember, assertWritable } from './operations.ts';
import { fixtures, analyzeSynthetic } from './synthetic-analysis.ts';

const readers = ['admin', 'reviewer', 'viewer'] as const;
const editors = ['admin', 'reviewer'] as const;
const reviews = (s: Services) => s.db.collection(`districts/${s.config.districtId}/reviews`);
const publicRef = (s: Services, id: string) => s.db.doc(`publicDistricts/${s.config.districtId}/tools/review-${id}`);
const staffRef = (s: Services, id: string) => s.db.doc(`districts/${s.config.districtId}/staffTools/review-${id}`);
const nowISO = () => new Date().toISOString();
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw new HttpError(400, 'Invalid review command. Check required fields and conditions.');
  return result.data;
}
async function authorize(s: Services, tx: Transaction, actor: DecodedIdToken, edit = false) {
  requireMember((await tx.get(membersRef(s).doc(actor.uid))).data(), actor, edit ? editors : readers);
  if (edit) await assertWritable(s, tx);
}
function event(s: Services, tx: Transaction, r: Review, action: string, actorUid: string, details: unknown = null) {
  tx.create(reviews(s).doc(r.id).collection('history').doc(), { action, actorUid, at: nowISO(), revision: r.revision, details });
}
function unpublish(s: Services, tx: Transaction, id: string) { tx.delete(publicRef(s, id)); tx.delete(staffRef(s, id)); }
async function quota(s: Services, tx: Transaction) {
  const ref = s.db.doc(`districts/${s.config.districtId}/analysisUsage/${nowISO().slice(0, 10)}`);
  const used = (await tx.get(ref)).get('count') || 0;
  if (used >= 100) throw new HttpError(429, 'The local district limit of 100 analysis attempts per UTC day has been reached.');
  // Caller must complete every other read before writing this quota.
  return () => tx.set(ref, { count: used + 1 });
}
function job(actor: DecodedIdToken, attempt = 1): Review['job'] {
  return { id: randomUUID(), status: 'queued', actorUid: actor.uid, actorEmail: actor.email!, attempt, leaseUntil: 0, error: null };
}
export async function listReviews(s: Services, actor: DecodedIdToken) {
  return s.db.runTransaction(async tx => {
    await authorize(s, tx, actor);
    const rows = await tx.get(reviews(s).orderBy('updatedAt', 'desc').limit(100));
    return rows.docs.map(d => d.data());
  });
}
export async function createReview(s: Services, actor: DecodedIdToken, raw: unknown, imported = false) {
  const input = parse(createReviewSchema, raw);
  const id = randomUUID();
  return s.db.runTransaction(async tx => {
    await authorize(s, tx, actor, true);
    const count = await tx.get(reviews(s).limit(100));
    if (count.size >= 100) throw new HttpError(429, 'This local sandbox is limited to 100 reviews.');
    const spend = await quota(s, tx);
    const r: Review = { id, ...input, sourceText: fixtures[input.fixtureId].text, revision: 1, analysis: null, decision: null, published: false, job: job(actor), createdAt: nowISO(), updatedAt: nowISO() };
    spend(); tx.create(reviews(s).doc(id), r);
    event(s, tx, r, imported ? 'imported_as_draft' : 'analysis_queued', actor.uid);
    return r;
  });
}
export async function reviewAction(s: Services, actor: DecodedIdToken, id: string, raw: unknown) {
  const input = parse(actionSchema, raw);
  return s.db.runTransaction(async tx => {
    await authorize(s, tx, actor, true);
    const ref = reviews(s).doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, 'Review not found.');
    const r = snap.data() as Review;
    if (r.revision !== input.revision) throw new HttpError(409, 'This review changed. Refresh it before trying again.');
    const active = ['queued', 'running'].includes(r.job.status);
    let spend: (() => unknown) | undefined;
    if (input.action === 'retry' || input.action === 'reanalyze') {
      if (active || (input.action === 'retry' && r.job.status !== 'failed')) throw new HttpError(409, 'The analysis is not ready for that action.');
      if (input.action === 'retry' && r.job.attempt >= 3) throw new HttpError(409, 'Retry limit reached. Start a new analysis.');
      spend = await quota(s, tx);
      r.job = job(actor, input.action === 'retry' ? r.job.attempt + 1 : 1);
      // Preserve the previous findings and human decision for comparison, but mark them stale.
      r.published = false;
    } else if (input.action === 'cancel') {
      if (!active) throw new HttpError(409, 'There is no active analysis to cancel.');
      r.job.status = 'cancelled'; r.job.leaseUntil = 0;
    } else if (input.action === 'decide') {
      if (r.job.status !== 'succeeded' || r.analysis?.id !== r.job.id) throw new HttpError(409, 'Complete the current analysis before deciding.');
      r.decision = { ...input.decision, analysisId: r.analysis.id, actorUid: actor.uid, at: nowISO() };
      r.published = false;
    } else if (input.action === 'publish') {
      if (r.job.status !== 'succeeded' || !r.analysis || r.analysis.id !== r.job.id || r.decision?.analysisId !== r.analysis.id || !['approved', 'conditional'].includes(r.decision.outcome)) throw new HttpError(409, 'A current approved or conditional human decision is required before publishing.');
      r.published = true;
    } else { r.published = false; }
    const before = snap.get('decision') ?? null;
    r.revision++; r.updatedAt = nowISO();
    spend?.();
    if (r.published) {
      // Explicit projection only: never copy source, evidence, rationale, identity, or job errors.
      const d = r.decision!;
      const profile = { name: r.name, category: d.category, summary: d.summary, outcome: d.outcome, conditions: d.conditions, reviewedAt: d.at, synthetic: true };
      tx.set(publicRef(s, id), profile); tx.set(staffRef(s, id), profile);
    } else { unpublish(s, tx, id); }
    tx.set(ref, r);
    event(s, tx, r, input.action, actor.uid, input.action === 'decide' ? { before, after: r.decision } : null);
    return r;
  });
}
export async function reviewHistory(s: Services, actor: DecodedIdToken, id: string) {
  return s.db.runTransaction(async tx => {
    await authorize(s, tx, actor);
    const rows = await tx.get(reviews(s).doc(id).collection('history').orderBy('at'));
    return rows.docs.map(d => ({ id: d.id, ...d.data() }));
  });
}
export async function exportReview(s: Services, actor: DecodedIdToken, id: string) {
  return s.db.runTransaction(async tx => {
    await authorize(s, tx, actor);
    const ref = reviews(s).doc(id);
    const [snap, history] = await Promise.all([tx.get(ref), tx.get(ref.collection('history').orderBy('at'))]);
    if (!snap.exists) throw new HttpError(404, 'Review not found.');
    const r = snap.data() as Review;
    return { format: 'privacypal-synthetic-v1', draft: { name: r.name, fixtureId: r.fixtureId, profileVersion: r.profileVersion || 'community-demo-v1' }, sourceText: r.sourceText, snapshot: { analysis: r.analysis, decision: r.decision, history: history.docs.map(d => d.data()) } };
  });
}
export async function importReview(s: Services, actor: DecodedIdToken, raw: unknown) {
  const data = parse(z.object({ format: z.literal('privacypal-synthetic-v1'), draft: createReviewSchema, sourceText: z.string().max(8000), snapshot: z.unknown() }).strict(), raw);
  if (data.sourceText !== fixtures[data.draft.fixtureId].text) throw new HttpError(400, 'Imported policy must match a bundled synthetic fixture.');
  // Historical exports are evidence for a human; they cannot confer a new district's approval.
  return createReview(s, actor, data.draft, true);
}

/** Claims one job using a lease. Queued and expired running jobs survive browser/API restarts. */
export async function processNextReview(s: Services, clock = Date.now()) {
  const candidates = await reviews(s).where('job.status', 'in', ['queued', 'running']).limit(100).get();
  for (const candidate of candidates.docs) {
    const claimed = await s.db.runTransaction(async tx => {
      if ((await tx.get(s.db.doc('installation/maintenance'))).exists) return null;
      const snap = await tx.get(candidate.ref);
      const r = snap.data() as Review;
      if (!['queued', 'running'].includes(r.job.status) || r.job.leaseUntil > clock) return null;
      r.job.status = 'running'; r.job.leaseUntil = clock + 30_000; r.revision++; r.updatedAt = nowISO();
      tx.set(candidate.ref, r); return r;
    });
    if (!claimed) continue;
    let analysis: Review['analysis'] = null;
    let error: string | null = null;
    try {
      const user = await s.auth.getUser(claimed.job.actorUid);
      if (user.disabled || !user.emailVerified || user.email !== claimed.job.actorEmail) throw new Error('Account unavailable.');
      if (claimed.fixtureId === 'retry' && claimed.job.attempt === 1) throw new Error('Synthetic temporary failure. Retry this analysis.');
      analysis = analyzeSynthetic(claimed.fixtureId, claimed.sourceText, claimed.job.id, claimed.profileVersion || 'community-demo-v1');
    } catch { error = claimed.fixtureId === 'retry' && claimed.job.attempt === 1 ? 'Synthetic temporary failure. Retry this analysis.' : 'Analysis failed. Check the source and account, then retry.'; }
    await s.db.runTransaction(async tx => {
      if ((await tx.get(s.db.doc('installation/maintenance'))).exists) return;
      const [snap, member] = await Promise.all([tx.get(candidate.ref), tx.get(membersRef(s).doc(claimed.job.actorUid))]);
      const r = snap.data() as Review;
      if (r.job.id !== claimed.job.id || r.job.status !== 'running' || r.job.leaseUntil !== claimed.job.leaseUntil) return;
      try { requireMember(member.data(), { uid: r.job.actorUid, email: r.job.actorEmail } as DecodedIdToken, editors); }
      catch { error = 'The requesting reviewer no longer has access. An active reviewer can retry.'; }
      r.job.status = error ? 'failed' : 'succeeded'; r.job.error = error; r.job.leaseUntil = 0;
      if (!error) r.analysis = analysis;
      r.revision++; r.updatedAt = nowISO();
      tx.set(candidate.ref, r);
      event(s, tx, r, error ? 'analysis_failed' : 'analysis_completed', r.job.actorUid, error ? { error } : { analysis });
    });
    return true;
  }
  return false;
}
export function startReviewWorker(s: Services) {
  let stopped = false;
  let pending: Promise<unknown> = Promise.resolve();
  let busy = false;
  const timer = setInterval(() => {
    if (busy || stopped) return;
    busy = true;
    pending = processNextReview(s).catch(error => console.error('Local analysis worker:', error.message)).finally(() => { busy = false; });
  }, 500);
  return async () => { stopped = true; clearInterval(timer); await pending; };
}
