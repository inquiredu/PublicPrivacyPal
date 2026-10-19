import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendSegmentAttempt, appendSynthesis, inspectSegmentArchive, readSegmentArchive, validateSegment, validateSynthesis,
} from '../../server/analysis/segments.ts';
import { bundleText } from '../../server/source-bundle.ts';
import { editAnalysis, validateEvidence } from '../../server/evidence.ts';
import { SEGMENT_LIMITS, sourceSegments } from '../../shared/source-segments.ts';
import {
  ADOPTION_AT, adoptionArchive, adultQuote, commitmentQuote, emptySegmentOutput, opposingQuote,
  returnAllSegments, returnSegment, synthesisOutput,
} from '../fixtures/segmented-adoption.ts';

test('complete authored commitment retains original wire formatting separately from derived synthesis', () => {
  const archive = returnAllSegments(adoptionArchive(), [{ quote: commitmentQuote, role: 'supporting' }]);
  const wire = `\n${JSON.stringify(synthesisOutput(archive, 'established'), null, 2)}\n`;
  const saved = appendSynthesis(archive, wire), inspected = inspectSegmentArchive(saved);
  assert.equal(saved.syntheses[0].raw, wire);
  assert.equal(inspected.syntheses[0].state, 'validated');
  assert.equal(inspected.syntheses[0].current, true);
  const validated = validateSynthesis(saved, wire);
  assert.equal(validated.findings.find(f => f.target === 'deletion')!.state, 'established');
  assert.equal(validated.complete, true);
  assert.ok(saved.requests.length >= 3);
  assert.deepEqual(inspectSegmentArchive(JSON.parse(JSON.stringify(saved))), inspected);
});

test('omission requires complete examination and exact required-range acknowledgments', () => {
  const archive = returnAllSegments(adoptionArchive('omission')), output = synthesisOutput(archive);
  assert.equal(validateSynthesis(archive, JSON.stringify(output)).complete, true);
  output.findings.find(f => f.target === 'deletion')!.segmentIds.pop();
  assert.throws(() => validateSynthesis(archive, JSON.stringify(output)), /required synthesis segments/);
});

test('late contradiction remains visible and prevents a positive synthesis', () => {
  const archive = returnAllSegments(adoptionArchive('contradiction'), [
    { quote: commitmentQuote, role: 'supporting' }, { quote: opposingQuote, role: 'opposing' },
  ]);
  assert.throws(() => validateSynthesis(archive, JSON.stringify(synthesisOutput(archive, 'established'))), /opposing/);
  const output = synthesisOutput(archive, 'ambiguous'), result = validateSynthesis(archive, JSON.stringify(output));
  assert.equal(result.complete, false);
  assert.deepEqual(new Set(result.findings.find(f => f.target === 'deletion')!.candidates.map(c => c.quote)), new Set([commitmentQuote, opposingQuote]));
  output.findings.find(f => f.target === 'deletion')!.candidateIds.pop();
  assert.throws(() => validateSynthesis(archive, JSON.stringify(output)), /retained synthesis candidates/);
});

for (const finalState of ['pending', 'failed', 'invalid', 'unavailable'] as const) {
  test(`${finalState} final range withholds a positive interpretation and cannot establish silence`, () => {
    let archive = adoptionArchive();
    for (let index = 0; index < archive.requests.length - 1; index++) {
      const output = emptySegmentOutput(archive, index);
      if (index === 0) output.targets.find(t => t.target === 'deletion')!.candidates.push({ quote: commitmentQuote, role: 'supporting', rationale: 'An earlier available commitment.' });
      archive = returnSegment(archive, index, output);
    }
    const last = archive.requests.length - 1, request = archive.requests[last];
    if (finalState === 'failed' || finalState === 'invalid') archive = appendSegmentAttempt(archive, {
      segmentId: request.segment.id, requestKey: request.key,
      outcome: finalState === 'failed' ? { kind: 'failed', reason: 'Authored final-range failure.' } : { kind: 'returned', raw: '{invalid response' },
    });
    if (finalState === 'unavailable') {
      const output = emptySegmentOutput(archive, last);
      output.targets.forEach(t => { t.status = 'unavailable'; t.question = 'Read the final range.'; });
      archive = returnSegment(archive, last, output);
    }
    const output = synthesisOutput(archive, 'established');
    output.findings.filter(f => f.target !== 'deletion').forEach(f => { f.state = 'unavailable'; f.question = 'Read the final range.'; });
    const result = validateSynthesis(archive, JSON.stringify(output));
    assert.equal(result.original.findings.find(f => f.target === 'deletion')!.state, 'established');
    assert.equal(result.findings.find(f => f.target === 'deletion')!.state, 'unavailable');
    assert.equal(result.findings.find(f => f.target === 'deletion')!.candidates.length, 1);
    output.findings.find(f => f.target === 'deletion')!.state = 'not_stated';
    assert.throws(() => validateSynthesis(archive, JSON.stringify(output)), /silence/);
  });
}

