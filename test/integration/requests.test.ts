import { createReview } from '../../server/reviews.ts';
import { commandStatus } from '../../server/commands.ts';
import { pastedDraft } from '../fixtures/pasted-policy.ts';
import { requestQueues } from '../../shared/request-dashboard.ts';
import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, query, limit, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { loadConfig } from '../../server/config.ts';
import { localServices, type Services } from '../../server/firebase.ts';
import { bootstrap } from '../../server/operations.ts';
import { commandIdentity } from '../../server/commands.ts';
import { requestDashboard, requestCommand, requestCommandStatus, requestDetail, requestHistory, listRequests } from '../../server/requests.ts';
import { validateRequestInstallation } from '../../server/request-storage.ts';
import { acquireMaintenance, releaseMaintenance } from '../../server/maintenance.ts';
import { saveBackup, finishRestore } from '../../scripts/backup-operations.ts';
import { verifyBackup } from '../../scripts/backup-files.ts';
import { apiServer } from '../../server/http.ts';
const config = loadConfig('config/test.example.json');
const base = `districts/${config.districtId}`;
let s: Services, env: RulesTestEnvironment;
let admin: DecodedIdToken, staff: DecodedIdToken, other: DecodedIdToken, reviewer: DecodedIdToken, viewer: DecodedIdToken;
const body = { toolName: 'Synthetic request', purpose: 'Classroom trial', requestedUrl: '' };
const run = (actor: DecodedIdToken, id: string | null, data: unknown, commandId = randomUUID()) => requestCommand(s, actor, id, data, commandIdentity(commandId, id ? `/api/requests/${id}` : '/api/requests', data));
const denied = (fn: Promise<unknown>, status: number) => assert.rejects(fn, (e: unknown) => (e as { status: number }).status === status);
async function fenced(fn: (id: string) => Promise<void>) { const lock = await acquireMaintenance(s, 'Synthetic request validation'); try { await fn(lock); } finally { await releaseMaintenance(s, lock); } }
before(async () => {
  s = localServices(config);
  env = await initializeTestEnvironment({ projectId: config.projectId, firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
  await env.clearFirestore();
  await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${config.projectId}/accounts`, { method: 'DELETE' });
  const result = await bootstrap(s, randomBytes(24).toString('hex'));
  admin = { uid: result.uid, email: config.bootstrapAdminEmail, email_verified: true } as DecodedIdToken;
  async function actor(role: string, uid = role) {
    const email = `${uid}@school.example`;
    await s.db.doc(`${base}/members/${uid}`).set({ email, role, active: true });
    return { uid, email, email_verified: true } as DecodedIdToken;
  }
  staff = await actor('staff'); other = await actor('staff', 'other'); reviewer = await actor('reviewer'); viewer = await actor('viewer');
});
after(async () => { await env?.cleanup(); await s?.close(); });
test('all active roles create their own request; requester projection and history protect internal details', async () => {
  for (const actor of [admin, reviewer, viewer, staff]) {
    const r = await run(actor, null, body); assert.equal(r.status, 'pending'); assert.equal(r.revision, 1); assert.equal(r.own, true);
    if (actor === viewer || actor === staff) { assert.equal(r.assignee, undefined); await denied(requestHistory(s, actor, r.id), 403); }
    await denied(requestDetail(s, other, r.id), 403);
    const h = await requestHistory(s, reviewer, r.id); assert.equal(h.items.length, 1); assert.equal(h.items[0].action, 'create');
  }
  const rows = await listRequests(s, staff); assert.equal(rows.items.length, 1); assert.equal(rows.items[0].own, true);
  await denied(run(staff, null, { ...body, requestedBy: admin.uid }), 400);
});
test('lost acknowledgement and concurrent identical submission produce one request and one event', async () => {
  const id = randomUUID(); const [a, b] = await Promise.all([run(staff, null, body, id), run(staff, null, body, id)]);
  assert.equal(a.id, b.id); assert.equal((await requestHistory(s, admin, a.id)).items.length, 1);
  const claimed = await run(reviewer, a.id, { action: 'claim', revision: 1 });
  assert.equal((await run(staff, null, body, id)).revision, claimed.revision, 'Replay returns current state');
  const status = await requestCommandStatus(s, staff, id); assert.equal(status.state, 'applied');
  if (status.state === 'applied') { assert.equal(status.appliedRevision, 1); assert.equal(status.request.status, 'in_review'); }
  assert.equal((await requestCommandStatus(s, other, id)).state, 'not_found');
  await denied(run(staff, null, { ...body, purpose: 'Different' }, id), 409);
});
test('competing claims serialize; only assignee acts, administrator takeover is explicit and audited', async () => {
  const r = await run(staff, null, body);
  const results = await Promise.allSettled([run(reviewer, r.id, { action: 'claim', revision: 1 }), run(admin, r.id, { action: 'claim', revision: 1 })]);
  assert.equal(results.filter(x => x.status === 'fulfilled').length, 1);
  let current = await requestDetail(s, admin, r.id);
  const owner = current.assignee === admin.uid ? admin : reviewer; const nonOwner = owner === admin ? reviewer : admin;
  await denied(run(nonOwner, r.id, { action: 'release', revision: current.revision }), 409);
  await denied(run(staff, r.id, { action: 'claim', revision: current.revision }), 403);
  if (owner === admin) { current = await run(admin, r.id, { action: 'release', revision: current.revision }); current = await run(reviewer, r.id, { action: 'claim', revision: current.revision }); }
  await denied(run(reviewer, r.id, { action: 'takeover', revision: current.revision, reason: 'Invalid role' }), 403);
  current = await run(admin, r.id, { action: 'takeover', revision: current.revision, reason: 'Private continuity note' });
  current = await run(admin, r.id, { action: 'decide', revision: current.revision, outcome: 'declined', reason: 'Requester-visible explanation', reviewId: null });
  const safe = await requestDetail(s, staff, r.id); assert.equal(safe.outcome?.reason, 'Requester-visible explanation'); assert.ok(!JSON.stringify(safe).includes('Private continuity'));
  await denied(run(reviewer, r.id, { action: 'reopen', revision: current.revision, reason: 'No' }), 403);
  current = await run(admin, r.id, { action: 'reopen', revision: current.revision, reason: 'New information' }); assert.equal(current.status, 'pending'); assert.equal(current.outcome, null);
});
test('requester and reviewer archives remain independent and reversible', async () => {
  let r = await run(staff, null, body);
  await denied(run(staff, r.id, { action: 'archive', revision: r.revision, audience: 'admin', archived: true }), 403);
  r = await run(staff, r.id, { action: 'archive', revision: r.revision, audience: 'requester', archived: true });
  assert.equal(r.archived, true); assert.equal((await requestDetail(s, admin, r.id)).archived, false);
  r = await run(reviewer, r.id, { action: 'archive', revision: r.revision, audience: 'admin', archived: true });
  r = await run(staff, r.id, { action: 'archive', revision: r.revision, audience: 'requester', archived: false });
  assert.equal(r.archived, false); assert.equal((await requestDetail(s, admin, r.id)).archived, true);
});
test('linking a review requires a district review and never publishes or changes its decision', async () => {
  let r = await run(staff, null, body); r = await run(reviewer, r.id, { action: 'claim', revision: r.revision });
  const reviewId = randomUUID();
  await denied(run(reviewer, r.id, { action: 'decide', revision: r.revision, outcome: 'review_linked', reason: 'See review', reviewId }), 400);
  await s.db.doc(`${base}/reviews/${reviewId}`).set({ syntheticReference: true });
  try {
    r = await run(reviewer, r.id, { action: 'decide', revision: r.revision, outcome: 'review_linked', reason: 'See current staff guidance', reviewId });
    assert.equal(r.outcome?.reviewId, reviewId);
    const staffDb = env.authenticatedContext(staff.uid, { email: staff.email, email_verified: true }).firestore();
    const guidancePath = `${base}/staffTools/review-${reviewId}`;
    assert.equal((await getDoc(doc(staffDb, guidancePath))).exists(), false);
    const published = { name: 'Synthetic linked service', summary: 'Published guidance only', conditions: 'Teacher supervised use' };
    await s.db.doc(guidancePath).set(published);
    assert.deepEqual((await getDoc(doc(staffDb, guidancePath))).data(), published);
    await assertFails(getDoc(doc(staffDb, `${base}/reviews/${reviewId}`)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), guidancePath)));
    await s.db.doc(guidancePath).delete();
    assert.equal((await getDoc(doc(staffDb, guidancePath))).exists(), false);
    assert.equal((await requestDetail(s, staff, r.id)).outcome?.reviewId, reviewId, 'Withdrawal does not rewrite the historical outcome');

    assert.deepEqual((await s.db.doc(`${base}/reviews/${reviewId}`).get()).data(), { syntheticReference: true });
    assert.equal((await s.db.doc(`publicDistricts/${config.districtId}/tools/${reviewId}`).get()).exists, false);
  } finally { await s.db.doc(`${base}/reviews/${reviewId}`).delete(); }
});
test('request capture and link commit together; lost responses and races cannot duplicate reviews', async () => {
  let r = await run(staff, null, { ...body, requestedUrl: 'https://synthetic.example/reference' });
  r = await run(reviewer, r.id, { action: 'claim', revision: r.revision });
  const payload = { ...pastedDraft, requestHandoff: { requestId: r.id, revision: r.revision, reason: 'Review created; no approval yet' } };
  const id = randomUUID(); const command = commandIdentity(id, '/api/reviews', payload);
  await denied(createReview(s, admin, payload, false, command), 409);
  await denied(createReview(s, staff, payload, false, command), 403);
  await denied(createReview(s, viewer, payload, false, command), 403);
  await fenced(async () => { await denied(createReview(s, reviewer, payload, false, command), 503); });
  const membership = s.db.doc(`${base}/members/${reviewer.uid}`);
  await membership.update({ active: false });
  try { await denied(createReview(s, reviewer, payload, false, command), 403); } finally { await membership.update({ active: true }); }
  const [a, b] = await Promise.all([createReview(s, reviewer, payload, false, command), createReview(s, reviewer, payload, false, command)]);
  assert.equal(a.id, b.id); assert.equal(a.published, false); assert.equal(a.decision, null); assert.equal(a.job.status, 'awaiting_review');
  assert.equal((await commandStatus(s, reviewer, id)).state, 'applied');
  assert.equal((await createReview(s, reviewer, payload, false, command)).id, a.id);
  assert.equal((await requestDetail(s, staff, r.id)).outcome?.reviewId, a.id);
  assert.equal((await requestHistory(s, admin, r.id)).items.length, 3);
  await denied(createReview(s, reviewer, payload, false, commandIdentity(randomUUID(), '/api/reviews', payload)), 409);
  const history = await s.db.collection(`${base}/reviews/${a.id}/history`).get();
  assert.equal(history.docs[0].get('details.requestContext.requestedUrl'), 'https://synthetic.example/reference');
  assert.equal((await s.db.doc(`${base}/staffTools/review-${a.id}`).get()).exists, false);
  // A fresh draft loses its authority after assignment changes, without creating an orphan review.
  let stale = await run(staff, null, body); stale = await run(reviewer, stale.id, { action: 'claim', revision: stale.revision });
  const stalePayload = { ...payload, requestHandoff: { ...payload.requestHandoff, requestId: stale.id, revision: stale.revision } };
  await run(admin, stale.id, { action: 'takeover', revision: stale.revision, reason: 'Synthetic competing assignment' });
  const beforeCount = (await s.db.doc(`${base}/reviewCounters/current`).get()).get('count');
  await denied(createReview(s, reviewer, stalePayload, false, commandIdentity(randomUUID(), '/api/reviews', stalePayload)), 409);
  assert.equal((await s.db.doc(`${base}/reviewCounters/current`).get()).get('count'), beforeCount);
});
test('revocation, changed role and maintenance are rechecked before receipt replay', async () => {
  const id = randomUUID(); const r = await run(other, null, body, id);
  const membership = s.db.doc(`${base}/members/${other.uid}`);
  await membership.update({ active: false });
  try { await denied(run(other, null, body, id), 403); await denied(requestCommandStatus(s, other, id), 403); } finally { await membership.update({ active: true }); }
  await fenced(async () => { await denied(run(other, null, body, id), 503); assert.equal((await requestCommandStatus(s, other, id)).state, 'applied'); });
  const claimId = randomUUID(); await run(reviewer, r.id, { action: 'claim', revision: 1 }, claimId);
  await s.db.doc(`${base}/members/${reviewer.uid}`).update({ role: 'staff' });
  try { await denied(run(reviewer, r.id, { action: 'claim', revision: 1 }, claimId), 403); } finally { await s.db.doc(`${base}/members/${reviewer.uid}`).update({ role: 'reviewer' }); }
});
test('legacy requests are readable without migration; adoption preserves original unknown date and archive', async () => {
  await s.db.doc(`${base}/requests/legacy`).set({ toolName: 'Earlier tool', purpose: 'Earlier purpose', requestedBy: staff.uid, status: 'pending', archived: true });
  const r = await requestDetail(s, staff, 'legacy'); assert.equal(r.revision, 0); assert.equal(r.createdAt, null);
  assert.equal((await s.db.doc(`${base}/requests/legacy`).get()).get('state'), undefined);
  const next = await run(admin, 'legacy', { action: 'claim', revision: 0 }); assert.equal(next.archivedByRequester, true);
  const h = await requestHistory(s, admin, 'legacy'); assert.equal(h.items[0].before?.revision, 0); assert.equal(h.items[0].action, 'claim');
});
test('heads, history and receipts deny direct browser reads and writes for every role and anonymous', async () => {
  for (const actor of [undefined, admin, reviewer, viewer, staff]) {
    const db = actor ? env.authenticatedContext(actor.uid, { email: actor.email, email_verified: true }).firestore() : env.unauthenticatedContext().firestore();
    for (const path of [`${base}/requests/legacy`, `${base}/requests/legacy/history/000001`, `${base}/requestReceipts/${staff.uid}/entries/${randomUUID()}`]) {
      await assertFails(getDoc(doc(db, path))); await assertFails(setDoc(doc(db, path), { forged: true }));
    }
  }
});
test('catalogue suggestion reads use only current staff projections and enforce membership for every role', async () => {
  const projection = s.db.doc(`${base}/staffTools/suggestion-test`);
  const privateRef = s.db.doc(`${base}/reviews/suggestion-private`);
  await projection.set({ name: 'Synthetic catalogue hint', summary: 'Only published guidance', category: 'Practice', conditions: 'Teacher supervised' });
  await privateRef.set({ name: 'Synthetic catalogue hint', sourceText: 'Private policy evidence' });
  try {
    for (const actor of [admin, reviewer, viewer, staff]) {
      const db = env.authenticatedContext(actor.uid, { email: actor.email, email_verified: true }).firestore();
      const snap = await getDocs(query(collection(db, `${base}/staffTools`), limit(1001)));
      const hint = snap.docs.find(d => d.id === 'suggestion-test')!;
      assert.equal(hint.get('conditions'), 'Teacher supervised'); assert.equal(hint.get('sourceText'), undefined);
    }
    const anonymousDb = env.unauthenticatedContext().firestore();
    await assertFails(getDocs(query(collection(anonymousDb, `${base}/staffTools`), limit(1001))));
    const nonmemberDb = env.authenticatedContext('no-membership', { email: 'unknown@school.example', email_verified: true }).firestore();
    await assertFails(getDocs(query(collection(nonmemberDb, `${base}/staffTools`), limit(1001))));
    const staffDb = env.authenticatedContext(staff.uid, { email: staff.email, email_verified: true }).firestore();
    await assertFails(getDoc(doc(staffDb, privateRef.path)));
    await s.db.doc(`${base}/members/${staff.uid}`).update({ active: false });
    try { await assertFails(getDocs(query(collection(staffDb, `${base}/staffTools`), limit(1001)))); }
    finally { await s.db.doc(`${base}/members/${staff.uid}`).update({ active: true }); }
    await projection.delete();
    const current = await getDocs(query(collection(staffDb, `${base}/staffTools`), limit(1001)));
    assert.equal(current.docs.some(d => d.id === 'suggestion-test'), false, 'Withdrawal cannot fall back to a matching private review');
  } finally { await projection.delete(); await privateRef.delete(); }
});
test('schema 11 backup validates request chain and receipts; old schema cannot hide new records', async () => {
  await fenced(async lock => { assert.equal((await validateRequestInstallation(s, lock)).hasArtifacts, true); });
  const backup = await saveBackup(s); const manifest = verifyBackup(backup, config); assert.equal(manifest.dataSchema, 11);
  await fenced(async lock => { await assert.rejects(finishRestore(s, { ...manifest, dataSchema: 10, backupId: lock }), /schema 11/); assert.equal((await s.db.doc('installation/maintenance').get()).get('id'), lock); });
  const event = s.db.doc(`${base}/requests/legacy/history/000001`); const original = (await event.get()).data()!;
  await event.update({ actorUid: 'forged' });
  try { await fenced(async lock => { await assert.rejects(validateRequestInstallation(s, lock)); }); } finally { await event.set(original); }
  const orphan = event.collection('unknown').doc('hidden'); await orphan.set({ hidden: true });
  try { await fenced(async lock => { await assert.rejects(validateRequestInstallation(s, lock), /descendants/); }); } finally { await orphan.delete(); }
});
test('bounded history refuses overflow without discarding receipts; history pages are complete', async () => {
  let r = await run(staff, null, body);
  while (r.revision < 64) r = await run(staff, r.id, { action: 'archive', revision: r.revision, audience: 'requester', archived: !r.archived });
  await denied(run(staff, r.id, { action: 'archive', revision: r.revision, audience: 'requester', archived: false }), 409);
  let cursor: string | undefined; const revisions: number[] = [];
  do { const page = await requestHistory(s, admin, r.id, cursor); revisions.push(...page.items.map(e => e.revision)); cursor = page.nextCursor || undefined; } while (cursor);
  assert.equal(new Set(revisions).size, 64);
  await fenced(async lock => { await validateRequestInstallation(s, lock); });
});
test('HTTP request routes enforce authentication, command IDs and payload validation', async () => {
  const password = randomBytes(24).toString('hex'); const account = await s.auth.createUser({ email: 'http-request@school.example', emailVerified: true, password });
  await s.db.doc(`${base}/members/${account.uid}`).set({ email: account.email, role: 'staff', active: true });
  const signin = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-demo-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: account.email, password, returnSecureToken: true }) });
  const token = (await signin.json() as { idToken: string }).idToken;
  const server = apiServer(s); server.listen(8787, '127.0.0.1'); await once(server, 'listening');
  try {
    assert.equal((await fetch('http://127.0.0.1:8787/api/requests')).status, 401);
    assert.equal((await fetch('http://127.0.0.1:8787/api/request-dashboard')).status, 401);
    const headers = { Origin: 'http://127.0.0.1:5173', Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    assert.equal((await fetch('http://127.0.0.1:8787/api/requests', { method: 'POST', headers, body: JSON.stringify(body) })).status, 400);
    assert.equal((await fetch('http://127.0.0.1:8787/api/request-dashboard', { headers })).status, 200);
    for (const path of ['/api/requests?queue=wrong', '/api/requests?queue=all&queue=active', '/api/request-dashboard?cursor=bad', '/api/me?queue=all']) assert.equal((await fetch('http://127.0.0.1:8787' + path, { headers })).status, 400);
    const id = randomUUID(); const response = await fetch('http://127.0.0.1:8787/api/requests', { method: 'POST', headers: { ...headers, 'Idempotency-Key': id }, body: JSON.stringify(body) });
    assert.equal(response.status, 201); const data = await response.json() as { id: string };
    assert.equal((await fetch(`http://127.0.0.1:8787/api/requests/${data.id}/history`, { headers })).status, 403);
    assert.equal((await fetch(`http://127.0.0.1:8787/api/request-commands/${id}`, { headers })).status, 200);
  } finally { server.close(); await once(server, 'close'); }
});

test('dashboard totals cover all pages, match queue filters and enforce audience archives', async () => {
  const created = [];
  for (let i = 0; i < 23; i++) created.push(await run(other, null, { ...body, toolName: `Queue test ${i}` }));
  let claimed = await run(reviewer, created[0].id, { action: 'claim', revision: 1 });
  await run(other, claimed.id, { action: 'archive', audience: 'requester', archived: true, revision: claimed.revision });
  const district = await requestDashboard(s, reviewer);
  assert.equal(district.audience, 'district'); assert.ok(district.counts.all > 20);
  assert.ok(district.counts.assigned > 0);
  for (const actor of [admin, reviewer, staff, viewer, other]) {
    const summary = await requestDashboard(s, actor);
    for (const queue of requestQueues) {
      let cursor: string | undefined; const ids: string[] = [];
      do { const page = await listRequests(s, actor, cursor, queue); ids.push(...page.items.map(r => r.id)); cursor = page.nextCursor || undefined; } while (cursor);
      assert.equal(ids.length, summary.counts[queue]); assert.equal(new Set(ids).size, ids.length);
    }
    if (actor === staff || actor === viewer || actor === other) {
      assert.equal(summary.audience, 'own'); assert.equal(summary.counts.assigned, 0);
      for (const row of summary.attention) { assert.equal((await requestDetail(s, actor, row.id)).own, true); assert.deepEqual(Object.keys(row).sort(), ['id', 'status', 'toolName']); }
    }
  }
  assert.ok((await listRequests(s, other, undefined, 'archived')).items.some(r => r.id === claimed.id));
  assert.ok((await listRequests(s, reviewer, undefined, 'assigned')).items.some(r => r.id === claimed.id));
  await s.db.doc(`${base}/members/${other.uid}`).update({ active: false });
  try { await denied(requestDashboard(s, other), 403); await denied(listRequests(s, other, undefined, 'active'), 403); }
  finally { await s.db.doc(`${base}/members/${other.uid}`).update({ active: true }); }
});

test('dashboard refuses overflow instead of reporting a partial total', async () => {
  const refs = Array.from({ length: 101 }, (_, i) => s.db.doc(`${base}/requests/overflow-${i}`));
  try {
    const batch = s.db.batch(); refs.forEach(ref => batch.set(ref, { toolName: 'Synthetic overflow', purpose: 'Bound check', requestedBy: staff.uid, status: 'pending', archived: false })); await batch.commit();
    await denied(requestDashboard(s, admin), 409);
  } finally { const batch = s.db.batch(); refs.forEach(ref => batch.delete(ref)); await batch.commit(); }
});
