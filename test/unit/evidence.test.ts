import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createReviewSchema, actionSchema, currentAnalysis, reviewedCount, citationsFor, type Review, type Analysis } from '../../shared/review.ts';
import { editAnalysis, validateEvidence, sourceHash } from '../../server/evidence.ts';
import { uniqueCitation } from '../../shared/evidence-selection.ts';
import { pastedDraft, pastedPolicy, policyLines, evidenceEdits, citation } from '../fixtures/pasted-policy.ts';
const at = '2026-10-15T12:00:00.000Z';
function analyze(profile = 'community-evidence-v1') {
  let analysis: Analysis | null = null;
  for (const [i, edit] of evidenceEdits.entries()) analysis = editAnalysis(pastedPolicy, profile, analysis, edit, `analysis-${i}`, 'reviewer-test', at);
  return analysis!;
}
test('pasted input preserves text, normalizes line endings and pins the default profile', () => {
  const result = createReviewSchema.parse({ ...pastedDraft, sourceText: '  🌱 First\r\nSecond\rThird  ' });
  assert.ok('sourceText' in result); assert.equal(result.sourceText, '  🌱 First\nSecond\nThird  ');
  assert.equal(result.profileVersion, 'community-evidence-v1');
  assert.equal(createReviewSchema.parse(pastedDraft).name, pastedDraft.name);
});
for (const sourceText of ['', ' \n\t ', '\u0000hidden', '\u001fhidden', 'x'.repeat(32001)]) test(`rejects invalid source ${JSON.stringify(sourceText.slice(0, 12))}`, () => {
  assert.equal(createReviewSchema.safeParse({ ...pastedDraft, sourceText }).success, false);
});
test('source kinds and client authority fields cannot be mixed or forged', () => {
  for (const extra of [{ fixtureId: 'complete' }, { score: 100 }, { url: 'https://policy.example' }, { sourceHash: 'forged' }, { sourceVersion: 99 }]) assert.equal(createReviewSchema.safeParse({ ...pastedDraft, ...extra }).success, false);
  assert.equal(createReviewSchema.safeParse({ name: 'Wrong', fixtureId: 'complete', sourceText: pastedPolicy }).success, false);
});
test('exact citations preserve Unicode offsets, whitespace and literal markup', () => {
  for (const quote of [policyLines[0], policyLines[1], policyLines[10]]) {
    const c = citation(quote);
    assert.deepEqual(validateEvidence(pastedPolicy, { ...evidenceEdits[0], citations: [c] }).citations, [c]);
    assert.deepEqual(uniqueCitation(pastedPolicy, quote), c);
  }
  assert.equal(sourceHash(pastedPolicy).length, 64);
});
test('missing, fabricated, shifted, duplicate and out-of-bounds evidence is rejected', () => {
  const c = evidenceEdits[0].citations[0];
  for (const citations of [[], [{ ...c, quote: c.quote + '.' }], [{ ...c, start: c.start + 1 }], [{ ...c, end: c.end - 1 }], [{ ...c, start: -1 }], [{ ...c, end: 999999 }], [{ ...c, end: c.start }], [c, c], [c, c, c, c], [{ quote: ' ', start: 7, end: 8 }]]) assert.throws(() => validateEvidence(pastedPolicy, { ...evidenceEdits[0], citations }));
  assert.throws(() => validateEvidence(pastedPolicy, { ...evidenceEdits[7], citations: [c] }));
});
test('manual edits reject forged fields, unknown criteria and blank rationale', () => {
  assert.throws(() => validateEvidence(pastedPolicy, { ...evidenceEdits[0], criterionId: 'forged' }), /known enabled/);
  for (const extra of [{ actorUid: 'forged' }, { score: 100 }, { reviewedAt: at }, { rationale: ' ' }, { finding: 'not_applicable' }]) assert.equal(actionSchema.safeParse({ action: 'edit_evidence', revision: 1, evidence: { ...evidenceEdits[0], ...extra } }).success, false);
  assert.equal(actionSchema.safeParse({ action: 'edit_evidence', revision: 1, evidence: evidenceEdits[0], sourceText: 'replacement' }).success, false);
});
test('ambiguous quotation requires explicit source selection; either exact occurrence is valid', () => {
  const source = 'Repeated. Other words. Repeated.';
  assert.throws(() => uniqueCitation(source, 'Repeated.'), /select/i);
  assert.throws(() => uniqueCitation(source, 'invented'), /match/i);
  const start = source.lastIndexOf('Repeated.');
  assert.doesNotThrow(() => validateEvidence(source, { ...evidenceEdits[0], citations: [{ quote: 'Repeated.', start, end: source.length }] }));
});
test('contradictions, exceptions, vague promises and missing evidence score deterministically', () => {
  const result = analyze();
  assert.equal(result.score.points, 27); assert.equal(result.score.maximum, 42); assert.equal(result.score.total, 64);
  assert.equal(result.evidenceCount, 7); assert.equal(result.findings[2].finding, 'no');
  assert.deepEqual(citationsFor(result.findings[2]), evidenceEdits[2].citations);
  assert.equal(result.findings[7].finding, 'not_specified'); assert.equal(citationsFor(result.findings[7]).length, 0);
  assert.equal(result.findings[0].reviewedBy, 'reviewer-test'); assert.equal(result.findings[0].reviewedAt, at);
  assert.equal(result.sourceHash, sourceHash(pastedPolicy)); assert.equal(result.schemaVersion, 'findings-v2');
  assert.equal(analyze('community-demo-v1').score.total, 69);
});
test('no default finding counts as reviewed; every pasted criterion needs explicit evidence review', () => {
  const partial = editAnalysis(pastedPolicy, 'community-evidence-v1', null, evidenceEdits[0], 'first', 'actor', at);
  const r = { sourceKind: 'pasted', analysis: partial, job: { id: 'first', status: 'succeeded' } } as Review;
  assert.equal(reviewedCount(r), 1); assert.equal(currentAnalysis(r), false);
  r.analysis = analyze(); r.job.id = r.analysis.id;
  assert.equal(reviewedCount(r), 8); assert.equal(currentAnalysis(r), true);
  r.job.id = 'earlier'; assert.equal(currentAnalysis(r), false);
});
test('edits preserve other findings and reject a mismatched source snapshot', () => {
  const before = analyze(); const original = structuredClone(before);
  const after = editAnalysis(pastedPolicy, before.profileVersion, before, { ...evidenceEdits[0], finding: 'partial' }, 'new', 'second-reviewer', at);
  assert.deepEqual(before, original); assert.equal(after.score.total, 57);
  assert.deepEqual(after.findings.slice(1), before.findings.slice(1)); assert.equal(after.findings[0].reviewedBy, 'second-reviewer');
  assert.throws(() => editAnalysis(pastedPolicy + '\nChanged', before.profileVersion, before, evidenceEdits[0], 'bad', 'actor', at), /different source/);
});