test('a missing declared annex blocks only its dependent target without hiding other coverage', () => {
  const archive = returnAllSegments(adoptionArchive('commitment', true), [{ quote: commitmentQuote, role: 'supporting' }]);
  const result = validateSynthesis(archive, JSON.stringify(synthesisOutput(archive, 'established')));
  assert.equal(result.findings.find(f => f.target === 'deletion')!.state, 'unavailable');
  assert.ok(result.findings.filter(f => f.target !== 'deletion').every(f => f.state === 'not_stated'));
  assert.deepEqual(readSegmentArchive(archive).coverage.find(t => t.target === 'deletion')!.missing, ['annex']);
});

for (const [name, quote] of [['invented', 'An invented retention promise.'], ['ambiguous', 'Synthetic layout information.'], ['outside segment', opposingQuote]] as const) {
  test(`${name} citation is preserved as invalid raw output, never accepted as a candidate`, () => {
    const archive = adoptionArchive('contradiction'), output = emptySegmentOutput(archive, 0);
    output.targets.find(t => t.target === 'deletion')!.candidates.push({ quote, role: 'supporting', rationale: 'Authored malformed-citation probe.' });
    assert.throws(() => validateSegment(archive.requests[0], JSON.stringify(output)), /quotation/);
    const raw = JSON.stringify(output), saved = returnSegment(archive, 0, output), state = readSegmentArchive(saved);
    assert.equal(saved.attempts[0].outcome.kind === 'returned' && saved.attempts[0].outcome.raw, raw);
    assert.equal(state.attempts[0].state, 'returned');
    assert.equal(state.candidates.length, 0);
  });
}

test('retry omission and subsequent failure cannot erase earlier candidates or revive historical synthesis', () => {
  let archive = returnAllSegments(adoptionArchive(), [{ quote: commitmentQuote, role: 'supporting' }]);
  const originalWire = JSON.stringify(synthesisOutput(archive, 'established'));
  archive = appendSynthesis(archive, originalWire);
  archive = returnSegment(archive, 0);
  assert.equal(inspectSegmentArchive(archive).syntheses[0].current, false);
  assert.equal(inspectSegmentArchive(archive).syntheses[0].state, 'validated');
  assert.throws(() => validateSynthesis(archive, originalWire), /Stale/);
  assert.throws(() => validateSynthesis(archive, JSON.stringify(synthesisOutput(archive))), /silence/);
  const request = archive.requests[0];
  archive = appendSegmentAttempt(archive, { segmentId: request.segment.id, requestKey: request.key, outcome: { kind: 'failed', reason: 'Authored retry failure.' } });
  assert.equal(readSegmentArchive(archive).candidates.length, 1);
  assert.equal(readSegmentArchive(archive).coverage.find(t => t.target === 'deletion')!.ready, false);
  assert.equal(archive.syntheses[0].raw, originalWire);
  assert.throws(() => returnSegment(archive, 0), /three/);
});

test('foreign segment identity and forged authority fields cannot enter validated output', () => {
  const archive = adoptionArchive(), output = emptySegmentOutput(archive, 0);
  assert.throws(() => validateSegment(archive.requests[1], JSON.stringify(output)), /cross-segment/);
  for (const field of ['reviewedBy', 'score', 'decision', 'published', 'serviceFacts']) {
    assert.throws(() => validateSegment(archive.requests[0], JSON.stringify({ ...output, [field]: 'forged' })));
  }
  const complete = returnAllSegments(archive);
  assert.throws(() => validateSynthesis(complete, JSON.stringify({ ...synthesisOutput(complete), reviewedBy: 'forged' })));
});

