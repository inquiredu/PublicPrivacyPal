import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { once } from 'node:events';
import { request as httpRequest } from 'node:http';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc, serverTimestamp, query, where } from 'firebase/firestore';
import { loadConfig } from '../../server/config.ts';
import { localServices, type Services } from '../../server/firebase.ts';
import { bootstrap } from '../../server/operations.ts';
import { apiServer } from '../../server/http.ts';
import type { Role } from '../../shared/config.ts';

const config = loadConfig('config/test.example.json');
const base = `districts/${config.districtId}`;
let s: Services;
let env: RulesTestEnvironment;
let server: ReturnType<typeof apiServer>;
let adminUid: string;
let adminToken: string;
const password = randomBytes(20).toString('hex');
const roleList: Role[] = ['admin', 'reviewer', 'viewer', 'staff'];
const identity = (role: string, verified = true) => ({ email: `${role}@school.example`, email_verified: verified });
const dbFor = (role: string, verified = true) => env.authenticatedContext(`rule-${role}`, identity(role, verified)).firestore();
const name = () => crypto.randomUUID();
const toolData = (uid: string) => ({ name: 'Fictional Tool', url: 'https://tool.example', notes: 'Private note', createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: uid });
const requestData = (uid: string) => ({ toolName: 'Example Tool', purpose: 'Synthetic classroom use', requestedBy: uid, status: 'pending', createdAt: serverTimestamp(), archived: false });
async function signin(email: string) {
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-demo-key', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const result = await response.json() as { idToken?: string; error?: unknown };
  assert.ok(response.ok && result.idToken, JSON.stringify(result.error));
  return result.idToken;
}
async function call(path: string, token?: string, body?: unknown, extra: Record<string, string> = {}) {
  const response = await fetch(`http://127.0.0.1:8787${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Origin: 'http://127.0.0.1:5173', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...extra },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, data: await response.json() as Record<string, unknown> };
}
function rawCall(path: string, headers: Record<string, string>, body?: string) {
  return new Promise<number>((resolve, reject) => {
    const request = httpRequest({ hostname: '127.0.0.1', port: 8787, path, method: body === undefined ? 'GET' : 'POST', headers }, response => {
      response.resume(); response.on('end', () => resolve(response.statusCode!));
    });
    request.on('error', reject); request.end(body);
  });
}

before(async () => {
  assert.equal(process.env.GCLOUD_PROJECT, config.projectId, 'Tests must use their dedicated demo project.');
  s = localServices(config);
  env = await initializeTestEnvironment({ projectId: config.projectId, firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
  await env.clearFirestore();
  const clearAuth = await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${config.projectId}/accounts`, { method: 'DELETE' });
  assert.ok(clearAuth.ok);
  adminUid = (await bootstrap(s, password)).uid;
  adminToken = await signin(config.bootstrapAdminEmail);
  server = apiServer(s);
  server.listen(8787, '127.0.0.1');
  await once(server, 'listening');
  for (const role of roleList) {
    await s.db.doc(`${base}/members/rule-${role}`).set({ role, email: `${role}@school.example`, active: true });
  }
  await s.db.doc(`${base}/tools/existing`).set({ name: 'Example', url: '', notes: 'Internal', createdAt: new Date(0), updatedAt: new Date(0), updatedBy: adminUid });
  await s.db.doc(`${base}/requests/staff-request`).set({ toolName: 'Example', purpose: 'Test', requestedBy: 'rule-staff', status: 'pending', archived: false, createdAt: new Date(0) });
  await s.db.doc(`${base}/members/rule-revoked`).set({ role: 'admin', email: 'revoked@school.example', active: false });
  await s.db.doc('districts/other-district/settings/private').set({ secret: 'other district' });
  await s.db.doc('districts/other-district/tools/private').set({ notes: 'another district' });
});
after(async () => {
  if (server) { server.close(); await once(server, 'close'); }
  await env?.cleanup();
  await s?.close();
});

