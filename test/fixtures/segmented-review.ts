import { practiceContract } from '../../server/evaluation';
import { bundleText, captureSourceBundle } from '../../server/source-bundle';
import { blankRequirementReview } from '../../shared/requirements';
import type { Review } from '../../shared/review';
import type { EvaluationContract } from '../../shared/evaluation';
import { SEGMENTED_HANDOFF_QUESTION, SEGMENTED_HANDOFF_SCOPE, type SegmentedCandidate, type SegmentedProposalRef, type SegmentedProposalView } from '../../shared/segmented-assistance';

/** Authored UI DTOs exercise handoff behavior; they confer no server proposal authority. */
export function segmentedReviewFixture(clauseCount = 0): { review: Review; proposal: SegmentedProposalView; candidates: SegmentedCandidate[] } {
  const at = '2026-10-20T12:00:00.000Z'; const scope = { product: 'Fictional review notebook', accounts: 'Synthetic school accounts', jurisdiction: 'Synthetic jurisdiction' };
  const contract: EvaluationContract = practiceContract('community-evidence-v1');
  const measure = contract.criteria.find(c => c.id === 'deletion')!;
  const definitions = Array.from({ length: clauseCount }, (_, i) => ({ id: `clause_${i + 1}`, proposition: `Fictional clause ${i + 1}.`, limited: 'Fictional exception.', opposed: 'Fictional contrary statement.', decisive: true }));
  contract.criteria = [{ ...measure, ...(clauseCount ? { requirements: definitions } : {}) }];
  const targetIds = clauseCount ? definitions.map(d => `deletion/${d.id}`) : ['deletion'];
  const quotes = targetIds.flatMap((target, t) => Array.from({ length: 4 }, (_, i) => ({ target, quote: `Fictional target ${t + 1} statement ${i + 1} about school data.`, role: (['supporting', 'limiting', 'opposing', 'supporting'] as const)[i] })));
  const bundle = captureSourceBundle({ version: 'pasted-source-bundle-v2', scope, documents: [
    { id: 'policy', label: 'Fictional school policy', origin: 'Authored test', scope, applicability: 'matched', effectiveDates: [], capture: 'complete', text: quotes.map(q => q.quote).join('\n'), requiredFor: ['*'], exclusionReason: '' },
    { id: 'annex', label: 'Missing fictional annex', origin: 'Authored test', scope, applicability: 'matched', effectiveDates: [], capture: 'missing', text: '', requiredFor: ['*'], exclusionReason: '' },
  ], links: [] }, contract, at);
  const sourceText = bundleText(bundle);
  const review: Review = { id: '00000000-0000-4000-8000-000000000001', name: 'Synthetic segmented UI', sourceKind: 'bundle', fixtureId: null, profileVersion: 'community-evidence-v1', sourceBundle: bundle, sourceText, sourceHash: bundle.id, contract,
    revision: 4, analysis: null, decision: null, published: false, createdAt: at, updatedAt: at,
    job: { id: 'synthetic-review', status: 'awaiting_review', attempt: 0, actorUid: 'test', actorEmail: 'test@example.invalid', leaseUntil: 0, error: null } };
  const reference: SegmentedProposalRef = { version: 'segmented-proposal-v1', runId: '00000000-0000-4000-8000-000000000002', synthesisAttemptId: '00000000-0000-4000-8000-000000000003', outcomeId: 'a'.repeat(64), evidenceRevision: 'b'.repeat(64), measureId: 'deletion', targetIds };
  const candidates: SegmentedCandidate[] = quotes.map((q, i) => ({ id: (i + 1).toString(16).padStart(64, '0'), target: q.target, documentId: 'policy', textHash: bundle.documents[0].textHash, start: sourceText.indexOf(q.quote), end: sourceText.indexOf(q.quote) + q.quote.length, quote: q.quote, role: q.role, rationales: ['Original fictional rationale.', 'Retained earlier-attempt sighting.'], segmentIds: ['s1'] }));
  const proposal: SegmentedProposalView = { reference, provenance: { version: 'segmented-provenance-v1', reference, bundleId: bundle.id, textHash: 'c'.repeat(64), definitionId: contract.id, planId: 'd'.repeat(64), provider: 'authored-recording', model: 'lantern-segmented-v1', adapterVersion: 'recording-v1', promptVersion: 'evidence-synthesis-v1', schemaVersion: 'segment-synthesis-v1', validatorVersion: 'synthesis-validator-v1' },
    current: true, eligible: true, reason: '', scope, requiredQuestion: SEGMENTED_HANDOFF_QUESTION,
    targets: targetIds.map(target => ({ target, original: { state: 'established', rationale: 'Original authored interpretation, not a human finding.', question: 'Which of these conflicting fictional terms governs?', candidateIds: candidates.filter(c => c.target === target).map(c => c.id), segmentIds: ['s1'] }, derived: { state: 'unavailable', ready: false, missing: ['annex'], question: 'The required annex remains unavailable.' }, candidateCount: 4 })),
    candidates: { items: candidates.slice(0, 20), nextCursor: candidates.length > 20 ? 'synthetic-next' : null },
    seed: { criterionId: 'deletion', finding: 'unresolved', citations: [], rationale: 'Human interpretation pending.', segmentedProposal: reference, sourceReview: { version: 'human-source-review-v1', bundleId: bundle.id, segmentIds: [] }, context: { scope: SEGMENTED_HANDOFF_SCOPE, uncertainty: 'scope', question: SEGMENTED_HANDOFF_QUESTION, resolution: 'retained', note: '', citations: [] }, ...(clauseCount ? { requirements: { ...blankRequirementReview(definitions), sourceStatus: 'incomplete' as const } } : {}) } };
  return { review, proposal, candidates };
}

export class SegmentedMemoryStorage {
  data = new Map<string, string>();
  get length() { return this.data.size; }
  key(index: number) { return [...this.data.keys()][index] ?? null; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  setItem(key: string, value: string) { this.data.set(key, value); }
  removeItem(key: string) { this.data.delete(key); }
}
