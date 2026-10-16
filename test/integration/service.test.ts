import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { loadConfig } from '../../server/config.ts';
import { localServices, type Services } from '../../server/firebase.ts';
import { bootstrap } from '../../server/operations.ts';
import { apiServer } from '../../server/http.ts';
import { readReview } from '../../server/review-storage.ts';
import { defaultEvaluation } from '../../shared/settings.ts';
import { exampleTierPolicy } from '../../shared/service-policy.ts';
import { audienceProjection, decisionIsCurrent } from '../../shared/service.ts';
import type { Review } from '../../shared/review.ts';
import { pastedDraft, evidenceEdits } from '../fixtures/pasted-policy.ts';
import { serviceValues } from '../fixtures/service.ts';
import { acquireMaintenance, releaseMaintenance } from '../../server/maintenance.ts';
const config = loadConfig('config/test.example.json'); const base = `districts/${config.districtId}`;
let s: Services; let env: RulesTestEnvironment; let server: ReturnType<typeof apiServer>;
const tokens: Record<string,string> = {}; const uids: Record<string,string> = {}; const password = randomBytes(24).toString('hex');
async function call(path:string, role='reviewer', body?:unknown, id=randomUUID()) {
  const res=await fetch(`http://127.0.0.1:8787/api${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Origin:'http://127.0.0.1:5173', Connection:'close', 'Content-Type':'application/json', 'Idempotency-Key':id, ...(tokens[role] ? { Authorization:`Bearer ${tokens[role]}` } : {}) }, ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
  return {status:res.status,data:await res.json()};
}
const get=(id:string)=>s.db.runTransaction(tx=>readReview(s,tx,id));
const publicPath=(r:Review)=>`publicDistricts/${config.districtId}/tools/review-${r.id}`;
const staffPath=(r:Review)=>`${base}/staffTools/review-${r.id}`;
async function create(service=true) { const out=await call('/reviews','reviewer',{...pastedDraft,name:'Cedar complete service',...(service?{serviceSettingsRevision:1}:{})});assert.equal(out.status,201,JSON.stringify(out.data));return out.data as Review; }
async function act(r:Review, action:string, extra={}, role='reviewer') {return call(`/reviews/${r.id}`,role,{action,revision:r.revision,...extra});}
const decision={outcome:'conditional',rationale:'Synthetic judgment despite explicitly recorded policy gaps.',conditions:'Fictional middle-school pilot only.',summary:'A fictional education workspace.',category:'Science'};
async function complete() {let r=await create();for(const evidence of evidenceEdits){const out=await act(r,'edit_evidence',{evidence});assert.equal(out.status,200);r=out.data;}return r;}
async function save(r:Review,values=serviceValues){const out=await act(r,'edit_service',{service:{values,rationale:'Synthetic district fact confirmation.'}});assert.equal(out.status,200,JSON.stringify(out.data));return out.data as Review;}
async function publish(r:Review){let out=await act(r,'decide',{decision});assert.equal(out.status,200,JSON.stringify(out.data));out=await act(out.data,'publish');assert.equal(out.status,200,JSON.stringify(out.data));return out.data as Review;}
before(async()=>{
  s=localServices(config);env=await initializeTestEnvironment({projectId:config.projectId,firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});await env.clearFirestore();await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${config.projectId}/accounts`,{method:'DELETE'});await bootstrap(s,password);
  for(const role of ['admin','reviewer','viewer','staff','nonmember']){const email=`service-${role}@school.example`;const u=await s.auth.createUser({email,password,emailVerified:true});uids[role]=u.uid;if(role!=='nonmember')await s.db.doc(`${base}/members/${u.uid}`).set({email,role,active:true});const res=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});tokens[role]=(await res.json() as {idToken:string}).idToken;}
  server=apiServer(s);server.listen(8787,'127.0.0.1');await once(server,'listening');
  const out=await call('/settings','admin',{section:'evaluation',revision:0,values:{...defaultEvaluation(),state:'Colorado',tierPolicy:exampleTierPolicy()}});assert.equal(out.status,200);
});
after(async()=>{server?.close();await once(server,'close');await env?.cleanup();await s?.close();});
test('complete service requires explicit current settings adoption; legacy review stays unchanged until adoption',async()=>{
  assert.equal((await call('/reviews','reviewer',{...pastedDraft,serviceSettingsRevision:99})).status,409);
  let r=await create(false);const before=await get(r.id);assert.equal(r.service,undefined);
  const out=await act(r,'adopt_service',{settingsRevision:1});assert.equal(out.status,200);r=out.data;
  assert.equal(r.service?.settingsRevision,1);assert.equal(r.sourceText,before.sourceText);assert.deepEqual(r.contract,before.contract);
  assert.equal((await act(r,'adopt_service',{settingsRevision:1})).status,409);
});
test('unconfirmed or expired required DPA blocks approval and publication on the server',async()=>{
  let r=await complete();r=await save(r,{...serviceValues,dpaStatus:'unknown',dpaSigned:'',dpaReference:'',dpaScope:''});
  let out=await act(r,'decide',{decision});assert.equal(out.status,409);assert.match(out.data.error,/DPA/);
  r=await save(r,{...serviceValues,dpaExpires:'2026-01-02'});assert.equal((await act(r,'decide',{decision})).status,409);
  const declined=await act(r,'decide',{decision:{...decision,outcome:'declined'}});assert.equal(declined.status,200);r=declined.data;assert.equal((await act(r,'publish')).status,409);
  r=await save(r);r=await publish(r);assert.equal(r.published,true);
  assert.deepEqual((await s.db.doc(publicPath(r)).get()).data(),audienceProjection(r,'public'));assert.deepEqual((await s.db.doc(staffPath(r)).get()).data(),audienceProjection(r,'staff'));
});
test('evidence correction retains district facts, withdraws both audiences and requires fresh decision',async()=>{
  let r=await publish(await save(await complete()));const service=structuredClone(r.service);const first=r.analysis!.id;
  r=(await act(r,'edit_evidence',{evidence:{...evidenceEdits[4],finding:'not_specified',citations:[],rationale:'General language is not evidence of the safeguards in this measure.'}})).data;
  assert.deepEqual(r.service,service);assert.equal(r.analysis?.score.total,57);assert.equal(r.published,false);assert.equal(decisionIsCurrent(r),false);
  assert.equal((await s.db.doc(publicPath(r)).get()).exists,false);assert.equal((await s.db.doc(staffPath(r)).get()).exists,false);assert.equal((await act(r,'publish')).status,409);
  assert.equal((await call(`/reviews/${r.id}/evaluations/${first}`)).data.analysis.score.total,64);
  r=await publish(r);assert.equal(r.published,true);
  r=await save(r,{...serviceValues,grades:'7–8'});assert.equal(decisionIsCurrent(r),false);assert.equal(r.published,false);assert.equal((await act(r,'publish')).status,409);r=await publish(r);assert.equal(r.published,true);
  const snapshot=(await call(`/reviews/${r.id}/export`)).data.snapshot;assert.equal(snapshot.service.values.grades,'7–8');assert.equal(snapshot.service.updatedBy,uids.reviewer);
});
test('failed service commit and conflicting writers cannot erase evidence or leave stale projections',async()=>{
  let r=await publish(await save(await complete()));const before=await get(r.id);const projection=(await s.db.doc(publicPath(r)).get()).data();const original=s.db.runTransaction;
  s.db.runTransaction=((fn:Parameters<typeof original>[0])=>original.call(s.db,async tx=>{const set=tx.set.bind(tx);tx.set=((ref:FirebaseFirestore.DocumentReference,...args:any[])=>{if(ref.path.includes('/services/'))throw new Error('Synthetic service write failure');return set(ref,...args as [any]);}) as typeof tx.set;return fn(tx);})) as typeof original;
  try{assert.equal((await act(r,'edit_service',{service:{values:{...serviceValues,grades:'7'},rationale:'Synthetic failure'}})).status,503);}finally{s.db.runTransaction=original;}
  assert.deepEqual(await get(r.id),before);assert.deepEqual((await s.db.doc(publicPath(r)).get()).data(),projection);
  const changes=await Promise.all([act(r,'edit_service',{service:{values:{...serviceValues,grades:'7'},rationale:'First writer'}}),act(r,'edit_service',{service:{values:{...serviceValues,grades:'8'},rationale:'Second writer'}})]);assert.deepEqual(changes.map(x=>x.status).sort(),[200,409]);r=await get(r.id);assert.equal(r.published,false);assert.deepEqual(r.analysis,before.analysis);
});
test('lost service response can be reconciled and retried without a duplicate version',async()=>{
  let r=await create();const id=randomUUID();const body={action:'edit_service',revision:r.revision,service:{values:serviceValues,rationale:'Reliable save'}};
  const first=await call(`/reviews/${r.id}`,'reviewer',body,id);assert.equal(first.status,200);r=first.data;
  const retry=await call(`/reviews/${r.id}`,'reviewer',body,id);assert.equal(retry.status,200);assert.equal(retry.data.revision,r.revision);
  assert.equal((await call(`/commands/${id}`)).data.state,'applied');assert.equal((await s.db.collection(`${base}/reviews/${r.id}/services`).get()).size,2);
  const lock=await acquireMaintenance(s,'Synthetic service fencing');try{assert.equal((await act(r,'edit_service',{service:{values:serviceValues,rationale:'Blocked'}})).status,503);}finally{await releaseMaintenance(s,lock);}
});
for(const role of ['anonymous','nonmember','staff','viewer','reviewer','admin'])test(`service versions and projections enforce ${role} boundaries`,async()=>{
  let r=await publish(await save(await complete()));const canEdit=['admin','reviewer'].includes(role);const canRead=canEdit||role==='viewer';const denied=role==='anonymous'?401:403;
  assert.equal((await call(`/reviews/${r.id}`,role)).status,canRead?200:denied);
  const db=role==='anonymous'?env.unauthenticatedContext().firestore():env.authenticatedContext(uids[role],{email:`service-${role}@school.example`,email_verified:true}).firestore();
  await assertSucceeds(getDoc(doc(db,publicPath(r))));await (['anonymous','nonmember'].includes(role)?assertFails:assertSucceeds)(getDoc(doc(db,staffPath(r))));
  const version=(await s.db.collection(`${base}/reviews/${r.id}/services`).limit(1).get()).docs[0];await assertFails(getDoc(doc(db,version.ref.path)));await assertFails(setDoc(doc(db,version.ref.path),{forged:true}));
  assert.equal((await act(r,'edit_service',{service:{values:serviceValues,rationale:'Role test'}},role)).status,canEdit?200:denied);
});
test('new settings never reinterpret the saved service policy or an existing decision',async()=>{
  const r=await publish(await save(await complete()));const old=await get(r.id);const policy=exampleTierPolicy();policy.version='stricter-local-v2';policy.rules['Tier 2: Site/Department Approved'].rostering=true;
  assert.equal((await call('/settings','reviewer',{section:'evaluation',revision:1,values:{...defaultEvaluation(),state:'Colorado',tierPolicy:policy}})).status,403);
  assert.equal((await call('/settings','admin',{section:'evaluation',revision:1,values:{...defaultEvaluation(),state:'Colorado',tierPolicy:policy}})).status,200);assert.deepEqual(await get(r.id),old);
  assert.equal((await call('/reviews','reviewer',{...pastedDraft,serviceSettingsRevision:1})).status,409);
});
