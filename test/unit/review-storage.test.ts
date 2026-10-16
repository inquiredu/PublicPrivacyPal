import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { bounded, BYTE_LIMITS, decodeCursor, encodeCursor } from '../../server/review-storage.ts';
import { districtContract, practiceContract, digest } from '../../server/evaluation.ts';
import { defaultEvaluation, evaluationSettingsSchema, SETTINGS_DEFINITION_VERSION } from '../../shared/settings.ts';
import { editAnalysis } from '../../server/evidence.ts';
import { measuresFor } from '../../shared/evaluation.ts';
import type { Analysis } from '../../shared/review.ts';
const values = evaluationSettingsSchema.parse({ ...defaultEvaluation(), state: 'Colorado' });
const saved = { schemaVersion: 1 as const, revision: 1, complete: true, values, updatedAt: '2026-10-15T12:00:00.000Z', updatedBy: 'synthetic', definitionVersion: SETTINGS_DEFINITION_VERSION, contentHash: createHash('sha256').update(JSON.stringify({ definitionVersion: SETTINGS_DEFINITION_VERSION, values })).digest('hex') };
test('adopted definitions pin all 50 measures, context, weights and an explicit scoring engine', () => {
  const contract = districtContract(saved, 1, 'evidence-weighted-v1');
  assert.equal(contract.criteria.length, 50); assert.equal(contract.context?.state, 'Colorado');
  assert.equal(contract.settingsHash, saved.contentHash); assert.equal(measuresFor({contract}).length,50);
  assert.notEqual(contract.id, districtContract(saved,1,'upstream-weighted-v1').id);
  assert.throws(()=>districtContract(saved,2,'evidence-weighted-v1'),/current revision/);
  assert.throws(()=>districtContract({...saved,contentHash:'forged'},1,'evidence-weighted-v1'),/hash/);
  assert.equal(practiceContract('community-demo-v1').engineVersion,'upstream-weighted-v1');
});
test('50 maximum-length Unicode findings exceed one broad record but fit bounded separate records', () => {
  const contract = districtContract(saved,1,'evidence-weighted-v1');
  const source = '測'.repeat(32000); const citations=[0,2000,4000].map(start=>({start,end:start+2000,quote:source.slice(start,start+2000)}));
  let analysis: Analysis|null=null;
  for(const c of contract.criteria) analysis=editAnalysis(source,'community-evidence-v1',analysis,{criterionId:c.id,finding:'partial',citations,rationale:'証'.repeat(1000)},'synthetic-id','synthetic-actor','2026-10-15T12:00:00.000Z',contract);
  assert.ok(Buffer.byteLength(JSON.stringify({source,analysis,contract}))>1024*1024);
  assert.equal(analysis!.score.total,50); assert.equal(analysis!.findings.length,50);
  for(const f of analysis!.findings) bounded('finding',f);
  bounded('source',{text:source}); bounded('definition',contract);
  assert.throws(()=>bounded('finding',{text:'測'.repeat(BYTE_LIMITS.finding/2)}),/byte limit/);
  assert.throws(()=>editAnalysis(source,'community-evidence-v1',analysis,{criterionId:'forged',finding:'partial',citations,rationale:'Test'},'id','actor','date',contract),/known enabled/);
});
test('version hashes are order-independent and cursors cannot cross scopes or inject paths',()=>{
  assert.equal(digest({b:{z:1,a:2},a:3}),digest({a:3,b:{a:2,z:1}}));
  const cursor=encodeCursor('review:one','2026-10-15T12:00:00.000Z','id');
  assert.equal(decodeCursor(cursor,'review:one')?.id,'id');
  assert.throws(()=>decodeCursor(cursor,'review:two'),/cursor/);
  assert.throws(()=>decodeCursor(encodeCursor('review:one','2026-10-15T12:00:00.000Z','../private'),'review:one'),/cursor/);
});
