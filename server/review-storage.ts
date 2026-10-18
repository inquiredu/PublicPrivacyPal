import { splitSourceBundle, joinSourceBundle } from './segmented-source-storage.ts';
import { LONG_BUNDLE_VERSION, SEGMENT_LIMITS } from '../shared/source-segments.ts';
import type { Transaction, DocumentSnapshot } from 'firebase-admin/firestore';
import type { Services } from './firebase.ts';
import type { Review, Analysis, ReviewEvent } from '../shared/review.ts';
import { serviceBlockers, decisionIsCurrent } from '../shared/service.ts';
import type { ServiceRecord } from '../shared/service.ts';
import { reviewedCount } from '../shared/review.ts';
import { STORAGE_VERSION, PAGE_SIZE, measuresFor, type EvaluationContract, type ReviewSummary, type Page } from '../shared/evaluation.ts';
import { practiceContract, digest } from './evaluation.ts';
import { sourceHash } from './evidence.ts';
import { HttpError } from './operations.ts';
import { PRECISION_DEFINITION } from '../shared/requirements.ts';
import { verifySourceBundle, bundleText } from './source-bundle.ts';
import type { SourceBundle } from '../shared/source-bundle.ts';

// Conservative UTF-8 JSON bounds leave room for Firestore field/path encoding overhead.
export const BYTE_LIMITS = { service: 48 * 1024, head: 8192, source: 128 * 1024, definition: 256 * 1024, evaluation: 64 * 1024, finding: 64 * 1024, decision: 32 * 1024, history: 160 * 1024, detail: 4 * 1024 * 1024 };
export function bounded<T>(kind: keyof typeof BYTE_LIMITS, data: T): T {
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > BYTE_LIMITS[kind]) throw new HttpError(413, `${kind} exceeds its storage byte limit.`);
  return data;
}
export const reviewCollection = (s: Services) => s.db.collection(`districts/${s.config.districtId}/reviews`);
export type ReviewHead = Omit<Review, 'sourceBundle' | 'sourceText' | 'analysis' | 'decision' | 'contract' | 'service'> & {
  serviceId?: string; serviceSummary?: { tier: string; grades: string; dataUse: string; decision: string; blockers: string[] }; storageVersion: 3; sourceId: string; definitionId: string; analysisId: string | null; decisionId: string | null;
  score: number | null; reviewed: number; measureCount: number;
};
type StoredEvaluation = Omit<Analysis, 'findings'> & { sourceId: string; definitionId: string; findingIds: string[] };
const refId = (id: unknown): string => { if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new HttpError(409, 'Invalid stored reference.'); return id; };
function required(snap: DocumentSnapshot, kind: keyof typeof BYTE_LIMITS) {
  if (!snap.exists) throw new HttpError(409, 'A versioned review record is missing. Restore a verified backup.');
  return bounded(kind, snap.data()!);
}
async function readSource(data: Record<string, any>, contract: EvaluationContract, tx: Transaction, root: ReturnType<ReturnType<typeof reviewCollection>['doc']>) {
  if (data.version === 3) {
    if (!Array.isArray(data.partIds) || !data.partIds.length || data.partIds.length > SEGMENT_LIMITS.segments || new Set(data.partIds).size !== data.partIds.length) throw new HttpError(409, 'Invalid source part references.');
    const records = await tx.getAll(...data.partIds.map((id: string) => root.collection('sourceParts').doc(refId(id))));
    const bundle = joinSourceBundle(data.manifest, records.map((snap, i) => ({ id: data.partIds[i], data: required(snap, 'source') })), data.plan, contract);
    if (bundle.id !== data.hash || bundle.capturedAt !== data.capturedAt) throw new HttpError(409, 'Segmented source identity mismatch.');
    return { text: bundleText(bundle), hash: bundle.id, bundle };
  }
  if (data.version === 2) {
    const bundle = verifySourceBundle(data.bundle, contract);
    if (data.hash !== bundle.id || data.capturedAt !== bundle.capturedAt) throw new HttpError(409, 'Source bundle record identity mismatch.');
    return { ...data, bundle, text: bundleText(bundle), hash: bundle.id } as { text: string; hash: string; bundle?: SourceBundle };
  }
  if (data.version !== 1 || data.bundle || sourceHash(data.text) !== data.hash) throw new HttpError(409, 'Source record integrity check failed.');
  return data as { text: string; hash: string; bundle?: SourceBundle };
}
const reviewSourceId = (r: Review) => r.sourceBundle?.id || sourceHash(r.sourceText);
export function summary(r: ReviewHead): ReviewSummary {
  return { id: r.id, name: r.name, revision: r.revision, createdAt: r.createdAt, updatedAt: r.updatedAt, published: r.published, status: r.job.status, score: r.score, reviewed: r.reviewed, measureCount: r.measureCount, ...(r.serviceSummary ? { service: r.serviceSummary } : {}) };
}
export async function readEvaluation(s: Services, tx: Transaction, reviewId: string, evaluationId: string) {
  const root = reviewCollection(s).doc(reviewId);
  const stored = required(await tx.get(root.collection('evaluations').doc(refId(evaluationId))), 'evaluation') as StoredEvaluation;
  if (stored.findingIds.length > 50 || new Set(stored.findingIds).size !== stored.findingIds.length) throw new HttpError(409, 'Invalid evaluation finding references.');
  const [sourceSnap, definitionSnap] = await Promise.all([tx.get(root.collection('sources').doc(refId(stored.sourceId))), tx.get(root.collection('definitions').doc(refId(stored.definitionId)))]);
  const contract = required(definitionSnap, 'definition') as EvaluationContract; const source = await readSource(required(sourceSnap, 'source'), contract, tx, root);
  const { id: contractId, ...definition } = contract;
  if (contract.id !== stored.definitionId || digest(definition) !== contractId || source.hash !== stored.sourceId || stored.sourceHash !== stored.sourceId || contract.criteria.length > 50) throw new HttpError(409, 'Review version integrity check failed.');
  const findings = stored.findingIds.length ? (await tx.getAll(...stored.findingIds.map(id => root.collection('findings').doc(refId(id))))).map((d, i) => {
    const finding = required(d, 'finding'); if (digest(finding) !== stored.findingIds[i]) throw new HttpError(409, 'Finding integrity check failed.'); return finding;
  }) : [];
  const { findingIds: _, sourceId: _s, definitionId: _d, ...analysis } = stored;
  return bounded('detail', { source, contract, analysis: { ...analysis, findings } as Analysis });
}
export async function readReview(s: Services, tx: Transaction, id: string, existing?: DocumentSnapshot): Promise<Review> {
  const root = reviewCollection(s).doc(id); const snap = existing || await tx.get(root);
  if (!snap.exists) throw new HttpError(404, 'Review not found.');
  if (snap.get('storageVersion') !== STORAGE_VERSION) throw new HttpError(409, 'This review requires the local storage migration.');
  const head = bounded('head', snap.data()!) as ReviewHead;
  const [version, decisionSnap] = await Promise.all([
    head.analysisId ? readEvaluation(s, tx, id, head.analysisId) : null,
    head.decisionId ? tx.get(root.collection('decisions').doc(refId(head.decisionId))) : undefined,
  ]);
  // Evaluated reviews already loaded these immutable records; do not read them twice.
  const contract = version?.contract || required(await tx.get(root.collection('definitions').doc(refId(head.definitionId))), 'definition') as EvaluationContract;
  const source = version?.source || await readSource(required(await tx.get(root.collection('sources').doc(refId(head.sourceId))), 'source'), contract, tx, root);
  const { id: contractId, ...definition } = contract;
  if (contract.id !== head.definitionId || digest(definition) !== contractId || source.hash !== head.sourceId || contract.criteria.length > 50 || (head.sourceKind === 'bundle') !== !!source.bundle) throw new HttpError(409, 'Review version integrity check failed.');
  if (version && (version.contract.id !== contract.id || version.analysis.sourceHash !== head.sourceId)) throw new HttpError(409, 'Evaluation does not match this review.');
  const service = head.serviceId ? required(await tx.get(root.collection('services').doc(refId(head.serviceId))), 'service') as ServiceRecord : undefined;
  if (service && digest(service) !== head.serviceId) throw new HttpError(409, 'Service details integrity check failed.');
  const { serviceId: _si, serviceSummary: _ss, storageVersion: _, sourceId: _s, definitionId: _d, analysisId: _a, decisionId: _j, score: _c, reviewed: _r, measureCount: _m, ...r } = head;
  const decision = decisionSnap ? required(decisionSnap, 'decision') as Review['decision'] : null;
  if (decision && digest(decision) !== head.decisionId) throw new HttpError(409, 'Decision integrity check failed.');
  return bounded('detail', { ...r, ...(service ? { service } : {}), ...(source.bundle ? { sourceBundle: source.bundle } : {}), sourceText: source.text as string, contract, analysis: version?.analysis || null, decision });
}
export function writeEvaluation(s: Services, tx: Transaction, r: Review, analysis: Analysis, seen = new Set<string>()) {
  const root = reviewCollection(s).doc(r.id); const contract = r.contract!;
  const ids = measuresFor(r).map(c => c.id);
  if (analysis.findings.length !== ids.length || new Set(analysis.findings.map(f => f.id)).size !== ids.length || analysis.findings.some(f => !ids.includes(f.id)) || analysis.sourceHash !== reviewSourceId(r) || analysis.profileVersion !== contract.profileVersion || analysis.score.engineVersion !== contract.engineVersion) throw new HttpError(409, 'Evaluation does not match the adopted source and rubric.');
  const findingIds = analysis.findings.map(f => { bounded('finding', f); const id = digest(f); if (!seen.has(id)) { tx.set(root.collection('findings').doc(id), f); seen.add(id); } return id; });
  const { findings: _, ...metadata } = analysis;
  tx.create(root.collection('evaluations').doc(refId(analysis.id)), bounded('evaluation', { ...metadata, sourceId: reviewSourceId(r), definitionId: contract.id, findingIds }));
}
/** All version writes and the small current pointer are part of the caller's transaction. */
export function writeReview(s: Services, tx: Transaction, r: Review, previous?: Review, migrating = false) {
  const root = reviewCollection(s).doc(r.id);
  if (r.sourceBundle?.version === LONG_BUNDLE_VERSION || previous?.evidenceVersion === 6) r.evidenceVersion = 6;
  else if (r.sourceBundle || previous?.evidenceVersion === 5) r.evidenceVersion = 5;
  else if (r.contract?.definitionVersion === PRECISION_DEFINITION || previous?.evidenceVersion === 4) r.evidenceVersion = 4;
  else if (r.analysis?.schemaVersion === 'findings-v3' || previous?.evidenceVersion === 3) r.evidenceVersion = 3;
  r.contract ||= practiceContract(r.profileVersion || 'community-demo-v1');
  if (r.sourceBundle && (bundleText(verifySourceBundle(r.sourceBundle, r.contract)) !== r.sourceText || r.sourceKind !== 'bundle')) throw new HttpError(409, 'Source bundle does not match review text.');
  const sourceId = reviewSourceId(r); const definitionId = r.contract.id;
  if (!previous || migrating) {
    if (r.sourceBundle?.version === LONG_BUNDLE_VERSION) {
      const { manifest, parts, plan } = splitSourceBundle(r.sourceBundle, r.contract);
      for (const p of parts) tx.create(root.collection('sourceParts').doc(p.id), bounded('source', p.data));
      tx.create(root.collection('sources').doc(sourceId), bounded('source', { version: 3, hash: sourceId, manifest, plan, partIds: parts.map(p => p.id), label: r.sourceLabel, capturedAt: r.sourceCapturedAt }));
    } else tx.create(root.collection('sources').doc(sourceId), bounded('source', { version: r.sourceVersion || 1, hash: sourceId, ...(r.sourceBundle ? { bundle: r.sourceBundle } : { text: r.sourceText }), label: r.sourceLabel || 'Bundled synthetic policy', capturedAt: r.sourceCapturedAt || r.createdAt }));
    tx.create(root.collection('definitions').doc(definitionId), bounded('definition', r.contract));
  } else if (sourceId !== reviewSourceId(previous) || definitionId !== previous.contract?.id) throw new HttpError(409, 'Source and rubric versions cannot change in place.');
  if (r.analysis && r.analysis.id !== previous?.analysis?.id) {
    // Reuse unchanged immutable findings instead of rewriting all fifty on each correction.
    writeEvaluation(s, tx, r, r.analysis, new Set(previous?.analysis?.findings.map(digest)));
  }
  const decisionId = r.decision ? digest(r.decision) : null;
  if (r.decision && decisionId !== (previous?.decision ? digest(previous.decision) : null)) tx.set(root.collection('decisions').doc(decisionId!), bounded('decision', r.decision));
  const serviceId = r.service ? digest(r.service) : undefined;
  if (r.service && serviceId !== (previous?.service ? digest(previous.service) : undefined)) tx.set(root.collection('services').doc(serviceId!), bounded('service', r.service));
  const { sourceBundle: _sb, service: _sv, sourceText: _, analysis: _a, decision: _d, contract: _c, ...fields } = r;
  const head: ReviewHead = { ...fields, ...(r.service ? { serviceId, serviceSummary: { tier: r.service.values.tier, grades: r.service.values.grades, dataUse: r.service.values.dataUse, decision: decisionIsCurrent(r) ? r.decision!.outcome : 'New decision needed', blockers: serviceBlockers(r.service) } } : {}), storageVersion: STORAGE_VERSION, sourceId, definitionId, analysisId: r.analysis?.id || null, decisionId, score: r.analysis?.score.total ?? null, reviewed: reviewedCount(r), measureCount: measuresFor(r).length };
  tx.set(root, bounded('head', head));
}

type Cursor = { scope: string; at: string; id: string };
export function decodeCursor(raw: string | undefined, scope: string): Cursor | undefined {
  if (!raw) return;
  try { if (raw.length > 800) throw new Error(); const c = JSON.parse(Buffer.from(raw, 'base64url').toString()); if (c.scope !== scope || typeof c.at !== 'string' || !/^\d{4}-\d\d-\d\dT/.test(c.at) || c.at.length > 40) throw new Error(); refId(c.id); return c; }
  catch { throw new HttpError(400, 'Invalid page cursor.'); }
}
export const encodeCursor = (scope: string, at: string, id: string) => Buffer.from(JSON.stringify({ scope, at, id })).toString('base64url');
export function historyPage(rows: DocumentSnapshot[], scope: string): Page<ReviewEvent> {
  const page = rows.slice(0, PAGE_SIZE); const last = page.at(-1);
  return { items: page.map(d => ({ ...required(d, 'history'), id: d.id } as ReviewEvent)), nextCursor: rows.length > PAGE_SIZE && last ? encodeCursor(scope, last.get('at'), last.id) : null };
}
