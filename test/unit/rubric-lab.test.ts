import { test } from 'node:test';
import assert from 'node:assert/strict';
import { candidate } from '../../scripts/rubric-lab/candidate.ts';
import { aggregate, grade, requestFor, validate } from '../../scripts/rubric-lab/engine.ts';
import { labCases, referenceOutput } from '../../scripts/rubric-lab/cases.ts';
import { evaluationAreas } from '../../shared/settings.ts';
const get = (id: string, category: string) => labCases.find(c => c.measureId === id && c.category === category)!;

test('proposed subset maps to existing measures and has six authored boundary cases each', () => {
  const existing = new Set(evaluationAreas.flatMap(a => a.criteria.map(c => c.id)));
  assert.equal(existing.size, 50); assert.equal(candidate.measures.length, 14);
  assert.equal(new Set(candidate.measures.map(m => m.id)).size, 14);
  assert.equal(labCases.length, 91); assert.equal(new Set(labCases.map(c => c.id)).size, 91);
  for (const m of candidate.measures) {
    assert.ok(existing.has(m.id)); assert.equal(new Set(m.requirements.map(r => r.id)).size, m.requirements.length);
    for (const category of ['positive', 'limited', 'adverse', 'silence', 'missing', 'scope']) assert.ok(get(m.id, category));
  }
});
for (const c of labCases) test(`provisional boundary: ${c.measureId} ${c.category}`, () => {
  assert.equal(aggregate(c, referenceOutput(c)).state, c.expected.state);
});
test('immutable inputs include coverage, source, scope, definitions, rules and schema; export omits labels', () => {
  const c = get('dr_003', 'positive'), request = requestFor(c);
  for (const changed of [{ ...c, scope: 'Independent adult accounts' }, { ...c, source: c.source + '\nNew terms.' },
    { ...c, coverage: { ...c.coverage, completion: 'missing_dependency' as const } }]) {
    assert.notEqual(requestFor(changed).requestId, request.requestId);
    assert.throws(() => validate(changed, referenceOutput(c)), /another immutable request/);
  }
  const exported = JSON.stringify(request);
  assert.ok(!exported.includes('"expected"')); assert.ok(!exported.includes('"category"'));
  assert.match(request.caseId, /^rubric-\d+$/); assert.match(request.instructions, /untrusted data/);
  assert.match(request.instructions, /never verified implementation/);
});
test('known opposing facts survive a missing dependency without becoming a resolved result', () => {
  const c = structuredClone(get('dr_003', 'adverse'));
  c.coverage.completion = 'missing_dependency';
  const output = referenceOutput(c); output.requirements[2].question = 'Supply the missing agreement annex.';
  const result = aggregate(c, output);
  assert.equal(result.state, 'unresolved'); assert.deepEqual(result.establishedFailures, ['trigger']);
});
test('candidate rejects forged authority, changed source, omitted/duplicated requirements and invented quotes', () => {
  const c = get('gov_001', 'positive'), original = referenceOutput(c);
  assert.throws(() => validate(c, { ...original, score: 100 }));
  assert.throws(() => validate(c, { ...original, requirements: original.requirements.slice(1) }));
  assert.throws(() => validate(c, { ...original, requirements: [...original.requirements, original.requirements[0]] }));
  const fake = structuredClone(original); fake.requirements[0].quotes[0].quote = 'A fabricated promise.';
  assert.throws(() => validate(c, fake), /not exact/);
  const wrongRole = structuredClone(original); wrongRole.requirements[0].quotes[0].role = 'opposition';
  assert.throws(() => validate(c, wrongRole), /role missing/);
  assert.throws(() => validate(c, ' '.repeat(65537)), /bounds/);
  assert.throws(() => requestFor({ ...c, source: '\ud800' }));
});
test('the model cannot relabel missing evidence as silence or invent a missing document', () => {
  const c = get('sec_003', 'missing'), output = referenceOutput(c);
  output.requirements[1].status = 'not_stated';
  assert.throws(() => validate(c, output), /not silence/);
  const complete = get('sec_003', 'silence'), forged = referenceOutput(complete);
  forged.requirements[1].status = 'unavailable';
  assert.throws(() => validate(complete, forged), /coverage manifest/);
  const unresolved = get('sec_003', 'scope'), noQuestion = referenceOutput(unresolved);
  noQuestion.scopeQuestion = '';
  assert.throws(() => validate(unresolved, noQuestion), /needs a question/);
  const positive = get('sec_003', 'positive'), hiddenQuestion = referenceOutput(positive);
  hiddenQuestion.requirements[1].question = 'Which algorithm is used?';
  assert.throws(() => validate(positive, hiddenQuestion), /requires unresolved evidence/);
  hiddenQuestion.requirements[1].question = ''; hiddenQuestion.scopeQuestion = 'Does this apply to schools?';
  assert.throws(() => validate(positive, hiddenQuestion), /requires unresolved scope/);
});
test('grading checks later requirements and evidence even when aggregate state remains partial', () => {
  const c = get('gov_001', 'post-transfer-notice'), output = referenceOutput(c);
  output.requirements[2].status = 'established'; output.requirements[2].quotes[0].role = 'support';
  // Exact but opposite evidence is structurally accepted. The semantic fixture must catch it.
  assert.equal(aggregate(c, output).state, 'partial');
  const report = grade([c], [{ caseId: c.id, output }]);
  assert.equal(report.valid, 1); assert.equal(report.correct, 0);
  assert.equal(report.rows[0].requirements[2].correct, false);
  const unrelated = referenceOutput(c); unrelated.requirements[2].quotes[0].quote = c.source.split('\n')[1];
  const evidenceReport = grade([c], [{ caseId: c.id, output: unrelated }]);
  assert.equal(evidenceReport.valid, 1); assert.equal(evidenceReport.correct, 0);
  assert.equal(evidenceReport.rows[0].requirements[2].evidenceCovered, false);
  const swappedRoles = referenceOutput(c);
  swappedRoles.requirements[2].quotes[0].role = 'support';
  swappedRoles.requirements[2].quotes.push({ quote: c.source.split('\n')[1], role: 'opposition' });
  const roleReport = grade([c], [{ caseId: c.id, output: swappedRoles }]);
  assert.equal(roleReport.valid, 1); assert.equal(roleReport.correct, 0);
});
test('grading exposes false assurances, missing and invalid cases, and rejects duplicate or unknown inputs', () => {
  const c = get('mon_004', 'adverse'), output = referenceOutput(c);
  output.requirements[0].status = 'established'; output.requirements[0].quotes[0].role = 'support';
  const report = grade(labCases, [{ caseId: c.id, output }, { caseId: labCases[0].id, output: {} }]);
  assert.equal(report.falseAssurances, 1); assert.equal(report.valid, 1); assert.equal(report.correct, 0); assert.equal(report.missing.length, 89);
  assert.throws(() => grade(labCases, [{ caseId: c.id, output }, { caseId: c.id, output }]), /duplicate/);
  assert.throws(() => grade(labCases, [{ caseId: 'unknown', output }]), /Unknown/);
  assert.equal(grade(labCases, []).missing.length, 91);
});
