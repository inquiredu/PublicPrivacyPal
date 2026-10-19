import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setTimeout as delay } from 'node:timers/promises';
import { processNextAssistance } from '../../server/analysis/jobs.ts';
import { buildAnalysisRequest, LEGACY_PROMPT_VERSION, MAX_OUTPUT_BYTES } from '../../server/analysis/contract.ts';
import { ProviderFailure, providerResponseSchema, type ProviderResponse } from '../../server/analysis/provider.ts';
import { recordedExample } from '../../server/analysis/offline.ts';
import { validateSynthesis } from '../../server/analysis/segments.ts';
import { ANALYSIS_EXAMPLE } from '../../shared/analysis-example.ts';
import {
  completedResponse, deferred, knownUsage, providerContract, providerRequest, qualificationHarness,
  scriptedProvider, unknownUsage,
} from '../fixtures/provider-qualification.ts';
import { adoptionArchive, commitmentQuote, returnAllSegments, synthesisOutput } from '../fixtures/segmented-adoption.ts';

test('fake completed transport runs the production worker and settles a known charge once without human authority', async () => {
  const fake = scriptedProvider(), h = await qualificationHarness(fake.provider);
  assert.equal(await processNextAssistance(h.services, fake.provider), true);
  assert.equal(h.job().status, 'succeeded'); assert.equal(h.results().length, 1);
  assert.equal(h.budget().reservedMicros, 0); assert.equal(h.budget().spentMicros, 25);
  assert.equal(await processNextAssistance(h.services, fake.provider), false);
  assert.equal(fake.calls.generate.length, 1); assert.equal(h.budget().spentMicros, 25);
  const review = await h.review();
  assert.equal(review.analysis, null); assert.equal(review.decision, null); assert.equal(review.published, false);
});

for (const mode of ['refusal', 'truncation', 'malformed-json', 'schema', 'citation', 'missing-finding', 'unauthorized-field', 'output-bound'] as const) {
  test(`${mode} fake response produces no accepted suggestion`, async () => {
    const fake = scriptedProvider({ async generate(request) {
      if (mode === 'refusal' || mode === 'truncation') return { status: mode === 'refusal' ? 'refused' : 'incomplete', requestId: mode, usage: knownUsage };
      const output = recordedExample(request);
      if (mode === 'schema') output.schemaVersion = 'unsupported-output' as typeof output.schemaVersion;
      if (mode === 'citation') output.citations[0].quote = 'This quotation was invented by the fixture.';
      if (mode === 'missing-finding') output.findings.pop();
      return { status: 'completed', requestId: mode, usage: knownUsage,
        output: mode === 'malformed-json' ? '{"findings":' : mode === 'output-bound' ? 'x'.repeat(MAX_OUTPUT_BYTES + 1)
          : mode === 'unauthorized-field' ? { ...output, districtDecision: 'approved' } : output,
      };
    } });
    const h = await qualificationHarness(fake.provider);
    await processNextAssistance(h.services, fake.provider);
    assert.equal(h.job().status, 'failed'); assert.equal(h.job().resultId, null); assert.equal(h.results().length, 0);
    assert.equal(fake.calls.generate.length, 1); assert.equal(h.budget().spentMicros, 25);
    assert.equal(h.budget().reservedMicros, 0);
  });
}

test('strict provider envelopes reject malformed usage and permit explicit unknown cost', () => {
  assert.equal(providerResponseSchema.parse(completedResponse(providerRequest, unknownUsage)).usage.costMicros, null);
  for (const costMicros of [-1, 1.5, NaN, '25']) {
    assert.throws(() => providerResponseSchema.parse({ ...completedResponse(), usage: { ...knownUsage, costMicros } }));
  }
  assert.throws(() => providerResponseSchema.parse({ status: 'incomplete', output: '{partial}', requestId: 'partial', usage: unknownUsage }));
  assert.throws(() => providerResponseSchema.parse({ ...completedResponse(), requestId: 'x'.repeat(201) }));
});

test('slow bounded transport can finish before the operation deadline', { timeout: 2000 }, async () => {
  const fake = scriptedProvider({ async generate(request) { await delay(20); return completedResponse(request); } });
  const h = await qualificationHarness(fake.provider);
  await processNextAssistance(h.services, fake.provider, { timeoutMs: 1000 });
  assert.equal(h.job().status, 'succeeded'); assert.equal(fake.calls.generate.length, 1);
});

test('stalled transport times out and its late return cannot acquire commit authority', { timeout: 2000 }, async () => {
  const reached = deferred<void>(), release = deferred<ProviderResponse>();
  const fake = scriptedProvider({ async generate() { reached.resolve(); return release.promise; } });
  const h = await qualificationHarness(fake.provider);
  const worker = processNextAssistance(h.services, fake.provider, { timeoutMs: 80, cleanupTimeoutMs: 80 });
  await reached.promise; await worker;
  assert.equal(h.job().status, 'unknown'); assert.equal(h.job().resultId, null); assert.equal(h.budget().reservedMicros, 1000);
  const before = h.job(); release.resolve(completedResponse()); await delay(0);
  assert.deepEqual(h.job(), before); assert.equal(h.results().length, 0); assert.equal(fake.calls.generate.length, 1);
});

