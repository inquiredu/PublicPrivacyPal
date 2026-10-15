import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculateScore } from '../../shared/scoring/engine.ts';
import { DEFAULT_PROFILE, getProfile, criteria } from '../../shared/scoring/profiles.ts';
import { createReviewSchema } from '../../shared/review.ts';
import { analyzeSynthetic, fixtures } from '../../server/synthetic-analysis.ts';

test('evidence candidate gives silence zero while preserving inherited arithmetic', () => {
  const inputs = [{ id: 'missing', weight: 2, assessment: 'not_addressed' as const }];
  assert.equal(calculateScore(inputs).total, 60);
  assert.equal(calculateScore(inputs, 'evidence-weighted-v1').total, 0);
  assert.equal(calculateScore([{ ...inputs[0], assessment: 'partial' }], 'evidence-weighted-v1').total, 50);
  assert.equal(calculateScore([{ ...inputs[0], assessment: 'does_not_meet' }], 'evidence-weighted-v1').total, 0);
});
test('same synthetic evidence produces explicit versioned scores, without changing evidence', () => {
  const old = analyzeSynthetic('gaps', fixtures.gaps.text, 'id', 'community-demo-v1');
  const candidate = analyzeSynthetic('gaps', fixtures.gaps.text, 'id', DEFAULT_PROFILE);
  assert.equal(old.score.total, 66); assert.equal(candidate.score.total, 36);
  assert.deepEqual(candidate.findings, old.findings); assert.equal(candidate.sourceHash, old.sourceHash);
  assert.equal(candidate.score.engineVersion, 'evidence-weighted-v1'); assert.equal(candidate.evidenceCount, 4);
  assert.equal(analyzeSynthetic('complete', fixtures.complete.text, 'id', DEFAULT_PROFILE).score.total, 100);
});
test('profile selection is constrained and pinned at review creation', () => {
  assert.equal(createReviewSchema.parse({ name: 'Demo', fixtureId: 'gaps' }).profileVersion, DEFAULT_PROFILE);
  assert.equal(createReviewSchema.parse({ name: 'Demo', fixtureId: 'gaps', profileVersion: 'community-demo-v1' }).profileVersion, 'community-demo-v1');
  assert.throws(() => createReviewSchema.parse({ name: 'Demo', fixtureId: 'gaps', profileVersion: 'unknown' }));
  for (const id of ['unknown', 'constructor', '__proto__']) assert.throws(() => getProfile(id));
});
test('candidate criterion weights and evidence guidance form an explicit eight-criterion contract', () => {
  assert.deepEqual(criteria.map(c => [c.id, c.weight]), [['collection', 2], ['purpose', 2], ['sale', 2], ['deletion', 2], ['security', 2], ['sharing', 2], ['contact', 1], ['changes', 1]]);
  for (const c of criteria) { assert.ok(c.evidence.length > 20); assert.ok(c.partial.length > 20); assert.ok(c.failure.length > 20); }
});
test('overflow and unknown engines fail instead of returning a misleading score', () => {
  assert.throws(() => calculateScore([{ id: 'overflow', weight: 1e308, assessment: 'meets' }]));
  assert.throws(() => calculateScore([1, 2].map(id => ({ id: String(id), weight: 3e307, assessment: 'meets' }))));
  assert.throws(() => calculateScore([], 'unknown' as 'evidence-weighted-v1'));
});
