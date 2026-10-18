import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureSourceBundle, bundleText, verifySourceBundle } from '../../server/source-bundle.ts';
import { practiceContract, digest } from '../../server/evaluation.ts';
import { buildAnalysisRequest, validateSuggestions } from '../../server/analysis/contract.ts';
import { assertRequestBudget } from '../../server/analysis/source-bundle.ts';
import { BUNDLE_SUGGESTION_SCHEMA, suggestionWireOutput, suggestedEvidence, type BundleModelOutput } from '../../shared/assistance.ts';
import { measureCoverage, coverageReady, BUNDLE_LIMITS } from '../../shared/source-bundle.ts';
import { validateEvidence, editAnalysis, sourceHash } from '../../server/evidence.ts';
import { syntheticBundle } from '../fixtures/source-bundle.ts';
import { candidate } from '../../shared/rubrics/precision-candidate.ts';
import { isWellFormedText } from '../../shared/policy-source.ts';
import { captureDraftSchema } from '../../shared/drafts.ts';
import { emptySourceBundle } from '../../shared/source-bundle.ts';
const contract = practiceContract('community-evidence-v1'), at = '2026-10-17T17:00:00.000Z';
function capture(input = syntheticBundle()) { return captureSourceBundle(input, contract, at); }
function request() { const bundle = capture(); return { bundle, request: buildAnalysisRequest(bundleText(bundle), contract, undefined, bundle) }; }
function output(req: ReturnType<typeof request>['request']): BundleModelOutput {
  return { schemaVersion: BUNDLE_SUGGESTION_SCHEMA, coverage: req.source.passages.map(p => ({ passageId: p.id, status: 'examined' })), citations: [],
    findings: req.measures.map(measureId => ({ measureId, state: measureId === 'deletion' ? 'unavailable' : 'not_addressed', citationIds: [], rationale: 'Synthetic fixture reviewed.', scope: 'School accounts', uncertainty: measureId === 'deletion' ? 'missing_source' : 'missing_statement', question: 'Confirm or supply the applicable evidence.' })) };
}
test('capture preserves raw and canonical identity, dates, scope, ranges and selected-set coverage', () => {
  const bundle = capture(); assert.notEqual(bundle.documents[0].rawHash, bundle.documents[0].textHash);
  assert.equal(bundle.documents[0].textHash, sourceHash(bundleText(bundle)));
  assert.deepEqual(verifySourceBundle(bundle, contract), bundle);
  assert.equal(coverageReady(measureCoverage(bundle, contract, 'deletion')), false);
  assert.equal(coverageReady(measureCoverage(bundle, contract, 'sale')), true);
  assert.notEqual(bundle.id, capture({ ...syntheticBundle(), scope: { ...syntheticBundle().scope, accounts: 'Independent adult accounts' } }).id);
  const alternate = syntheticBundle(); alternate.documents[0].effectiveDates.push('2025-01-01');
  assert.notEqual(capture(alternate).id, bundle.id); assert.equal(capture(alternate).documents[0].effectiveDates.length, 2);
});
for (const mutation of ['text', 'scope', 'rawHash', 'textHash', 'start', 'dependencies'] as const) test(`read rejects changed ${mutation}`, () => {
  const b = capture();
  if (mutation === 'text') b.documents[0].text += 'x';
  if (mutation === 'scope') b.scope.accounts += 'x';
  if (mutation === 'rawHash') b.documents[0].rawHash = '0'.repeat(64);
  if (mutation === 'textHash') b.documents[0].textHash = '0'.repeat(64);
  if (mutation === 'start') b.documents[0].start++;
  if (mutation === 'dependencies') b.documents[1].requiredFor = ['sale'];
  assert.throws(() => verifySourceBundle(b, contract));
});
for (const mutation of ['duplicate', 'unknownTarget', 'uncovered', 'link', 'exclusion', 'emptyCapture', 'missingText', 'surrogate', 'control', 'tooLong', 'tooMany'] as const) test(`capture rejects ${mutation}`, () => {
  const b = syntheticBundle();
  if (mutation === 'duplicate') b.documents[1].id = b.documents[0].id;
  if (mutation === 'unknownTarget') b.documents[1].requiredFor = ['invented'];
  if (mutation === 'uncovered') b.documents[0].requiredFor = ['sale'];
  if (mutation === 'link') b.links[0].documentId = 'unknown';
  if (mutation === 'exclusion') b.documents[0].requiredFor = [];
  if (mutation === 'emptyCapture') b.documents[0].text = '';
  if (mutation === 'missingText') b.documents[1].text = 'Text supplied';
  if (mutation === 'surrogate') b.documents[0].text = '\ud800\n';
  if (mutation === 'control') b.documents[0].text = '\u0001';
  if (mutation === 'tooLong') b.documents[0].text = 'a'.repeat(32001);
  if (mutation === 'tooMany') b.documents = Array.from({ length: 9 }, (_, i) => ({ ...b.documents[0], id: `d${i}` }));
  assert.throws(() => capture(b));
});
test('tiny lines, whitespace and Unicode boundaries have a bounded complete passage partition', () => {
  for (const text of ['a\n'.repeat(16000), 'a'.repeat(3999) + '😀' + '\n'.repeat(10000)]) {
    const input = syntheticBundle(); input.documents[0].text = text;
    const b = capture(input), r = buildAnalysisRequest(bundleText(b), contract, undefined, b);
    assert.ok(r.source.passages.length <= BUNDLE_LIMITS.passages);
    assert.equal(r.source.passages.map(p => p.text).join(''), text);
    assert.ok(Buffer.byteLength(JSON.stringify(r)) <= BUNDLE_LIMITS.requestBytes);
    for (const p of r.source.passages) assert.equal(isWellFormedText(p.text), true);
  }
});
test('input budget is enforced before provider dispatch without truncating the request', () => {
  const { request: r } = request(); r.instructions = 'x'.repeat(BUNDLE_LIMITS.requestBytes);
  assert.throws(() => assertRequestBudget(r), /budget/);
});
test('bundle v4 round trip retains wire evidence and derives readiness per measure', () => {
  const { bundle, request: r } = request(), wire = output(r);
  const result = validateSuggestions(r, bundleText(bundle), wire);
  assert.equal(result.sourceStatus, 'incomplete');
  assert.equal(result.findings.find(f => f.measureId === 'deletion')!.state, 'unavailable');
  assert.deepEqual(suggestionWireOutput(result), wire);
  assert.deepEqual(validateSuggestions(r, bundleText(bundle), suggestionWireOutput(result)), result);
  assert.equal(suggestedEvidence(result.findings[0], result)!.finding, 'unresolved'); // explicit omission question stays open
});
for (const mutation of ['missingSegment', 'duplicateSegment', 'unknownSegment', 'forgedReadiness', 'silence'] as const) test(`bundle output rejects ${mutation}`, () => {
  const { bundle, request: r } = request(), wire: any = output(r);
  if (mutation === 'missingSegment') wire.coverage = [];
  if (mutation === 'duplicateSegment') wire.coverage.push(wire.coverage[0]);
  if (mutation === 'unknownSegment') wire.coverage[0].passageId = 'missing';
  if (mutation === 'forgedReadiness') wire.sourceStatus = 'usable';
  if (mutation === 'silence') { const f = wire.findings.find((f: any) => f.measureId === 'deletion'); f.state = 'not_addressed'; f.uncertainty = 'missing_statement'; }
  assert.throws(() => validateSuggestions(r, bundleText(bundle), wire));
});
test('failed final segment cannot be hidden by earlier examined segments or successful commitments', () => {
  const input = syntheticBundle(); input.documents[0].text = 'We protect data. ' + 'x'.repeat(4100);
  const bundle = capture(input), r = buildAnalysisRequest(bundleText(bundle), contract, undefined, bundle), wire = output(r);
  wire.coverage.at(-1)!.status = 'unavailable';
  wire.findings = wire.findings.map(f => ({ ...f, state: 'unavailable', uncertainty: 'missing_source' } as any));
  const result = validateSuggestions(r, bundleText(bundle), wire);
  assert.ok(result.coverage!.targets.every(t => !t.ready));
});
test('human saves cannot turn missing documents into silence or override capture scope', () => {
  const b = capture(), text = bundleText(b);
  for (const finding of ['not_specified', 'yes'] as const) assert.throws(() => validateEvidence(text, { criterionId: 'deletion', finding, citations: [], rationale: 'Claimed complete.' }, contract, b), /coverage/);
  const edit = { criterionId: 'deletion', finding: 'unresolved' as const, citations: [], rationale: 'Need the missing addendum.' };
  const analysis = editAnalysis(text, contract.profileVersion, null, edit, 'test', 'human', at, contract, undefined, true, b);
  assert.equal(analysis.score.total, null); assert.equal(analysis.sourceHash, b.id); assert.equal(analysis.schemaVersion, 'findings-v5');
  assert.deepEqual(analysis.findings.find(f => f.id === 'deletion')!.coverage!.targets[0].missing, ['addendum']);
  const q = { quote: 'We delete school records after termination.', start: 0, end: 42 };
  const independent = validateEvidence(text, { criterionId: 'collection', finding: 'yes', citations: [{ ...q, end: q.quote.length }], rationale: 'Exact synthetic statement.' }, contract, b);
  assert.equal(independent.finding, 'yes');
});
test('quotations cannot cross document boundaries even when the joined text matches', () => {
  const input = syntheticBundle(); Object.assign(input.documents[1], { capture: 'complete', text: 'Backups are retained forever.' });
  const b = capture(input), text = bundleText(b), start = b.documents[0].end - 3, end = b.documents[1].start + 3;
  assert.throws(() => validateEvidence(text, { criterionId: 'deletion', finding: 'partial', citations: [{ start, end, quote: text.slice(start, end) }], rationale: 'Crossed a boundary.' }, contract, b), /one captured document/);
});
test('precision clauses retain positive and opposing evidence while missing dependencies withhold the aggregate', () => {
  const measure = candidate.measures.find(m => m.id === 'sec_003')!;
  const c = { ...contract, criteria: [{ ...contract.criteria[0], id: measure.id, requirements: measure.requirements }] };
  const input = syntheticBundle(); input.documents[1].requiredFor = [`${measure.id}/${measure.requirements[1].id}`]; input.documents[0].text = 'Transit is encrypted. Stored data is unencrypted.';
  const b = captureSourceBundle(input, c, at), r = buildAnalysisRequest(bundleText(b), c, undefined, b);
  const q = (id: string, quote: string) => ({ id, documentId: 'policy', sourceId: b.documents[0].textHash, passageId: 'p1', quote });
  const wire: BundleModelOutput = { schemaVersion: BUNDLE_SUGGESTION_SCHEMA, coverage: [{ passageId: 'p1', status: 'examined' }], citations: [q('a', 'Transit is encrypted.'), q('b', 'Stored data is unencrypted.')], findings: [{ measureId: measure.id, rationale: 'Synthetic conflict kept.', scope: 'School accounts', scopeStatus: 'matched', scopeQuestion: '', requirements: measure.requirements.map((d, i) => ({ id: d.id, status: i ? 'opposed' : 'established', rationale: 'Exact fixture text.', question: '', evidence: [{ citationId: i ? 'b' : 'a', role: i ? 'opposition' : 'support' }] })) }] };
  const result = validateSuggestions(r, bundleText(b), wire), f = result.findings[0];
  assert.equal(f.state, 'unavailable'); assert.equal(f.requirements!.requirements[1].status, 'opposed');
  const saved = editAnalysis(bundleText(b), c.profileVersion, null, suggestedEvidence(f, result)!, 'test', 'human', at, c, undefined, true, b);
  assert.equal(saved.score.total, null); assert.equal(saved.findings[0].requirements!.requirements[1].status, 'opposed');
  assert.deepEqual(suggestionWireOutput(result), wire);
});
test('unfinished capture drafts retain blank fields, text when marking missing, and scope across serialization', () => {
  const bundle = emptySourceBundle(); bundle.documents[0].text = 'Unsaved synthetic source.'; bundle.documents[0].capture = 'missing';
  const draft = { sourceKind: 'bundle', sourceBundle: bundle, name: '', sourceLabel: '', sourceText: '', fixtureId: 'complete', profileVersion: 'community-evidence-v1' };
  assert.deepEqual(captureDraftSchema.parse(JSON.parse(JSON.stringify(draft))), draft);
  assert.throws(() => captureSourceBundle(bundle, contract, at));
});
test('matched source dependencies cannot borrow supporting citations from an excluded account document', () => {
  const b = syntheticBundle(); Object.assign(b.documents[1], { capture: 'complete', text: 'We never sell adult account data.', requiredFor: [], exclusionReason: 'Independent consumer accounts are outside this school review.' });
  const captured = capture(b), text = bundleText(captured), start = captured.documents[1].start;
  assert.throws(() => validateEvidence(text, { criterionId: 'sale', finding: 'yes', citations: [{ start, end: text.length, quote: captured.documents[1].text }], rationale: 'Wrong account terms.' }, contract, captured), /outside/);
  const r = buildAnalysisRequest(text, contract, undefined, captured), wire = output(r);
  wire.citations.push({ id: 'adult', documentId: 'addendum', sourceId: captured.documents[1].textHash, passageId: 'p2', quote: captured.documents[1].text });
  const f = wire.findings.find(f => f.measureId === 'sale')!; Object.assign(f, { state: 'supported', citationIds: ['adult'], uncertainty: 'none', question: '' });
  assert.throws(() => validateSuggestions(r, text, wire), /outside/);
});
test('an independent supported finding can prepare a draft while a different dependency remains unavailable', () => {
  const input = syntheticBundle(); input.documents[0].text = 'We collect account names. The backup addendum applies to deletion.';
  const b = capture(input), r = buildAnalysisRequest(bundleText(b), contract, undefined, b), wire = output(r);
  wire.citations.push({ id: 'collection', documentId: 'policy', sourceId: b.documents[0].textHash, passageId: 'p1', quote: 'We collect account names.' });
  Object.assign(wire.findings.find(f => f.measureId === 'collection')!, { state: 'supported', citationIds: ['collection'], uncertainty: 'none', question: '' });
  const result = validateSuggestions(r, bundleText(b), wire);
  assert.equal(result.sourceStatus, 'incomplete'); assert.equal(result.segments![0].state, 'validated');
  assert.equal(suggestedEvidence(result.findings.find(f => f.measureId === 'collection')!, result)!.finding, 'yes');
  assert.equal(suggestedEvidence(result.findings.find(f => f.measureId === 'deletion')!, result)!.finding, 'unresolved');
  const changed = structuredClone(wire); changed.citations[0].documentId = 'addendum';
  assert.throws(() => validateSuggestions(r, bundleText(b), changed), /identity/);
});
