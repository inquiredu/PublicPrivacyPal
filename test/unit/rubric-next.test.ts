import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digest } from '../../server/evaluation.ts';
import { evaluationAreas } from '../../shared/settings.ts';
import { candidate } from '../../shared/rubrics/precision-candidate.ts';
import { assessNext, FROZEN_CANDIDATE_ID, gradeNext, nextCandidate, nextCandidateId, nextRequest } from '../../scripts/rubric-lab/next-candidate.ts';
import { exportNextInputs, nextCases, nextReference } from '../../scripts/rubric-lab/next-cases.ts';

const get = (measure: string, category: string) => nextCases.find(c => c.measureId === measure && c.category === category)!;
test('the batch contains only the three remaining ownership IDs and preserves historical labels and identity', () => {
  const originals = evaluationAreas.flatMap(a => a.criteria);
  const remaining = originals.filter(c => !candidate.measures.some(m => m.id === c.id));
  assert.equal(remaining.length, 36);
  assert.equal(digest(candidate), FROZEN_CANDIDATE_ID);
  assert.equal(nextCandidateId, '82d59137f2c498d6c623695c4c8b5502a6700cfe23a3a7d299ad327a29921110');
  assert.deepEqual(nextCandidate.measures.map(m => m.id), ['do_001', 'do_002', 'do_004']);
  assert.equal(nextCandidate.measures.reduce((n, m) => n + m.requirements.length, 0), 7);
  assert.equal(nextCandidate.status, 'proposed-not-adopted');
  for (const measure of nextCandidate.measures) {
    assert.equal(measure.label, remaining.find(c => c.id === measure.id)!.question);
    assert.equal('weight' in measure, false);
    assert.equal(new Set(measure.requirements.map(r => r.id)).size, measure.requirements.length);
    for (const category of ['positive', 'limited', 'adverse', 'silence', 'missing', 'scope']) assert.ok(get(measure.id, category));
  }
});
for (const c of nextCases) test(`provisional ownership boundary: ${c.measureId} ${c.category}`, () => {
  const result = assessNext(c, nextReference(c));
  assert.equal(result.state, c.expected.state);
  assert.equal(result.output.scopeStatus, c.expected.scopeStatus);
});
test('paired changes isolate licensing, file portability and amendment-route boundaries', () => {
  for (const [id, requirement] of [['do_001', 'license'], ['do_002', 'format'], ['do_004', 'route']]) {
    const positive = get(id, 'positive'), limited = get(id, 'limited');
    assert.deepEqual(positive.coverage, limited.coverage);
    assert.equal(positive.scope, limited.scope);
    for (const [key, expected] of Object.entries(positive.expected.requirements)) {
      if (key === requirement) { assert.notDeepEqual(expected, limited.expected.requirements[key]); }
      else assert.deepEqual(expected, limited.expected.requirements[key]);
    }
  }
});
test('coverage and scope block assurance without erasing an explicit ownership claim or inventing silence', () => {
  const c = get('do_001', 'known-opposition-missing-license');
  const result = assessNext(c, nextReference(c));
  assert.equal(result.state, 'unresolved');
  assert.deepEqual(result.establishedFailures, ['ownership']);
  const falseSilence = nextReference(c); falseSilence.requirements[1] = { ...falseSilence.requirements[1], status: 'not_stated', question: '' };
  assert.throws(() => assessNext(c, falseSilence), /cannot establish silence/);
  const silent = get('do_001', 'silence'), falseMissing = nextReference(silent);
  falseMissing.requirements[0].status = 'unavailable'; falseMissing.requirements[0].question = 'Invented missing annex';
  assert.throws(() => assessNext(silent, falseMissing), /cannot invent/);
  const scoped = get('do_004', 'scope'), hiddenQuestion = nextReference(scoped); hiddenQuestion.scopeQuestion = '';
  assert.throws(() => assessNext(scoped, hiddenQuestion), /needs a question/);
});
test('source, scope and coverage changes invalidate earlier requests; malformed and forged returns fail', () => {
  const c = get('do_002', 'positive'), original = nextReference(c);
  for (const changed of [{ ...c, source: c.source + '\nNew exception.' }, { ...c, scope: 'Independent adult accounts.' }, { ...c, coverage: { ...c.coverage, format: 'missing_dependency' as const } }]) {
    assert.notEqual(nextRequest(changed).requestId, original.requestId);
    assert.throws(() => assessNext(changed, original), /another immutable request/);
  }
  assert.throws(() => assessNext(c, { ...original, score: 100 }));
  assert.throws(() => assessNext(c, { ...original, requirements: original.requirements.slice(1) }));
  assert.throws(() => assessNext(c, { ...original, requirements: [original.requirements[0], original.requirements[0], original.requirements[2]] }));
  const invented = nextReference(c); invented.requirements[0].quotes[0].quote = 'An invented commitment.';
  assert.throws(() => assessNext(c, invented), /exact/);
  assert.throws(() => assessNext(c, ' '.repeat(65537)), /64 KiB/);
  assert.throws(() => nextRequest({ ...c, source: '\ud800' }));
});
test('the grader checks every clause and quote even when a wrong interpretation keeps the same partial result', () => {
  const c = get('do_002', 'vendor-dependent-format'), output = nextReference(c);
  output.requirements[2].status = 'limited'; output.requirements[2].quotes[0].role = 'limitation';
  assert.equal(assessNext(c, output).state, 'partial');
  const report = gradeNext([c], [{ caseId: c.id, output }]);
  assert.equal(report.valid, 1); assert.equal(report.correct, 0);
  assert.equal(report.rows[0].requirements[2].correct, false);
  const unrelated = nextReference(c); unrelated.requirements[2].quotes[0].quote = c.source.split('\n')[1];
  const irrelevant = gradeNext([c], [{ caseId: c.id, output: unrelated }]);
  assert.equal(irrelevant.valid, 1); assert.equal(irrelevant.correct, 0);
});
test('exact opposing quotations can still be misinterpreted; false assurances and missing observations stay visible', () => {
  const c = get('do_001', 'adverse'), output = nextReference(c);
  output.requirements[1].status = 'established'; output.requirements[1].quotes[0].role = 'support';
  // Structural validity is not semantic validation. The authored expected interpretation catches this case.
  assert.equal(assessNext(c, output).state, 'supported');
  const report = gradeNext(nextCases, [{ caseId: c.id, output }]);
  assert.equal(report.falseAssurances, 1); assert.equal(report.correct, 0);
  assert.equal(report.missing.length, nextCases.length - 1);
  assert.throws(() => gradeNext(nextCases, [{ caseId: c.id, output }, { caseId: c.id, output }]), /repeated/);
  assert.throws(() => gradeNext(nextCases, [{ caseId: 'not-assigned', output }]), /Unknown/);
  assert.equal(gradeNext(nextCases, [{ caseId: c.id, output: {} }]).valid, 0);
});
test('exported inputs omit expected labels, category and references; export cannot overwrite earlier evidence', () => {
  assert.equal(nextCases.length, 31); assert.equal(new Set(nextCases.map(c => c.id)).size, 31);
  const directory = mkdtempSync(join(tmpdir(), 'privacypal-rubric-next-'));
  const path = join(directory, 'inputs.jsonl'); exportNextInputs(path);
  const content = readFileSync(path, 'utf8'), rows = content.trim().split('\n').map(line => JSON.parse(line));
  assert.equal(rows.length, 31);
  assert.doesNotMatch(content, /"expected"|"category"|"rationale"\s*:\s*"Authored/);
  assert.ok(rows.every(row => /^ownership-[a-f0-9]{16}$/.test(row.caseId)));
  assert.throws(() => exportNextInputs(path), /EEXIST/);
  assert.equal(readFileSync(path, 'utf8'), content);
});
