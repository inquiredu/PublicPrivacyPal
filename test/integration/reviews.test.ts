import { readReview } from '../../server/review-storage.ts';
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
import { saveBackup } from '../../scripts/backup-operations.ts';
import { processNextReview } from '../../server/reviews.ts';
import type { Review } from '../../shared/review.ts';

const config = loadConfig('config/test.example.json');
const base = `districts/${config.districtId}`;
const pass = randomBytes(24).toString('hex');
let s: Services; let env: RulesTestEnvironment; let server: ReturnType<typeof apiServer>;
const tokens: Record<string, string> = {}; const uids: Record<string, string> = {};
async function call(path: string, role = 'reviewer', body?: unknown) {
  const res = await fetch(`http://127.0.0.1:8787/api/reviews${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { 'Idempotency-Key': randomUUID(), Connection: 'close', Origin: 'http://127.0.0.1:5173', ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: res.status, data: await res.json() };
}
async function create(fixtureId = 'complete') { const out = await call('', 'reviewer', { name: 'Fictional Orchard', fixtureId }); assert.equal(out.status, 201); return out.data as Review; }
const get = async (id: string) => s.db.runTransaction(tx => readReview(s, tx, id));
async function action(r: Review, action: string, extra = {}) { return call(`/${r.id}`, 'reviewer', { action, revision: r.revision, ...extra }); }
const decision = { outcome: 'conditional', rationale: 'Private review reasoning', conditions: 'Use only with teacher supervision.', summary: 'Fictional classroom learning resource.', category: 'Learning' };
async function reviewed() {
  let r = await create(); await processNextReview(s); r = await get(r.id);
  const out = await action(r, 'decide', { decision }); assert.equal(out.status, 200); return out.data as Review;
}
async function published() { const r = await reviewed(); const out = await action(r, 'publish'); assert.equal(out.status, 200); return out.data as Review; }
const publicPath = (r: Review) => `publicDistricts/${config.districtId}/tools/review-${r.id}`;
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

for (const role of ['anonymous', 'nonmember', 'staff', 'viewer', 'reviewer', 'admin']) test(`workflow API and rules enforce ${role} permissions`, async () => {
  const canRead = ['viewer', 'reviewer', 'admin'].includes(role); const canWrite = ['reviewer', 'admin'].includes(role);
  assert.equal((await call('', role)).status, canRead ? 200 : role === 'anonymous' ? 401 : 403);
  assert.equal((await call('', role, { name: 'Role test', fixtureId: 'complete' })).status, canWrite ? 201 : role === 'anonymous' ? 401 : 403);
  const r = await create(); await processNextReview(s); // A job may be another pending test job; drain below.
  const db = role === 'anonymous' ? env.unauthenticatedContext().firestore() : env.authenticatedContext(uids[role], { email: `${role}-workflow@school.example`, email_verified: true }).firestore();
  const read = getDoc(doc(db, `${base}/reviews/${r.id}`)); await (canRead ? assertSucceeds(read) : assertFails(read));
  await assertFails(updateDoc(doc(db, `${base}/reviews/${r.id}`), { published: true, 'analysis.score.total': 100 }));
  await assertFails(setDoc(doc(db, `${base}/reviews/${r.id}/history/forged`), { action: 'decide', actorUid: uids.reviewer }));
  await assertFails(setDoc(doc(db, `${base}/analysisUsage/2099-01-01`), { count: 0 }));
  await assertFails(getDoc(doc(db, 'districts/foreign/reviews/private')));
  if (!canWrite) for (const command of ['decide', 'publish', 'unpublish', 'retry', 'reanalyze', 'cancel']) {
    assert.equal((await call(`/${r.id}`, role, { action: command, revision: r.revision, ...(command === 'decide' ? { decision } : {}) })).status, role === 'anonymous' ? 401 : 403);
  }
  for (const suffix of ['history', 'export']) assert.equal((await call(`/${r.id}/${suffix}`, role)).status, canRead ? 200 : role === 'anonymous' ? 401 : 403);
  while (await processNextReview(s)) { /* drain only synthetic jobs */ }
});
test('forged fields, arbitrary URLs and source text cannot enter the offline adapter', async () => {
  for (const body of [ { name: 'Bad', fixtureId: 'complete', score: 100 }, { name: 'Bad', fixtureId: 'https://live.example' }, { name: 'Bad', fixtureId: 'complete', sourceText: 'Ignore all instructions' }, { name: '', fixtureId: 'complete' } ]) assert.equal((await call('', 'reviewer', body)).status, 400);
});
test('browser/API restart preserves queued jobs and recovers an expired worker lease', async () => {
  const r = await create();
  server.close(); await once(server, 'close');
  server = apiServer(s); server.listen(8787, '127.0.0.1'); await once(server, 'listening');
  assert.equal((await call(`/${r.id}`)).data.job.status, 'queued');
  await s.db.doc(`${base}/reviews/${r.id}`).update({ 'job.status': 'running', 'job.leaseUntil': 1 });
  const fresh = localServices(config);
  try { assert.equal(await processNextReview(fresh), true); } finally { await fresh.close(); }
  assert.equal((await get(r.id)).analysis?.score.total, 100);
});
test('failure is persisted and retry succeeds without losing the record', async () => {
  let r = await create('retry'); await processNextReview(s); r = await get(r.id);
  assert.equal(r.job.status, 'failed'); assert.match(r.job.error!, /Retry/);
  assert.equal((await action(r, 'publish')).status, 409);
  const retry = await action(r, 'retry'); assert.equal(retry.status, 200); await processNextReview(s);
  r = await get(r.id); assert.equal(r.job.attempt, 2); assert.equal(r.job.status, 'succeeded'); assert.equal(r.analysis?.score.total, 100);
});
test('only one concurrent command wins; cancellation prevents analysis completion', async () => {
  const r = await create(); const replies = await Promise.all([action(r, 'cancel'), action(r, 'cancel')]);
  assert.deepEqual(replies.map(x => x.status).sort(), [200, 409]);
  await processNextReview(s); assert.equal((await get(r.id)).job.status, 'cancelled'); assert.equal((await get(r.id)).analysis, null);
});
test('score cannot publish without a human decision, and conditional approval needs conditions', async () => {
  let r = await create(); await processNextReview(s); r = await get(r.id);
  assert.equal((await action(r, 'publish')).status, 409);
  assert.equal((await action(r, 'decide', { decision: { ...decision, conditions: '' } })).status, 400);
  assert.equal((await action(r, 'decide', { decision: { ...decision, actorUid: 'forged' } })).status, 400);
});
test('publication exposes only selected fields and unpublication removes both projections', async () => {
  let r = await published(); const publicDoc = await getDoc(doc(env.unauthenticatedContext().firestore(), publicPath(r)));
  assert.deepEqual(Object.keys(publicDoc.data()!).sort(), ['category', 'conditions', 'name', 'outcome', 'reviewedAt', 'summary', 'synthetic']);
  assert.equal(publicDoc.data()!.conditions, decision.conditions);
  r = (await action(r, 'unpublish')).data;
  assert.equal(r.published, false); assert.equal((await s.db.doc(publicPath(r)).get()).exists, false);
  assert.equal((await s.db.doc(`${base}/staffTools/review-${r.id}`).get()).exists, false);
  assert.equal((await action(r, 'unpublish')).status, 200);
});
test('a failed unpublish commit returns an error and preserves the entire published state', async () => {
  const r = await published(); const original = s.db.runTransaction;
  // Inject failure inside the real transaction before commit; no test-only HTTP bypass exists.
  s.db.runTransaction = ((fn: Parameters<typeof original>[0]) => original.call(s.db, async tx => {
    const remove = tx.delete.bind(tx);
    tx.delete = ((ref: FirebaseFirestore.DocumentReference) => { if (ref.path === publicPath(r)) throw new Error('Synthetic write failure'); return remove(ref); }) as typeof tx.delete;
    return fn(tx);
  })) as typeof original;
  try { assert.equal((await action(r, 'unpublish')).status, 503); }
  finally { s.db.runTransaction = original; }
  assert.equal((await get(r.id)).published, true); assert.equal((await get(r.id)).revision, r.revision);
  assert.equal((await s.db.doc(publicPath(r)).get()).exists, true);
  assert.equal((await action(r, 'unpublish')).status, 200);
});
test('changing a decision or starting analysis removes publication; prior decisions remain attributed', async () => {
  let r = await published(); const oldDecision = r.decision;
  r = (await action(r, 'reanalyze')).data; assert.equal(r.published, false); assert.deepEqual(r.decision, oldDecision);
  assert.equal((await s.db.doc(publicPath(r)).get()).exists, false); await processNextReview(s); r = await get(r.id);
  assert.equal((await action(r, 'publish')).status, 409);
  r = (await action(r, 'decide', { decision: { ...decision, outcome: 'declined' } })).data;
  assert.equal((await action(r, 'publish')).status, 409);
  const events = (await call(`/${r.id}/history`)).data.items;
  assert.equal(events.filter((e: { action: string }) => e.action === 'decide').length, 2);
  for (const e of events) assert.equal(e.actorUid, uids.reviewer);
  const db = env.authenticatedContext(uids.admin, { email: 'admin-workflow@school.example', email_verified: true }).firestore();
  await assertFails(deleteDoc(doc(db, `${base}/reviews/${r.id}/history/${events[0].id}`)));
});
test('revocation between submission and completion fails the job and blocks commands', async () => {
  const r = await create(); await s.db.doc(`${base}/members/${uids.reviewer}`).update({ active: false });
  try { await processNextReview(s); assert.equal((await get(r.id)).job.status, 'failed'); assert.equal((await call('')).status, 403); }
  finally { await s.db.doc(`${base}/members/${uids.reviewer}`).update({ active: true }); }
});
test('disabled identities cannot complete queued analysis', async () => {
  const r = await create(); await s.auth.updateUser(uids.reviewer, { disabled: true });
  try { await processNextReview(s); assert.equal((await get(r.id)).job.status, 'failed'); }
  finally { await s.auth.updateUser(uids.reviewer, { disabled: false }); }
});
test('export/import reanalyzes as an unpublished draft, never adopting a claimed score or approval', async () => {
  const r = await published(); const bundle = (await call(`/${r.id}/export`)).data;
  bundle.snapshot.analysis.score.total = 999; bundle.snapshot.decision.actorUid = 'forged';
  const imported = await call('/import', 'admin', bundle); assert.equal(imported.status, 201);
  let copy = imported.data as Review; assert.equal(copy.decision, null); assert.equal(copy.published, false); assert.notEqual(copy.id, r.id);
  await processNextReview(s); copy = await get(copy.id); assert.equal(copy.analysis?.score.total, 100);
  assert.equal((await action(copy, 'publish')).status, 409);
  assert.equal((await call('/import', 'staff', bundle)).status, 403);
  bundle.sourceText += 'tampered'; assert.equal((await call('/import', 'admin', bundle)).status, 400);
});
test('profiles remain pinned across retries, exports and legacy review records', async () => {
  for (const profileVersion of ['community-evidence-v1', 'community-demo-v1']) {
    const created = await call('', 'reviewer', { name: 'Profile comparison', fixtureId: 'gaps', profileVersion }); assert.equal(created.status, 201);
    let r = created.data as Review; await processNextReview(s); r = await get(r.id);
    assert.equal(r.analysis?.score.total, profileVersion === 'community-demo-v1' ? 66 : 36);
    if (profileVersion === 'community-demo-v1') {
      // Milestone 2 records predate the top-level profile field; keep their original formula.
      await s.db.doc(`${base}/reviews/${r.id}`).update({ profileVersion: (await import('firebase-admin/firestore')).FieldValue.delete() });
      assert.equal((await action(r, 'reanalyze')).status, 200); await processNextReview(s); r = await get(r.id);
      assert.equal(r.analysis?.score.total, 66);
    }
    const archive = (await call(`/${r.id}/export`)).data;
    assert.equal(archive.draft.profileVersion, profileVersion);
    const copy = (await call('/import', 'reviewer', archive)).data as Review; await processNextReview(s);
    assert.equal((await get(copy.id)).analysis?.profileVersion, profileVersion);
  }
  assert.equal((await call('', 'reviewer', { name: 'Unknown', fixtureId: 'gaps', profileVersion: 'forged' })).status, 400);
});
test('maintenance fences API, direct client writes, account commands and workers while allowing reads', async () => {
  const r = await create(); const lock = await acquireMaintenance(s, 'Integration backup boundary');
  try {
    assert.equal((await call('')).status, 200);
    assert.equal((await call('', 'reviewer', { name: 'Blocked', fixtureId: 'complete' })).status, 503);
    assert.equal((await action(r, 'cancel')).status, 503);
    const res = await fetch('http://127.0.0.1:8787/api/members', { method: 'POST', headers: { Authorization: `Bearer ${tokens.admin}`, Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'viewer-workflow@school.example', role: 'reviewer', active: true }) });
    assert.equal(res.status, 503);
    assert.equal(await processNextReview(s), false);
    assert.equal((await get(r.id)).revision, r.revision);
    const db = env.authenticatedContext(uids.reviewer, { email: 'reviewer-workflow@school.example', email_verified: true }).firestore();
    await assertFails(updateDoc(doc(db, `${base}/tools/reading-garden`), { notes: 'Forbidden while saving', updatedAt: serverTimestamp(), updatedBy: uids.reviewer }));
    await assertFails(setDoc(doc(db, `${base}/requests/maintenance-attempt`), { toolName: 'Test', purpose: 'Test', requestedBy: uids.reviewer, status: 'pending', archived: false, createdAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(db, 'installation/maintenance')));
    await assert.rejects(acquireMaintenance(s, 'Concurrent backup'), /already active/);
    await assert.rejects(releaseMaintenance(s, 'wrong-lock'), /does not match/);
  } finally { await releaseMaintenance(s, lock); }
  assert.equal(await processNextReview(s), true); assert.equal((await get(r.id)).job.status, 'succeeded');
});
test('a worker already in flight cannot commit across the backup boundary', async () => {
  const r = await create(); const original = s.auth.getUser; let lock = '';
  s.auth.getUser = async (...args) => { const user = await original.apply(s.auth, args); lock = await acquireMaintenance(s, 'Worker race test'); return user; };
  try { await processNextReview(s); assert.equal((await get(r.id)).job.status, 'running'); assert.equal((await get(r.id)).analysis, null); }
  finally { s.auth.getUser = original; if (lock) await releaseMaintenance(s, lock); }
  assert.equal(await processNextReview(s, Date.now() + 31000), true); assert.equal((await get(r.id)).job.status, 'succeeded');
});
test('unconfirmed backup export remains in maintenance instead of claiming success', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async (input, options) => {
    if (String(input) === 'http://127.0.0.1:4400/_admin/export') throw new Error('Injected export interruption');
    return original(input, options);
  };
  try { await assert.rejects(saveBackup(s), /Backup was not confirmed/); }
  finally { globalThis.fetch = original; }
  const lock = await s.db.doc('installation/maintenance').get(); assert.ok(lock.exists);
  assert.equal((await call('', 'reviewer', { name: 'Still blocked', fixtureId: 'complete' })).status, 503);
  await releaseMaintenance(s, lock.get('id'));
});
test('review dashboard enforces all reader roles and actual publication lifecycle without private detail', async () => {
  const dashboard = async (role: string, query = '') => {
    const res = await fetch(`http://127.0.0.1:8787/api/review-dashboard${query}`, { headers: tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {} });
    return { status: res.status, data: await res.json() };
  };
  for (const role of ['anonymous','nonmember','staff']) assert.equal((await dashboard(role)).status, role === 'anonymous' ? 401 : 403);
  for (const role of ['viewer','reviewer','admin']) assert.equal((await dashboard(role)).status,200);
  assert.equal((await dashboard('reviewer','?queue=bogus')).status,400);
  assert.equal((await dashboard('reviewer','?queue=failed&queue=all')).status,400);
  assert.equal((await dashboard('reviewer','?cursor=bad')).status,400);
  const baseline=(await dashboard('reviewer')).data;
  let r=await published();
  let data=(await dashboard('reviewer')).data;
  assert.equal(data.counts.public,baseline.counts.public+1); assert.equal(data.counts.staff,baseline.counts.staff+1);
  const publicRow=(await dashboard('reviewer','?queue=public')).data.items.find((x: {id:string})=>x.id===r.id);
  assert.ok(publicRow); assert.deepEqual(Object.keys(publicRow).sort(),['id','name','queues']);
  await s.db.doc(publicPath(r)).delete();
  data=(await dashboard('reviewer','?queue=publication')).data;
  assert.ok(data.items.some((x: {id:string})=>x.id===r.id)); assert.equal(data.counts.public,baseline.counts.public);
  assert.equal((await action(r,'unpublish')).status,200);
  data=(await dashboard('reviewer','?queue=publication')).data;
  assert.ok(!data.items.some((x: {id:string})=>x.id===r.id));
  const headRef=s.db.doc(`${base}/reviews/${r.id}`); const saved=(await headRef.get()).data()!;
  try {
    await headRef.update({analysisId:randomUUID(), 'job.status':'succeeded', serviceSummary:{blockers:['Synthetic recorded requirement']}});
    assert.ok((await dashboard('reviewer','?queue=decision')).data.items.some((x:{id:string})=>x.id===r.id));
    assert.ok((await dashboard('reviewer','?queue=requirements')).data.items.some((x:{id:string})=>x.id===r.id));
    await headRef.update({'job.status':'awaiting_review'});
    assert.ok((await dashboard('reviewer','?queue=evidence')).data.items.some((x:{id:string})=>x.id===r.id));
  } finally { await headRef.set(saved); }
  const member=s.db.doc(`${base}/members/${uids.viewer}`); await member.update({active:false});
  try { assert.equal((await dashboard('viewer')).status,403); } finally { await member.update({active:true}); }
  const orphan=s.db.doc(`publicDistricts/${config.districtId}/tools/review-${randomUUID()}`); await orphan.set({name:'Synthetic orphan'});
  try { assert.equal((await dashboard('reviewer')).status,409); } finally { await orphan.delete(); }
});

