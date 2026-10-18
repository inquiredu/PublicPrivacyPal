import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { policyTextSchema, canonicalPolicyTextSchema, isWellFormedText } from '../../shared/policy-source.ts';
import { sourceHash } from '../../server/evidence.ts';
import { buildAnalysisRequest, passagesFor, validateSuggestions, LEGACY_PROMPT_VERSION } from '../../server/analysis/contract.ts';
import { practiceContract } from '../../server/evaluation.ts';
import { ANALYSIS_EXAMPLE } from '../../shared/analysis-example.ts';
import { recordedExample, offlineProvider } from '../../server/analysis/offline.ts';
import { LEGACY_SUGGESTION_SCHEMA, suggestedEvidence, findingRules, questionReasons, type Suggestion } from '../../shared/assistance.ts';
import { OperationDeadline } from '../../server/analysis/deadline.ts';
import { processNextAssistance } from '../../server/analysis/jobs.ts';
import type { Services } from '../../server/firebase.ts';

const contract = practiceContract('community-evidence-v1');
const request = buildAnalysisRequest(ANALYSIS_EXAMPLE, contract);

test('malformed Unicode is rejected before segmentation in a timeout-isolated process', () => {
  const module = new URL('../../server/analysis/contract.ts', import.meta.url).href;
  const child = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e',
    `import {passagesFor} from ${JSON.stringify(module)}; for (const text of ["\\ud800\\nPolicy", "a\\ud800\\nb", "\\udc00", "\\ud800"]) { let rejected = false; try { passagesFor(text); } catch { rejected = true; } if (!rejected) throw new Error('Malformed source accepted'); }`],
  { timeout: 5000, encoding: 'utf8' });
  assert.ifError(child.error); assert.equal(child.status, 0, child.stderr);
});

test('ingestion, request construction and source identity share valid canonical text', () => {
  for (const malformed of ['\ud800', '\ud801', '\udc00', 'a\ud800\nb', '\ud800x', '\udc00\ud800']) {
    assert.equal(policyTextSchema.safeParse(malformed).success, false);
    assert.throws(() => buildAnalysisRequest(malformed, contract));
    assert.throws(() => sourceHash(malformed), /Unicode/);
    assert.throws(() => validateSuggestions(request, malformed, recordedExample(request)));
  }
  const canonical = policyTextSchema.parse('  🔒 Terms\r\nPolicy\rNext\tsection  ');
  assert.equal(canonical, '  🔒 Terms\nPolicy\nNext\tsection  ');
  assert.equal(buildAnalysisRequest(canonical, contract).sourceHash, sourceHash(canonical));
  for (const raw of ['Terms\r\nPolicy', 'Terms\rPolicy', 'Terms\u0000Policy']) {
    assert.equal(canonicalPolicyTextSchema.safeParse(raw).success, false);
    assert.throws(() => buildAnalysisRequest(raw, contract));
  }
  assert.notEqual(sourceHash('é'), sourceHash('e\u0301'));
  assert.equal(policyTextSchema.safeParse('x'.repeat(32000)).success, true);
  assert.equal(policyTextSchema.safeParse('x'.repeat(32001)).success, false);
  assert.equal(policyTextSchema.safeParse('x\r\n'.repeat(16000)).success, false);
});

test('segmentation preserves exact valid Unicode at newline and size boundaries', () => {
  for (const offset of [0, 1, 3998, 3999, 4000, 4001]) {
    for (const tail of ['\nPolicy', '\n\nPolicy', 'z', '']) {
      const source = 'a'.repeat(offset) + '🔒' + tail;
      const passages = passagesFor(source);
      for (const p of passages) {
        assert.equal(p.text, source.slice(p.start, p.end));
        assert.ok(p.end > p.start); assert.ok(isWellFormedText(p.text));
      }
      assert.equal(passages.map(p => p.text).join('').replace(/\s/g, ''), source.replace(/\s/g, ''));
    }
  }
  for (const a of ['a', '\ud800', '\udc00', '🔒', '\n']) for (const b of ['b', '\ud800', '\udc00', '🔒', '\n']) {
    const source = `Prefix${a}${b}Suffix`;
    if (isWellFormedText(source)) assert.doesNotThrow(() => passagesFor(source));
    else assert.throws(() => passagesFor(source));
  }
});

test('clear negative and partial findings need no invented uncertainty or question', () => {
  for (const state of ['contradicted', 'partial'] as const) {
    const raw = recordedExample(request);
    Object.assign(raw.findings[0], { state, uncertainty: 'none', question: '' });
    const result = validateSuggestions(request, ANALYSIS_EXAMPLE, raw);
    assert.equal(suggestedEvidence(result.findings[0], result)?.finding, state === 'partial' ? 'partial' : 'no');
  }
  const raw = recordedExample(request);
  raw.findings.find(f => f.state === 'partial')!.question = '';
  assert.doesNotThrow(() => validateSuggestions(request, ANALYSIS_EXAMPLE, raw));
});

