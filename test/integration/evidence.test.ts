import { readReview } from '../../server/review-storage.ts';
import { requestJson, ApiError } from '../../src/api.ts';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { randomBytes, randomUUID } from 'node:crypto';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { loadConfig } from '../../server/config.ts';
import { localServices, type Services } from '../../server/firebase.ts';
import { bootstrap } from '../../server/operations.ts';
import { apiServer } from '../../server/http.ts';
import { acquireMaintenance, releaseMaintenance } from '../../server/maintenance.ts';
import { processNextReview } from '../../server/reviews.ts';
import { currentAnalysis, reviewedCount, type Review } from '../../shared/review.ts';
import { pastedDraft, pastedPolicy, evidenceEdits } from '../fixtures/pasted-policy.ts';
import { sourceHash } from '../../server/evidence.ts';

const config = loadConfig('config/test.example.json');
const base = `districts/${config.districtId}`;
const pass = randomBytes(24).toString('hex');
let s: Services; let env: RulesTestEnvironment; let server: ReturnType<typeof apiServer>;
const tokens: Record<string, string> = {}; const uids: Record<string, string> = {};
async function call(path: string, role = 'reviewer', body?: unknown, commandId: string = randomUUID()) {
  const res = await fetch(`http://127.0.0.1:8787/api/reviews${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Idempotency-Key': commandId, Connection: 'close', Origin: 'http://127.0.0.1:5173', ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: res.status, data: await res.json() };
}
const get = async (id: string) => s.db.runTransaction(tx => readReview(s, tx, id));
const publicPath = (r: Review) => `publicDistricts/${config.districtId}/tools/review-${r.id}`;
const staffPath = (r: Review) => `${base}/staffTools/review-${r.id}`;
async function create() { const out = await call('', 'reviewer', pastedDraft); assert.equal(out.status, 201); return out.data as Review; }
async function action(r: Review, action: string, extra = {}, role = 'reviewer') { return call(`/${r.id}`, role, { action, revision: r.revision, ...extra }); }
async function edit(r: Review, evidence = evidenceEdits[0], role = 'reviewer') { return action(r, 'edit_evidence', { evidence }, role); }
async function complete() {
  let r = await create();
  for (const evidence of evidenceEdits) { const out = await edit(r, evidence); assert.equal(out.status, 200); r = out.data; }
  return r;
}
const decision = { outcome: 'conditional', rationale: 'Private practice rationale', conditions: 'Synthetic evaluation only.', summary: 'Fictional practice resource.', category: 'Learning' };
async function published() {
  let r = await complete(); let out = await action(r, 'decide', { decision }); assert.equal(out.status, 200); r = out.data;
  out = await action(r, 'publish'); assert.equal(out.status, 200); return out.data as Review;
}
async function state(r: Review) { return { review: await get(r.id), history: (await call(`/${r.id}/history`)).data.items, public: (await s.db.doc(publicPath(r)).get()).data(), staff: (await s.db.doc(staffPath(r)).get()).data() }; }
before(async () => {
  s = localServices(config);
  env = await initializeTestEnvironment({ projectId: config.projectId, firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
  await env.clearFirestore();
  assert.ok((await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${config.projectId}/accounts`, { method: 'DELETE' })).ok);
  await bootstrap(s, pass);
  for (const role of ['admin', 'reviewer', 'viewer', 'staff', 'nonmember']) {
    const email = `${role}-workflow@school.example`;
    const user = await s.auth.createUser({ email, password: pass, emailVerified: true }); uids[role] = user.uid;
    if (role !== 'nonmember') await s.db.doc(`${base}/members/${user.uid}`).set({ email, role, active: true });
    const res = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-demo-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass, returnSecureToken: true }) });
    tokens[role] = (await res.json() as { idToken: string }).idToken;
  }
  server = apiServer(s); server.listen(8787, '127.0.0.1'); await once(server, 'listening');
});
after(async () => { if (server) { server.close(); await once(server, 'close'); } await env?.cleanup(); await s?.close(); });
for (const role of ['anonymous', 'nonmember', 'staff', 'viewer', 'reviewer', 'admin']) test(`pasted policy and evidence commands enforce ${role} permissions`, async () => {
  const canWrite = ['reviewer', 'admin'].includes(role); const canRead = canWrite || role === 'viewer';
  const denied = role === 'anonymous' ? 401 : 403;
  assert.equal((await call('', role, pastedDraft)).status, canWrite ? 201 : denied);
  const r = await create(); assert.equal((await edit(r, evidenceEdits[0], role)).status, canWrite ? 200 : denied);
  const db = role === 'anonymous' ? env.unauthenticatedContext().firestore() : env.authenticatedContext(uids[role], { email: `${role}-workflow@school.example`, email_verified: true }).firestore();
  await (canRead ? assertSucceeds : assertFails)(getDoc(doc(db, `${base}/reviews/${r.id}`)));
  await assertFails(updateDoc(doc(db, `${base}/reviews/${r.id}`), { sourceText: 'Replacement', 'analysis.score.total': 100 }));
  await assertFails(setDoc(doc(db, `${base}/reviews/${r.id}/history/forged`), { action: 'edit_evidence', actorUid: uids.admin }));
  await assertFails(getDoc(doc(db, 'districts/foreign/reviews/private')));
  for (const suffix of ['history', 'export']) assert.equal((await call(`/${r.id}/${suffix}`, role)).status, canRead ? 200 : denied);
});
test('capture fixes the source and remains unreviewed without consuming analysis quota', async () => {
  const quota = s.db.doc(`${base}/analysisUsage/${new Date().toISOString().slice(0, 10)}`);
  await quota.set({ count: 100 });
  const r = await create(); assert.equal(r.sourceKind, 'pasted'); assert.equal(r.fixtureId, null); assert.equal(r.sourceText, pastedPolicy);
  assert.equal(r.sourceHash, sourceHash(pastedPolicy)); assert.equal(r.sourceVersion, 1); assert.ok(r.sourceCapturedAt);
  assert.equal(r.job.status, 'awaiting_review'); assert.equal(r.analysis, null); assert.equal(reviewedCount(r), 0);
  assert.equal((await quota.get()).get('count'), 100); assert.equal(await processNextReview(s), false);
  assert.equal((await action(r, 'decide', { decision })).status, 409); assert.equal((await action(r, 'publish')).status, 409);
  for (const command of ['reanalyze', 'retry', 'cancel']) assert.equal((await action(r, command)).status, 409);
  await quota.delete();
});
test('invalid sources, forged authority and oversized bodies leave no reviews behind', async () => {
  const count = (await call('')).data.length;
  for (const body of [{ ...pastedDraft, sourceText: ' ' }, { ...pastedDraft, sourceText: 'x'.repeat(32001) }, { ...pastedDraft, sourceText: '\u0000secret' }, { ...pastedDraft, fixtureId: 'complete' }, { ...pastedDraft, url: 'https://policy.example' }, { ...pastedDraft, sourceHash: 'forged' }]) assert.equal((await call('', 'reviewer', body)).status, 400);
  assert.equal((await call('', 'reviewer', { ...pastedDraft, sourceText: 'x'.repeat(140000) })).status, 413);
  assert.equal((await call('/import', 'reviewer', { padding: 'x'.repeat(2 * 1024 * 1024) })).status, 413);
  assert.equal((await call('')).data.length, count);
});
test('all eight explicit findings are required, including an intentional missing-evidence finding', async () => {
  let r = await create();
  for (const [i, evidence] of evidenceEdits.entries()) {
    r = (await edit(r, evidence)).data;
    assert.equal(reviewedCount(r), i + 1);
    assert.equal(currentAnalysis(r), i === 7);
    if (i < 7) assert.equal((await action(r, 'decide', { decision })).status, 409);
  }
  assert.equal(r.job.status, 'succeeded'); assert.equal(r.analysis?.score.total, 64); assert.equal(r.analysis?.evidenceCount, 7);
  assert.equal(r.analysis?.sourceHash, r.sourceHash);
  assert.equal(r.analysis?.findings[2].additionalEvidence?.length, 1);
  assert.equal((await action(r, 'publish')).status, 409);
});
test('evidence correction atomically withdraws publication, invalidates the decision and records before/after attribution', async () => {
  let r = await published(); const old = structuredClone(r);
  const pub = await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), publicPath(r))));
  assert.deepEqual(Object.keys(pub.data()!).sort(), ['category', 'conditions', 'name', 'outcome', 'reviewedAt', 'summary', 'synthetic']);
  assert.equal(pub.data()!.synthetic, false);
  const out = await edit(r, { ...evidenceEdits[0], finding: 'partial', rationale: 'Corrected scope after a second review.' }, 'admin');
  assert.equal(out.status, 200); r = out.data;
  assert.equal(r.published, false); assert.equal(r.analysis?.score.total, 57); assert.notEqual(r.analysis?.id, old.analysis?.id);
  assert.deepEqual(r.decision, old.decision); assert.equal(r.sourceHash, old.sourceHash); assert.equal(r.sourceText, old.sourceText);
  assert.equal((await s.db.doc(publicPath(r)).get()).exists, false); assert.equal((await s.db.doc(staffPath(r)).get()).exists, false);
  assert.equal((await action(r, 'publish')).status, 409);
  const history = (await call(`/${r.id}/history`)).data.items;
  const correction = history.find((e: { revision: number }) => e.revision === r.revision);
  assert.equal(correction.actorUid, uids.admin); assert.equal(correction.details.before.finding, 'yes'); assert.equal(correction.details.after.finding, 'partial');
  assert.equal(correction.details.after.reviewedBy, uids.admin); assert.ok(correction.details.after.reviewedAt);
  assert.equal(correction.details.beforeScore, 64); assert.equal(correction.details.afterScore, 57); assert.equal(correction.details.sourceHash, old.sourceHash);
  assert.equal(correction.details.beforeAnalysisId, old.analysis?.id); assert.equal(correction.details.afterAnalysisId, r.analysis?.id);
  r = (await action(r, 'decide', { decision })).data; r = (await action(r, 'publish')).data; assert.equal(r.published, true);
});
test('invalid corrections cannot change a published record, its history or projections', async () => {
  const r = await published(); const before = await state(r); const c = evidenceEdits[0].citations[0];
  for (const evidence of [ { ...evidenceEdits[0], citations: [] }, { ...evidenceEdits[0], citations: [{ ...c, start: c.start + 1 }] }, { ...evidenceEdits[0], citations: [{ ...c, quote: 'Invented commitment' }] }, { ...evidenceEdits[0], rationale: '' }, { ...evidenceEdits[0], reviewedBy: 'forged' }, { ...evidenceEdits[0], score: 100 }, { ...evidenceEdits[0], criterionId: 'unknown' }, { ...evidenceEdits[7], citations: [c] } ]) assert.equal((await action(r, 'edit_evidence', { evidence })).status, 400);
  assert.equal((await action(r, 'edit_evidence', { evidence: evidenceEdits[0], sourceText: 'changed' })).status, 400);
  assert.deepEqual(await state(r), before);
});
test('a transaction failure cannot save evidence while leaving an old public entry visible', async () => {
  const r = await published(); const before = await state(r); const original = s.db.runTransaction;
  s.db.runTransaction = ((fn: Parameters<typeof original>[0]) => original.call(s.db, async tx => {
    const remove = tx.delete.bind(tx);
    tx.delete = ((ref: FirebaseFirestore.DocumentReference) => { if (ref.path === publicPath(r)) throw new Error('Synthetic evidence commit failure'); return remove(ref); }) as typeof tx.delete;
    return fn(tx);
  })) as typeof original;
  try { assert.equal((await edit(r)).status, 503); } finally { s.db.runTransaction = original; }
  assert.deepEqual(await state(r), before); assert.equal((await edit(r)).status, 200);
});
test('concurrent evidence commands reject stale revisions and append exactly one event', async () => {
  const r = await create();
  const outcomes = await Promise.all([edit(r, evidenceEdits[0]), edit(r, evidenceEdits[1])]);
  assert.deepEqual(outcomes.map(x => x.status).sort(), [200, 409]);
  assert.equal((await get(r.id)).revision, r.revision + 1); assert.equal(reviewedCount(await get(r.id)), 1);
  assert.equal((await call(`/${r.id}/history`)).data.items.length, 2);
});
test('revoked members, disabled accounts and maintenance cannot change evidence', async () => {
  const r = await create(); const before = await state(r);
  await s.db.doc(`${base}/members/${uids.reviewer}`).update({ active: false });
  try { assert.equal((await edit(r)).status, 403); } finally { await s.db.doc(`${base}/members/${uids.reviewer}`).update({ active: true }); }
  await s.auth.updateUser(uids.reviewer, { disabled: true });
  try { assert.equal((await edit(r)).status, 401); } finally { await s.auth.updateUser(uids.reviewer, { disabled: false }); }
  const lock = await acquireMaintenance(s, 'Synthetic evidence maintenance');
  try { assert.equal((await edit(r)).status, 503); assert.equal((await call('', 'reviewer', pastedDraft)).status, 503); }
  finally { await releaseMaintenance(s, lock); }
  assert.deepEqual(await state(r), before);
});
test('API restart preserves partially reviewed text without queuing automatic analysis', async () => {
  let r = await create(); r = (await edit(r)).data;
  server.close(); await once(server, 'close'); server = apiServer(s); server.listen(8787, '127.0.0.1'); await once(server, 'listening');
  assert.deepEqual((await call(`/${r.id}`)).data, r);
  assert.equal(await processNextReview(s), false); assert.equal((await edit(r, evidenceEdits[1])).status, 200);
});
test('export/import keeps source and profile but discards archived authority and review progress', async () => {
  const r = await published(); const bundle = (await call(`/${r.id}/export`)).data;
  assert.equal(bundle.format, 'privacypal-pasted-v1'); assert.equal(bundle.draft.sourceText, pastedPolicy); assert.ok(bundle.snapshot.history.length > 8);
  bundle.snapshot.analysis.score.total = 999; bundle.snapshot.decision.actorUid = 'forged';
  const out = await call('/import', 'admin', bundle); assert.equal(out.status, 201);
  const copy = out.data as Review; assert.notEqual(copy.id, r.id); assert.equal(copy.sourceHash, r.sourceHash); assert.equal(copy.profileVersion, r.profileVersion);
  assert.equal(copy.analysis, null); assert.equal(copy.decision, null); assert.equal(copy.published, false); assert.equal(copy.job.status, 'awaiting_review');
  assert.equal((await action(copy, 'publish')).status, 409); assert.equal((await call(`/${copy.id}/history`)).data.items.length, 1);
  assert.equal((await call('/import', 'staff', bundle)).status, 403);
});
test('fixture corrections cannot race an active worker; reruns preserve their audit trail', async () => {
  let r = (await call('', 'reviewer', { name: 'Fixture correction', fixtureId: 'complete' })).data as Review;
  assert.equal((await edit(r)).status, 409); await processNextReview(s); r = await get(r.id);
  const evidence = { criterionId: 'changes', finding: 'not_specified', citations: [], rationale: 'Synthetic correction for the workflow test.' };
  const out = await action(r, 'edit_evidence', { evidence }); assert.equal(out.status, 200); r = out.data;
  assert.equal(r.analysis?.score.total, 93); assert.equal(currentAnalysis(r), true);
  r = (await action(r, 'reanalyze')).data; assert.equal((await edit(r)).status, 409); await processNextReview(s); r = await get(r.id);
  assert.equal(r.analysis?.score.total, 100);
  assert.equal((await call(`/${r.id}/history`)).data.items.filter((e: { action: string }) => e.action === 'edit_evidence').length, 1);
});