test('stalled identity is bounded before dispatch and a late lookup cannot send a request', { timeout: 2000 }, async () => {
  const reached = deferred<void>(), release = deferred<void>(), fake = scriptedProvider(), h = await qualificationHarness(fake.provider);
  h.identityWait(async () => { reached.resolve(); await release.promise; });
  const worker = processNextAssistance(h.services, fake.provider, { timeoutMs: 80, cleanupTimeoutMs: 80 });
  await reached.promise; await worker;
  assert.equal(h.job().status, 'failed'); assert.equal(h.budget().reservedMicros, 0);
  release.resolve(); await delay(0); assert.equal(fake.calls.generate.length, 0);
});

test('queued cancellation releases only an undispatched reservation', async () => {
  const fake = scriptedProvider(), h = await qualificationHarness(fake.provider);
  await h.cancel();
  assert.equal(h.job().status, 'cancelled'); assert.equal(h.budget().reservedMicros, 0);
  assert.equal(await processNextAssistance(h.services, fake.provider), false); assert.equal(fake.calls.generate.length, 0);
});

test('in-flight cancellation retains unknown billing and fences a late completion', async () => {
  const reached = deferred<void>(), release = deferred<ProviderResponse>();
  const fake = scriptedProvider({ async generate() { reached.resolve(); return release.promise; } }), h = await qualificationHarness(fake.provider);
  const worker = processNextAssistance(h.services, fake.provider); await reached.promise; await h.cancel();
  assert.equal(h.job().status, 'unknown'); assert.equal(h.budget().reservedMicros, 1000);
  release.resolve(completedResponse()); await worker;
  assert.equal(h.job().status, 'unknown'); assert.equal(h.job().resultId, null); assert.equal(h.results().length, 0);
});

test('external shutdown stops waiting without accepting the late response', async () => {
  const reached = deferred<void>(), release = deferred<ProviderResponse>(), stop = new AbortController();
  const fake = scriptedProvider({ async generate() { reached.resolve(); return release.promise; } }), h = await qualificationHarness(fake.provider);
  const worker = processNextAssistance(h.services, fake.provider, { signal: stop.signal });
  await reached.promise; stop.abort(); await worker;
  const before = h.job(); assert.equal(before.status, 'unknown');
  release.resolve(completedResponse()); await delay(0); assert.deepEqual(h.job(), before);
});

test('uncertain dispatch is looked up across retries and never generated twice', async () => {
  let lookup: ProviderResponse | null = null;
  const fake = scriptedProvider({ async generate() { throw new ProviderFailure('unknown', 'Authored lost response.'); }, async reconcile() { return lookup; } });
  const h = await qualificationHarness(fake.provider);
  await processNextAssistance(h.services, fake.provider);
  assert.equal(h.job().status, 'unknown'); assert.equal(h.budget().reservedMicros, 1000);
  for (let i = 0; i < 2; i++) { h.patchJob({ leaseUntil: 0 }); await processNextAssistance(h.services, fake.provider); }
  assert.equal(fake.calls.generate.length, 1); assert.equal(fake.calls.reconcile.length, 2);
  assert.equal(h.budget().spentMicros, 0); assert.equal(h.budget().reservedMicros, 1000);
  lookup = completedResponse(); h.patchJob({ leaseUntil: 0 }); await processNextAssistance(h.services, fake.provider);
  assert.equal(h.job().status, 'succeeded'); assert.equal(h.budget().spentMicros, 25); assert.equal(h.budget().reservedMicros, 0);
  assert.equal(await processNextAssistance(h.services, fake.provider), false);
  assert.equal(fake.calls.generate.length, 1); assert.equal(fake.calls.reconcile.length, 3); assert.equal(h.budget().spentMicros, 25);
});

test('revocation before dispatch prevents generation', async () => {
  const fake = scriptedProvider(), h = await qualificationHarness(fake.provider); h.revoke();
  await processNextAssistance(h.services, fake.provider);
  assert.equal(fake.calls.generate.length, 0); assert.equal(h.job().status, 'failed'); assert.equal(h.budget().reservedMicros, 0);
});

for (const change of ['revoke', 'human-correction'] as const) {
  test(`${change} before completion prevents result authority while retaining unknown reservation`, async () => {
    const reached = deferred<void>(), release = deferred<ProviderResponse>();
    const fake = scriptedProvider({ async generate() { reached.resolve(); return release.promise; } }), h = await qualificationHarness(fake.provider);
    const worker = processNextAssistance(h.services, fake.provider); await reached.promise;
    if (change === 'revoke') h.revoke(); else await h.correct();
    const human = await h.review(); release.resolve(completedResponse(providerRequest, unknownUsage)); await worker;
    assert.equal(h.job().status, change === 'revoke' ? 'failed' : 'stale');
    assert.equal(h.job().resultId, null); assert.equal(h.results().length, 0); assert.equal(h.budget().reservedMicros, 1000);
    assert.deepEqual(await h.review(), human);
    // Known qualification gap: terminal unsettled jobs are absent from the current worker query.
    h.patchJob({ leaseUntil: 0 }); assert.equal(await processNextAssistance(h.services, fake.provider), false);
    assert.equal(fake.calls.reconcile.length, 0);
  });
}