test('operator bootstrap sets a stable district and a protected admin, with minimal public records', async () => {
  const install = await s.db.doc('installation/config').get();
  assert.equal(install.get('bootstrapAdminUid'), adminUid);
  assert.equal(install.get('districtId'), config.districtId);
  assert.equal((await s.db.doc(`${base}/members/${adminUid}`).get()).get('role'), 'admin');
  const samples = await s.db.collection(`publicDistricts/${config.districtId}/tools`).get();
  assert.equal(samples.size, 3);
  for (const sample of samples.docs) assert.deepEqual(Object.keys(sample.data()).sort(), ['category', 'name', 'summary']);
});
test('repeat bootstrap does not reset passwords, memberships, or data', async () => {
  const again = await bootstrap(s, 'a-different-password-for-repeat');
  assert.equal(again.created, false);
  assert.equal(again.uid, adminUid);
  assert.ok(await signin(config.bootstrapAdminEmail));
});
test('changing the configured bootstrap identity cannot take over an initialized project', async () => {
  const altered = { ...s, config: { ...config, bootstrapAdminEmail: 'imposter@school.example' } };
  await assert.rejects(bootstrap(altered, password), /Configuration differs/);
});
test('bootstrap never adopts an identity that registered first', async () => {
  const separate = localServices({ ...config, projectId: 'demo-preclaimed-test' });
  try {
    await separate.auth.createUser({ email: config.bootstrapAdminEmail, password, emailVerified: false });
    await assert.rejects(bootstrap(separate, password), /Refusing to adopt/);
    assert.equal((await separate.db.doc('installation/config').get()).exists, false);
  } finally { await separate.close(); }
});
test('a second district configuration initializes independently with its own identity and samples', async () => {
  const second = localServices(loadConfig('config/second-district.example.json'));
  try {
    const result = await bootstrap(second, password);
    assert.ok(result.created);
    assert.notEqual(result.uid, adminUid);
    assert.equal((await second.db.doc('installation/config').get()).get('districtId'), 'river-valley');
    assert.equal((await second.db.doc(`${base}/members/${adminUid}`).get()).exists, false);
    assert.equal((await second.db.collection('publicDistricts/river-valley/tools').get()).size, 3);
  } finally { await second.close(); }
});

test('anonymous users can read only explicit public records', async () => {
  const db = env.unauthenticatedContext().firestore();
  await assertSucceeds(getDocs(collection(db, `publicDistricts/${config.districtId}/tools`)));
  await assertSucceeds(getDoc(doc(db, `publicDistricts/${config.districtId}`)));
  for (const path of [`${base}/tools/existing`, `${base}/settings/private`, `${base}/members/${adminUid}`, 'installation/config']) {
    await assertFails(getDoc(doc(db, path)));
  }
});

