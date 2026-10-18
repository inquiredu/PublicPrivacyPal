import { editLegacyAnalysis } from '../../server/legacy-evidence.ts';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, getDocs, collection, query, limit, setDoc } from 'firebase/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { loadConfig } from '../../server/config.ts';
import { localServices, type Services } from '../../server/firebase.ts';
import { bootstrap } from '../../server/operations.ts';
import { apiServer } from '../../server/http.ts';
import { saveSettings } from '../../server/settings.ts';
import { defaultEvaluation, evaluationAreas } from '../../shared/settings.ts';
import { measuresFor } from '../../shared/evaluation.ts';
import { currentAnalysis, type Review } from '../../shared/review.ts';
import { readReview, BYTE_LIMITS } from '../../server/review-storage.ts';
import { migrateReviews } from '../../server/review-migration.ts';
import { acquireMaintenance, releaseMaintenance } from '../../server/maintenance.ts';
import { digest } from '../../server/evaluation.ts';
import { editAnalysis, sourceHash } from '../../server/evidence.ts';
import { analyzeSynthetic, fixtures } from '../../server/synthetic-analysis.ts';
const config=loadConfig('config/test.example.json'); const base=`districts/${config.districtId}`;
let s:Services; let env:RulesTestEnvironment; let server:ReturnType<typeof apiServer>;
const tokens:Record<string,string>={}; const actors:Record<string,DecodedIdToken>={}; const password=randomBytes(24).toString('hex');
let settingsRevision=0; let full:Review;
async function call(path:string,role='reviewer',body?:unknown) {
  const res=await fetch(`http://127.0.0.1:8787/api${path}`,{method:body===undefined?'GET':'POST',headers:{Origin:'http://127.0.0.1:5173','Content-Type':'application/json',Connection:'close','Idempotency-Key':randomUUID(),...(tokens[role]?{Authorization:`Bearer ${tokens[role]}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:res.status,data:await res.json()};
}
const get=(id:string)=>s.db.runTransaction(tx=>readReview(s,tx,id));
async function settings(weights=defaultEvaluation().evaluationWeights) {
  const saved=await saveSettings(s,actors.admin,{section:'evaluation',revision:settingsRevision,values:{...defaultEvaluation(),state:'Colorado',customEvaluationContext:'Synthetic context only.',evaluationWeights:weights}});
  settingsRevision=saved.revision; return saved;
}
async function create(sourceText='Fictional policy. We name the data collected and restrict its use.') {
  const out=await call('/reviews','reviewer',{name:'Full rubric synthetic trial',sourceKind:'pasted',sourceLabel:'Synthetic snapshot',sourceText,rubricMode:'district',settingsRevision,engineVersion:'evidence-weighted-v1'});
  assert.equal(out.status,201,JSON.stringify(out.data)); return out.data as Review;
}
async function action(r:Review,action:string,extra={}) {return call(`/reviews/${r.id}`,'reviewer',{action,revision:r.revision,...extra});}
const decision={outcome:'conditional',rationale:'Synthetic reviewer judgment.',conditions:'Fictional examples only.',summary:'Synthetic full rubric example.',category:'Learning'};
before(async()=>{
  s=localServices(config);env=await initializeTestEnvironment({projectId:config.projectId,firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});await env.clearFirestore();
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${config.projectId}/accounts`,{method:'DELETE'});await bootstrap(s,password);
  for(const role of ['admin','reviewer','viewer','staff','nonmember']) {
    const email=`storage-${role}@school.example`;const user=await s.auth.createUser({email,password,emailVerified:true});actors[role]={uid:user.uid,email} as DecodedIdToken;
    if(role!=='nonmember')await s.db.doc(`${base}/members/${user.uid}`).set({email,role,active:true});
    const response=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});tokens[role]=(await response.json() as {idToken:string}).idToken;
  }
  server=apiServer(s);server.listen(8787,'127.0.0.1');await once(server,'listening');await settings();
});
after(async()=>{server?.close();await once(server,'close');await env?.cleanup();await s?.close();});

test('50 maximum Unicode findings fit split records; prior evaluations stay reproducible',async()=>{
  const source='測'.repeat(32000);const citations=[0,2000,4000].map(start=>({start,end:start+2000,quote:source.slice(start,start+2000)}));
  full=await create(source);const contract=structuredClone(full.contract!);let firstId='';
  for(const c of measuresFor(full)) {
    const out=await action(full,'edit_evidence',{evidence:{criterionId:c.id,finding:'partial',citations,rationale:'証'.repeat(1000)}});assert.equal(out.status,200,JSON.stringify(out.data));full=out.data;if(!firstId)firstId=full.analysis!.id;
  }
  assert.ok(Buffer.byteLength(JSON.stringify(full))>1024*1024);assert.equal(full.analysis?.score.total,50);assert.equal(currentAnalysis(full),true);
  const root=s.db.doc(`${base}/reviews/${full.id}`);const head=(await root.get()).data()!;
  assert.equal(head.sourceText,undefined);assert.equal(head.analysis,undefined);assert.equal(head.contract,undefined);assert.equal(head.decision,undefined);
  assert.ok(Buffer.byteLength(JSON.stringify(head))<8192);
  for(const [collectionName,kind] of [['sources','source'],['definitions','definition'],['findings','finding'],['evaluations','evaluation'],['history','history']] as const) for(const d of (await root.collection(collectionName).get()).docs) assert.ok(Buffer.byteLength(JSON.stringify(d.data()))<=BYTE_LIMITS[kind]);
  assert.equal((await root.collection('evaluations').get()).size,50);
  assert.ok((await root.collection('findings').get()).size<101,'unchanged findings must be shared between evaluations');
  const older=await call(`/reviews/${full.id}/evaluations/${firstId}`);assert.equal(older.status,200);assert.equal(older.data.analysis.findings.filter((f:any)=>f.reviewedBy).length,1);
  assert.deepEqual(older.data.contract,contract);assert.equal(older.data.source.text,source);
  const events=[];let cursor:string|null=null;
  do {const out=await call(`/reviews/${full.id}/history${cursor?`?cursor=${cursor}`:''}`);assert.equal(out.status,200);assert.ok(out.data.items.length<=20);events.push(...out.data.items);cursor=out.data.nextCursor;} while(cursor);
  assert.equal(events.length,51);assert.equal(new Set(events.map((e:any)=>e.id)).size,51);
});
test('new settings and disabled areas affect only explicitly new evaluations',async()=>{
  const before=await get(full.id);const oldId=before.contract!.id;
  const weights=Object.fromEntries(evaluationAreas.map((a,i)=>[a.id,i===0?1 as const:0 as const]));await settings(weights);
  const stale=await call('/reviews','reviewer',{name:'Stale',sourceKind:'pasted',sourceLabel:'Synthetic',sourceText:'Synthetic policy',rubricMode:'district',settingsRevision:settingsRevision-1,engineVersion:'evidence-weighted-v1'});assert.equal(stale.status,409);
  const next=await create();assert.equal(next.contract!.criteria.length,50);assert.ok(measuresFor(next).length<50);assert.notEqual(next.contract!.id,oldId);
  assert.deepEqual(await get(full.id),before);
  const disabled=next.contract!.criteria.find(c=>c.weight===0)!;
  assert.equal((await action(next,'edit_evidence',{evidence:{criterionId:disabled.id,finding:'not_specified',citations:[],rationale:'Cannot review a disabled measure.'}})).status,400);
  await settings();
});
test('full-rubric decisions, correction and publication remain atomic and revision-bound',async()=>{
  full=(await action(full,'decide',{decision})).data;full=(await action(full,'publish')).data;assert.equal(full.published,true);
  const approvedId=full.analysis!.id; const path=`publicDistricts/${config.districtId}/tools/review-${full.id}`;
  assert.deepEqual(Object.keys((await s.db.doc(path).get()).data()!).sort(),['category','conditions','name','outcome','reviewedAt','summary','synthetic']);
  const old=await get(full.id); const original=s.db.runTransaction;
  s.db.runTransaction=((fn:Parameters<typeof original>[0])=>original.call(s.db,async tx=>{const create=tx.create.bind(tx);tx.create=((ref:FirebaseFirestore.DocumentReference,...args:any[])=>{if(ref.path.includes('/evaluations/'))throw new Error('Synthetic evaluation write failure');return create(ref,...args as [any]);}) as typeof tx.create;return fn(tx);})) as typeof original;
  const evidence={criterionId:measuresFor(full)[0].id,finding:'not_specified',citations:[],rationale:'Synthetic correction removing the earlier inference.'};
  try {assert.equal((await action(full,'edit_evidence',{evidence})).status,503);}finally{s.db.runTransaction=original;}
  assert.deepEqual(await get(full.id),old);assert.equal((await s.db.doc(path).get()).exists,true);
  const attempts=await Promise.all([action(full,'edit_evidence',{evidence}),action(full,'edit_evidence',{evidence})]);assert.deepEqual(attempts.map(x=>x.status).sort(),[200,409]);full=await get(full.id);
  assert.equal(full.published,false);assert.equal((await s.db.doc(path).get()).exists,false);assert.equal((await action(full,'publish')).status,409);
  assert.equal((await call(`/reviews/${full.id}/evaluations/${approvedId}`)).data.analysis.score.total,50);
  full=(await action(full,'decide',{decision})).data;full=(await action(full,'publish')).data;assert.equal(full.published,true);
  const archive=await call(`/reviews/${full.id}/export`);assert.equal(archive.status,200);assert.equal(archive.data.format,'privacypal-district-v1');assert.ok(archive.data.snapshot.historyNextCursor);assert.ok(Buffer.byteLength(JSON.stringify(archive.data))<=2*1024*1024);
  assert.equal((await call('/reviews/import','reviewer',archive.data)).status,400,'archived settings must never authorize a new district evaluation');
});
for(const role of ['anonymous','nonmember','staff','viewer','reviewer','admin']) test(`versioned API and direct storage enforce ${role} access`,async()=>{
  const read=['admin','reviewer','viewer'].includes(role);const status=read?200:role==='anonymous'?401:403;
  for(const path of ['/reviews',`/reviews/${full.id}`,`/reviews/${full.id}/history`,`/reviews/${full.id}/evaluations/${full.analysis!.id}`])assert.equal((await call(path,role)).status,status);
  const db=role==='anonymous'?env.unauthenticatedContext().firestore():env.authenticatedContext(actors[role].uid,{email:actors[role].email,email_verified:true}).firestore();
  for(const name of ['sources','definitions','evaluations','findings','decisions']) {
    const real=(await s.db.collection(`${base}/reviews/${full.id}/${name}`).limit(1).get()).docs[0];assert.ok(real);
    await assertFails(getDoc(doc(db,real.ref.path)));await assertFails(setDoc(doc(db,real.ref.path),{forged:true}));
  }
  await assertFails(getDocs(collection(db,`${base}/reviews`)));
  await assertFails(getDocs(query(collection(db,`${base}/reviews`),limit(22))));
  await (read?assertSucceeds:assertFails)(getDocs(query(collection(db,`${base}/reviews`),limit(20))));
  await assertFails(getDoc(doc(db,'districts/foreign/reviews/private')));
});
test('legacy migration preserves source, historical evaluations, decisions and publications and is repeatable',async()=>{
  const id=randomUUID();const at='2026-10-15T12:00:00.000Z';const text=fixtures.complete.text;
  const initial=analyzeSynthetic('complete',text,randomUUID(),'community-demo-v1');
  const f=initial.findings[0];const edit={criterionId:f.id,finding:'partial' as const,citations:[{quote:f.quote,start:f.start!,end:f.end!}],rationale:'Synthetic legacy correction.'};
  const changed=editLegacyAnalysis(text,'community-demo-v1',initial,edit,randomUUID(),actors.reviewer.uid,at);
  const r:Review={id,name:'Legacy synthetic fixture',fixtureId:'complete',sourceKind:'fixture',sourceText:text,revision:5,analysis:changed,decision:{...decision,outcome:'conditional',analysisId:changed.id,actorUid:actors.reviewer.uid,at},published:true,createdAt:at,updatedAt:at,job:{id:changed.id,status:'succeeded',attempt:0,actorUid:actors.reviewer.uid,actorEmail:actors.reviewer.email!,leaseUntil:0,error:null}};
  const root=s.db.doc(`${base}/reviews/${id}`);await root.set(r);
  await root.collection('history').doc('analysis').set({action:'analysis_completed',actorUid:actors.reviewer.uid,at,revision:2,details:{analysis:initial}});
  await root.collection('history').doc('correction').set({action:'edit_evidence',actorUid:actors.reviewer.uid,at,revision:3,details:{criterionId:f.id,before:f,after:changed.findings[0],beforeAnalysisId:initial.id,afterAnalysisId:changed.id,beforeScore:initial.score.total,afterScore:changed.score.total,sourceHash:sourceHash(text),profileVersion:'community-demo-v1'}});
  const publicPath=`publicDistricts/${config.districtId}/tools/review-${id}`;const projection={name:r.name,summary:decision.summary,outcome:'conditional',conditions:decision.conditions,category:'Learning',synthetic:true,reviewedAt:at};await s.db.doc(publicPath).set(projection);
  const lock=await acquireMaintenance(s,'Synthetic migration');
  try {
    assert.equal((await migrateReviews(s,lock)).migrated,1);const migrated=await get(id);
    const {contract,...values}=migrated;assert.deepEqual(values,r);assert.equal(contract!.engineVersion,'upstream-weighted-v1');
    assert.deepEqual((await call(`/reviews/${id}/evaluations/${initial.id}`)).data.analysis,initial);
    const hash=digest((await root.get()).data());assert.equal((await migrateReviews(s,lock)).migrated,0);assert.equal(digest((await root.get()).data()),hash);
    assert.deepEqual((await s.db.doc(publicPath).get()).data(),projection);
  }finally{await releaseMaintenance(s,lock);}
});
test('migration failure rolls back an individual review and retains the maintenance fence',async()=>{
  const existing=await get(full.id);const {contract:_,...legacy}=existing;legacy.id=randomUUID();legacy.fixtureId='complete';legacy.sourceKind='fixture';legacy.sourceText=fixtures.complete.text;legacy.analysis=null;legacy.decision=null;legacy.published=false;delete legacy.profileVersion;
  const root=s.db.doc(`${base}/reviews/${legacy.id}`);await root.set(legacy);const lock=await acquireMaintenance(s,'Synthetic migration failure');const original=s.db.runTransaction;
  s.db.runTransaction=((fn:Parameters<typeof original>[0])=>original.call(s.db,async tx=>{const create=tx.create.bind(tx);tx.create=((ref:FirebaseFirestore.DocumentReference,...args:any[])=>{if(ref.path.includes(`${legacy.id}/sources/`))throw new Error('Synthetic migration failure');return create(ref,...args as [any]);}) as typeof tx.create;return fn(tx);})) as typeof original;
  try {await assert.rejects(migrateReviews(s,lock),/Synthetic migration failure/);}finally{s.db.runTransaction=original;}
  assert.deepEqual((await root.get()).data(),legacy);assert.equal((await root.collection('definitions').get()).size,0);assert.equal((await s.db.doc('installation/maintenance').get()).get('id'),lock);
  assert.equal((await migrateReviews(s,lock)).migrated,1);await releaseMaintenance(s,lock);
});
test('a thousand lightweight summaries page without duplication or loading private detail',async()=>{
  const sample=(await s.db.doc(`${base}/reviews/${full.id}`).get()).data()!;
  const existing=await s.db.collection(`${base}/reviews`).get();const writer=s.db.bulkWriter();
  for(let i=existing.size;i<1000;i++){const id=randomUUID();writer.create(s.db.doc(`${base}/reviews/${id}`),{...sample,id,name:`Synthetic summary ${i}`,createdAt:'2026-10-15T10:00:00.000Z'});}await writer.close();
  let cursor:string|null=null;const seen=new Set<string>();let pages=0;
  do {const out=await call(`/reviews${cursor?`?cursor=${cursor}`:''}`);assert.equal(out.status,200);assert.ok(out.data.items.length<=20);assert.ok(Buffer.byteLength(JSON.stringify(out.data))<16000);for(const r of out.data.items){assert.equal(r.sourceText,undefined);assert.equal(r.contract,undefined);assert.equal(r.analysis,undefined);assert.equal(r.decision,undefined);assert.ok(!seen.has(r.id));seen.add(r.id);}cursor=out.data.nextCursor;pages++;}while(cursor);
  assert.equal(seen.size,1000);assert.equal(pages,50);
  await s.db.doc(`${base}/reviewCounters/current`).set({count:1000});
  assert.equal((await call('/reviews','reviewer',{name:'Over sandbox capacity',fixtureId:'complete'})).status,429);
  assert.equal((await s.db.collection(`${base}/reviews`).count().get()).data().count,1000);
  assert.equal((await call('/reviews?cursor=broken')).status,400);
  assert.equal((await call(`/reviews/${full.id}/history?cursor=${Buffer.from(JSON.stringify({scope:`reviews:${config.districtId}`,at:'2026-10-15T10:00:00.000Z',id:full.id})).toString('base64url')}`)).status,400);
});
