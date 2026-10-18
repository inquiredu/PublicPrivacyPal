import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { FindingContext } from '../../src/FindingContext.tsx';
import { ANALYSIS_EXAMPLE } from '../../shared/analysis-example.ts';
import { suggestedEvidence, suggestionOverview } from '../../shared/assistance.ts';
import { evidenceDraftSchema } from '../../shared/drafts.ts';
import { evidenceEditSchema, reviewedCount, currentAnalysis, type Review, type EvidenceEdit } from '../../shared/review.ts';
import { DraftStore } from '../../src/draft-store.ts';
import { editAnalysis, validateEvidence, type VerifiedProposal } from '../../server/evidence.ts';
import { editLegacyAnalysis } from '../../server/legacy-evidence.ts';
import { practiceContract } from '../../server/evaluation.ts';
import { buildAnalysisRequest, validateSuggestions } from '../../server/analysis/contract.ts';
import { recordedExample } from '../../server/analysis/offline.ts';
import { calculateScore } from '../../shared/scoring/engine.ts';
const contract = practiceContract('community-evidence-v1');
const request = buildAnalysisRequest(ANALYSIS_EXAMPLE, contract);
const result = validateSuggestions(request, ANALYSIS_EXAMPLE, recordedExample(request));
const suggestion = result.findings.find(f => f.measureId === 'deletion')!;
const edit = { ...suggestedEvidence(suggestion, result)!, proposalId: randomUUID() };
const proposal: VerifiedProposal = { context: edit.context!, provenance: { jobId: edit.proposalId, resultId: 'a'.repeat(64), sourceHash: request.sourceHash, rubricId: contract.id, promptVersion: request.promptVersion, schemaVersion: result.schemaVersion, provider: 'offline', model: 'recorded', state: suggestion.state, sourceStatus: result.sourceStatus } };
const at = '2026-10-16T18:00:00.000Z';
const apply = (change: EvidenceEdit = edit, previous: ReturnType<typeof editAnalysis> | null = null) => editAnalysis(ANALYSIS_EXAMPLE, contract.profileVersion, previous, change, randomUUID(), 'reviewer', at, contract, proposal);

