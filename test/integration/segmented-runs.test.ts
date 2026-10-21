import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { loadConfig } from '../../server/config.ts';
import { localServices, type Services } from '../../server/firebase.ts';
import { createReview, reviewAction } from '../../server/reviews.ts';
import { commandIdentity, commandStatus } from '../../server/commands.ts';
import { digest } from '../../server/evaluation.ts';
import { readReview } from '../../server/review-storage.ts';
import { acquireMaintenance, releaseMaintenance } from '../../server/maintenance.ts';
import { segmentedExampleCapture, SEGMENTED_LIMITS as L, type SegmentedAttemptScope } from '../../shared/segmented-assistance.ts';
import type { Review } from '../../shared/review.ts';
import { processNextSegmentedRun } from '../../server/analysis/segmented-jobs.ts';
import { generateSegmentedRecording, type SegmentedTransportResult } from '../../server/analysis/segmented-recording.ts';
import { buildSynthesisRequest } from '../../server/analysis/segments.ts';
import { segmentedRunDetail, segmentedProposalDetail, segmentedOutputDetail, segmentedRunSummary } from '../../server/segmented-reviews.ts';
import { loadSegmentedRun, segmentedRunRef, segmentedDispatches, segmentedCounterRef, outputText, archiveForAttempts,
  validateSegmentedInstallation, SEGMENTED_COLLECTIONS as C } from '../../server/segmented-review-storage.ts';
import { deferred } from '../fixtures/segmented-application.ts';

const config=loadConfig('config/test.example.json'),root=`districts/${config.districtId}`;
let s:Services,env:RulesTestEnvironment; const actors:Record<string,DecodedIdToken>={};
before(async()=>{
  s=localServices(config);env=await initializeTestEnvironment({projectId:config.projectId,firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});
  await fetch('http://127.0.0.1:9099/emulator/v1/projects/'+config.projectId+'/accounts',{method:'DELETE'});
  for(const role of ['admin','reviewer','viewer','staff']){const user=await s.auth.createUser({email:`segmented-${role}@school.example`,password:randomBytes(24).toString('hex'),emailVerified:true});actors[role]={uid:user.uid,email:user.email,email_verified:true} as DecodedIdToken;}
});
beforeEach(async()=>{await env.clearFirestore();for(const [role,a]of Object.entries(actors))await s.db.doc(`${root}/members/${a.uid}`).set({email:a.email,role,active:true});});
after(async()=>{await env?.cleanup();await s?.close();});
const get=(id:string)=>s.db.runTransaction(tx=>readReview(s,tx,id));
async function act(r:Review,action:string,extra:Record<string,unknown>={},id=randomUUID()){
  const body={action,revision:r.revision,...extra};return reviewAction(s,actors.reviewer,r.id,body,commandIdentity(id,`/api/reviews/${r.id}`,body));
}
async function create(){const body=segmentedExampleCapture();return createReview(s,actors.reviewer,body,false,commandIdentity(randomUUID(),'/api/reviews',body));}
async function start(){return act(await create(),'start_segmented_run');}
async function run(r:Review){const current=await get(r.id);return s.db.runTransaction(tx=>loadSegmentedRun(s,tx,current,current.segmentedRunId!));}
async function queue(r:Review,scope:SegmentedAttemptScope){const loaded=await run(r),current=await get(r.id),id=randomUUID();
  const body={action:'run_segmented_attempt',revision:current.revision,runId:loaded.run.id,runRevision:loaded.run.revision,scope};
  const result=await reviewAction(s,actors.reviewer,r.id,body,commandIdentity(id,`/api/reviews/${r.id}`,body));return{review:result,body,id,attempt:(await run(r)).attempts.at(-1)!};}
async function cancel(r:Review){const loaded=await run(r);return act(await get(r.id),'cancel_segmented_run',{runId:loaded.run.id,runRevision:loaded.run.revision});}
async function first(r:Review){const loaded=await run(r);return{kind:'segment' as const,segmentId:loaded.archive.requests[0].segment.id};}
async function complete(r:Review,scope:SegmentedAttemptScope){await queue(r,scope);assert.equal(await processNextSegmentedRun(s),true);}

