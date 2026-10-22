import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SEGMENTED_LIMITS as L, segmentedActionSchema, segmentedProposalRefSchema } from '../../shared/segmented-assistance.ts';
import { segmentedRecordingEligible, generateSegmentedRecording } from '../../server/analysis/segmented-recording.ts';
import { newSegmentArchive, appendSegmentAttempt, buildSynthesisRequest, validateSynthesis } from '../../server/analysis/segments.ts';
import { makeOutput, outputBytes, outputText, makeRequest, bytes, reserveSegmented, emptySegmentedCounter,
  SEGMENTED_START_RESERVATION, SEGMENTED_ATTEMPT_RESERVATION, findingBaseline } from '../../server/segmented-review-storage.ts';
import { segmentedPage } from '../../server/segmented-reviews.ts';
import { segmentedFixtureReview, unreservedSegmentedRun } from '../fixtures/segmented-application.ts';

test('recording eligibility binds the complete saved source and exact definition', () => {
  const r = segmentedFixtureReview(); assert.equal(segmentedRecordingEligible(r),true);
  for (const change of ['text','scope','definition','manifest'] as const) {
    const altered = structuredClone(r);
    if (change === 'text') altered.sourceBundle!.documents[0].text += 'changed';
    if (change === 'scope') altered.sourceBundle!.scope.accounts = 'Other account type';
    if (change === 'definition') altered.contract!.criteria[0].weight++;
    if (change === 'manifest') altered.sourceBundle!.documents[1].capture = 'complete';
    assert.equal(segmentedRecordingEligible(altered),false,change);
  }
});
test('raw output identity preserves whitespace, invalid JSON and invalid UTF8 without repaired replacements', () => {
  const raw = Buffer.from(' \n {"invalid": \n\t'); const record = makeOutput(raw);
  assert.equal(outputText(record),raw.toString()); assert.deepEqual(outputBytes(record),raw);
  const bad = makeOutput(Uint8Array.from([0xc0,0xaf])); assert.deepEqual(outputBytes(bad),Buffer.from([0xc0,0xaf])); assert.throws(()=>outputText(bad));
  assert.throws(()=>outputBytes({...record,base64:record.base64+'='})); assert.throws(()=>outputBytes({...record,byteLength:1}));
});
test('transport and complete stored envelopes enforce independent byte limits without a retained prefix', () => {
  const full = makeOutput(Buffer.alloc(L.transportBytes,0x22)); assert.equal(full.byteLength,L.transportBytes); assert.ok(bytes(full)<=L.output);
  assert.throws(()=>makeOutput(Buffer.alloc(L.transportBytes+1)),/transport bound/);
  const r=segmentedFixtureReview(),request=newSegmentArchive(r.sourceBundle!,r.contract!).requests[0];
  const stored=makeRequest({kind:'segment',segmentId:request.segment.id},request); assert.equal(typeof stored.request,'object'); assert.deepEqual(stored.request,request);
  assert.throws(()=>makeRequest({kind:'synthesis'},{key:'0'.repeat(64),text:'"'.repeat(150000)}),/byte bound/);
});
test('per-run admission reserves complete future records and refuses before mutating its inputs', () => {
  let {run,counter}=reserveSegmented(unreservedSegmentedRun(),emptySegmentedCounter(),SEGMENTED_START_RESERVATION); let admitted=0;
  while(run.admittedBytes+SEGMENTED_ATTEMPT_RESERVATION.bytes<=L.runBytes) { ({run,counter}=reserveSegmented(run,counter,SEGMENTED_ATTEMPT_RESERVATION)); admitted++; }
  assert.ok(admitted<75); const before=structuredClone({run,counter});
  assert.throws(()=>reserveSegmented(run,counter,SEGMENTED_ATTEMPT_RESERVATION),/retention admission/); assert.deepEqual({run,counter},before);
  assert.throws(()=>reserveSegmented(unreservedSegmentedRun(),{...emptySegmentedCounter(),admittedRecords:L.installationRecords},SEGMENTED_START_RESERVATION),/retention admission/);
});
test('ordinary absent finding and exact blank placeholder share identity; no other field is normalized away', () => {
  const r=segmentedFixtureReview(),baseline=findingBaseline(r,'deletion');
  r.analysis={findings:[{id:'deletion',finding:'unresolved',quote:'',start:null,end:null}]} as typeof r.analysis;
  assert.equal(findingBaseline(r,'deletion'),baseline);
  r.analysis!.findings[0].rationale='Retained human or imported text'; assert.notEqual(findingBaseline(r,'deletion'),baseline);
});
test('byte-aware pages retain complete candidates and scoped continuation without silent evidence loss', () => {
  const values=Array.from({length:28},(_,i)=>({id:String(i).padStart(2,'0'),rationales:['測'.repeat(600)].flatMap(x=>Array.from({length:8},(_,j)=>x+j)),quote:'界'.repeat(1800)}));
  let cursor:string|null=null; const recovered:typeof values=[];
  do { const p:{items:typeof values;nextCursor:string|null}=segmentedPage(values,'district/review/run/outcome/measure',cursor||undefined,v=>v.id);
    assert.ok(p.items.length>0&&p.items.length<20); assert.ok(bytes(p)<=L.pageBytes); recovered.push(...p.items); cursor=p.nextCursor;
    if(cursor) assert.throws(()=>segmentedPage(values,'different scope',cursor!,v=>v.id),/page cursor/);
  } while(cursor);
  assert.deepEqual(recovered,values);
});
test('strict actions and references reject provider overrides, arbitrary outputs and incomplete target shapes', () => {
  assert.throws(()=>segmentedActionSchema.parse({action:'start_segmented_run',revision:1,provider:'live'}));
  assert.throws(()=>segmentedActionSchema.parse({action:'run_segmented_attempt',revision:1,runId:crypto.randomUUID(),runRevision:1,scope:{kind:'synthesis'},output:'untrusted'}));
  assert.throws(()=>segmentedProposalRefSchema.parse({version:'segmented-proposal-v1',runId:crypto.randomUUID(),synthesisAttemptId:crypto.randomUUID(),outcomeId:'0'.repeat(64),evidenceRevision:'0'.repeat(64),measureId:'deletion',targetIds:[]}));
});
test('authored recording uses unchanged v1 requests and preserves late opposition in whole-source synthesis',async()=>{
  const r=segmentedFixtureReview(); let archive=newSegmentArchive(r.sourceBundle!,r.contract!); const keys=archive.requests.map(r=>r.key),signal=new AbortController().signal;
  for(const request of archive.requests){const output=await generateSegmentedRecording({kind:'segment',request},signal);assert.equal(output.status,'completed');
    archive=appendSegmentAttempt(archive,{segmentId:request.segment.id,requestKey:request.key,outcome:{kind:'returned',raw:Buffer.from(output.bytes).toString()}});}
  assert.deepEqual(archive.requests.map(r=>r.key),keys);
  const request=buildSynthesisRequest(archive);assert.ok(request.candidates.some(c=>c.role==='supporting'));assert.ok(request.candidates.some(c=>c.role==='opposing'));
  const output=await generateSegmentedRecording({kind:'synthesis',archive},signal), result=validateSynthesis(archive,Buffer.from(output.bytes).toString());
  assert.equal(result.findings.find(f=>f.target==='deletion')!.state,'unavailable');assert.deepEqual(result.findings.find(f=>f.target==='deletion')!.coverage.missing,['annex']);
});