test('unresolved assurances cannot validate or become a yes draft, including legacy results', () => {
  for (const uncertainty of ['missing_source', 'conflict', 'scope', 'ambiguous_wording', 'missing_statement'] as const) {
    const raw = recordedExample(request); Object.assign(raw.findings[0], { uncertainty, question: 'What resolves this?' });
    assert.throws(() => validateSuggestions(request, ANALYSIS_EXAMPLE, raw), /incompatible/);
    const result = validateSuggestions(request, ANALYSIS_EXAMPLE, recordedExample(request));
    assert.equal(suggestedEvidence({ ...result.findings[0], uncertainty }, { ...result, schemaVersion: LEGACY_SUGGESTION_SCHEMA }), null);
  }
  const raw = recordedExample(request); Object.assign(raw.findings[0], { state: 'ambiguous', uncertainty: 'conflict', question: 'Which clause applies?' });
  assert.doesNotThrow(() => validateSuggestions(request, ANALYSIS_EXAMPLE, raw));
  raw.findings[0].question = '  ';
  assert.throws(() => validateSuggestions(request, ANALYSIS_EXAMPLE, raw), /follow-up/);
});

test('a known permitted exception can remain supported without inventing factual uncertainty', () => {
  const raw = recordedExample(request);
  Object.assign(raw.findings[0], { uncertainty: 'exception', question: '', scope: 'School accounts; the adopted definition permits the stated limited exception.' });
  const result = validateSuggestions(request, ANALYSIS_EXAMPLE, raw);
  assert.equal(suggestedEvidence(result.findings[0], result)?.finding, 'yes');
});

test('prompt and emitted schema carry the same state/question compatibility specification', () => {
  assert.ok(request.instructions.includes(JSON.stringify(findingRules)));
  const schema = request.schema as { properties: { findings: { items: { allOf: any[] } } } };
  const rules = schema.properties.findings.items.allOf;
  for (const [state, reasons] of Object.entries(findingRules)) {
    assert.deepEqual(rules.find(rule => rule.if.properties.state?.const === state).then.properties.uncertainty.enum, reasons);
  }
  assert.deepEqual(rules.at(-1).if.properties.uncertainty.enum, questionReasons);
});

test('historical v1 request identity and validation remain pinned; new requests have new keys', async () => {
  const legacy = buildAnalysisRequest(ANALYSIS_EXAMPLE, contract, LEGACY_PROMPT_VERSION);
  // Captured from the pre-change implementation, not recomputed from the new builder.
  assert.equal(legacy.key, '5344077b3aea1693d91775a152d4c529c958df31f1f4540e857afb122c44a4c9');
  assert.notEqual(request.key, legacy.key);
  const response = await offlineProvider.generate(legacy, { attemptId: 'historical', signal: new AbortController().signal });
  assert.equal(response.status, 'completed'); if (response.status !== 'completed') return;
  const result = validateSuggestions(legacy, ANALYSIS_EXAMPLE, response.output);
  assert.equal(result.schemaVersion, LEGACY_SUGGESTION_SCHEMA);
  assert.throws(() => validateSuggestions(request, ANALYSIS_EXAMPLE, response.output));
  const raw = { ...recordedExample(request), schemaVersion: LEGACY_SUGGESTION_SCHEMA };
  Object.assign(raw.findings[0], { state: 'contradicted' as Suggestion['state'], uncertainty: 'none', question: '' });
  assert.throws(() => validateSuggestions(legacy, ANALYSIS_EXAMPLE, raw), /follow-up/);
});

test('a deadline bounds uncooperative work and removes authority from late continuations', async () => {
  let release!: () => void; let wrote = false;
  const stalled = new Promise<void>(resolve => { release = resolve; });
  const d = new OperationDeadline(30);
  try {
    await assert.rejects(d.wait(async () => { await stalled; d.check(); wrote = true; }));
    release(); await delay(0); assert.equal(wrote, false);
    await assert.rejects(d.wait(async () => { wrote = true; }));
  } finally { d.dispose(); }
});

test('query stalls and shutdown before claiming do not hold the worker slot indefinitely', async () => {
  const chain = { where: () => chain, orderBy: () => chain, limit: () => chain, get: () => new Promise<never>(() => {}) };
  const s = { config: { districtId: 'demo-invariants' }, db: { collection: () => chain } } as unknown as Services;
  assert.equal(await processNextAssistance(s, offlineProvider, { timeoutMs: 30 }), false);
  const stop = new AbortController();
  const pending = processNextAssistance(s, offlineProvider, { signal: stop.signal });
  stop.abort(); assert.equal(await pending, false);
});

test('disposing a finished operation also fences any outstanding heartbeat continuation', async () => {
  const d = new OperationDeadline(1000); let release!: () => void; let renewed = false;
  const blocked = new Promise<void>(resolve => { release = resolve; });
  const late = d.wait(async () => { await blocked; d.check(); renewed = true; });
  await delay(0); d.dispose(); await assert.rejects(late);
  release(); await delay(0); assert.equal(renewed, false);
});