for (const role of roleList) {
  test(`${role}: staff catalogue and own membership readable; unrelated district private data denied`, async () => {
    const db = dbFor(role);
    await assertSucceeds(getDocs(collection(db, `${base}/staffTools`)));
    await assertSucceeds(getDoc(doc(db, `${base}/members/rule-${role}`)));
    await assertFails(getDoc(doc(db, 'districts/other-district/settings/private')));
    await assertFails(getDoc(doc(db, 'districts/other-district/tools/private')));
  });
  test(`${role}: private settings and internal tools follow the role matrix`, async () => {
    const db = dbFor(role);
    await (role === 'admin' ? assertSucceeds : assertFails)(getDoc(doc(db, `${base}/settings/private`)));
    await (role !== 'staff' ? assertSucceeds : assertFails)(getDoc(doc(db, `${base}/tools/existing`)));
    await (role === 'admin' ? assertSucceeds : assertFails)(getDocs(collection(db, `${base}/members`)));
  });
  test(`${role}: public projections and member roles cannot be written directly`, async () => {
    const db = dbFor(role);
    await assertFails(setDoc(doc(db, `publicDistricts/${config.districtId}/tools/${name()}`), { name: 'Poisoned', notes: 'Private' }));
    await assertFails(updateDoc(doc(db, `${base}/members/rule-${role}`), { role: 'admin' }));
    await assertFails(setDoc(doc(db, `${base}/members/forged`), { role: 'admin', active: true, email: 'forged@school.example' }));
    await assertFails(deleteDoc(doc(db, `${base}/members/${adminUid}`)));
  });
  test(`${role}: internal tool editing follows the role matrix`, async () => {
    const db = dbFor(role);
    const write = setDoc(doc(db, `${base}/tools/${name()}`), toolData(`rule-${role}`));
    await (['admin', 'reviewer'].includes(role) ? assertSucceeds : assertFails)(write);
  });
  test(`${role}: cannot bypass request commands with direct writes`, async () => {
    const db = dbFor(role);
    await assertFails(setDoc(doc(db, `${base}/requests/${name()}`), requestData(`rule-${role}`)));
    await assertFails(setDoc(doc(db, `${base}/requests/${name()}`), { ...requestData(`rule-${role}`), status: 'approved' }));
    await assertFails(setDoc(doc(db, `${base}/requests/${name()}`), { ...requestData(`rule-${role}`), history: [{ actor: adminUid }] }));
  });
}
for (const role of ['outsider', 'revoked']) test(`${role}: knowing a district or having the same email domain grants no private access`, async () => {
  const db = dbFor(role);
  for (const path of [`${base}/settings/private`, `${base}/tools/existing`, `${base}/staffTools/reading-garden`]) await assertFails(getDoc(doc(db, path)));
  await assertFails(setDoc(doc(db, `${base}/requests/${name()}`), { ...requestData(`rule-${role}`), requesterDomain: 'school.example' }));
  await assertFails(setDoc(doc(db, 'orgRegistry/school.example'), { ownerId: `rule-${role}` }));
});
test('unverified identities cannot use memberships', async () => {
  const db = dbFor('admin', false);
  await assertFails(getDoc(doc(db, `${base}/settings/private`)));
  await assertFails(setDoc(doc(db, `${base}/tools/${name()}`), toolData('rule-admin')));
});
test('email changes invalidate old membership instead of inheriting its role', async () => {
  const db = env.authenticatedContext('rule-admin', { email: 'different@school.example', email_verified: true }).firestore();
  await assertFails(getDoc(doc(db, `${base}/settings/private`)));
});
test('legacy invitation acceptance cannot grant or escalate a role', async () => {
  const db = dbFor('staff');
  await assertFails(setDoc(doc(db, `users/${adminUid}/contributors/staff@school.example`), { status: 'accepted', permission: 'lead' }));
});
test('requester identity and timestamps cannot be forged', async () => {
  const db = dbFor('staff');
  await assertFails(setDoc(doc(db, `${base}/requests/${name()}`), requestData(adminUid)));
  await assertFails(setDoc(doc(db, `${base}/requests/${name()}`), { ...requestData('rule-staff'), createdAt: new Date(0) }));
  await assertFails(setDoc(doc(db, `${base}/requests/${name()}`), { ...requestData('rule-staff'), toolName: '' }));
});
test('staff request reads and archives require the API', async () => {
  const db = dbFor('staff');
  await assertFails(getDocs(query(collection(db, `${base}/requests`), where('requestedBy', '==', 'rule-staff'))));
  await assertFails(getDocs(collection(db, `${base}/requests`)));
  await assertFails(updateDoc(doc(db, `${base}/requests/staff-request`), { archived: true }));
  await assertFails(updateDoc(doc(db, `${base}/requests/staff-request`), { status: 'approved' }));
  await assertFails(updateDoc(doc(db, `${base}/requests/staff-request`), { archived: 'yes' }));
  await assertFails(updateDoc(doc(dbFor('viewer'), `${base}/requests/staff-request`), { archived: false }));
});
test('reviewers cannot bypass server request commands', async () => {
  const db = dbFor('reviewer');
  await assertFails(getDocs(collection(db, `${base}/requests`)));
  await assertFails(updateDoc(doc(db, `${base}/requests/staff-request`), { status: 'approved' }));
});
test('reviewers cannot add public fields or forge record authorship', async () => {
  const db = dbFor('reviewer');
  await assertFails(setDoc(doc(db, `${base}/tools/${name()}`), { ...toolData('rule-reviewer'), isPublished: true }));
  await assertFails(setDoc(doc(db, `${base}/tools/${name()}`), toolData(adminUid)));
  await assertFails(updateDoc(doc(db, `${base}/tools/existing`), { createdAt: serverTimestamp(), updatedAt: serverTimestamp(), updatedBy: 'rule-reviewer' }));
  await assertFails(setDoc(doc(db, `${base}/audit/${name()}`), { actorUid: adminUid, action: 'approved' }));
});

