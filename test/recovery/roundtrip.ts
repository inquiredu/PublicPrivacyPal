import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { once } from 'node:events';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { CollectionReference } from 'firebase-admin/firestore';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { loadConfig } from '../../server/config.ts';
import { localServices } from '../../server/firebase.ts';
import { bootstrap } from '../../server/operations.ts';
import { createReview, reviewAction, processNextReview } from '../../server/reviews.ts';
import type { Review } from '../../shared/review.ts';
import { apiServer } from '../../server/http.ts';
import { childEnvironment } from '../../scripts/emulator-child.ts';
import { saveBackup, finishRestore } from '../../scripts/backup-operations.ts';
import { verifyBackup } from '../../scripts/backup-files.ts';

const config = loadConfig('config/test.example.json'); childEnvironment(config); delete process.env.FIREBASE_CONFIG;
assert.equal(process.env.PRIVACYPAL_CONFIG, 'config/test.example.json');
const directory = process.env.PRIVACYPAL_RECOVERY_TEST!;
assert.ok(directory && directory.includes('/.local/recovery-tests/'));
const receiptPath = resolve(directory, 'receipt.json');
const s = localServices(config); const base = `districts/${config.districtId}`;
async function allDocuments() {
  const result: Record<string, unknown> = {};
  async function scan(collection: CollectionReference) {
    for (const ref of await collection.listDocuments()) {
      const doc = await ref.get(); if (doc.exists && doc.ref.path !== 'installation/maintenance') result[doc.ref.path] = doc.data();
      for (const child of await ref.listCollections()) await scan(child);
    }
  }
  for (const collection of await s.db.listCollections()) await scan(collection);
  return JSON.parse(JSON.stringify(result)); // Firestore timestamps retain their exact seconds/nanos.
}
async function signIn(email: string, password: string) {
  const res = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-demo-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
  return { status: res.status, body: await res.json() as { idToken: string; localId: string } };
}
try {
  if (process.env.PRIVACYPAL_RECOVERY_PHASE === 'seed') {
    const password = randomBytes(24).toString('base64url');
    const admin = await bootstrap(s, password); assert.ok(admin.created);
    const identities: Record<string, { uid: string; email: string }> = { admin: { uid: admin.uid, email: config.bootstrapAdminEmail } };
    for (const role of ['reviewer', 'viewer', 'staff', 'revoked', 'disabled']) {
      const email = `${role}@school.example`;
      const user = await s.auth.createUser({ email, password, emailVerified: true, disabled: role === 'disabled' }); identities[role] = { uid: user.uid, email };
      await s.db.doc(`${base}/members/${user.uid}`).set({ email, role: role === 'disabled' || role === 'revoked' ? 'reviewer' : role, active: role !== 'revoked' });
    }
    const actor = identities.reviewer as DecodedIdToken;
    let review = await createReview(s, actor, { name: 'Recovery Orchard', fixtureId: 'complete' });
    await processNextReview(s); review = (await s.db.doc(`${base}/reviews/${review.id}`).get()).data() as Review;
    review = await reviewAction(s, actor, review.id, { action: 'decide', revision: review.revision, decision: { outcome: 'conditional', rationale: 'Private synthetic recovery rationale', conditions: 'Teacher supervision only.', summary: 'Fictional recovery example.', category: 'Learning' } });
    review = await reviewAction(s, actor, review.id, { action: 'publish', revision: review.revision });
    const failed = await createReview(s, actor, { name: 'Retry preserved', fixtureId: 'retry' }); await processNextReview(s);
    const pending = await createReview(s, actor, { name: 'Queued across recovery', fixtureId: 'gaps' });
    await s.db.doc(`${base}/requests/recovery-request`).set({ toolName: 'Synthetic request', purpose: 'Recovery rehearsal', requestedBy: identities.staff.uid, archived: false, status: 'pending' });
    const backup = await saveBackup(s); verifyBackup(backup, config);
    writeFileSync(receiptPath, JSON.stringify({ password, identities, reviewId: review.id, failedId: failed.id, pendingId: pending.id, backup, documents: await allDocuments() }), { mode: 0o600 });
    console.log('Recovery seed saved: synthetic identities, published decision, failed and queued analyses, requests and audit history.');
  } else {
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    const manifest = verifyBackup(process.env.PRIVACYPAL_RESTORE!, config);
    await finishRestore(s, manifest);
    assert.deepEqual(await allDocuments(), receipt.documents, 'Every Firestore document must survive exactly, including history, timestamps, quota and projections.');
    assert.equal((await bootstrap(s, 'must-not-change-password')).created, false);
    const users = await s.auth.listUsers(); assert.equal(users.users.length, Object.keys(receipt.identities).length);
    const server = apiServer(s); server.listen(8787, '127.0.0.1'); await once(server, 'listening');
    const rules = await initializeTestEnvironment({ projectId: config.projectId, firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
    try {
      for (const role of ['admin', 'reviewer', 'viewer', 'staff', 'revoked', 'disabled']) {
        const identity = receipt.identities[role]; const login = await signIn(identity.email, receipt.password);
        assert.equal(login.status, role === 'disabled' ? 400 : 200);
        if (role === 'disabled') continue;
        assert.equal(login.body.localId, identity.uid);
        const headers = { Authorization: `Bearer ${login.body.idToken}`, Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json' };
        const list = await fetch('http://127.0.0.1:8787/api/reviews', { headers });
        assert.equal(list.status, ['admin', 'reviewer', 'viewer'].includes(role) ? 200 : 403);
        if (!['admin', 'reviewer'].includes(role)) {
          const edit = await fetch('http://127.0.0.1:8787/api/reviews', { method: 'POST', headers, body: JSON.stringify({ name: 'Forbidden restore write', fixtureId: 'complete' }) }); assert.equal(edit.status, 403);
        }
        const db = rules.authenticatedContext(identity.uid, { email: identity.email, email_verified: true }).firestore();
        await assertFails(updateDoc(doc(db, `${base}/reviews/${receipt.reviewId}`), { published: false }));
      }
      const db = rules.unauthenticatedContext().firestore();
      const publicDoc = await assertSucceeds(getDoc(doc(db, `publicDistricts/${config.districtId}/tools/review-${receipt.reviewId}`)));
      assert.equal(publicDoc.data()?.conditions, 'Teacher supervision only.'); assert.equal(publicDoc.data()?.rationale, undefined);
      await assertFails(getDoc(doc(db, `${base}/reviews/${receipt.reviewId}`)));
      await assertFails(getDoc(doc(db, 'installation/maintenance')));
    } finally { await rules.cleanup(); server.close(); await once(server, 'close'); }
    if (process.env.PRIVACYPAL_RECOVERY_PHASE === 'restore') {
      assert.equal(await processNextReview(s), true);
      const pending = (await s.db.doc(`${base}/reviews/${receipt.pendingId}`).get()).data() as Review;
      assert.equal(pending.job.status, 'succeeded'); assert.equal(pending.analysis?.score.total, 36);
      assert.equal((await s.db.doc(`${base}/reviews/${receipt.failedId}`).get()).get('job.status'), 'failed');
      const originalManifest = readFileSync(resolve(receipt.backup, 'privacypal-backup.json'), 'utf8');
      const nextBackup = await saveBackup(s); assert.notEqual(nextBackup, receipt.backup);
      assert.equal(readFileSync(resolve(receipt.backup, 'privacypal-backup.json'), 'utf8'), originalManifest);
      receipt.backup = nextBackup; receipt.documents = await allDocuments(); writeFileSync(receiptPath, JSON.stringify(receipt), { mode: 0o600 });
    }
    console.log(`Recovery ${process.env.PRIVACYPAL_RECOVERY_PHASE}: exact document comparison, password sign-in, disabled/revoked accounts, role denials and public projections passed.`);
  }
} finally { await s.close(); }
