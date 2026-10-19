import { LONG_BUNDLE_VERSION } from '../shared/source-segments.ts';
import { prepareAssistance, verifiedProposal } from './analysis/jobs.ts';
import { FieldPath } from 'firebase-admin/firestore';
import { PAGE_SIZE } from '../shared/evaluation.ts';
import type { SavedSettings, EvaluationSettings } from '../shared/settings.ts';
import { districtContract, practiceContract } from './evaluation.ts';
import { readReview, readEvaluation, writeReview, summary, bounded, decodeCursor, encodeCursor, historyPage, type ReviewHead } from './review-storage.ts';
import { replayCommand, recordCommand, type CommandIdentity } from './commands.ts';
import { emptyService, serviceBlockers, decisionIsCurrent, audienceProjection, type ServiceRecord } from '../shared/service.ts';
import { tierPolicySchema } from '../shared/service-policy.ts';
import { randomUUID, createHash } from 'node:crypto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { createReviewSchema, fixtureReviewSchema, pastedReviewSchema, actionSchema, currentAnalysis, isPastedReview, evidenceComplete, type Review } from '../shared/review.ts';
import type { Services } from './firebase.ts';
import { HttpError, membersRef, requireMember, assertWritable } from './operations.ts';
import { fixtures, analyzeSynthetic } from './synthetic-analysis.ts';
import { editAnalysis, sourceHash } from './evidence.ts';
import { captureSourceBundle, bundleText } from './source-bundle.ts';
import { captureDefinitions } from './capture-definitions.ts';
import { profileVersions } from '../shared/scoring/profiles.ts';