test('HTTP has no public bootstrap endpoint or unauthenticated member access', async () => {
  assert.equal((await call('/api/bootstrap', undefined, {})).status, 404);
  assert.equal((await call('/api/members')).status, 401);
  assert.equal((await call('/api/me', 'invented-token')).status, 401);
  assert.equal((await call('/api/members', adminToken, undefined, { Origin: 'https://foreign.example' })).status, 403);
  assert.equal(await rawCall('/api/members', { Host: 'foreign.example', Authorization: `Bearer ${adminToken}` }), 403);
  const publicData = (await call('/api/config')).data;
  assert.equal(publicData.bootstrapAdminEmail, undefined);
  assert.equal(publicData.projectId, config.projectId);
});
test('API mutation requires local Origin, valid bounded JSON, and the expected media type', async () => {
  const headers = { Authorization: `Bearer ${adminToken}`, Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' };
  assert.equal(await rawCall('/api/members', { Authorization: headers.Authorization, 'Content-Type': 'application/json' }, '{}'), 403);
  assert.equal(await rawCall('/api/members', { ...headers, 'Content-Type': 'text/plain' }, '{}'), 415);
  assert.equal(await rawCall('/api/members', headers, '{invalid'), 400);
  assert.equal(await rawCall('/api/members', headers, JSON.stringify({ huge: 'x'.repeat(9000) })), 413);
});
test('server membership changes are admin-only, validated, audited, and immediately revocable', async () => {
  const account = await s.auth.createUser({ email: 'colleague@school.example', emailVerified: true, password });
  const token = await signin('colleague@school.example');
  assert.equal((await call('/api/me', token)).status, 403);
  assert.equal((await call('/api/members', token, { email: 'colleague@school.example', role: 'admin', active: true })).status, 403);
  assert.equal((await call('/api/members', adminToken, { email: 'colleague@school.example', role: 'reviewer', active: true, uid: adminUid })).status, 400);
  assert.equal((await call('/api/members', adminToken, { email: 'colleague@school.example', role: 'reviewer', active: true })).status, 200);
  assert.equal((await call('/api/me', token)).data.role, 'reviewer');
  assert.equal((await call('/api/members', token)).status, 403);
  assert.equal((await call('/api/members', token, { email: 'colleague@school.example', role: 'admin', active: true })).status, 403);
  assert.equal((await call('/api/members', adminToken, { email: 'colleague@school.example', role: 'admin', active: true })).status, 200);
  assert.equal((await call('/api/members', token, { email: config.bootstrapAdminEmail, role: 'staff', active: false })).status, 403);
  assert.equal((await call('/api/members', token, { email: 'colleague@school.example', role: 'staff', active: false })).status, 403);
  assert.equal((await call('/api/members', adminToken, { email: 'colleague@school.example', role: 'admin', active: false })).status, 200);
  assert.equal((await call('/api/me', token)).status, 403);
  assert.equal((await call('/api/members', token, { email: 'colleague@school.example', role: 'admin', active: true })).status, 403);
  const ctx = env.authenticatedContext(account.uid, { email: account.email, email_verified: true }).firestore();
  await assertFails(getDoc(doc(ctx, `${base}/settings/private`)));
  const events = await s.db.collection(`${base}/audit`).where('targetUid', '==', account.uid).get();
  assert.equal(events.size, 3);
  for (const event of events.docs) assert.equal(event.get('actorUid'), adminUid);
});
test('server rejects unverified and outside-domain identities even with a valid token', async () => {
  for (const [email, emailVerified] of [['unverified@school.example', false], ['outsider@different.example', true]] as const) {
    await s.auth.createUser({ email, emailVerified, password });
    const token = await signin(email);
    assert.equal((await call('/api/me', token)).status, 403);
    assert.notEqual((await call('/api/members', adminToken, { email, role: 'admin', active: true })).status, 200);
  }
});
test('server rejects disabled users with previously issued tokens', async () => {
  const user = await s.auth.createUser({ email: 'disabled@school.example', emailVerified: true, password });
  const token = await signin('disabled@school.example');
  await s.auth.updateUser(user.uid, { disabled: true });
  assert.equal((await call('/api/me', token)).status, 401);
});