test('response and synthesis-count bounds reject excess without replacing stored returns', () => {
  const empty = adoptionArchive(), request = empty.requests[0];
  assert.throws(() => appendSegmentAttempt(empty, { segmentId: request.segment.id, requestKey: request.key,
    outcome: { kind: 'returned', raw: 'x'.repeat(SEGMENT_LIMITS.outputBytes + 1) },
  }), /Invalid returned output/);
  assert.equal(empty.attempts.length, 0);
  let archive = returnAllSegments(empty), raw = JSON.stringify(synthesisOutput(archive));
  for (let i = 0; i < 3; i++) archive = appendSynthesis(archive, raw);
  assert.throws(() => appendSynthesis(archive, raw), /excessive/);
  assert.equal(archive.syntheses.length, 3);
});

test('exact quotes and structural acceptance do not certify account scope or interpretation', () => {
  const archive = returnAllSegments(adoptionArchive('wrong-scope'), [{ quote: adultQuote, role: 'supporting' }]);
  const result = validateSynthesis(archive, JSON.stringify(synthesisOutput(archive, 'established')));
  // Deliberate known limitation: this adult-only quote does not establish the school-account claim.
  assert.equal(result.findings.find(f => f.target === 'deletion')!.state, 'established');
  assert.equal(archive.bundle.scope.accounts, 'District-managed school accounts');
  assert.equal(result.findings.find(f => f.target === 'deletion')!.candidates[0].quote, adultQuote);
});

test('machine examination supplies no human range acknowledgment or proposal authority', () => {
  const archive = returnAllSegments(adoptionArchive(), [{ quote: commitmentQuote, role: 'supporting' }]);
  assert.equal(validateSynthesis(archive, JSON.stringify(synthesisOutput(archive, 'established'))).complete, true);
  const source = bundleText(archive.bundle), start = source.indexOf(commitmentQuote);
  const evidence = { criterionId: 'deletion', finding: 'yes' as const, citations: [{ quote: commitmentQuote, start, end: start + commitmentQuote.length }], rationale: 'Human interpretation of the authored fixture.' };
  assert.throws(() => validateEvidence(source, evidence, archive.contract, archive.bundle), /every required source segment/);
  const acknowledged = { ...evidence, sourceReview: { version: 'human-source-review-v1' as const, bundleId: archive.bundle.id, segmentIds: sourceSegments(archive.bundle).map(s => s.id) } };
  assert.equal(validateEvidence(source, acknowledged, archive.contract, archive.bundle).finding, 'yes');
  assert.throws(() => editAnalysis(source, archive.contract.profileVersion, null, { ...acknowledged, proposalId: '00000000-0000-4000-8000-000000000001' },
    'synthetic-evaluation', 'synthetic-reviewer', ADOPTION_AT, archive.contract, undefined, true, archive.bundle), /verified by the server/);
});

test('late offline output has no authority to replace an attributed human correction', () => {
  const archive = adoptionArchive('contradiction'), source = bundleText(archive.bundle), start = source.indexOf(opposingQuote);
  const evidence = { criterionId: 'deletion', finding: 'no' as const, citations: [{ quote: opposingQuote, start, end: start + opposingQuote.length }],
    rationale: 'Human correction retains the indefinite-backup exception.',
    sourceReview: { version: 'human-source-review-v1' as const, bundleId: archive.bundle.id, segmentIds: sourceSegments(archive.bundle).map(s => s.id) },
  };
  const human = editAnalysis(source, archive.contract.profileVersion, null, evidence, 'human-v1', 'synthetic-reviewer', ADOPTION_AT, archive.contract, undefined, true, archive.bundle);
  const before = structuredClone(human);
  const late = returnAllSegments(archive, [{ quote: commitmentQuote, role: 'supporting' }]);
  const output = appendSynthesis(late, JSON.stringify(synthesisOutput(late, 'established')));
  assert.equal(inspectSegmentArchive(output).syntheses[0].state, 'validated');
  assert.throws(() => editAnalysis(source, archive.contract.profileVersion, human, { ...evidence, proposalId: '00000000-0000-4000-8000-000000000002' },
    'forged-v2', 'synthetic-reviewer', ADOPTION_AT, archive.contract, undefined, true, archive.bundle), /verified by the server/);
  assert.deepEqual(human, before);
  assert.equal(human.findings.find(f => f.id === 'deletion')!.finding, 'no');
  // This is the present offline authority boundary, not a claim that future segmented jobs exist.
});