const readers = ['admin', 'reviewer', 'viewer'] as const;
const editors = ['admin', 'reviewer'] as const;
const reviews = (s: Services) => s.db.collection(`districts/${s.config.districtId}/reviews`);
const publicRef = (s: Services, id: string) => s.db.doc(`publicDistricts/${s.config.districtId}/tools/review-${id}`);
const staffRef = (s: Services, id: string) => s.db.doc(`districts/${s.config.districtId}/staffTools/review-${id}`);
const nowISO = () => new Date().toISOString();
function parse<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (!result.success) throw new HttpError(400, `Invalid review command. ${result.error.issues[0]?.message || 'Check required fields and conditions.'}`);
  return result.data;
}
async function authorize(s: Services, tx: Transaction, actor: DecodedIdToken, edit = false) {
  requireMember((await tx.get(membersRef(s).doc(actor.uid))).data(), actor, edit ? editors : readers);
  if (edit) await assertWritable(s, tx);
}
function event(s: Services, tx: Transaction, r: Review, action: string, actorUid: string, details: unknown = null) {
  tx.create(reviews(s).doc(r.id).collection('history').doc(), bounded('history', { action, actorUid, at: nowISO(), revision: r.revision, details }));
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
async function adoptService(s: Services, tx: Transaction, actor: DecodedIdToken, revision: number): Promise<ServiceRecord> {
  const saved = (await tx.get(s.db.doc(`districts/${s.config.districtId}/settings/evaluation`))).data() as SavedSettings<EvaluationSettings> | undefined;
  if (!saved?.complete || saved.revision !== revision || !saved.values.tierPolicy) throw new HttpError(409, 'Ask an administrator to save a tier policy in Settings, then adopt its current revision.');
  if (saved.contentHash !== createHash('sha256').update(JSON.stringify({ definitionVersion: saved.definitionVersion, values: saved.values })).digest('hex')) throw new HttpError(409, 'The saved settings hash does not match.');
  return { version: 1, revision: 1, values: emptyService(), policy: tierPolicySchema.parse(saved.values.tierPolicy), settingsRevision: revision, updatedAt: nowISO(), updatedBy: actor.uid, rationale: 'Explicitly adopted the saved district tier policy.' };
}
export async function listReviews(s: Services, actor: DecodedIdToken, cursor?: string) {
  return s.db.runTransaction(async tx => {
    await authorize(s, tx, actor);
    const scope = `reviews:${s.config.districtId}`; const after = decodeCursor(cursor, scope);
    let q = reviews(s).orderBy('createdAt', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(PAGE_SIZE + 1);
    if (after) q = q.startAfter(after.at, after.id);
    const rows = await tx.get(q); const page = rows.docs.slice(0, PAGE_SIZE); const last = page.at(-1);
    if (page.some(d => d.get('storageVersion') !== 3)) throw new HttpError(409, 'Run the local review storage migration.');
    return { items: page.map(d => summary(d.data() as ReviewHead)), nextCursor: rows.size > PAGE_SIZE && last ? encodeCursor(scope, last.get('createdAt'), last.id) : null };
  });
}
export async function reviewDetail(s: Services, actor: DecodedIdToken, id: string, evaluationId?: string) {
  return s.db.runTransaction(async tx => { await authorize(s, tx, actor); return evaluationId ? readEvaluation(s, tx, id, evaluationId) : readReview(s, tx, id); });
}
export async function rubricStatus(s: Services, actor: DecodedIdToken) {
  return s.db.runTransaction(async tx => {
    await authorize(s, tx, actor);
    const saved = await tx.get(s.db.doc(`districts/${s.config.districtId}/settings/evaluation`));
    const available = saved.get('complete') === true && ['pef-2.0', 'pef-precision-v1'].includes(saved.get('values.starterProfile'));
    return { servicePolicyAvailable: !!saved.get('values.tierPolicy'), available, revision: saved.get('revision') || 0, measureCount: available ? 50 : 0, profile: available ? saved.get('values.starterProfile') : null,
      captureDefinitions: { practice: Object.fromEntries(profileVersions.map(version => [version, captureDefinitions(practiceContract(version))])),
        district: available ? captureDefinitions(districtContract(saved.data() as SavedSettings<EvaluationSettings>, saved.get('revision'), 'evidence-weighted-v1')) : null } };
  });
}
export async function createReview(s: Services, actor: DecodedIdToken, raw: unknown, imported = false, command?: CommandIdentity) {
  const input = parse(createReviewSchema, raw);
  const id = randomUUID();
  return s.db.runTransaction(async tx => {
    await authorize(s, tx, actor, true);
    const replay = await replayCommand(s, tx, actor, command); if (replay) return replay;
    const counter = s.db.doc(`districts/${s.config.districtId}/reviewCounters/current`);
    const count = await tx.get(counter);
    if (!count.exists && !(await tx.get(reviews(s).limit(1))).empty) throw new HttpError(409, 'Run the local review storage migration.');
    const total = count.get('count') || 0;
    if (total >= 1000) throw new HttpError(429, 'This local sandbox is limited to 1000 reviews.');
    const contract = 'rubricMode' in input ? districtContract((await tx.get(s.db.doc(`districts/${s.config.districtId}/settings/evaluation`))).data() as SavedSettings<EvaluationSettings> | undefined, input.settingsRevision, input.engineVersion) : practiceContract(input.profileVersion);
    if ('sourceDefinitionId' in input && input.sourceDefinitionId && input.sourceDefinitionId !== captureDefinitions(contract).id) throw new HttpError(409, 'The source dependency definitions changed. Refresh and explicitly adopt the current definitions; your draft is retained.');
    const service = input.serviceSettingsRevision ? await adoptService(s, tx, actor, input.serviceSettingsRevision) : undefined;
    const pasted = 'sourceKind' in input;
    const spend = pasted ? undefined : await quota(s, tx);
    const capturedAt = nowISO();
    let sourceBundle;
    try { sourceBundle = 'sourceBundle' in input ? captureSourceBundle(input.sourceBundle, contract, capturedAt) : undefined; }
    catch (error) { throw new HttpError(400, error instanceof Error ? error.message : 'Invalid source bundle.'); }
    const text = sourceBundle ? bundleText(sourceBundle) : 'sourceText' in input ? input.sourceText : fixtures['fixtureId' in input ? input.fixtureId : 'complete'].text;
    const r: Review = {
      id, name: input.name, contract, ...(service ? { service } : {}), profileVersion: input.profileVersion,
      fixtureId: 'fixtureId' in input ? input.fixtureId : null, sourceKind: sourceBundle ? 'bundle' : pasted ? 'pasted' : 'fixture',
      sourceLabel: 'sourceKind' in input ? input.sourceLabel : fixtures[input.fixtureId].label,
      ...(sourceBundle ? { sourceBundle } : {}), sourceText: text, sourceHash: sourceBundle?.id || sourceHash(text), sourceVersion: sourceBundle?.version === LONG_BUNDLE_VERSION ? 3 : sourceBundle ? 2 : 1, sourceCapturedAt: capturedAt,
      revision: 1, analysis: null, decision: null, published: false,
      job: { ...job(actor), ...(pasted ? { status: 'awaiting_review' as const, attempt: 0 } : {}) },
      createdAt: capturedAt, updatedAt: capturedAt,
    };
    spend?.(); tx.set(counter, { count: total + 1 }); writeReview(s, tx, r);
    event(s, tx, r, imported ? 'imported_as_draft' : pasted ? 'policy_captured' : 'analysis_queued', actor.uid, { sourceHash: r.sourceHash, sourceVersion: r.sourceVersion, sourceLabel: r.sourceLabel });
    recordCommand(s, tx, actor, r, command);
    return r;
  });
}
export async function reviewAction(s: Services, actor: DecodedIdToken, id: string, raw: unknown, command?: CommandIdentity) {
  const input = parse(actionSchema, raw);
  return s.db.runTransaction(async tx => {
    await authorize(s, tx, actor, true);
    const replay = await replayCommand(s, tx, actor, command); if (replay) return replay;
    const ref = reviews(s).doc(id);
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpError(404, 'Review not found.');
    const r = await readReview(s, tx, id, snap);
    const previousReview = structuredClone(r);
    if (r.revision !== input.revision) throw new HttpError(409, 'This review changed. Refresh it before trying again.');
    const active = ['queued', 'running'].includes(r.job.status);
    let spend: (() => unknown) | undefined;
    let details: unknown = null;
    if (input.action === 'start_assistance' || input.action === 'cancel_assistance') {
      await prepareAssistance(s, tx, actor, r, input.action === 'cancel_assistance');
      details = { assistanceId: r.assistanceId };
    } else if (input.action === 'adopt_service') {
      if (r.service) throw new HttpError(409, 'This review already has an adopted tier policy. Create a new review to adopt different requirements.');
      r.service = await adoptService(s, tx, actor, input.settingsRevision); r.published = false;
      details = { serviceRevision: r.service.revision, policyVersion: r.service.policy.version, settingsRevision: r.service.settingsRevision };
    } else if (input.action === 'edit_service') {
      if (!r.service) throw new HttpError(409, 'Adopt the saved district tier policy before editing service details.');
      if (active) throw new HttpError(409, 'Finish or cancel the current analysis before editing service details.');
      if (input.service.values.dpaStatus === 'recorded' && input.service.values.dpaSigned > nowISO().slice(0, 10)) throw new HttpError(400, 'A recorded agreement cannot have a future signing date.');
      r.service = { ...r.service, revision: r.service.revision + 1, values: input.service.values, rationale: input.service.rationale, updatedAt: nowISO(), updatedBy: actor.uid };
      r.published = false;
      details = { before: previousReview.service, after: r.service };
    } else if (input.action === 'retry' || input.action === 'reanalyze') {
      if (isPastedReview(r)) throw new HttpError(409, 'Pasted policies are reviewed manually. Edit the evidence for each criterion.');
      if (active || (input.action === 'retry' && r.job.status !== 'failed')) throw new HttpError(409, 'The analysis is not ready for that action.');
      if (input.action === 'retry' && r.job.attempt >= 3) throw new HttpError(409, 'Retry limit reached. Start a new analysis.');
      spend = await quota(s, tx);
      r.job = job(actor, input.action === 'retry' ? r.job.attempt + 1 : 1);
      // Preserve the previous findings and human decision for comparison, but mark them stale.
      r.published = false;
    } else if (input.action === 'cancel') {
      if (!active) throw new HttpError(409, 'There is no active analysis to cancel.');
      r.job.status = 'cancelled'; r.job.leaseUntil = 0;
    } else if (input.action === 'edit_evidence') {
      if (!['awaiting_review', 'succeeded'].includes(r.job.status)) throw new HttpError(409, 'Finish the current analysis before editing its evidence.');
      const previous = r.analysis;
      const at = nowISO(); const analysisId = randomUUID();
      const proposal = input.evidence.proposalId ? await verifiedProposal(s, tx, r, input.evidence.proposalId, input.evidence.criterionId) : undefined;
      try { r.analysis = editAnalysis(r.sourceText, r.profileVersion || 'community-demo-v1', previous, input.evidence, analysisId, actor.uid, at, r.contract, proposal, isPastedReview(r), r.sourceBundle); }
      catch (error) { throw new HttpError(400, error instanceof Error ? error.message : 'Invalid evidence.'); }
      r.job = { id: analysisId, status: evidenceComplete(r) ? 'succeeded' : 'awaiting_review', attempt: 0, actorUid: actor.uid, actorEmail: actor.email!, leaseUntil: 0, error: null };
      r.published = false;
      details = { criterionId: input.evidence.criterionId,
        before: previous?.findings.find(f => f.id === input.evidence.criterionId) || null,
        after: r.analysis.findings.find(f => f.id === input.evidence.criterionId),
        beforeAnalysisId: previous?.id || null, afterAnalysisId: analysisId,
        beforeScore: previous?.score.total ?? null, afterScore: r.analysis.score.total,
        sourceHash: r.analysis.sourceHash, profileVersion: r.analysis.profileVersion,
      };
    } else if (input.action === 'decide') {
      if (!currentAnalysis(r)) throw new HttpError(409, 'Complete the current evidence review before deciding. Each pasted-policy criterion needs an explicit finding and rationale.');
      if (input.decision.outcome !== 'declined' && serviceBlockers(r.service).length) throw new HttpError(409, serviceBlockers(r.service).join(' '));
      r.decision = { ...input.decision, ...(r.service ? { serviceRevision: r.service.revision } : {}), analysisId: r.analysis!.id, actorUid: actor.uid, at: nowISO() };
      r.published = false;
    } else if (input.action === 'publish') {
      if (!currentAnalysis(r) || !r.analysis || !decisionIsCurrent(r) || !r.decision || !['approved', 'conditional'].includes(r.decision.outcome)) throw new HttpError(409, 'A current approved or conditional human decision is required before publishing.');
      if (serviceBlockers(r.service).length) throw new HttpError(409, serviceBlockers(r.service).join(' '));
      r.published = true;
    } else { r.published = false; }
    const before = previousReview.decision;
    r.revision++; r.updatedAt = nowISO();
    spend?.();
    if (r.published) {
      // Explicit projection only: never copy source, evidence, rationale, identity, or job errors.
      tx.set(publicRef(s, id), audienceProjection(r, 'public')!); tx.set(staffRef(s, id), audienceProjection(r, 'staff')!);
    } else { unpublish(s, tx, id); }
    writeReview(s, tx, r, previousReview);
    event(s, tx, r, input.action, actor.uid, input.action === 'decide' ? { before, after: r.decision } : details);
    recordCommand(s, tx, actor, r, command);
    return r;
  });
}
export async function reviewHistory(s: Services, actor: DecodedIdToken, id: string, cursor?: string) {
  return s.db.runTransaction(async tx => {
    await authorize(s, tx, actor);
    const scope = `history:${s.config.districtId}:${id}`; const after = decodeCursor(cursor, scope);
    let q = reviews(s).doc(id).collection('history').orderBy('at', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(PAGE_SIZE + 1);
    if (after) q = q.startAfter(after.at, after.id);
    return historyPage((await tx.get(q)).docs, scope);
  });
}
export async function exportReview(s: Services, actor: DecodedIdToken, id: string) {
  // Current snapshot and one bounded history page. The cursor permits explicit continuation.
  return s.db.runTransaction(async tx => {
    await authorize(s, tx, actor);
    const r = await readReview(s, tx, id);
    const rows = (await tx.get(reviews(s).doc(id).collection('history').orderBy('at', 'desc').orderBy(FieldPath.documentId(), 'desc').limit(PAGE_SIZE + 1))).docs;
    const page = historyPage(rows, `history:${s.config.districtId}:${id}`);
    const bundle = { format: r.sourceBundle?.version === LONG_BUNDLE_VERSION ? 'privacypal-source-bundle-v2' : r.sourceBundle ? 'privacypal-source-bundle-v1' : r.contract?.kind === 'district' ? 'privacypal-district-v1' : isPastedReview(r) ? 'privacypal-pasted-v1' : 'privacypal-synthetic-v1',
      draft: isPastedReview(r) ? { name: r.name, sourceKind: 'pasted', sourceLabel: r.sourceLabel, sourceText: r.sourceText, profileVersion: r.profileVersion } : { name: r.name, fixtureId: r.fixtureId, profileVersion: r.profileVersion || 'community-demo-v1' },
      ...(r.sourceBundle ? { sourceBundle: r.sourceBundle } : {}), ...(!isPastedReview(r) ? { sourceText: r.sourceText } : {}), snapshot: { ...(r.service ? { service: r.service } : {}), contract: r.contract, analysis: r.analysis, decision: r.decision, history: page.items, historyNextCursor: page.nextCursor } };
    while (Buffer.byteLength(JSON.stringify(bundle)) > 2 * 1024 * 1024 && bundle.snapshot.history.length) {
      bundle.snapshot.history.pop(); const last = bundle.snapshot.history.at(-1);
      bundle.snapshot.historyNextCursor = last ? encodeCursor(`history:${s.config.districtId}:${id}`, last.at, last.id) : null;
    }
    if ((!bundle.snapshot.history.length && rows.length) || Buffer.byteLength(JSON.stringify(bundle)) > 2 * 1024 * 1024) throw new HttpError(413, 'Snapshot exceeds the export limit. Use the paged review endpoints or installation backup.');
    return bundle;
  });
}
export async function importReview(s: Services, actor: DecodedIdToken, raw: unknown, command?: CommandIdentity) {
  if (raw && typeof raw === 'object' && 'format' in raw && ['privacypal-source-bundle-v1', 'privacypal-source-bundle-v2'].includes(String(raw.format))) throw new HttpError(400, 'This source-bundle export is an archive. Explicitly capture a new bundle and adopt its required documents and rubric.');
  if (raw && typeof raw === 'object' && 'format' in raw && raw.format === 'privacypal-district-v1') throw new HttpError(400, 'This district-rubric export is an archive. Paste its source as a new review and explicitly select your current saved rubric.');
  const data = parse(z.discriminatedUnion('format', [
    z.object({ format: z.literal('privacypal-synthetic-v1'), draft: fixtureReviewSchema, sourceText: z.string().max(8000), snapshot: z.unknown() }).strict(),
    z.object({ format: z.literal('privacypal-pasted-v1'), draft: pastedReviewSchema, snapshot: z.unknown() }).strict(),
  ]), raw);
  if (data.format === 'privacypal-pasted-v1') return createReview(s, actor, data.draft, true, command);
  if (data.sourceText !== fixtures[data.draft.fixtureId].text) throw new HttpError(400, 'Imported policy must match a bundled synthetic fixture.');
  // Historical exports are evidence for a human; they cannot confer a new district's approval.
  return createReview(s, actor, data.draft, true, command);
}

/** Claims one job using a lease. Queued and expired running jobs survive browser/API restarts. */
export async function processNextReview(s: Services, clock = Date.now()) {
  const candidates = await reviews(s).where('job.status', 'in', ['queued', 'running']).limit(20).get();
  for (const candidate of candidates.docs) {
    const claimed = await s.db.runTransaction(async tx => {
      if ((await tx.get(s.db.doc('installation/maintenance'))).exists) return null;
      const snap = await tx.get(candidate.ref);
      const r = await readReview(s, tx, candidate.id, snap);
      const previousReview = structuredClone(r);
      if (!['queued', 'running'].includes(r.job.status) || r.job.leaseUntil > clock) return null;
      r.job.status = 'running'; r.job.leaseUntil = clock + 30_000; r.revision++; r.updatedAt = nowISO();
      writeReview(s, tx, r, previousReview); return r;
    });
    if (!claimed) continue;
    let analysis: Review['analysis'] = null;
    let error: string | null = null;
    try {
      const user = await s.auth.getUser(claimed.job.actorUid);
      if (user.disabled || !user.emailVerified || user.email !== claimed.job.actorEmail) throw new Error('Account unavailable.');
      if (claimed.fixtureId === 'retry' && claimed.job.attempt === 1) throw new Error('Synthetic temporary failure. Retry this analysis.');
      if (!claimed.fixtureId || isPastedReview(claimed)) throw new Error('Pasted text cannot be sent to the fixture adapter.');
      analysis = analyzeSynthetic(claimed.fixtureId, claimed.sourceText, claimed.job.id, claimed.profileVersion || 'community-demo-v1');
    } catch { error = claimed.fixtureId === 'retry' && claimed.job.attempt === 1 ? 'Synthetic temporary failure. Retry this analysis.' : 'Analysis failed. Check the source and account, then retry.'; }
    await s.db.runTransaction(async tx => {
      if ((await tx.get(s.db.doc('installation/maintenance'))).exists) return;
      const [snap, member] = await Promise.all([tx.get(candidate.ref), tx.get(membersRef(s).doc(claimed.job.actorUid))]);
      const r = await readReview(s, tx, candidate.id, snap);
      const previousReview = structuredClone(r);
      if (r.job.id !== claimed.job.id || r.job.status !== 'running' || r.job.leaseUntil !== claimed.job.leaseUntil) return;
      try { requireMember(member.data(), { uid: r.job.actorUid, email: r.job.actorEmail } as DecodedIdToken, editors); }
      catch { error = 'The requesting reviewer no longer has access. An active reviewer can retry.'; }
      r.job.status = error ? 'failed' : 'succeeded'; r.job.error = error; r.job.leaseUntil = 0;
      if (!error) r.analysis = analysis;
      r.revision++; r.updatedAt = nowISO();
      writeReview(s, tx, r, previousReview);
      event(s, tx, r, error ? 'analysis_failed' : 'analysis_completed', r.job.actorUid, error ? { error } : { analysisId: analysis!.id, sourceHash: analysis!.sourceHash, definitionId: r.contract!.id, score: analysis!.score.total });
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
