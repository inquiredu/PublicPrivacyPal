import { longSyntheticBundle } from '../fixtures/source-segments.ts';
import { suggestedEvidence } from '../../shared/assistance.ts';
import { ANALYSIS_EXAMPLE } from '../../shared/analysis-example.ts';
import { syntheticBundle } from '../fixtures/source-bundle.ts';
import { processNextAssistance, assistanceDetail } from '../../server/analysis/jobs.ts';
import { exampleTierPolicy } from '../../shared/service-policy.ts';
import { serviceValues } from '../fixtures/service.ts';
import { readReview, readEvaluation } from '../../server/review-storage.ts';
import { measuresFor } from '../../shared/evaluation.ts';
import { commandIdentity, commandStatus } from '../../server/commands.ts';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
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
import { pastedDraft, evidenceEdits } from '../fixtures/pasted-policy.ts';
import { apiServer } from '../../server/http.ts';
import { saveSettings, getSettings } from '../../server/settings.ts';
import { defaultEvaluation, defaultLibrary } from '../../shared/settings.ts';
import { childEnvironment } from '../../scripts/emulator-child.ts';
import { saveBackup, finishRestore } from '../../scripts/backup-operations.ts';
import { verifyBackup } from '../../scripts/backup-files.ts';
import { acquireMaintenance, releaseMaintenance } from '../../server/maintenance.ts';
import { migrateReviews } from '../../server/review-migration.ts';

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
    const settingsActor = identities.admin as DecodedIdToken;
    await saveSettings(s, settingsActor, { section: 'evaluation', revision: 0, values: { ...defaultEvaluation(), state: 'Colorado', tierPolicy: exampleTierPolicy(), districtMission: 'Synthetic recovery mission', evaluationWeights: { ...defaultEvaluation().evaluationWeights, security: 1.5 } } });
    await saveSettings(s, settingsActor, { section: 'library', revision: 0, values: { ...defaultLibrary('Recovery District'), title: 'Recovered practice library', themeColor: '#114488', footerSections: [], defaultViewMode: 'compact' } });
    const actor = identities.reviewer as DecodedIdToken;
    const unicode = '測'.repeat(32000);
    let full = await createReview(s, actor, { name: 'Full rubric recovery', serviceSettingsRevision: 1, sourceKind: 'pasted', sourceLabel: 'Synthetic Unicode policy', sourceText: unicode, rubricMode: 'district', settingsRevision: 1, engineVersion: 'evidence-weighted-v1' });
    let firstEvaluation = '';
    for (const c of measuresFor(full)) {
      full = await reviewAction(s, actor, full.id, { action: 'edit_evidence', revision: full.revision, evidence: { criterionId: c.id, finding: 'partial', citations: [0, 2000, 4000].map(start => ({ start, end: start + 2000, quote: unicode.slice(start, start + 2000) })), rationale: '証'.repeat(1000) } });
      firstEvaluation ||= full.analysis!.id;
    }
    assert.ok(Buffer.byteLength(JSON.stringify(full)) > 1024 * 1024);
    full = await reviewAction(s, actor, full.id, { action: 'edit_service', revision: full.revision, service: { values: serviceValues, rationale: 'Synthetic service facts across recovery.' } });
    full = await reviewAction(s, actor, full.id, { action: 'decide', revision: full.revision, decision: { outcome: 'conditional', rationale: 'Synthetic full rubric recovery.', conditions: 'Fictional demonstration only.', summary: 'Synthetic full rubric recovery.', category: 'Learning' } });
    full = await reviewAction(s, actor, full.id, { action: 'publish', revision: full.revision });
    let review = await createReview(s, actor, { name: 'Recovery Orchard', fixtureId: 'complete' });
    await processNextReview(s); review = await s.db.runTransaction(tx => readReview(s, tx, review.id));
    review = await reviewAction(s, actor, review.id, { action: 'decide', revision: review.revision, decision: { outcome: 'conditional', rationale: 'Private synthetic recovery rationale', conditions: 'Teacher supervision only.', summary: 'Fictional recovery example.', category: 'Learning' } });
    review = await reviewAction(s, actor, review.id, { action: 'publish', revision: review.revision });
    const commandId = randomUUID();
    let pasted = await createReview(s, actor, pastedDraft, false, commandIdentity(commandId, '/api/reviews', pastedDraft));
    for (const evidence of evidenceEdits) pasted = await reviewAction(s, actor, pasted.id, { action: 'edit_evidence', revision: pasted.revision, evidence });
    pasted = await reviewAction(s, actor, pasted.id, { action: 'decide', revision: pasted.revision, decision: { outcome: 'conditional', rationale: 'Private pasted recovery rationale', conditions: 'Synthetic practice only.', summary: 'Fictional pasted recovery policy.', category: 'Learning' } });
    pasted = await reviewAction(s, actor, pasted.id, { action: 'publish', revision: pasted.revision });
    let partial = await createReview(s, actor, { ...pastedDraft, name: 'Partly reviewed across recovery' });
    partial = await reviewAction(s, actor, partial.id, { action: 'edit_evidence', revision: partial.revision, evidence: evidenceEdits[2] });
    let assisted = await createReview(s, actor, { ...pastedDraft, name: 'Recovered suggestions', sourceText: ANALYSIS_EXAMPLE });
    assisted = await reviewAction(s, actor, assisted.id, { action: 'start_assistance', revision: assisted.revision });
    await processNextAssistance(s);
    assert.equal((await assistanceDetail(s, actor, assisted.id))?.status, 'succeeded');
    const proposals=(await assistanceDetail(s,actor,assisted.id))!;
    for(const measureId of ['collection','deletion','security']) {
      const finding=proposals.result!.findings.find(f=>f.measureId===measureId)!;
      const evidence={...suggestedEvidence(finding,proposals.result!)!,proposalId:proposals.id};
      if(measureId==='security') evidence.finding='unresolved';
      if(measureId==='deletion') { evidence.finding='partial'; evidence.context={...evidence.context!,resolution:'resolved',note:'School account deletion is supported with the recorded log-retention exception.',citations:evidence.citations}; }
      assisted=await reviewAction(s,actor,assisted.id,{action:'edit_evidence',revision:assisted.revision,evidence});
    }
    assert.equal(assisted.analysis!.score.total,null);

    const originalSettings = (await getSettings(s, settingsActor)).evaluation;
    const precisionSettings = await saveSettings(s, settingsActor, { section: 'evaluation', revision: originalSettings.revision, values: { ...originalSettings.values, starterProfile: 'pef-precision-v1' } });
    let precision = await createReview(s, actor, { name: 'Precision recovery', sourceKind: 'pasted', sourceLabel: 'Synthetic precision recording', sourceText: ANALYSIS_EXAMPLE, rubricMode: 'district', settingsRevision: precisionSettings.revision, engineVersion: 'evidence-weighted-v1' });
    precision = await reviewAction(s, actor, precision.id, { action: 'start_assistance', revision: precision.revision });
    await processNextAssistance(s);
    const precisionProposals = (await assistanceDetail(s, actor, precision.id))!;
    assert.equal(precisionProposals.result!.schemaVersion, 'policy-suggestions-v3');
    for (const measureId of ['do_003', 'sec_003']) {
      const f = precisionProposals.result!.findings.find(f => f.measureId === measureId)!;
      const evidence = { ...suggestedEvidence(f, precisionProposals.result!)!, proposalId: precisionProposals.id };
      if (measureId === 'sec_003') { evidence.finding = 'unresolved'; evidence.requirements!.requirements[1] = { ...evidence.requirements!.requirements[1], status: 'unavailable', question: 'Supply applicable security terms.', rationale: 'Required security evidence remains unavailable.' }; }
      precision = await reviewAction(s, actor, precision.id, { action: 'edit_evidence', revision: precision.revision, evidence });
    }
    assert.equal(precision.analysis!.schemaVersion, 'findings-v4'); assert.equal(precision.evidenceVersion, 4);
    const sourceBundle = syntheticBundle(); sourceBundle.documents[0].text = ANALYSIS_EXAMPLE; sourceBundle.documents[1].requiredFor = ['sec_003'];
    let bundled = await createReview(s, actor, { name: 'Bounded source recovery', sourceKind: 'bundle', sourceLabel: 'Synthetic school policy and missing addendum', sourceBundle, rubricMode: 'district', settingsRevision: precisionSettings.revision, engineVersion: 'evidence-weighted-v1' });
    const security = precision.analysis!.findings.find(f => f.id === 'sec_003')!;
    bundled = await reviewAction(s, actor, bundled.id, { action: 'edit_evidence', revision: bundled.revision, evidence: { criterionId: security.id, finding: 'unresolved', citations: [{ quote: security.quote, start: security.start, end: security.end }], rationale: 'Retain known evidence across bundle recovery.', requirements: security.requirements } });
    assert.equal(bundled.evidenceVersion, 5); assert.equal(bundled.analysis!.schemaVersion, 'findings-v5');
    await saveSettings(s, settingsActor, { section: 'evaluation', revision: precisionSettings.revision, values: originalSettings.values });

    const longInput = longSyntheticBundle(); longInput.documents[0].text = '測'.repeat(100000) + '\nBackups are retained for seven years after termination.';
    let longReview = await createReview(s, actor, { name: 'Segmented source recovery', sourceKind: 'bundle', sourceLabel: 'Synthetic long Unicode policy', sourceBundle: longInput, profileVersion: 'community-evidence-v1' });
    const lateQuote = 'Backups are retained for seven years after termination.', lateStart = longReview.sourceText.indexOf(lateQuote);
    longReview = await reviewAction(s, actor, longReview.id, { action: 'edit_evidence', revision: longReview.revision, evidence: { criterionId: 'deletion', finding: 'unresolved', citations: [{ quote: lateQuote, start: lateStart, end: lateStart + lateQuote.length }], rationale: 'Late exception and missing addendum survive source parts and recovery.', sourceReview: { version: 'human-source-review-v1', bundleId: longReview.sourceBundle!.id, segmentIds: ['s1'] } } });
    assert.equal(longReview.sourceVersion, 3); assert.equal(longReview.evidenceVersion, 6);

    let pendingAssisted = await createReview(s, actor, { ...pastedDraft, name: 'Queued suggestions across restore', sourceText: ANALYSIS_EXAMPLE });
    pendingAssisted = await reviewAction(s, actor, pendingAssisted.id, { action: 'start_assistance', revision: pendingAssisted.revision });
    const failed = await createReview(s, actor, { name: 'Retry preserved', fixtureId: 'retry' }); await processNextReview(s);
    const pending = await createReview(s, actor, { name: 'Queued across recovery', fixtureId: 'gaps' });
    await s.db.doc(`${base}/requests/recovery-request`).set({ toolName: 'Synthetic request', purpose: 'Recovery rehearsal', requestedBy: identities.staff.uid, archived: false, status: 'pending' });
    // Include a legacy inline record in a mixed-version archive, then establish the exact
    // expected post-migration state. Restore must independently produce the same documents.
    const root = s.db.doc(`${base}/reviews/${review.id}`);
    for (const name of ['sources', 'definitions', 'findings', 'evaluations', 'decisions']) {
      const batch = s.db.batch(); for (const d of (await root.collection(name).get()).docs) batch.delete(d.ref); await batch.commit();
    }
    const { contract: _contract, ...legacy } = review; await root.set(legacy);
    const completed = (await root.collection('history').where('action', '==', 'analysis_completed').get()).docs[0];
    await completed.ref.update({ details: { analysis: review.analysis } });
    const backup = await saveBackup(s); assert.equal(verifyBackup(backup, config).dataSchema, 9);
    const lock = await acquireMaintenance(s, 'Establish synthetic migration expectation');
    await migrateReviews(s, lock); await releaseMaintenance(s, lock);
    writeFileSync(receiptPath, JSON.stringify({ password, identities, commandId, longId: longReview.id, bundleId: bundled.id, precisionId: precision.id, assistedId: assisted.id, pendingAssistedId: pendingAssisted.id, fullId: full.id, firstEvaluation, reviewId: review.id, pastedId: pasted.id, partialId: partial.id, failedId: failed.id, pendingId: pending.id, backup, documents: await allDocuments() }), { mode: 0o600 });
    console.log('Recovery seed saved: synthetic identities, published decision, failed and queued analyses, requests and audit history.');
  } else {
    const receipt = JSON.parse(readFileSync(receiptPath, 'utf8'));
    const manifest = verifyBackup(process.env.PRIVACYPAL_RESTORE!, config);
    await finishRestore(s, manifest);
    assert.deepEqual(await allDocuments(), receipt.documents, 'Every Firestore document must survive exactly, including history, timestamps, quota and projections.');
    const longReview = await s.db.runTransaction(tx => readReview(s, tx, receipt.longId));
    assert.equal(longReview.sourceVersion, 3); assert.equal(longReview.evidenceVersion, 6); assert.equal(longReview.analysis!.schemaVersion, 'findings-v6');
    assert.ok(longReview.sourceText.length > 100000); assert.equal(longReview.analysis!.score.total, null);
    assert.equal(longReview.analysis!.findings.find(f => f.id === 'deletion')!.quote, 'Backups are retained for seven years after termination.');
    assert.deepEqual(longReview.analysis!.findings.find(f => f.id === 'deletion')!.sourceReview!.segmentIds, ['s1']);
    const bundled = await s.db.runTransaction(tx => readReview(s, tx, receipt.bundleId));
    assert.equal(bundled.evidenceVersion, 5); assert.equal(bundled.sourceVersion, 2); assert.equal(bundled.analysis!.schemaVersion, 'findings-v5');
    assert.equal(bundled.sourceBundle!.documents[1].capture, 'missing'); assert.equal(bundled.analysis!.score.total, null);
    assert.equal(bundled.analysis!.findings.find(f => f.id === 'sec_003')!.coverage!.targets[0].ready, false);
    const assistance = await assistanceDetail(s, receipt.identities.reviewer as DecodedIdToken, receipt.assistedId);
    assert.equal(assistance?.status, 'succeeded'); assert.equal(assistance?.result?.findings.length, 8);
    const restoredContext=await s.db.runTransaction(tx=>readReview(s,tx,receipt.assistedId));
    assert.equal(restoredContext.analysis!.schemaVersion,'findings-v3');assert.equal(restoredContext.analysis!.score.total,null);
    const recovered=restoredContext.analysis!.findings;
    assert.equal(recovered.find(f=>f.id==='collection')!.context!.resolution,'retained');
    assert.equal(recovered.find(f=>f.id==='deletion')!.context!.resolvedBy,receipt.identities.reviewer.uid);
    assert.equal(recovered.find(f=>f.id==='security')!.finding,'unresolved');
    assert.equal(recovered.find(f=>f.id==='deletion')!.provenance!.jobId,assistance!.id);
    const precision = await s.db.runTransaction(tx => readReview(s, tx, receipt.precisionId));
    assert.equal(precision.evidenceVersion, 4); assert.equal(precision.analysis!.schemaVersion, 'findings-v4');
    assert.equal(precision.contract!.definitionVersion, 'pef-precision-snapshot-v1'); assert.equal(precision.analysis!.score.total, null);
    const precisionProposals = (await assistanceDetail(s, receipt.identities.reviewer as DecodedIdToken, receipt.precisionId))!;
    assert.equal(precisionProposals.result!.schemaVersion, 'policy-suggestions-v3');
    assert.equal(precision.analysis!.findings.find(f => f.id === 'sec_003')!.requirements!.requirements[1].question, 'Supply applicable security terms.');
    assert.equal(precision.analysis!.findings.find(f => f.id === 'sec_003')!.proposalRequirements!.requirements[1].status, 'established');
    const full = await s.db.runTransaction(tx => readReview(s, tx, receipt.fullId));
    assert.equal(full.published, true); assert.equal(full.analysis?.findings.length, 50); assert.equal(full.analysis?.score.total, 50);
    assert.deepEqual(full.service?.values, serviceValues); assert.equal(full.service?.policy.version, 'local-tier-example-v1'); assert.equal(full.decision?.serviceRevision, full.service?.revision);
    assert.equal(full.contract?.settingsRevision, 1); assert.equal(full.sourceText, '測'.repeat(32000));
    const prior = await s.db.runTransaction(tx => readEvaluation(s, tx, full.id, receipt.firstEvaluation));
    assert.equal(prior.analysis.findings.filter(f => f.reviewedBy).length, 1);
    const pasted = await s.db.runTransaction(tx => readReview(s, tx, receipt.pastedId));
    assert.equal(pasted.analysis?.score.total, 64); assert.equal(pasted.published, true); assert.equal(pasted.analysis?.findings[2].additionalEvidence?.length, 1);
    assert.equal(pasted.analysis?.findings[2].reviewedBy, receipt.identities.reviewer.uid);
    assert.equal((await s.db.doc(`${base}/reviews/${receipt.partialId}`).get()).get('job.status'), 'awaiting_review');
    const commandResult = await commandStatus(s, receipt.identities.reviewer as DecodedIdToken, receipt.commandId);
    assert.equal(commandResult.state, 'applied');
    const replay = await createReview(s, receipt.identities.reviewer as DecodedIdToken, pastedDraft, false, commandIdentity(receipt.commandId, '/api/reviews', pastedDraft));
    assert.equal(replay.id, receipt.pastedId);
    assert.deepEqual(await allDocuments(), receipt.documents, 'Replaying a recovered command must change no document.');
    const recoveredSettings = await getSettings(s, receipt.identities.admin as DecodedIdToken);
    assert.equal(recoveredSettings.evaluation.values.districtMission, 'Synthetic recovery mission');
    assert.equal(recoveredSettings.evaluation.values.evaluationWeights.security, 1.5);
    assert.equal(recoveredSettings.library.values.title, 'Recovered practice library');
    assert.deepEqual(recoveredSettings.library.values.footerSections, []);
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
      assert.equal(await processNextAssistance(s), true);
      assert.equal((await assistanceDetail(s, receipt.identities.reviewer as DecodedIdToken, receipt.pendingAssistedId))?.status, 'succeeded');
      assert.equal(await processNextReview(s), true);
      const pending = await s.db.runTransaction(tx => readReview(s, tx, receipt.pendingId));
      assert.equal(pending.job.status, 'succeeded'); assert.equal(pending.analysis?.score.total, 36);
      assert.equal((await s.db.doc(`${base}/reviews/${receipt.failedId}`).get()).get('job.status'), 'failed');
      const originalManifest = readFileSync(resolve(receipt.backup, 'privacypal-backup.json'), 'utf8');
      const nextBackup = await saveBackup(s); assert.notEqual(nextBackup, receipt.backup);
      assert.equal(verifyBackup(nextBackup, config).dataSchema, 9);
      assert.equal(readFileSync(resolve(receipt.backup, 'privacypal-backup.json'), 'utf8'), originalManifest);
      receipt.backup = nextBackup; receipt.documents = await allDocuments(); writeFileSync(receiptPath, JSON.stringify(receipt), { mode: 0o600 });
    }
    console.log(`Recovery ${process.env.PRIVACYPAL_RECOVERY_PHASE}: exact document comparison, password sign-in, disabled/revoked accounts, role denials and public projections passed.`);
  }
} finally { await s.close(); }