test('review dashboard counts beyond the first page and refuses unsupported inventory', async () => {
  const { reviewDashboard } = await import('../../server/review-dashboard.ts');
  const actor=await s.auth.verifyIdToken(tokens.reviewer);
  const sample=(await s.db.collection(`${base}/reviews`).limit(1).get()).docs[0].data();
  const refs=Array.from({length:1001},()=>s.db.doc(`${base}/reviews/${randomUUID()}`));
  const existing=(await s.db.collection(`${base}/reviews`).get()).size;
  try {
    const writer=s.db.bulkWriter();
    for (const ref of refs.slice(0,1000-existing)) writer.create(ref,{...sample,id:ref.id,name:'Synthetic dashboard bound',decisionId:null,serviceId:null,serviceSummary:null,published:false,analysisId:null,job:{...sample.job,status:'failed'}});
    // Optional fields must be absent, not null.
    await writer.close();
    const fix=s.db.bulkWriter(); const { FieldValue }=await import('firebase-admin/firestore');
    for(const ref of refs.slice(0,1000-existing)) fix.update(ref,{serviceId:FieldValue.delete(),serviceSummary:FieldValue.delete()});
    await fix.close();
    const result=await reviewDashboard(s,actor,'failed'); assert.equal(result.counts.all,1000); assert.ok(result.counts.failed>20); assert.equal(result.items.length,20); assert.ok(result.nextCursor);
    const next=await reviewDashboard(s,actor,'failed',result.nextCursor!); assert.ok(!next.items.some(r=>result.items.some(p=>p.id===r.id)));
    await refs[1000].set({...sample,id:refs[1000].id});
    await assert.rejects(reviewDashboard(s,actor), (e: unknown)=>(e as {status:number}).status===409);
  } finally { const writer=s.db.bulkWriter(); for(const ref of refs) writer.delete(ref); await writer.close(); }
});

test('daily analysis quota is transactional, applies to retries, and does not alter denied records', async () => {
  const r = await create('retry'); await processNextReview(s); const failed = await get(r.id);
  const quota = s.db.doc(`${base}/analysisUsage/${new Date().toISOString().slice(0, 10)}`); await quota.set({ count: 99 });
  const attempts = await Promise.all([call('', 'reviewer', { name: 'Quota A', fixtureId: 'complete' }), call('', 'reviewer', { name: 'Quota B', fixtureId: 'complete' })]);
  assert.deepEqual(attempts.map(x => x.status).sort(), [201, 429]);
  assert.equal((await action(failed, 'retry')).status, 429); assert.equal((await get(r.id)).revision, failed.revision);
});
