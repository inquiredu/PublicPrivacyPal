import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { segmentedExampleCapture, SEGMENTED_HANDOFF_QUESTION, SEGMENTED_HANDOFF_SCOPE, type SegmentedDraftSeed, type SegmentedProvenance } from '../../shared/segmented-assistance.ts';
import { evidenceDraftSchema } from '../../shared/drafts.ts';
import { blankRequirementReview, requirementDraftSchema } from '../../shared/requirements.ts';
import { sourceSegments } from '../../shared/source-segments.ts';
import { evidenceEditSchema, currentAnalysis, reviewedCount, type EvidenceEdit, type Review } from '../../shared/review.ts';
import { DraftStore } from '../../src/draft-store.ts';
import { practiceContract } from '../../server/evaluation.ts';
import { buildSegmentPlan } from '../../server/analysis/segments.ts';
import { captureSourceBundle, bundleText } from '../../server/source-bundle.ts';
import { editAnalysis, sourceHash, type VerifiedSegmentedProposal } from '../../server/evidence.ts';

const at = '2026-10-21T00:00:00.000Z';
const contract = practiceContract('community-evidence-v1');
const bundle = captureSourceBundle(segmentedExampleCapture().sourceBundle, contract, at);
const source = bundleText(bundle);
const reference: SegmentedProvenance['reference'] = { version: 'segmented-proposal-v1', runId: randomUUID(), synthesisAttemptId: randomUUID(), outcomeId: '1'.repeat(64), evidenceRevision: '2'.repeat(64), measureId: 'sale', targetIds: ['sale'] };
const provenance: SegmentedProvenance = { version: 'segmented-provenance-v1', reference, bundleId: bundle.id, textHash: sourceHash(source), definitionId: contract.id, planId: buildSegmentPlan(bundle, contract).plan.id, provider: 'authored-recording', model: 'lantern-segmented-v1', adapterVersion: 'recording-v1', promptVersion: 'evidence-synthesis-v1', schemaVersion: 'segment-synthesis-v1', validatorVersion: 'synthesis-validator-v1' };
const seed: SegmentedDraftSeed = { criterionId: 'sale', finding: 'unresolved', rationale: 'Review the original proposals before interpreting this measure.', citations: [], segmentedProposal: reference, sourceReview: { version: 'human-source-review-v1', bundleId: bundle.id, segmentIds: [] }, context: { scope: SEGMENTED_HANDOFF_SCOPE, uncertainty: 'scope', question: SEGMENTED_HANDOFF_QUESTION, resolution: 'retained', note: '', citations: [] } };
const verified: VerifiedSegmentedProposal = { provenance, seed, unavailable: false };
function apply(evidence: EvidenceEdit = seed, previous: ReturnType<typeof editAnalysis> | null = null, supplied: VerifiedSegmentedProposal | undefined = verified) {
  return editAnalysis(source, contract.profileVersion, previous, evidence, randomUUID(), 'synthetic-reviewer', at, contract, undefined, true, bundle, supplied);
}

test('segmented handoff keeps human coverage empty and scores unresolved until explicit review', () => {
  const analysis = apply(); const finding = analysis.findings.find(f => f.id === 'sale')!;
  assert.deepEqual(finding.segmentedProvenance, provenance);
  assert.deepEqual(finding.sourceReview?.segmentIds, []);
  assert.equal(finding.context?.question, SEGMENTED_HANDOFF_QUESTION);
  assert.equal(analysis.adapterVersion, 'human-evidence-v6'); assert.equal(analysis.schemaVersion, 'findings-v7');
  assert.equal(analysis.score.total, null);
  assert.equal(reviewedCount({ analysis } as Review), 0);
  assert.equal(currentAnalysis({ analysis, sourceKind: 'bundle', job: { id: analysis.id, status: 'awaiting_review' } } as Review), false);
  assert.equal(evidenceEditSchema.safeParse({ ...seed, segmentedProvenance: provenance }).success, false);
  assert.equal(evidenceEditSchema.safeParse({ ...seed, proposalId: randomUUID() }).success, false);
});

