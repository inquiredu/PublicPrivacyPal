import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ANALYSIS_EXAMPLE } from '../../shared/analysis-example.ts';
import { suggestedEvidence, SUGGESTION_SCHEMA, type ModelOutput } from '../../shared/assistance.ts';
import { practiceContract, digest } from '../../server/evaluation.ts';
import { buildAnalysisRequest, passagesFor, validateSuggestions } from '../../server/analysis/contract.ts';
import { recordedExample, offlineProvider } from '../../server/analysis/offline.ts';
import { analysisCases } from '../fixtures/analysis-cases.ts';
import { gradeObservations } from '../../server/analysis/benchmark.ts';
const contract = practiceContract('community-evidence-v1');
const request = buildAnalysisRequest(ANALYSIS_EXAMPLE, contract);
test('recorded provider gives exact quotes and proposals, never reviewed findings or decisions', async () => {
  const response = await offlineProvider.generate(request, { attemptId: 'synthetic', signal: new AbortController().signal });
  assert.equal(response.status, 'completed'); if (response.status !== 'completed') return;
  const result = validateSuggestions(request, ANALYSIS_EXAMPLE, response.output);
  assert.equal(result.findings.length, 8);
  for (const q of result.citations) assert.equal(ANALYSIS_EXAMPLE.slice(q.start, q.end), q.quote);
  const deletion = result.findings.find(f => f.measureId === 'deletion')!;
  assert.equal(deletion.state, 'partial'); assert.ok(deletion.question);
  assert.deepEqual(Object.keys(suggestedEvidence(deletion, result)!).sort(), ['citations', 'context', 'criterionId', 'finding', 'rationale']);
  assert.equal(suggestedEvidence({ ...deletion, state: 'ambiguous', uncertainty: 'scope' }, result)?.finding, 'unresolved');
  assert.equal(suggestedEvidence(deletion, { ...result, sourceStatus: 'incomplete' })?.finding, 'unresolved');
  await assert.rejects(offlineProvider.generate(buildAnalysisRequest('Other policy', contract), { attemptId: 'no', signal: new AbortController().signal }));
});
const malformed: Record<string, (o: ModelOutput) => void> = {
  'missing measure': o => { o.findings.pop(); },
  'duplicate measure': o => { o.findings[1] = o.findings[0]; },
  'invented measure': o => { o.findings[0].measureId = 'invented'; },
  'invented quote': o => { o.citations[0].quote = 'We obey every law.'; },
  'wrong source': o => { o.citations[0].sourceId = 'f'.repeat(64); },
  'wrong passage': o => { o.citations[0].passageId = 'p999'; },
  'duplicate citation': o => { o.citations.push(o.citations[0]); },
  'unknown reference': o => { o.findings[0].citationIds = ['unknown']; },
  'unsupported promise': o => { o.findings[0].citationIds = []; },
  'missing question': o => { const f = o.findings.find(f => f.state === 'partial')!; f.uncertainty = 'scope'; f.question = ''; },
  'unknown summary support': o => { o.summary[0].measureIds = ['invented']; },
  'unreadable source with assurances': o => { o.sourceStatus = 'unreadable'; },
  'incomplete source called silent': o => { o.sourceStatus = 'incomplete'; },
  'oversize rationale': o => { o.findings[0].rationale = 'x'.repeat(1001); },
};
for (const [name, corrupt] of Object.entries(malformed)) test(`rejects ${name}`, () => {
  const output = recordedExample(request); corrupt(output);
  assert.throws(() => validateSuggestions(request, ANALYSIS_EXAMPLE, output));
});
test('unknown authority fields, truncated JSON and oversized output cannot enter suggestions', () => {
  assert.throws(() => validateSuggestions(request, ANALYSIS_EXAMPLE, { ...recordedExample(request), score: 100, publish: true }));
  assert.throws(() => validateSuggestions(request, ANALYSIS_EXAMPLE, '{"findings":['));
  assert.throws(() => validateSuggestions(request, ANALYSIS_EXAMPLE, ' '.repeat(262145)));
});
test('passage IDs disambiguate repetition and preserve Unicode offsets without trimming the source', () => {
  const source = '  🔒 never sell. never sell.\n  🔒 never sell.  ';
  const req = buildAnalysisRequest(source, { ...contract, criteria: contract.criteria.filter(c => c.id === 'sale') });
  const output: ModelOutput = { schemaVersion: SUGGESTION_SCHEMA, sourceStatus: 'usable', citations: [{ id: 'q', sourceId: req.sourceHash, passageId: 'p1', quote: 'never sell.' }], findings: [{ measureId: 'sale', state: 'supported', citationIds: ['q'], rationale: 'Explicit prohibition.', scope: 'Supplied policy.', uncertainty: 'none', question: '' }], summary: [] };
  assert.throws(() => validateSuggestions(req, source, output), /ambiguous/);
  output.citations[0].passageId = 'p2';
  const q = validateSuggestions(req, source, output).citations[0]; assert.equal(source.slice(q.start, q.end), q.quote);
  const long = 'a'.repeat(3999) + '🔒' + 'b';
  assert.equal(passagesFor(long).map(p => p.text).join(''), long);
  assert.throws(() => passagesFor('x'.repeat(32001)));
});
test('prompt is stable, only contains enabled adopted definitions and treats context as data', () => {
  const narrowed = { ...contract, criteria: contract.criteria.map(c => ({ ...c, weight: c.id === 'sale' ? c.weight : 0 })) }; narrowed.id = digest(narrowed.criteria);
  const req = buildAnalysisRequest(ANALYSIS_EXAMPLE, narrowed);
  assert.deepEqual(req.measures, ['sale']); assert.equal(JSON.parse(req.reference).measures.length, 1);
  assert.equal(buildAnalysisRequest(ANALYSIS_EXAMPLE, contract).key, request.key);
  assert.notEqual(req.key, request.key); assert.notEqual(buildAnalysisRequest(ANALYSIS_EXAMPLE + '\nNew terms.', contract).key, request.key);
  assert.match(req.instructions, /untrusted data/); assert.match(req.instructions, /not a literal yes\/no/);
});
test('benchmark exposes missing/invalid cases, false assurances and unknown costs', () => {
  assert.throws(() => gradeObservations([{ ...analysisCases[0], request }], []), /one measure per case/);
  assert.equal(analysisCases.length, 40); assert.equal(new Set(analysisCases.map(c => c.id)).size, 40);
  const c = analysisCases.find(c => c.id === 'sale-exception')!;
  const output = { schemaVersion: SUGGESTION_SCHEMA, sourceStatus: 'usable', citations: [{ id: 'q', sourceId: c.request.sourceHash, passageId: 'p1', quote: c.source }], findings: [{ measureId: 'sale', state: 'supported', citationIds: ['q'], rationale: 'Synthetic wrong assurance.', scope: 'School accounts.', uncertainty: 'none', question: '' }], summary: [] };
  const report = gradeObservations(analysisCases, [{ caseId: c.id, output }, { caseId: analysisCases[0].id, output: {} }]);
  assert.equal(report.falseAssurances, 1); assert.equal(report.valid, 1); assert.equal(report.correct, 0); assert.equal(report.missing.length, 38); assert.equal(report.unknownCostCases, 2);
  assert.throws(() => gradeObservations(analysisCases, [{ caseId: c.id, output }, { caseId: c.id, output }]));
});
