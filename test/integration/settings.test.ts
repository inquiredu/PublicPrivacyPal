import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { initializeTestEnvironment, assertFails, assertSucceeds, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { loadConfig } from '../../server/config.ts';
import { localServices, type Services } from '../../server/firebase.ts';
import { bootstrap } from '../../server/operations.ts';
import { apiServer } from '../../server/http.ts';
import { acquireMaintenance, releaseMaintenance } from '../../server/maintenance.ts';
import { defaultEvaluation, defaultLibrary } from '../../shared/settings.ts';

const config = loadConfig('config/test.example.json'); const base = `districts/${config.districtId}`;
const pass = randomBytes(24).toString('hex'); const tokens: Record<string, string> = {}; const uids: Record<string, string> = {};
let s: Services; let env: RulesTestEnvironment; let server: ReturnType<typeof apiServer>;
const evaluation = () => ({ ...defaultEvaluation(), state: 'Colorado', districtMission: 'PRIVATE synthetic mission', customEvaluationContext: 'PRIVATE synthetic guidance' });
const library = () => ({ ...defaultLibrary('Maple Example District'), title: 'Synthetic Library', contactEmail: 'privacy@school.example' });
async function call(role = 'admin', body?: unknown, headers = {}) {
  const response = await fetch('http://127.0.0.1:8787/api/settings', { method: body === undefined ? 'GET' : 'POST', headers: { Connection: 'close', Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json', ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}), ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}
async function save(section: 'evaluation' | 'library', values: unknown, role = 'admin') {
  const revision = (await call()).data[section].revision;
  return call(role, { section, revision, values });
}
async function state() {
  return { settings: (await call()).data, public: (await s.db.doc(`publicDistricts/${config.districtId}`).get()).data(), audit: (await s.db.collection(`${base}/audit`).get()).docs.map(d => d.data()), versions: await Promise.all(['evaluation', 'library'].map(async k => (await s.db.collection(`${base}/settings/${k}/versions`).get()).docs.map(d => d.data()))) };
}
before(async () => {
  s = localServices(config); env = await initializeTestEnvironment({ projectId: config.projectId, firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
  await env.clearFirestore(); assert.ok((await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${config.projectId}/accounts`, { method: 'DELETE' })).ok);
  await bootstrap(s, pass);
  for (const role of ['admin', 'admin2', 'reviewer', 'viewer', 'staff', 'nonmember', 'foreign']) {
    const email = `${role}-settings@school.example`; const user = await s.auth.createUser({ email, password: pass, emailVerified: true }); uids[role] = user.uid;
    if (role !== 'nonmember') await s.db.doc(`${role === 'foreign' ? 'districts/foreign' : base}/members/${user.uid}`).set({ email, role: role === 'admin2' || role === 'foreign' ? 'admin' : role, active: true });
    const res = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-demo-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pass, returnSecureToken: true }) });
    tokens[role] = (await res.json() as { idToken: string }).idToken;
  }
  await s.db.doc('districts/foreign/settings/evaluation').set({ secret: 'Another district' });
  server = apiServer(s); server.listen(8787, '127.0.0.1'); await once(server, 'listening');
});
after(async () => { if (server) { server.close(); await once(server, 'close'); } await env?.cleanup(); await s?.close(); });
test('existing installations get unsaved defaults without writes or completing setup', async () => {
  const out = await call(); assert.equal(out.status, 200); assert.equal(out.data.evaluation.complete, false); assert.equal(out.data.evaluation.revision, 0);
  assert.equal((await s.db.doc(`${base}/settings/evaluation`).get()).exists, false);
  assert.equal((await s.db.doc(`${base}/settings/private`).get()).get('internalNote'), 'Synthetic installation settings. Visible only to administrators.');
});
test('a first setup save failure cannot mark setup complete or leave partial settings', async () => {
  const original = s.db.runTransaction;
  s.db.runTransaction = ((fn: Parameters<typeof original>[0]) => original.call(s.db, async tx => {
    const create = tx.create.bind(tx);
    tx.create = ((ref: FirebaseFirestore.DocumentReference, data: FirebaseFirestore.DocumentData) => {
      if (ref.path === `${base}/settings/evaluation/versions/1`) throw new Error('Synthetic initial settings failure');
      return create(ref, data);
    }) as typeof tx.create;
    return fn(tx);
  })) as typeof original;
  try { assert.equal((await save('evaluation', evaluation())).status, 503); } finally { s.db.runTransaction = original; }
  assert.equal((await call()).data.evaluation.complete, false);
  assert.equal((await s.db.doc(`${base}/settings/evaluation`).get()).exists, false);
  assert.equal((await s.db.collection(`${base}/audit`).where('action', '==', 'evaluation_settings_saved').get()).size, 0);
});
for (const role of ['anonymous', 'nonmember', 'foreign', 'staff', 'viewer', 'reviewer', 'admin']) test(`${role}: settings access is enforced by the API and Firestore rules`, async () => {
  const allowed = role === 'admin'; const denied = role === 'anonymous' ? 401 : 403;
  assert.equal((await call(role)).status, allowed ? 200 : denied);
  for (const section of ['evaluation', 'library'] as const) assert.equal((await save(section, section === 'evaluation' ? evaluation() : library(), role)).status, allowed ? 200 : denied);
  const db = role === 'anonymous' ? env.unauthenticatedContext().firestore() : env.authenticatedContext(uids[role], { email: `${role}-settings@school.example`, email_verified: true }).firestore();
  for (const path of [`${base}/settings/evaluation`, `${base}/settings/library`, `${base}/settings/evaluation/versions/1`]) {
    await (allowed ? assertSucceeds : assertFails)(getDoc(doc(db, path))); await assertFails(setDoc(doc(db, path), { complete: true, revision: 99 }));
  }
  await (role === 'foreign' ? assertSucceeds : assertFails)(getDoc(doc(db, 'districts/foreign/settings/evaluation')));
  await assertFails(updateDoc(doc(db, `publicDistricts/${config.districtId}`), { librarySettings: library() }));
});
test('versioned settings record authenticated authority and expose only the library allowlist', async () => {
  const e = await save('evaluation', evaluation()); const l = await save('library', library());
  assert.equal(e.status, 200); assert.equal(l.status, 200); assert.equal(e.data.updatedBy, uids.admin); assert.match(e.data.contentHash, /^[a-f0-9]{64}$/);
  assert.deepEqual((await s.db.doc(`${base}/settings/evaluation/versions/${e.data.revision}`).get()).data(), e.data);
  const pub = (await assertSucceeds(getDoc(doc(env.unauthenticatedContext().firestore(), `publicDistricts/${config.districtId}`)))).data()!;
  assert.deepEqual(pub.librarySettings, library()); assert.ok(!JSON.stringify(pub).includes('PRIVATE')); assert.ok(!JSON.stringify(pub).includes(uids.admin));
  assert.equal(pub.libraryRevision, l.data.revision); assert.equal(pub.name, config.districtName);
  const history = (await s.db.collection(`${base}/audit`).where('action', '==', 'evaluation_settings_saved').get()).docs;
  assert.ok(history.some(d => d.get('actorUid') === uids.admin && d.get('revision') === e.data.revision));
});
test('forged fields, invalid weights, invalid images and oversized commands make no changes', async () => {
  const before = await state(); const revision = before.settings.library.revision;
  const valid = { section: 'library', revision, values: library() };
  for (const body of [{ ...valid, actorUid: 'forged' }, { ...valid, districtId: 'foreign' }, { ...valid, values: { ...library(), secret: 'leak' } }, { ...valid, values: { ...library(), logo: 'https://logo.example/x.png' } }, { ...valid, values: { ...library(), logo: 'data:image/png;base64,YWJj' } }, { section: 'evaluation', revision: before.settings.evaluation.revision, values: { ...evaluation(), evaluationWeights: {} } }]) assert.equal((await call('admin', body)).status, 400);
  assert.equal((await call('admin', { ...valid, padding: 'x'.repeat(200000) })).status, 413);
  assert.equal((await call('admin', valid, { Origin: 'https://foreign.example' })).status, 403);
  assert.equal((await call('admin', valid, { Origin: '' })).status, 403);
  assert.deepEqual(await state(), before);
});
test('concurrent edits to the same section conflict; separate sections save independently', async () => {
  const old = (await call()).data; const revision = old.evaluation.revision;
  const outputs = await Promise.all(['First mission', 'Second mission'].map((districtMission, i) => call(i ? 'admin2' : 'admin', { section: 'evaluation', revision, values: { ...evaluation(), districtMission } })));
  assert.deepEqual(outputs.map(o => o.status).sort(), [200, 409]);
  const winner = outputs.find(o => o.status === 200)!.data;
  assert.equal((await call()).data.evaluation.values.districtMission, winner.values.districtMission);
  const results = await Promise.all([call('admin', { section: 'evaluation', revision: winner.revision, values: evaluation() }), call('admin2', { section: 'library', revision: old.library.revision, values: library() })]);
  assert.ok(results.every(r => r.status === 200));
});
test('failed projection writes cannot save settings, history, or report successful setup', async () => {
  const before = await state(); const original = s.db.runTransaction;
  s.db.runTransaction = ((fn: Parameters<typeof original>[0]) => original.call(s.db, async tx => {
    const write = tx.set.bind(tx);
    tx.set = ((ref: FirebaseFirestore.DocumentReference, ...args: unknown[]) => { if (ref.path === `publicDistricts/${config.districtId}`) throw new Error('Synthetic public settings failure'); return (write as Function)(ref, ...args); }) as typeof tx.set;
    return fn(tx);
  })) as typeof original;
  try { assert.equal((await save('library', { ...library(), title: 'Must not be saved' })).status, 503); } finally { s.db.runTransaction = original; }
  assert.deepEqual(await state(), before);
});
test('revocation during a settings transaction, disabled accounts and maintenance prevent saves', async () => {
  const before = await state(); const original = s.db.runTransaction;
  s.db.runTransaction = (async (...args: Parameters<typeof original>) => {
    s.db.runTransaction = original;
    await s.db.doc(`${base}/members/${uids.admin}`).update({ active: false });
    return original.apply(s.db, args);
  }) as typeof original;
  try { assert.equal((await call('admin', { section: 'evaluation', revision: before.settings.evaluation.revision, values: evaluation() })).status, 403); }
  finally { s.db.runTransaction = original; await s.db.doc(`${base}/members/${uids.admin}`).update({ active: true }); }
  await s.auth.updateUser(uids.admin, { disabled: true });
  try { assert.equal((await call()).status, 401); } finally { await s.auth.updateUser(uids.admin, { disabled: false }); }
  const lock = await acquireMaintenance(s, 'Settings test');
  try { assert.equal((await save('evaluation', evaluation())).status, 503); assert.equal((await save('library', library())).status, 503); }
  finally { await releaseMaintenance(s, lock); }
  assert.deepEqual(await state(), before);
});
test('settings persist across API restart, preserve explicit empty footers, and never alter reviews', async () => {
  await s.db.doc(`${base}/reviews/existing`).set({ profileVersion: 'community-evidence-v1', analysis: { score: 64 }, published: true });
  await save('evaluation', { ...evaluation(), starterProfile: 'none', evaluationWeights: {} });
  await save('library', { ...library(), footerSections: [] }); const before = await state();
  server.close(); await once(server, 'close'); server = apiServer(s); server.listen(8787, '127.0.0.1'); await once(server, 'listening');
  assert.deepEqual(await state(), before); assert.deepEqual((await call()).data.library.values.footerSections, []);
  assert.deepEqual((await s.db.doc(`${base}/reviews/existing`).get()).data(), { profileVersion: 'community-evidence-v1', analysis: { score: 64 }, published: true });
});