async function receipt(id: string, role = 'reviewer') {
  const res = await fetch(`http://127.0.0.1:8787/api/commands/${id}`, { headers: { Connection:'close', Origin:'http://127.0.0.1:5173', ...(tokens[role] ? { Authorization:`Bearer ${tokens[role]}` } : {}) } });
  return {status:res.status,data:await res.json()};
}
test('lost HTTP acknowledgement is reconciled and concurrent retries create one review and event', async () => {
  const id=randomUUID(); const reviews=s.db.collection(`districts/${config.districtId}/reviews`);
  const before=(await reviews.count().get()).data().count;
  await assert.rejects(requestJson('http://127.0.0.1:8787/api/reviews',async()=>tokens.reviewer,pastedDraft,{commandId:id,fetcher:async(url,init)=>{
    const response=await fetch(url,{...init,headers:{...init?.headers,Origin:'http://127.0.0.1:5173'}}); assert.equal(response.status,201);
    await response.text(); throw new Error('Synthetic lost response after commit');
  }}),e=>e instanceof ApiError && e.uncertain);
  const saved=await receipt(id); assert.equal(saved.status,200); assert.equal(saved.data.state,'applied');
  const attempts=await Promise.all([call('','reviewer',pastedDraft,id),call('','reviewer',pastedDraft,id)]);
  for(const out of attempts) { assert.equal(out.status,201); assert.equal(out.data.id,saved.data.review.id); }
  assert.equal((await reviews.count().get()).data().count,before+1);
  assert.equal((await call(`/${saved.data.review.id}/history`)).data.items.length,1);
});
test('concurrent first delivery and canonical key ordering are idempotent; changed payload and route are rejected', async () => {
  const id=randomUUID(); const [a,b]=await Promise.all([call('','reviewer',pastedDraft,id),call('','reviewer',Object.fromEntries(Object.entries(pastedDraft).reverse()),id)]);
  assert.equal(a.status,201); assert.equal(b.status,201); assert.equal(a.data.id,b.data.id);
  assert.equal((await call('','reviewer',{...pastedDraft,name:'Changed content'},id)).status,409);
  assert.equal((await call(`/${a.data.id}`,'reviewer',{action:'edit_evidence',revision:a.data.revision,evidence:evidenceEdits[0]},id)).status,409);
  assert.equal((await call('','reviewer',pastedDraft,'invalid')).status,400);
});
test('replayed evidence and publication commands return current state without repeating history or restoring stale publication', async () => {
  let r=await published(); const id=randomUUID(); const body={action:'edit_evidence',revision:r.revision,evidence:evidenceEdits[0]};
  r=(await call(`/${r.id}`,'reviewer',body,id)).data;
  const count=(await call(`/${r.id}/history`)).data.items.length;
  const replay=await call(`/${r.id}`,'reviewer',body,id); assert.equal(replay.status,200); assert.equal(replay.data.revision,r.revision);
  assert.equal((await call(`/${r.id}/history`)).data.items.length,count); assert.equal((await s.db.doc(publicPath(r)).get()).exists,false);
  r=(await action(r,'decide',{decision})).data;
  const publishId=randomUUID(); const publishBody={action:'publish',revision:r.revision};
  r=(await call(`/${r.id}`,'reviewer',publishBody,publishId)).data;
  r=(await action(r,'unpublish')).data;
  const later=await call(`/${r.id}`,'reviewer',publishBody,publishId);
  assert.equal(later.data.revision,r.revision); assert.equal(later.data.published,false); assert.equal((await s.db.doc(publicPath(r)).get()).exists,false);
});
test('receipt scope, current roles, direct rules and disabled accounts cannot expose or forge outcomes', async () => {
  const id=randomUUID(); await call('','reviewer',pastedDraft,id);
  for(const role of ['anonymous','nonmember','staff','viewer']) assert.equal((await receipt(id,role)).status,role==='anonymous'?401:403);
  assert.deepEqual((await receipt(id,'admin')).data,{state:'not_found'});
  for(const role of ['reviewer','admin']) {
    const db=env.authenticatedContext(uids[role],{email:`${role}-workflow@school.example`,email_verified:true}).firestore();
    const ref=doc(db,`${base}/commandReceipts/${uids.reviewer}/entries/${id}`);
    await assertFails(getDoc(ref)); await assertFails(setDoc(ref,{reviewId:'forged'}));
  }
  await s.db.doc(`${base}/members/${uids.reviewer}`).update({active:false});
  try { assert.equal((await receipt(id)).status,403); assert.equal((await call('','reviewer',pastedDraft,id)).status,403); }
  finally { await s.db.doc(`${base}/members/${uids.reviewer}`).update({active:true}); }
  await s.auth.updateUser(uids.reviewer,{disabled:true});
  try { assert.equal((await receipt(id)).status,401); } finally { await s.auth.updateUser(uids.reviewer,{disabled:false}); }
});
test('maintenance permits checking a receipt but fences retries; missing receipts never claim failure', async () => {
  const id=randomUUID(); await call('','reviewer',pastedDraft,id);
  const missing=randomUUID(); assert.deepEqual((await receipt(missing)).data,{state:'not_found'});
  const lock=await acquireMaintenance(s,'Synthetic command check');
  try { assert.equal((await receipt(id)).data.state,'applied'); assert.equal((await call('','reviewer',pastedDraft,id)).status,503); assert.equal((await call('','reviewer',pastedDraft,missing)).status,503); }
  finally { await releaseMaintenance(s,lock); }
  assert.equal((await receipt(missing)).data.state,'not_found'); assert.equal((await call('','reviewer',pastedDraft,missing)).status,201);
});
test('import replay survives an API restart without copying archived decisions twice', async () => {
  const id=randomUUID(); const body={format:'privacypal-pasted-v1',draft:pastedDraft,snapshot:{decision:'Untrusted archived approval'}};
  const first=await call('/import','reviewer',body,id); assert.equal(first.status,201);
  server.close(); await once(server,'close'); server=apiServer(s); server.listen(8787,'127.0.0.1'); await once(server,'listening');
  const replay=await call('/import','reviewer',body,id); assert.equal(replay.data.id,first.data.id); assert.equal(replay.data.decision,null);
  assert.equal((await receipt(id)).data.state,'applied'); assert.equal((await call(`/${first.data.id}/history`)).data.items.length,1);
});

test('a failed receipt write rolls back its review and audit event together', async () => {
  const id=randomUUID(); const before=(await call('')).data.length; const original=s.db.runTransaction;
  s.db.runTransaction=((fn: Parameters<typeof original>[0])=>original.call(s.db,async tx=>{
    const create=tx.create.bind(tx);
    tx.create=((ref: FirebaseFirestore.DocumentReference, data: FirebaseFirestore.DocumentData)=>{
      if(ref.path.includes('/commandReceipts/')) throw new Error('Synthetic receipt failure');
      return create(ref,data);
    }) as typeof tx.create;
    return fn(tx);
  })) as typeof original;
  try { assert.equal((await call('','reviewer',pastedDraft,id)).status,503); }
  finally { s.db.runTransaction=original; }
  assert.equal((await call('')).data.length,before); assert.equal((await receipt(id)).data.state,'not_found');
  assert.equal((await call('','reviewer',pastedDraft,id)).status,201);
});
