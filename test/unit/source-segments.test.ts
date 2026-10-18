import { candidate } from '../../shared/rubrics/precision-candidate.ts';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { longSyntheticBundle } from '../fixtures/source-segments.ts';
import { captureSourceBundle, bundleText, verifySourceBundle } from '../../server/source-bundle.ts';
import { districtContract, practiceContract, digest } from '../../server/evaluation.ts';
import { sourceHash, validateEvidence, editAnalysis } from '../../server/evidence.ts';
import { SEGMENT_LIMITS, sourceSegments } from '../../shared/source-segments.ts';
import { isWellFormedText } from '../../shared/policy-source.ts';
import { buildAnalysisRequest } from '../../server/analysis/contract.ts';
import { splitSourceBundle, joinSourceBundle } from '../../server/segmented-source-storage.ts';
import { newSegmentArchive, readSegmentArchive, inspectSegmentArchive, appendSegmentAttempt, appendSynthesis, buildSynthesisRequest, validateSynthesis, validateSegment, type SegmentArchive, type SegmentOutput, type SynthesisOutput } from '../../server/analysis/segments.ts';
import { captureDraftSchema, evidenceDraftSchema } from '../../shared/drafts.ts';
import { DraftStore } from '../../src/draft-store.ts';
import { defaultEvaluation, evaluationSettingsSchema, SETTINGS_DEFINITION_VERSION } from '../../shared/settings.ts';
import { createHash } from 'node:crypto';
const contract = practiceContract('community-evidence-v1'), at = '2026-10-17T21:00:00.000Z';
function archive(complete = true) {
  const input = longSyntheticBundle();
  if (complete) { input.documents[1].capture = 'complete'; input.documents[1].text = 'Synthetic complete backup addendum.'; }
  return newSegmentArchive(captureSourceBundle(input, contract, at), structuredClone(contract));
}
function wire(a: SegmentArchive, i: number): SegmentOutput {
  const r = a.requests[i];
  return { schemaVersion: 'segment-candidates-v1', requestKey: r.key, segmentId: r.segment.id, targets: r.reference.targets.map(target => ({ target, status: 'examined', question: '', candidates: [] })) };
}
function returned(a: SegmentArchive, i: number, output = wire(a, i)) {
  return appendSegmentAttempt(a, { segmentId: a.requests[i].segment.id, requestKey: a.requests[i].key, outcome: { kind: 'returned', raw: JSON.stringify(output) } });
}
function complete(a = archive()) { for (let i = 0; i < a.requests.length; i++) a = returned(a, i); return a; }
function synthesis(a: SegmentArchive): SynthesisOutput {
  const r = buildSynthesisRequest(a);
  return { schemaVersion: 'segment-synthesis-v1', requestKey: r.key, findings: r.coverage.map(t => ({ target: t.target, state: 'not_stated', segmentIds: t.segmentIds, candidateIds: r.candidates.filter(c => c.target === t.target).map(c => c.id), rationale: 'Synthetic complete-source examination.', question: '' })) };
}
test('long capture preserves the late exception, canonical text and immutable parts under old per-record bounds', () => {
  const a = archive(); assert.ok(bundleText(a.bundle).length > 60000);
  assert.equal(verifySourceBundle(a.bundle, contract).id, a.bundle.id);
  const split = splitSourceBundle(a.bundle, contract);
  assert.deepEqual(joinSourceBundle(split.manifest, split.parts, split.plan, contract), a.bundle);
  assert.ok(split.parts.every(p => Buffer.byteLength(JSON.stringify(p)) < 128 * 1024));
  assert.throws(() => joinSourceBundle(split.manifest, split.parts.slice(0, -1), split.plan, contract));
  const changed = structuredClone(split); changed.parts[0].data.text += 'x';
  assert.throws(() => joinSourceBundle(changed.manifest, changed.parts, changed.plan, contract));
  assert.throws(() => joinSourceBundle(split.manifest, [...split.parts].reverse(), split.plan, contract));
  assert.throws(() => buildAnalysisRequest(bundleText(a.bundle), contract, undefined, a.bundle), /segment/);
});
test('Unicode, tiny lines, heading context and boundary ranges preserve every character once', () => {
  for (const text of ['測'.repeat(128000), 'a\n'.repeat(64000), 'x'.repeat(7999) + '😀' + 'z'.repeat(8001), '# Heading\n' + 'x'.repeat(17000)]) {
    const input = longSyntheticBundle(); input.documents[0].text = text;
    const b = captureSourceBundle(input, contract, at); const plan = newSegmentArchive(b, contract);
    assert.equal(plan.requests.map(r => r.text.slice(r.segment.start - r.segment.contextStart, r.segment.end - r.segment.contextStart)).join(''), text);
    assert.ok(plan.requests.every(r => isWellFormedText(r.text) && Buffer.byteLength(JSON.stringify(r)) <= SEGMENT_LIMITS.requestBytes));
    if (text.startsWith('#')) assert.ok(plan.requests[1].headings.some(h => h.text === '# Heading'));
  }
});
test('long version and joined separator budgets reject overflow; historical v1 remains 32k', () => {
  const input = longSyntheticBundle(); input.documents[0].text = 'x'.repeat(128001); assert.throws(() => captureSourceBundle(input, contract, at));
  input.documents[0].text = 'x'.repeat(128000); input.documents[1].text = 'x'; input.documents[1].capture = 'complete'; assert.throws(() => captureSourceBundle(input, contract, at));
  input.version = 'pasted-source-bundle-v1'; input.documents[0].text = 'x'.repeat(32001); assert.throws(() => captureSourceBundle(input, contract, at));
});
test('segment output cannot establish silence and must acknowledge every target', () => {
  const a = archive(), output: any = wire(a, 0);
  output.targets[0].state = 'not_stated'; assert.throws(() => validateSegment(a.requests[0], JSON.stringify(output)));
  delete output.targets[0].state; output.targets.pop(); assert.throws(() => validateSegment(a.requests[0], JSON.stringify(output)), /targets/);
});
for (const mode of ['pending', 'failed', 'invalid', 'unavailable', 'missing-document'] as const) test(`${mode} final material prevents confirmed silence without hiding earlier evidence`, () => {
  let a = archive(mode !== 'missing-document'); const first = wire(a, 0);
  first.targets.find(t => t.target === 'deletion')!.candidates = [{ quote: 'We delete all school records within thirty days.', role: 'supporting', rationale: 'Synthetic commitment.' }];
  a = returned(a, 0, first);
  for (let i = 1; i < a.requests.length - (mode === 'missing-document' ? 0 : 1); i++) a = returned(a, i);
  const last = a.requests.length - 1, request = a.requests[last];
  if (mode === 'failed') a = appendSegmentAttempt(a, { segmentId: request.segment.id, requestKey: request.key, outcome: { kind: 'failed', reason: 'Synthetic final request failed.' } });
  if (mode === 'invalid') a = appendSegmentAttempt(a, { segmentId: request.segment.id, requestKey: request.key, outcome: { kind: 'returned', raw: '{broken' } });
  if (mode === 'unavailable') { const out = wire(a, last); out.targets.forEach(t => { t.status = 'unavailable'; t.question = 'Examine the remaining source.'; }); a = returned(a, last, out); }
  const state = readSegmentArchive(a), target = state.coverage.find(t => t.target === 'deletion')!;
  assert.equal(target.ready, false); assert.equal(state.candidates.length, 1);
  const out = synthesis(a); out.findings.forEach(f => { if (!state.coverage.find(t => t.target === f.target)!.ready) { f.state = 'unavailable'; f.question = 'Complete source examination.'; } });
  const f = out.findings.find(f => f.target === 'deletion')!;
  f.state = 'established'; f.question = '';
  const validated = validateSynthesis(a, JSON.stringify(out));
  assert.equal(validated.findings.find(f => f.target === 'deletion')!.state, 'unavailable'); assert.equal(validated.original.findings.find(f => f.target === 'deletion')!.state, 'established');
  f.state = 'not_stated'; assert.throws(() => validateSynthesis(a, JSON.stringify(out)), /silence/);
});
test('late cross-segment contradiction must survive synthesis; missing candidate and range acknowledgments reject', () => {
  let a = archive();
  for (let i = 0; i < a.requests.length; i++) {
    const out = wire(a, i), target = out.targets.find(t => t.target === 'deletion');
    if (i === 0) target!.candidates.push({ quote: 'We delete all school records within thirty days.', role: 'supporting', rationale: 'Commitment.' });
    if (a.requests[i].text.includes('Backups are retained')) target!.candidates.push({ quote: 'Backups are retained for seven years after termination.', role: 'opposing', rationale: 'Late exception.' });
    a = returned(a, i, out);
  }
  const out = synthesis(a), f = out.findings.find(f => f.target === 'deletion')!;
  f.state = 'established'; assert.throws(() => validateSynthesis(a, JSON.stringify(out)), /opposing/);
  f.state = 'ambiguous'; f.question = 'Resolve the stated deletion scope and exception.';
  assert.equal(validateSynthesis(a, JSON.stringify(out)).complete, false);
  const changed = structuredClone(out); changed.findings.find(f => f.target === 'deletion')!.candidateIds.pop(); assert.throws(() => validateSynthesis(a, JSON.stringify(changed)), /candidates/);
  f.segmentIds.pop(); assert.throws(() => validateSynthesis(a, JSON.stringify(out)), /segments/);
});
test('overlapping boundary quotations deduplicate by exact document/range/target/role and preserve sightings', () => {
  const input = longSyntheticBundle(); input.documents[0].text = 'x'.repeat(7990) + 'A unique boundary commitment.' + 'y'.repeat(9000);
  let a = newSegmentArchive(captureSourceBundle(input, contract, at), structuredClone(contract));
  for (let i = 0; i < 2; i++) { const out = wire(a, i); out.targets[0].candidates = [{ quote: 'A unique boundary commitment.', role: 'supporting', rationale: `Boundary observation ${i}.` }]; a = returned(a, i, out); }
  const candidates = readSegmentArchive(a).candidates;
  assert.equal(candidates.length, 1); assert.equal(candidates[0].segmentIds.length, 2); assert.equal(candidates[0].rationales.length, 2);
});
test('retry cannot erase previously retained evidence; a stale synthesis is preserved but no longer current', () => {
  let a = complete(); const out = synthesis(a); a = appendSynthesis(a, JSON.stringify(out));
  assert.equal(inspectSegmentArchive(a).syntheses[0].current, true);
  const retry = wire(a, 0); retry.targets[0].candidates.push({ quote: 'We delete all school records within thirty days.', role: 'supporting', rationale: 'Found on explicit retry.' }); a = returned(a, 0, retry);
  assert.throws(() => validateSynthesis(a, JSON.stringify(out)), /Stale/); assert.equal(inspectSegmentArchive(a).syntheses[0].current, false);
  a = returned(a, 0); assert.equal(readSegmentArchive(a).candidates.length, 1);
  assert.throws(() => returned(a, 0), /three/);
});
test('changed manifests, requests, scope and plan identity fail closed', () => {
  for (const field of ['bundle','request','plan','contract'] as const) {
    const a = archive();
    if (field === 'bundle') a.bundle.scope.accounts = 'Different accounts';
    if (field === 'request') a.requests[0].text += 'tampered';
    if (field === 'plan') a.plan.segments.pop();
    if (field === 'contract') a.contract.criteria[0].weight += 1;
    assert.throws(() => readSegmentArchive(a));
  }
});
test('full evidence output and request budgets reject excess without truncation', () => {
  const a = archive(); assert.throws(() => validateSegment(a.requests[0], ' '.repeat(SEGMENT_LIMITS.outputBytes + 1)), /budget/);
  const c = structuredClone(contract); c.context = { ...c.context, customEvaluationContext: 'x'.repeat(260000) } as any; const { id: _id, ...body } = c; c.id = digest(body);
  assert.throws(() => newSegmentArchive(a.bundle, c), /budget/);
});
test('manual long review requires all dependency ranges; unfinished evidence survives without scores', () => {
  const a = archive(), text = bundleText(a.bundle), quote = 'Backups are retained for seven years after termination.', start = text.indexOf(quote);
  const evidence: any = { criterionId: 'deletion', finding: 'no', citations: [{ quote, start, end: start + quote.length }], rationale: 'A late exception.' };
  assert.throws(() => validateEvidence(text, evidence, contract, a.bundle), /every required/);
  evidence.finding = 'unresolved'; const saved = editAnalysis(text, contract.profileVersion, null, evidence, 'test', 'human', at, contract, undefined, true, a.bundle);
  assert.equal(saved.schemaVersion, 'findings-v6'); assert.equal(saved.score.total, null);
  evidence.sourceReview = { version: 'human-source-review-v1', bundleId: a.bundle.id, segmentIds: sourceSegments(a.bundle).map(s => s.id) }; evidence.finding = 'no';
  assert.equal(validateEvidence(text, evidence, contract, a.bundle).finding, 'no');
  evidence.sourceReview.segmentIds.push('s99'); assert.throws(() => validateEvidence(text, evidence, contract, a.bundle), /unknown/);
});
test('long capture and incomplete human range acknowledgments survive serialized draft reload', () => {
  const memory = new Map<string, string>(); const storage = { getItem: (k: string) => memory.get(k) || null, setItem: (k: string, v: string) => { memory.set(k, v); }, removeItem: (k: string) => { memory.delete(k); }, key: () => null, length: 0 };
  const a = archive(), store = new DraftStore('segments', storage);
  const capture = { sourceKind: 'bundle', sourceBundle: longSyntheticBundle(), name: '', sourceLabel: '', sourceText: '', fixtureId: 'complete', profileVersion: 'community-evidence-v1' };
  store.set('capture', capture);
  const evidence = { revision: 1, criterionId: 'deletion', finding: 'unresolved', citations: [], rationale: '', quoteText: '', sourceReview: { version: 'human-source-review-v1', bundleId: a.bundle.id, segmentIds: ['s1'] } };
  store.set('evidence', evidence); const reloaded = new DraftStore('segments', storage);
  assert.deepEqual(reloaded.get('capture', captureDraftSchema), capture); assert.deepEqual(reloaded.get('evidence', evidenceDraftSchema), evidence);
});
test('precision plan covers every adopted clause and preserves 50 measure weights', () => {
  const values = evaluationSettingsSchema.parse({ ...defaultEvaluation(), state: 'Colorado', starterProfile: 'pef-precision-v1' });
  const c = districtContract({ schemaVersion: 1, revision: 1, complete: true, values, updatedAt: null, updatedBy: null, definitionVersion: SETTINGS_DEFINITION_VERSION, contentHash: createHash('sha256').update(JSON.stringify({ definitionVersion: SETTINGS_DEFINITION_VERSION, values })).digest('hex') }, 1, 'evidence-weighted-v1');
  const input = longSyntheticBundle(); input.documents[1].requiredFor = ['*'];
  const a = newSegmentArchive(captureSourceBundle(input, c, at), c);
  assert.ok(a.requests[0].reference.targets.some(t => t.includes('/'))); assert.deepEqual(a.contract.criteria.map(c => c.weight), c.criteria.map(c => c.weight));
});
test('offline archive survives exact file round trip and CLI refuses overwrite', () => {
  let a = complete(); a = appendSynthesis(a, JSON.stringify(synthesis(a)));
  const dir = mkdtempSync(join(tmpdir(), 'privacypal-segment-archive-')), path = join(dir, 'archive.json');
  writeFileSync(path, JSON.stringify(a), { mode: 0o600 });
  const recovered = JSON.parse(readFileSync(path, 'utf8'));
  assert.deepEqual(inspectSegmentArchive(recovered), inspectSegmentArchive(a));
  const run = (...args: string[]) => execFileSync(process.execPath, ['--import','tsx','scripts/analysis-segments.ts',...args], { encoding: 'utf8', stdio: 'pipe' });
  assert.match(run('inspect', path), /"complete": true/);
  const target = join(dir, 'synthesis.json'); run('synthesis-request', path, target); assert.throws(() => run('synthesis-request', path, target));
  assert.equal(sourceHash(readFileSync(path, 'utf8')), sourceHash(JSON.stringify(a)));
});

