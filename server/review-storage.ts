import type { Transaction, DocumentSnapshot } from 'firebase-admin/firestore';
import type { Services } from './firebase.ts';
import type { Review, Analysis, ReviewEvent } from '../shared/review.ts';
import { reviewedCount } from '../shared/review.ts';
import { STORAGE_VERSION, PAGE_SIZE, measuresFor, type EvaluationContract, type ReviewSummary, type Page } from '../shared/evaluation.ts';
import { practiceContract, digest } from './evaluation.ts';
import { sourceHash } from './evidence.ts';
import { HttpError } from './operations.ts';

// Conservative UTF-8 JSON bounds leave room for Firestore field/path encoding overhead.
export const BYTE_LIMITS = { head: 8192, source: 128 * 1024, definition: 256 * 1024, evaluation: 64 * 1024, finding: 32 * 1024, decision: 32 * 1024, history: 96 * 1024, detail: 3 * 1024 * 1024 };
export function bounded<T>(kind: keyof typeof BYTE_LIMITS, data: T): T {
  if (Buffer.byteLength(JSON.stringify(data), 'utf8') > BYTE_LIMITS[kind]) throw new HttpError(413, `${kind} exceeds its storage byte limit.`);
  return data;
}
export const reviewCollection = (s: Services) => s.db.collection(`districts/${s.config.districtId}/reviews`);
export type ReviewHead = Omit<Review, 'sourceText' | 'analysis' | 'decision' | 'contract'> & {
  storageVersion: 3; sourceId: string; definitionId: string; analysisId: string | null; decisionId: string | null;
  score: number | null; reviewed: number; measureCount: number;
};
type StoredEvaluation = Omit<Analysis, 'findings'> & { sourceId: string; definitionId: string; findingIds: string[] };
const refId = (id: unknown): string => { if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new HttpError(409, 'Invalid stored reference.'); return id; };
function required(snap: DocumentSnapshot, kind: keyof typeof BYTE_LIMITS) {
  if (!snap.exists) throw new HttpError(409, 'A versioned review record is missing. Restore a verified backup.');
  return bounded(kind, snap.data()!);
}
export function summary(r: ReviewHead): ReviewSummary {
  return { id: r.id, name: r.name, revision: r.revision, createdAt: r.createdAt, updatedAt: r.updatedAt, published: r.published, status: r.job.status, score: r.score, reviewed: r.reviewed, measureCount: r.measureCount };
}
export async function readEvaluation(s: Services, tx: Transaction, reviewId: string, evaluationId: string) {
  const root = reviewCollection(s).doc(reviewId);
  const stored = required(await tx.get(root.collection('evaluations').doc(refId(evaluationId))), 'evaluation') as StoredEvaluation;
  if (stored.findingIds.length > 50 || new Set(stored.findingIds).size !== stored.findingIds.length) throw new HttpError(409, 'Invalid evaluation finding references.');
  const [sourceSnap, definitionSnap] = await Promise.all([tx.get(root.collection('sources').doc(refId(stored.sourceId))), tx.get(root.collection('definitions').doc(refId(stored.definitionId)))]);
  const source = required(sourceSnap, 'source'); const contract = required(definitionSnap, 'definition') as EvaluationContract;
  const { id: contractId, ...definition } = contract;
  if (contract.id !== stored.definitionId || digest(definition) !== contractId || sourceHash(source.text) !== stored.sourceId || stored.sourceHash !== stored.sourceId || contract.criteria.length > 50) throw new HttpError(409, 'Review version integrity check failed.');
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
  const source = version?.source || required(await tx.get(root.collection('sources').doc(refId(head.sourceId))), 'source');
  const contract = version?.contract || required(await tx.get(root.collection('definitions').doc(refId(head.definitionId))), 'definition') as EvaluationContract;
  const { id: contractId, ...definition } = contract;
  if (contract.id !== head.definitionId || digest(definition) !== contractId || sourceHash(source.text) !== head.sourceId || contract.criteria.length > 50) throw new HttpError(409, 'Review version integrity check failed.');
  if (version && (version.contract.id !== contract.id || version.analysis.sourceHash !== head.sourceId)) throw new HttpError(409, 'Evaluation does not match this review.');
  const { storageVersion: _, sourceId: _s, definitionId: _d, analysisId: _a, decisionId: _j, score: _c, reviewed: _r, measureCount: _m, ...r } = head;
  const decision = decisionSnap ? required(decisionSnap, 'decision') as Review['decision'] : null;
  if (decision && digest(decision) !== head.decisionId) throw new HttpError(409, 'Decision integrity check failed.');
  return bounded('detail', { ...r, sourceText: source.text as string, contract, analysis: version?.analysis || null, decision });
}
export function writeEvaluation(s: Services, tx: Transaction, r: Review, analysis: Analysis, seen = new Set<string>()) {
  const root = reviewCollection(s).doc(r.id); const contract = r.contract!;
  const ids = measuresFor(r).map(c => c.id);
  if (analysis.findings.length !== ids.length || new Set(analysis.findings.map(f => f.id)).size !== ids.length || analysis.findings.some(f => !ids.includes(f.id)) || analysis.sourceHash !== sourceHash(r.sourceText) || analysis.profileVersion !== contract.profileVersion || analysis.score.engineVersion !== contract.engineVersion) throw new HttpError(409, 'Evaluation does not match the adopted source and rubric.');
  const findingIds = analysis.findings.map(f => { bounded('finding', f); const id = digest(f); if (!seen.has(id)) { tx.set(root.collection('findings').doc(id), f); seen.add(id); } return id; });
  const { findings: _, ...metadata } = analysis;
  tx.create(root.collection('evaluations').doc(refId(analysis.id)), bounded('evaluation', { ...metadata, sourceId: sourceHash(r.sourceText), definitionId: contract.id, findingIds }));
}
/** All version writes and the small current pointer are part of the caller's transaction. */
export function writeReview(s: Services, tx: Transaction, r: Review, previous?: Review, migrating = false) {
  const root = reviewCollection(s).doc(r.id);
  r.contract ||= practiceContract(r.profileVersion || 'community-demo-v1');
  const sourceId = sourceHash(r.sourceText); const definitionId = r.contract.id;
  if (!previous || migrating) {
    tx.create(root.collection('sources').doc(sourceId), bounded('source', { version: r.sourceVersion || 1, hash: sourceId, text: r.sourceText, label: r.sourceLabel || 'Bundled synthetic policy', capturedAt: r.sourceCapturedAt || r.createdAt }));
    tx.create(root.collection('definitions').doc(definitionId), bounded('definition', r.contract));
  } else if (sourceId !== sourceHash(previous.sourceText) || definitionId !== previous.contract?.id) throw new HttpError(409, 'Source and rubric versions cannot change in place.');
  if (r.analysis && r.analysis.id !== previous?.analysis?.id) {
    // Reuse unchanged immutable findings instead of rewriting all fifty on each correction.
    writeEvaluation(s, tx, r, r.analysis, new Set(previous?.analysis?.findings.map(digest)));
  }
  const decisionId = r.decision ? digest(r.decision) : null;
  if (r.decision && decisionId !== (previous?.decision ? digest(previous.decision) : null)) tx.set(root.collection('decisions').doc(decisionId!), bounded('decision', r.decision));
  const { sourceText: _, analysis: _a, decision: _d, contract: _c, ...fields } = r;
  const head: ReviewHead = { ...fields, storageVersion: STORAGE_VERSION, sourceId, definitionId, analysisId: r.analysis?.id || null, decisionId, score: r.analysis?.score.total ?? null, reviewed: reviewedCount(r), measureCount: measuresFor(r).length };
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