test('durable commands replay their exact attempt effect without advancing the review or dispatching twice',async()=>{
  const r=await start(),queued=await queue(r,await first(r)),before=await get(r.id);assert.equal(before.revision,r.revision);
  await processNextSegmentedRun(s);const after=await get(r.id);assert.deepEqual(after,before);
  const replay=await reviewAction(s,actors.reviewer,r.id,queued.body,commandIdentity(queued.id,`/api/reviews/${r.id}`,queued.body));assert.deepEqual(replay,after);
  const state=await commandStatus(s,actors.reviewer,queued.id);assert.equal(state.state,'applied');if(state.state==='applied')assert.equal(state.segmented?.attemptId,queued.attempt.id);
  assert.equal((await run(r)).attempts.length,1);assert.equal(await processNextSegmentedRun(s),false);
  await assert.rejects(()=>reviewAction(s,actors.reviewer,r.id,{...queued.body,scope:{kind:'synthesis'}},commandIdentity(queued.id,`/api/reviews/${r.id}`,{...queued.body,scope:{kind:'synthesis'}})),/different content/);
  assert.equal((await validateSegmentedInstallation(s)).runCount,1);
});
test('invalid whitespace retry retains earlier valid evidence, original bytes and explicit incomplete coverage',async()=>{
  const r=await start(),scope=await first(r);await complete(r,scope);await queue(r,scope);
  const raw=' \n {"broken":\t\n';await processNextSegmentedRun(s,{transport:async()=>({status:'completed',bytes:Buffer.from(raw)})});
  const loaded=await run(r),failed=loaded.attempts.at(-1)!;assert.equal(failed.status,'failed');assert.equal(outputText(loaded.outputs.get(failed.outputId!)!),raw);
  const request=buildSynthesisRequest(archiveForAttempts(loaded));assert.ok(request.candidates.some(c=>c.role==='supporting'));assert.ok(request.coverage.every(c=>!c.ready));
  await complete(r,{kind:'synthesis'});const final=await run(r);assert.ok(final.run.currentOutcomeId);
  const proposal=await segmentedProposalDetail(s,actors.reviewer,r.id,final.run.id,final.run.currentOutcomeId!,'deletion');
  assert.equal(proposal.targets[0].derived.state,'unavailable');assert.equal(proposal.seed!.finding,'unresolved');assert.deepEqual(proposal.seed!.sourceReview!.segmentIds,[]);
  await validateSegmentedInstallation(s);
});
test('queued synthesis retry immediately disables the prior proposal and old snapshots remain inspectable',async()=>{
  const r=await start();await complete(r,await first(r));await complete(r,{kind:'synthesis'});
  const previous=await run(r),outcome=previous.run.currentOutcomeId!;await queue(r,{kind:'synthesis'});
  assert.equal((await run(r)).run.currentOutcomeId,null);
  const historical=await segmentedProposalDetail(s,actors.reviewer,r.id,previous.run.id,outcome,'deletion');assert.equal(historical.eligible,false);assert.equal(historical.seed,null);
  await processNextSegmentedRun(s);assert.equal((await run(r)).attempts.filter(a=>a.scope.kind==='synthesis').length,2);await validateSegmentedInstallation(s);
});
test('invalid UTF8 and maximum invalid returns remain inspectable; overflow retains no misleading prefix',async()=>{
  const r=await start(),scope=await first(r);
  for(const bytes of [Buffer.from([0xc0,0xaf]),Buffer.alloc(L.transportBytes,0x22),Buffer.alloc(L.transportBytes+1,0x22)]){
    await queue(r,scope);await processNextSegmentedRun(s,{transport:async()=>({status:'completed',bytes})});const loaded=await run(r),a=loaded.attempts.at(-1)!,outcome=loaded.outcomes.get(a.outcomeId!)!;
    assert.equal(a.status,'failed');if(bytes.length>L.transportBytes){assert.equal(outcome.state,'overflow');assert.equal(a.outputId,null);assert.equal(outcome.transportByteLength,bytes.length);}
    else{const view=await segmentedOutputDetail(s,actors.reviewer,r.id,loaded.run.id,a.outputId!);assert.deepEqual(Buffer.from(view.base64,'base64'),bytes);assert.equal(view.text,null);assert.ok(view.decodeError);assert.ok(Buffer.byteLength(JSON.stringify(view))<=L.output);}
  }
  await assert.rejects(()=>queue(r,scope),/attempt limit/);await validateSegmentedInstallation(s);
});
test('human change and requester revocation after dispatch retain raw output without result authority',async()=>{
  for(const change of ['human','revocation'] as const){
    const r=await start();await queue(r,{kind:'synthesis'});const reached=deferred<void>(),release=deferred<SegmentedTransportResult>();
    const worker=processNextSegmentedRun(s,{transport:async(input,signal)=>{const result=await generateSegmentedRecording(input,signal);reached.resolve();await release.promise;return result;}});
    await reached.promise;
    if(change==='human')await act(await get(r.id),'edit_evidence',{evidence:{criterionId:'deletion',finding:'unresolved',citations:[],rationale:'Human work saved before the delayed recording.'}});
    else await s.db.doc(`${root}/members/${actors.reviewer.uid}`).update({active:false});
    const human=await get(r.id);release.resolve({status:'completed',bytes:Buffer.alloc(0)});await worker;
    const saved=await run(r),a=saved.attempts.at(-1)!;assert.ok(a.outputId);assert.equal(a.eligibleAtCompletion,false);assert.equal(saved.run.currentOutcomeId,null);assert.deepEqual(await get(r.id),human);
    if(change==='revocation')await s.db.doc(`${root}/members/${actors.reviewer.uid}`).update({active:true});
    await cancel(r);
  }
  await validateSegmentedInstallation(s);
});
test('queued and in-flight cancellation use the real review command and retain dispatched history only',async()=>{
  const r=await start();await queue(r,await first(r));const cancelled=await cancel(r);assert.equal(cancelled.revision,r.revision+1);assert.equal(await processNextSegmentedRun(s),false);assert.equal((await run(r)).attempts[0].status,'cancelled');
  const r2=await start();await queue(r2,{kind:'synthesis'});const reached=deferred<void>(),release=deferred<void>();
  const worker=processNextSegmentedRun(s,{transport:async(input,signal)=>{const response=await generateSegmentedRecording(input,signal);reached.resolve();await release.promise;return response;}});
  await reached.promise;await cancel(r2);release.resolve();await worker;const completed=await run(r2),a=completed.attempts[0];
  assert.ok(a.outputId);assert.equal(a.eligibleAtCompletion,false);assert.equal(a.ineligibleReason,'run_cancelled');assert.equal(completed.run.currentOutcomeId,null);await validateSegmentedInstallation(s);
});
test('unknown dispatch blocks another attempt and recovery reuses the exact deterministic attempt identity',async()=>{
  const r=await start(),queued=await queue(r,await first(r)),stop=new AbortController(),late=deferred<SegmentedTransportResult>();let sent=0;
  await processNextSegmentedRun(s,{leaseMs:1000,signal:stop.signal,transport:async()=>{sent++;stop.abort();return late.promise;}});
  const unknown=await run(r);assert.equal(unknown.attempts[0].status,'unknown');assert.equal(unknown.attempts[0].dispatched,true);await assert.rejects(()=>queue(r,{kind:'synthesis'}),/unknown outcome/);
  const before=unknown.attempts[0];late.resolve({status:'completed',bytes:Buffer.from('{}')});await delay(0);assert.deepEqual((await run(r)).attempts[0],before);
  await processNextSegmentedRun(s);const recovered=await run(r);assert.equal(recovered.attempts.length,1);assert.equal(recovered.attempts[0].id,queued.attempt.id);assert.equal(recovered.attempts[0].status,'completed');assert.equal(sent,1);await validateSegmentedInstallation(s);
});
test('expired callback cannot retain output or change lifecycle; the next lease recovers the same attempt',async()=>{
  const r=await start(),queued=await queue(r,await first(r)),reached=deferred<void>(),release=deferred<void>();
  const worker=processNextSegmentedRun(s,{leaseMs:30000,transport:async(input,signal)=>{const response=await generateSegmentedRecording(input,signal);reached.resolve();await release.promise;return response;}});
  await reached.promise;const ref=segmentedRunRef(s,r.id,r.segmentedRunId!).collection(C.attempts).doc(queued.attempt.id);
  await s.db.runTransaction(async tx=>{const a=await tx.get(ref),idx=await tx.get(segmentedDispatches(s).doc(queued.attempt.id));tx.set(ref,{...a.data(),leaseUntil:0});tx.set(idx.ref,{...idx.data(),leaseUntil:0});});
  const before=(await ref.get()).data();release.resolve();await worker;assert.deepEqual((await ref.get()).data(),before);assert.equal((await run(r)).outputs.size,0);
  await processNextSegmentedRun(s);assert.equal((await run(r)).attempts[0].status,'completed');
});
test('maintenance fences retention and settlement until the persisted dispatch can recover after expiry',async()=>{
  const r=await start();await queue(r,{kind:'synthesis'});const reached=deferred<void>(),release=deferred<void>();
  const worker=processNextSegmentedRun(s,{leaseMs:5000,transport:async(input,signal)=>{const response=await generateSegmentedRecording(input,signal);reached.resolve();await release.promise;return response;}});
  await reached.promise;const lock=await acquireMaintenance(s,'Synthetic segmented retention fence');const frozen=(await run(r)).attempts[0];
  try{release.resolve();await worker;assert.deepEqual((await run(r)).attempts[0],frozen);assert.equal((await run(r)).outputs.size,0);await validateSegmentedInstallation(s,{maintenanceId:lock});}
  finally{await releaseMaintenance(s,lock);}
  await delay(5010);await processNextSegmentedRun(s);assert.equal((await run(r)).attempts[0].status,'completed');
});
test('strict readers reject a dropped historical prefix, rewound generation and under-reserved queued output',async()=>{
  const r=await start();await complete(r,await first(r));await complete(r,{kind:'synthesis'});const completeRun=await run(r),synthesis=completeRun.attempts.at(-1)!;
  const attemptRef=completeRun.ref.collection(C.attempts).doc(synthesis.id),savedAttempt=(await attemptRef.get()).data()!;
  await attemptRef.update({evidenceAttemptIds:[]});await assert.rejects(()=>run(r),/complete ordered historical/);await attemptRef.set(savedAttempt);
  await queue(r,await first(r));const savedHead=(await completeRun.ref.get()).data()!,counterRef=segmentedCounterRef(s),savedCounter=(await counterRef.get()).data()!;
  await completeRun.ref.update({evidenceGeneration:synthesis.evidenceGeneration,currentOutcomeId:synthesis.outcomeId,currentSynthesisAttemptId:synthesis.id});await assert.rejects(()=>run(r),/generation/);await completeRun.ref.set(savedHead);
  await completeRun.ref.update({admittedBytes:savedHead.admittedBytes-1000});await counterRef.update({admittedBytes:savedCounter.admittedBytes-1000});await assert.rejects(()=>run(r),/admission reservation/);await assert.rejects(()=>validateSegmentedInstallation(s));
  await completeRun.ref.set(savedHead);await counterRef.set(savedCounter);await processNextSegmentedRun(s);await validateSegmentedInstallation(s);
});
test('all browser roles are denied new private records while authorized API readers retain inspection access',async()=>{
  const r=await start();await complete(r,await first(r));const loaded=await run(r),path=loaded.ref.collection(C.outputs).doc(loaded.attempts[0].outputId!).path;
  for(const role of ['anonymous','staff','viewer','reviewer','admin']){const a=actors[role],db=a?env.authenticatedContext(a.uid,{email:a.email,email_verified:true}).firestore():env.unauthenticatedContext().firestore();await assertFails(getDoc(doc(db,path)));await assertFails(setDoc(doc(db,path),{forged:true}));}
  await assert.rejects(()=>segmentedRunSummary(s,actors.staff,r.id),/permission/);
  assert.equal((await segmentedRunDetail(s,actors.viewer,r.id,loaded.run.id)).attempts.items.length,1);
});
test('an orphan attributed finding fails validation after every run, evaluation, marker and counter is gone',async()=>{
  const r=await start();await complete(r,{kind:'synthesis'});const loaded=await run(r);
  const view=await segmentedProposalDetail(s,actors.reviewer,r.id,loaded.run.id,loaded.run.currentOutcomeId!,'deletion');
  const saved=await act(await get(r.id),'edit_evidence',{evidence:view.seed!});const finding=saved.analysis!.findings.find(f=>f.id==='deletion')!;
  await validateSegmentedInstallation(s);
  await s.db.recursiveDelete(s.db.doc(`${root}/reviews/${r.id}`));
  await s.db.recursiveDelete(s.db.doc(`${root}/commandReceipts/${actors.reviewer.uid}`));
  await segmentedCounterRef(s).delete();for(const d of (await segmentedDispatches(s).get()).docs)await d.ref.delete();
  await s.db.doc(`${root}/reviews/${r.id}/findings/${digest(finding)}`).set(finding);
  await assert.rejects(()=>validateSegmentedInstallation(s),/orphaned or changed attributed finding/);
});