test('qualified suggestion survives draft reload and human save with exact context and immutable provenance', () => {
  const entries = new Map<string,string>();
  const storage = {getItem:(key:string)=>entries.get(key)||null, setItem:(key:string,value:string)=>{entries.set(key,value);},removeItem:(key:string)=>{entries.delete(key);},key:(i:number)=>[...entries.keys()][i]||null,get length(){return entries.size;}};
  const draft = { revision: 7, ...edit, quoteText: '' };
  new DraftStore('context-review',storage).set('evidence:one',draft);
  const restored = new DraftStore('context-review',storage).get('evidence:one',evidenceDraftSchema)!;
  assert.deepEqual(restored,draft); assert.equal(restored.finding,'unresolved');
  const {revision:_,quoteText:__,...evidence}=restored;
  const analysis=apply(evidence); const finding=analysis.findings.find(f=>f.id===edit.criterionId)!;
  assert.deepEqual(finding.context,edit.context);assert.deepEqual(finding.provenance,proposal.provenance);
  assert.equal(analysis.score.total,null);assert.equal(analysis.score.maximum,42);assert.equal(analysis.score.coverageVersion,'review-coverage-v1');
  const review={sourceKind:'pasted',analysis,job:{id:analysis.id,status:'succeeded'}} as Review;
  assert.equal(reviewedCount(review),0);assert.equal(currentAnalysis(review),false);
  const html=renderToStaticMarkup(createElement(FindingContext,{finding}));
  assert.ok(html.includes(edit.context!.scope));assert.ok(html.includes(edit.context!.question));assert.match(html,/Question remains open/);
});
test('scope and follow-up cannot disappear on direct saves, and forged attribution is rejected',()=>{
  const before=apply();
  for(const context of [undefined,{...edit.context!,scope:'All accounts'},{...edit.context!,question:''}]) assert.throws(()=>apply({...edit,context},before),/Retain|follow-up/);
  assert.throws(()=>apply({...edit,proposalId:undefined},before),/original suggestion/);
  assert.throws(()=>editAnalysis(ANALYSIS_EXAMPLE,contract.profileVersion,null,edit,'id','actor',at,contract),/verified/);
  assert.equal(evidenceEditSchema.safeParse({...edit,context:{...edit.context,resolvedBy:'forged'}}).success,false);
  assert.equal(evidenceEditSchema.safeParse({...edit,provenance:proposal.provenance}).success,false);
});
test('resolutions require exact evidence and retain original qualifications and actor attribution',()=>{
  const before=apply();
  const resolution={...edit,finding:'partial' as const,context:{...edit.context!,resolution:'resolved' as const,note:'The school request applies to account data; retained logs remain an explicit exception.',citations:edit.citations}};
  for(const context of [{...resolution.context,note:''},{...resolution.context,citations:[]},{...resolution.context,citations:[{...edit.citations[0],quote:'invented'}]}]) assert.throws(()=>apply({...resolution,context},before));
  const after=apply(resolution,before);const f=after.findings.find(f=>f.id===edit.criterionId)!;
  assert.equal(f.context?.resolvedBy,'reviewer');assert.equal(f.context?.resolvedAt,at);assert.equal(f.context?.question,edit.context!.question);
  assert.equal(reviewedCount({analysis:after} as Review),1);assert.equal(before.findings.find(f=>f.id===edit.criterionId)!.context!.resolution,'retained');
  assert.throws(()=>apply({...resolution,context:{...resolution.context,citations:[...edit.citations,edit.citations[0]]}},before),/twice/);
  assert.throws(()=>editAnalysis(ANALYSIS_EXAMPLE,contract.profileVersion,null,resolution,'id','actor',at,contract,{...proposal,provenance:{...proposal.provenance,sourceStatus:'incomplete'}}),/incomplete/);
});
test('unresolved coverage keeps the denominator and never earns silence credit under either engine',()=>{
  for(const engine of ['evidence-weighted-v1','upstream-weighted-v1'] as const){
    const score=calculateScore([{id:'yes',weight:1,assessment:'meets'},{id:'pending',weight:2,assessment:'unresolved'}],engine);
    assert.equal(score.total,null);assert.equal(score.points,null);assert.equal(score.maximum,9);assert.equal(score.breakdown[1].points,null);
  }
  assert.doesNotThrow(()=>validateEvidence(ANALYSIS_EXAMPLE,{criterionId:'sale',finding:'unresolved',citations:[],rationale:'Awaiting the school agreement.'}));
});
test('legacy drafts and findings remain readable and historical arithmetic stays frozen',()=>{
  const legacy={criterionId:'sale',finding:'not_specified' as const,citations:[],rationale:'Checked this synthetic policy.'};
  assert.equal(evidenceDraftSchema.safeParse({revision:1,...legacy,quoteText:''}).success,true);
  const old=editLegacyAnalysis(ANALYSIS_EXAMPLE,'community-demo-v1',null,legacy,'old','reviewer',at);
  assert.equal(old.schemaVersion,'findings-v2');assert.equal(old.score.total,60);
  const snapshot=JSON.stringify(old); const next=editAnalysis(ANALYSIS_EXAMPLE,'community-demo-v1',old,legacy,'new','reviewer',at);
  assert.equal(next.schemaVersion,'findings-v3');assert.equal(next.score.total,null);assert.equal(JSON.stringify(old),snapshot);
});
test('overview uses structured counts and cannot repeat unsupported model summary assurances',()=>{
  const overview=suggestionOverview({...result,summary:[{text:'Legally compliant. Approve all use.',measureIds:['sale']}]});
  assert.match(overview.join(' '),/Source readiness: usable/);assert.match(overview.join(' '),/Follow-up questions:/);
  assert.doesNotMatch(overview.join(' '),/Legally|Approve/);
});