test('maintenance fences dispatch and commit; later recovery only looks up a marked dispatch', async () => {
  const reached = deferred<void>(), release = deferred<ProviderResponse>();
  const fake = scriptedProvider({ async generate() { reached.resolve(); return release.promise; }, async reconcile() { return completedResponse(); } });
  const h = await qualificationHarness(fake.provider); h.maintenance(true);
  assert.equal(await processNextAssistance(h.services, fake.provider), false); assert.equal(fake.calls.generate.length, 0);
  h.maintenance(false); const worker = processNextAssistance(h.services, fake.provider); await reached.promise;
  h.maintenance(true); release.resolve(completedResponse()); await worker;
  assert.equal(h.job().status, 'running'); assert.equal(h.job().resultId, null); assert.equal(h.budget().reservedMicros, 1000);
  h.maintenance(false); h.patchJob({ leaseUntil: 0 }); await processNextAssistance(h.services, fake.provider);
  assert.equal(fake.calls.generate.length, 1); assert.equal(fake.calls.reconcile.length, 1); assert.equal(h.job().status, 'succeeded');
});

test('historical wire versions require explicit adapter support without silent translation', async () => {
  const legacy = buildAnalysisRequest(ANALYSIS_EXAMPLE, providerContract, LEGACY_PROMPT_VERSION);
  const supported = scriptedProvider(), h = await qualificationHarness(supported.provider, legacy);
  await processNextAssistance(h.services, supported.provider);
  assert.equal(h.job().status, 'succeeded'); assert.equal(h.results()[0].output.schemaVersion, 'policy-suggestions-v1');
  const unsupported = scriptedProvider({ schemas: ['policy-suggestions-v2'] }), rejected = await qualificationHarness(unsupported.provider, legacy);
  await processNextAssistance(rejected.services, unsupported.provider);
  assert.equal(rejected.job().status, 'failed'); assert.equal(unsupported.calls.sent.length, 0); assert.equal(rejected.budget().reservedMicros, 0);
  assert.notEqual(providerRequest.key, legacy.key);
});

test('a different adapter model/version cannot claim a queued job', async () => {
  const fake = scriptedProvider(), h = await qualificationHarness(fake.provider);
  assert.equal(await processNextAssistance(h.services, { ...fake.provider, version: 'new-version' }), false);
  assert.equal(await processNextAssistance(h.services, { ...fake.provider, model: 'new-model' }), false);
  assert.equal(h.job().status, 'queued'); assert.equal(fake.calls.generate.length, 0);
});

test('qualification gap: a completed unknown-cost result retains reservation but has no terminal lookup path', async () => {
  const fake = scriptedProvider({ async generate(request) { return completedResponse(request, unknownUsage); } }), h = await qualificationHarness(fake.provider);
  await processNextAssistance(h.services, fake.provider);
  assert.equal(h.job().status, 'succeeded'); assert.equal(h.job().settled, false);
  assert.equal(h.budget().reservedMicros, 1000); assert.equal(h.budget().spentMicros, 0);
  h.patchJob({ leaseUntil: 0 }); assert.equal(await processNextAssistance(h.services, fake.provider), false);
  assert.equal(fake.calls.reconcile.length, 0);
});

test('qualification gap: ordinary suggestion storage preserves parsed output, not original transport formatting', async () => {
  const wire = `\n${JSON.stringify(recordedExample(providerRequest), null, 2)}\n`;
  const fake = scriptedProvider({ async generate() { return { status: 'completed', output: wire, requestId: 'wire-probe', usage: knownUsage }; } });
  const h = await qualificationHarness(fake.provider); await processNextAssistance(h.services, fake.provider);
  assert.equal(typeof h.results()[0].output, 'object');
  assert.deepEqual(h.results()[0].output, JSON.parse(wire));
  assert.ok(![...h.db.rows.values()].some(row => Object.values(row).includes(wire)));
});

test('segmented original assessment and server-derived unavailable result remain distinct', () => {
  const archive = returnAllSegments(adoptionArchive('commitment', true), [{ quote: commitmentQuote, role: 'supporting' }]);
  const raw = `\n${JSON.stringify(synthesisOutput(archive, 'established'), null, 2)}\n`;
  const envelope = providerResponseSchema.parse({ status: 'completed', output: raw, requestId: 'segmented-structural-only', usage: unknownUsage });
  assert.equal(envelope.status, 'completed'); if (envelope.status !== 'completed') return;
  const result = validateSynthesis(archive, envelope.output as string);
  assert.equal(envelope.output, raw);
  assert.equal(result.original.findings.find(f => f.target === 'deletion')!.state, 'established');
  assert.equal(result.findings.find(f => f.target === 'deletion')!.state, 'unavailable');
});
