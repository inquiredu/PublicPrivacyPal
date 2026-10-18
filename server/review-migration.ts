import { FieldPath } from 'firebase-admin/firestore';
import type { Services } from './firebase.ts';
import type { Review, Analysis } from '../shared/review.ts';
import { citationsFor } from '../shared/review.ts';
import { practiceContract, digest } from './evaluation.ts';
import { editLegacyAnalysis } from './legacy-evidence.ts';
import { bounded, reviewCollection, writeReview, writeEvaluation } from './review-storage.ts';

/** Operator-only, resumable per review. The maintenance lock survives any failed conversion. */
export async function migrateReviews(s: Services, lockId: string) {
  let cursor: string | undefined; let migrated = 0; let count = 0;
  while (true) {
    let q = reviewCollection(s).orderBy(FieldPath.documentId()).limit(20);
    if (cursor) q = q.startAfter(cursor);
    const page = await q.get(); if (page.empty) break;
    for (const doc of page.docs) {
      count++;
      migrated += await s.db.runTransaction(async tx => {
        const lock = await tx.get(s.db.doc('installation/maintenance'));
        if (lock.get('id') !== lockId) throw new Error('Migration requires its active maintenance lock.');
        const head = await tx.get(doc.ref);
        if (head.get('storageVersion') === 3) return 0;
        if (head.get('storageVersion') !== undefined) throw new Error('Unsupported review storage version.');
        const history = await tx.get(doc.ref.collection('history').orderBy('revision').limit(101));
        if (history.size > 100) throw new Error('Legacy review exceeds the 100-event migration bound. Keep maintenance active and use a separately reviewed migration.');
        const r = head.data() as Review;
        if (!r.sourceText || r.id !== doc.id) throw new Error('Invalid legacy review.');
        r.contract = practiceContract(r.profileVersion || 'community-demo-v1');
        const versions = new Map<string, Analysis>();
        const converted = history.docs.map(event => {
          const data = event.data(); const d = data.details;
          if (data.action === 'analysis_completed' && d?.analysis) {
            versions.set(d.analysis.id, d.analysis);
            return { ref: event.ref, data: { ...data, details: { analysisId: d.analysis.id, sourceHash: d.analysis.sourceHash, definitionId: r.contract!.id, score: d.analysis.score.total } } };
          }
          if (data.action === 'edit_evidence') {
            const before = d.beforeAnalysisId ? versions.get(d.beforeAnalysisId) : null;
            if (d.beforeAnalysisId && !before) throw new Error('Legacy evidence history is incomplete.');
            const analysis = editLegacyAnalysis(r.sourceText, r.profileVersion || 'community-demo-v1', before || null, { criterionId: d.criterionId, finding: d.after.finding, citations: citationsFor(d.after), rationale: d.after.rationale }, d.afterAnalysisId, d.after.reviewedBy, d.after.reviewedAt, r.contract);
            if (analysis.score.total !== d.afterScore || (before?.score.total ?? null) !== d.beforeScore || digest(before?.findings.find(f => f.id === d.criterionId) || null) !== digest(d.before)) throw new Error('Legacy evidence history cannot be reproduced.');
            versions.set(analysis.id, analysis);
          }
          return { ref: event.ref, data };
        });
        if (r.analysis) {
          const reconstructed = versions.get(r.analysis.id);
          if (reconstructed && digest(reconstructed) !== digest(r.analysis)) throw new Error('Legacy current evaluation disagrees with its history.');
          versions.set(r.analysis.id, r.analysis);
        }
        // Validate every payload before queueing writes; one failed review leaves no partial versions.
        for (const e of converted) bounded('history', e.data);
        const seen = new Set<string>();
        for (const analysis of versions.values()) writeEvaluation(s, tx, r, analysis, seen);
        for (const e of converted) {
          if (e.data.action === 'decide') for (const decision of [e.data.details?.before, e.data.details?.after]) if (decision) tx.set(doc.ref.collection('decisions').doc(digest(decision)), bounded('decision', decision));
          tx.set(e.ref, e.data);
        }
        writeReview(s, tx, r, { ...r, decision: null }, true);
        return 1;
      });
    }
    cursor = page.docs.at(-1)!.id;
  }
  await s.db.runTransaction(async tx => {
    const lock = await tx.get(s.db.doc('installation/maintenance'));
    if (lock.get('id') !== lockId) throw new Error('Migration lost its maintenance lock.');
    const marker = s.db.doc(`districts/${s.config.districtId}/reviewCounters/current`);
    const previous = await tx.get(marker);
    if (previous.get('count') !== count) tx.set(marker, { count });
  });
  return { migrated, count };
}