test('complete-source synthesis refuses candidate overflow and preserves all segment evidence', () => {
  const input = longSyntheticBundle(); input.documents[0].text = Array.from({ length: 16 }, (_, i) => (`Unique core ${i}:` + 'x'.repeat(8000)).slice(0, 8000)).join('');
  let a = newSegmentArchive(captureSourceBundle(input, contract, at), structuredClone(contract));
  for (let i = 0; i < a.requests.length; i++) {
    const r = a.requests[i], out = wire(a, i), quote = r.text.slice(r.segment.start - r.segment.contextStart, r.segment.start - r.segment.contextStart + 2000);
    for (const t of out.targets) t.candidates = [{ quote, role: 'supporting', rationale: 'Synthetic maximum evidence retention.' }];
    a = returned(a, i, out);
  }
  const retained = readSegmentArchive(a).candidates.length; assert.equal(retained, 16 * 8);
  assert.throws(() => buildSynthesisRequest(a), /synthesis request.*budget/);
  assert.equal(readSegmentArchive(a).candidates.length, retained); assert.equal(a.syntheses.length, 0);
});

test('unfinished long precision review retains opposing and supporting clauses without resolving the measure', () => {
  const definitions = candidate.measures.find(m => m.id === 'sec_003')!.requirements;
  const { id: _old, ...body } = { ...contract, criteria: [{ ...contract.criteria[0], id: 'sec_003', requirements: definitions }] };
  const c = { ...body, id: digest(body) };
  const input = longSyntheticBundle(); input.documents[0].text = 'Transit is encrypted.\n' + 'x'.repeat(40000) + '\nStored data is unencrypted.'; input.documents[1].requiredFor = ['sec_003'];
  const bundle = captureSourceBundle(input, c, at), text = bundleText(bundle);
  const quotes = ['Transit is encrypted.', 'Stored data is unencrypted.'];
  const clauses = definitions.map((d, i) => ({ id: d.id, status: i ? 'opposed' : 'established', rationale: 'Retain exact synthetic evidence.', question: '', citations: [{ quote: quotes[i], start: text.indexOf(quotes[i]), end: text.indexOf(quotes[i]) + quotes[i].length, role: i ? 'opposition' : 'support' }] }));
  const evidence = { criterionId: 'sec_003', finding: 'unresolved', citations: [{ quote: quotes[0], start: 0, end: quotes[0].length }], rationale: 'Missing addendum and unfinished review.', sourceReview: { version: 'human-source-review-v1', bundleId: bundle.id, segmentIds: ['s1'] }, requirements: { version: 'requirements-v1', scope: 'Synthetic school accounts', scopeStatus: 'matched', scopeQuestion: '', sourceStatus: 'usable', requirements: clauses } };
  const saved = editAnalysis(text, c.profileVersion, null, evidence as any, 'test', 'reviewer', at, c, undefined, true, bundle);
  assert.equal(saved.score.total, null); assert.equal(saved.findings[0].requirements!.sourceStatus, 'incomplete');
  assert.deepEqual(saved.findings[0].requirements!.requirements.map(r => r.status), ['established','opposed']);
});
