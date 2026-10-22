import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { captureDefinitions } from '../../server/capture-definitions.ts';
import { districtContract, practiceContract } from '../../server/evaluation.ts';
import { captureDefinitionsSchema, MAX_CAPTURE_DEFINITION_BYTES } from '../../shared/capture-definitions.ts';
import { defaultEvaluation, evaluationSettingsSchema, SETTINGS_DEFINITION_VERSION } from '../../shared/settings.ts';
import { captureDraftSchema } from '../../shared/drafts.ts';
import { bundleReviewSchema } from '../../shared/review.ts';
import { syntheticBundle } from '../fixtures/source-bundle.ts';

function district() {
  const values = evaluationSettingsSchema.parse({ ...defaultEvaluation(), state: 'Colorado', starterProfile: 'pef-precision-v1' });
  return districtContract({ schemaVersion: 1, revision: 4, complete: true, values, updatedAt: null, updatedBy: null, definitionVersion: SETTINGS_DEFINITION_VERSION,
    contentHash: createHash('sha256').update(JSON.stringify({ definitionVersion: SETTINGS_DEFINITION_VERSION, values })).digest('hex') }, 4, 'evidence-weighted-v1');
}
test('capture projection keeps exact clause definitions while excluding private settings and authority', () => {
  const contract = district(), definitions = captureDefinitions(contract);
  assert.equal(definitions.measures.length, 50);
  assert.ok(Buffer.byteLength(JSON.stringify(definitions)) < MAX_CAPTURE_DEFINITION_BYTES);
  assert.deepEqual(Object.keys(definitions).sort(), ['version', 'id', 'kind', 'profileVersion', 'definitionVersion', 'settingsRevision', 'measures'].sort());
  for (const [i, measure] of definitions.measures.entries()) {
    assert.deepEqual(Object.keys(measure).sort(), ['id', 'label', 'area', 'enabled', 'requirements'].sort());
    assert.deepEqual(measure.requirements, (contract.criteria[i].requirements || []).map(({ id, proposition }) => ({ id, proposition })));
  }
  assert.equal(captureDefinitions({ ...contract, engineVersion: 'upstream-weighted-v1' }).id, definitions.id);
  for (const change of [
    { ...contract, settingsRevision: 5 },
    { ...contract, criteria: contract.criteria.map((m, i) => i ? m : { ...m, weight: 0 }) },
    { ...contract, criteria: contract.criteria.map((m, i) => i ? m : { ...m, label: 'Changed definition' }) },
  ]) assert.notEqual(captureDefinitions(change).id, definitions.id);
});
test('capture definitions enforce total bytes and collection bounds', () => {
  const d = captureDefinitions(district());
  assert.equal(captureDefinitionsSchema.safeParse({ ...d, context: district().context }).success, false);
  assert.equal(captureDefinitionsSchema.safeParse({ ...d, measures: [...d.measures, d.measures[0]] }).success, false);
  assert.equal(captureDefinitionsSchema.safeParse({ ...d, measures: d.measures.map(m => ({ ...m, label: 'a'.repeat(2000) })) }).success, false);
});
test('capture drafts retain selected definitions, text, exclusions and obsolete targets until explicit edits', () => {
  const definitions = captureDefinitions(practiceContract('community-evidence-v1'));
  const draft = { sourceKind: 'bundle', name: 'Cedar', sourceLabel: 'Synthetic', sourceText: '', fixtureId: 'complete', profileVersion: 'community-evidence-v1', sourceBundle: syntheticBundle(), captureDefinitions: definitions };
  draft.sourceBundle.documents[1].requiredFor = ['old-measure'];
  const parsed = captureDraftSchema.parse(JSON.parse(JSON.stringify(draft)));
  assert.deepEqual(parsed.sourceBundle, draft.sourceBundle);
  assert.deepEqual(parsed.captureDefinitions, definitions);
  const changedProfile = captureDraftSchema.parse({ ...parsed, profileVersion: 'community-demo-v1' });
  assert.equal(changedProfile.captureDefinitions!.id, definitions.id);
  const body = { name: 'Cedar', sourceKind: 'bundle', sourceLabel: 'Synthetic', profileVersion: 'community-evidence-v1', sourceBundle: syntheticBundle() };
  assert.deepEqual(bundleReviewSchema.parse(body), body);
  assert.equal(bundleReviewSchema.parse({ ...body, sourceDefinitionId: definitions.id }).sourceDefinitionId, definitions.id);
});