test('segmented attribution cannot be forged, removed or replaced by another historical result', () => {
  assert.throws(() => editAnalysis(source, contract.profileVersion, null, seed, randomUUID(), 'actor', at, contract, undefined, true, bundle), /verified/);
  const before = apply(); const snapshot = JSON.stringify(before);
  assert.throws(() => apply({ ...seed, segmentedProposal: undefined }, before), /original segmented|different source/);
  const another = { ...reference, outcomeId: '3'.repeat(64) };
  assert.throws(() => apply({ ...seed, segmentedProposal: another }, before, { ...verified, provenance: { ...provenance, reference: another } }), /original segmented/);
  assert.throws(() => apply(seed, null, { ...verified, provenance: { ...provenance, bundleId: '4'.repeat(64) } }), /different source/);
  assert.throws(() => apply(seed, null, { ...verified, provenance: { ...provenance, definitionId: '4'.repeat(64) } }), /different source/);
  for (const context of [undefined, { ...seed.context, question: '' }, { ...seed.context, scope: 'All accounts' }]) assert.throws(() => apply({ ...seed, context }, before), /Retain|question/);
  const after = apply({ ...seed, rationale: 'Human correction with original historical reference.' }, before);
  assert.deepEqual(after.findings.find(f => f.id === 'sale')!.segmentedProvenance, provenance);
  assert.equal(JSON.stringify(before), snapshot);
});

test('human resolution requires explicit ranges and question resolution, independently of machine readiness', () => {
  const quote = bundle.documents[0].text.slice(0, 21);
  const citation = { quote, start: bundle.documents[0].start, end: bundle.documents[0].start + quote.length };
  const resolved: EvidenceEdit = { ...seed, finding: 'partial', citations: [citation], sourceReview: { ...seed.sourceReview!, segmentIds: sourceSegments(bundle).map(s => s.id) }, context: { ...seed.context, resolution: 'resolved', note: 'I checked every captured range and the original qualifications.', citations: [citation] } };
  assert.throws(() => apply({ ...resolved, sourceReview: seed.sourceReview }), /every required/);
  assert.throws(() => apply({ ...resolved, context: seed.context }), /Resolve the retained/);
  const after = apply(resolved, apply()); const finding = after.findings.find(f => f.id === 'sale')!;
  assert.equal(finding.context?.resolvedBy, 'synthetic-reviewer'); assert.deepEqual(finding.segmentedProvenance, provenance);
  assert.throws(() => apply(resolved, null, { ...verified, unavailable: true }), /Missing captured/);
  assert.equal(after.score.total, null, 'unreviewed measures keep the total withheld');
});

test('later unrelated manual saves keep new evidence versions and earlier immutable attribution', () => {
  const before = apply(); const snapshot = JSON.stringify(before);
  const after = editAnalysis(source, contract.profileVersion, before, { criterionId: contract.criteria.find(c => c.id !== 'sale')!.id, finding: 'unresolved', citations: [], rationale: 'Manual review still pending.' }, randomUUID(), 'reviewer', at, contract, undefined, true, bundle);
  assert.equal(after.schemaVersion, 'findings-v7'); assert.equal(after.adapterVersion, 'human-evidence-v6');
  assert.deepEqual(after.findings.find(f => f.id === 'sale')!.segmentedProvenance, provenance);
  assert.equal(JSON.stringify(before), snapshot);
});

test('draft reload retains exact whitespace, historical reference and original revision', () => {
  const entries = new Map<string, string>();
  const storage = { getItem: (k: string) => entries.get(k) || null, setItem: (k: string, v: string) => { entries.set(k, v); }, removeItem: (k: string) => { entries.delete(k); }, key: (i: number) => [...entries.keys()][i] || null, get length() { return entries.size; } };
  const draft = { ...seed, revision: 4, rationale: '  unfinished rationale\n', quoteText: '', context: { ...seed.context, scope: '  partial scope\n', question: '  partial question\n', note: '  unfinished resolution\n' } };
  new DraftStore('segmented-test', storage).set('evidence:one', draft);
  const restored = new DraftStore('segmented-test', storage).get('evidence:one', evidenceDraftSchema);
  assert.deepEqual(restored, draft);
  const clauses = blankRequirementReview([{ id: 'one', proposition: 'One requirement', limited: 'Limited claim.', opposed: 'Opposing claim.', decisive: false }]);
  clauses.scope = ' scope\n'; clauses.scopeQuestion = ' question\n'; clauses.requirements[0].question = ' clause question\n';
  assert.deepEqual(requirementDraftSchema.parse(clauses), clauses);
});
