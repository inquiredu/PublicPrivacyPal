import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { loadConfig } from '../../server/config.ts';
import { localServices, type Services } from '../../server/firebase.ts';
import { bootstrap } from '../../server/operations.ts';
import { apiServer } from '../../server/http.ts';
import { processNextSegmentedRun } from '../../server/analysis/segmented-jobs.ts';
import { segmentedExampleCapture, type SegmentedRunView, type SegmentedProposalView } from '../../shared/segmented-assistance.ts';
import type { Review } from '../../shared/review.ts';

const config = loadConfig('config/test.example.json');
const base = `districts/${config.districtId}`;
const password = randomBytes(24).toString('hex');
let s: Services; let env: RulesTestEnvironment; let server: ReturnType<typeof apiServer>;
const tokens: Record<string, string> = {}; const uids: Record<string, string> = {};
async function call(path: string, body?: unknown, role = 'reviewer', id = randomUUID()) {
  const response = await fetch(`http://127.0.0.1:8787/api/${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Connection: 'close', Origin: 'http://127.0.0.1:5173', 'Content-Type': 'application/json', 'Idempotency-Key': id, ...(tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, data: await response.json() };
}
const action = (review: Review, action: string, fields: Record<string, unknown> = {}, commandId = randomUUID()) => call(`reviews/${review.id}`, { action, revision: review.revision, ...fields }, 'reviewer', commandId);
const getReview = async (id: string): Promise<Review> => { const response = await call(`reviews/${id}`); assert.equal(response.status, 200, JSON.stringify(response.data)); return response.data; };
const getRun = async (review: Review): Promise<SegmentedRunView> => { const response = await call(`reviews/${review.id}/segmented-runs/${review.segmentedRunId}`); assert.equal(response.status, 200, JSON.stringify(response.data)); return response.data; };
const proposal = async (review: Review, measureId = 'sale', outcomeId?: string): Promise<SegmentedProposalView> => { const run = await getRun(review); const response = await call(`reviews/${review.id}/segmented-runs/${run.run.id}/proposals/${outcomeId || run.run.currentOutcomeId}/${measureId}`); assert.equal(response.status, 200, JSON.stringify(response.data)); return response.data; };
async function create() { const response = await call('reviews', segmentedExampleCapture()); assert.equal(response.status, 201, JSON.stringify(response.data)); return response.data as Review; }
async function started() { const review = await create(); const response = await action(review, 'start_segmented_run'); assert.equal(response.status, 200, JSON.stringify(response.data)); return response.data as Review; }
async function attempt(review: Review, scope: { kind: 'segment'; segmentId: string } | { kind: 'synthesis' }) {
  const run = await getRun(review);
  const response = await action(review, 'run_segmented_attempt', { runId: run.run.id, runRevision: run.run.revision, scope });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  assert.equal(response.data.revision, review.revision, 'attempt commands never advance human review revision');
  assert.equal(await processNextSegmentedRun(s), true);
}
async function completed() {
  const review = await started(); const run = await getRun(review);
  for (const segment of run.segments) await attempt(review, { kind: 'segment', segmentId: segment.id });
  await attempt(review, { kind: 'synthesis' });
  const saved = await getReview(review.id);
  assert.equal(saved.analysis, null); assert.equal(saved.decision, null); assert.equal(saved.published, false);
  assert.equal(saved.revision, review.revision);
  return saved;
}
before(async () => {
  s = localServices(config);
  env = await initializeTestEnvironment({ projectId: config.projectId, firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
  await env.clearFirestore();
  assert.ok((await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${config.projectId}/accounts`, { method: 'DELETE' })).ok);
  await bootstrap(s, password);
  for (const role of ['admin', 'reviewer', 'viewer', 'staff', 'nonmember']) {
    const email = `segmented-${role}@school.example`;
    const user = await s.auth.createUser({ email, password, emailVerified: true }); uids[role] = user.uid;
    if (role !== 'nonmember') await s.db.doc(`${base}/members/${user.uid}`).set({ email, role, active: true });
    const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-demo-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }) });
    tokens[role] = (await response.json() as { idToken: string }).idToken;
  }
  server = apiServer(s); server.listen(8787, '127.0.0.1'); await once(server, 'listening');
});
after(async () => { if (server) { server.close(); await once(server, 'close'); } await env?.cleanup(); await s?.close(); });

test('one completed result supports sequential explicit handoffs on unchanged measures', async () => {
  let review = await completed(); const original = await proposal(review);
  assert.equal(original.eligible, true); assert.ok(original.seed);
  assert.equal(original.seed.finding, 'unresolved'); assert.deepEqual(original.seed.citations, []); assert.deepEqual(original.seed.sourceReview?.segmentIds, []);
  const response = await action(review, 'edit_evidence', { evidence: original.seed });
  assert.equal(response.status, 200, JSON.stringify(response.data)); review = response.data;
  assert.equal(review.evidenceVersion, 7); assert.equal(review.analysis!.schemaVersion, 'findings-v7'); assert.equal(review.analysis!.adapterVersion, 'human-evidence-v6'); assert.equal(review.analysis!.score.total, null);
  assert.deepEqual(review.analysis!.findings.find(f => f.id === 'sale')!.segmentedProvenance?.reference, original.reference);
  const second = await proposal(review, 'collection'); assert.equal(second.eligible, true, second.reason); assert.ok(second.seed);
  const next = await action(review, 'edit_evidence', { evidence: second.seed }); assert.equal(next.status, 200, JSON.stringify(next.data));
  assert.equal(next.data.analysis.findings.filter((f: any) => f.segmentedProvenance).length, 2);
  assert.equal(next.data.analysis.score.total, null);
  assert.equal((await s.db.doc(`publicDistricts/${config.districtId}/tools/review-${review.id}`).get()).exists, false);
});

test('queueing a retry fences an unsaved proposal but historical correction retains its exact original', async () => {
  let review = await completed(); const original = await proposal(review);
  const save = await action(review, 'edit_evidence', { evidence: original.seed }); assert.equal(save.status, 200, JSON.stringify(save.data)); review = save.data;
  const other = await proposal(review, 'collection'); const run = await getRun(review);
  const retry = await action(review, 'run_segmented_attempt', { runId: run.run.id, runRevision: run.run.revision, scope: { kind: 'segment', segmentId: run.segments[0].id } });
  // A stale run may reject new dispatch before queueing; cancellation must still disable new handoffs.
  if (retry.status !== 200) { assert.equal(retry.status, 409); const cancel = await action(review, 'cancel_segmented_run', { runId: run.run.id, runRevision: run.run.revision }); assert.equal(cancel.status, 200, JSON.stringify(cancel.data)); review = cancel.data; }
  const staleSave = await action(review, 'edit_evidence', { evidence: other.seed }); assert.equal(staleSave.status, 409, JSON.stringify(staleSave.data));
  const corrected = await action(review, 'edit_evidence', { evidence: { ...original.seed, rationale: 'Human correction keeps the original historical suggestion.' } });
  assert.equal(corrected.status, 200, JSON.stringify(corrected.data));
  assert.deepEqual(corrected.data.analysis.findings.find((f: any) => f.id === 'sale').segmentedProvenance.reference, original.reference);
  if (retry.status === 200) await processNextSegmentedRun(s);
});

test('late synthesis after a human save remains historical and cannot overwrite evidence', async () => {
  let review = await started(); const run = await getRun(review);
  for (const segment of run.segments) await attempt(review, { kind: 'segment', segmentId: segment.id });
  const before = await getRun(review);
  const queued = await action(review, 'run_segmented_attempt', { runId: before.run.id, runRevision: before.run.revision, scope: { kind: 'synthesis' } }); assert.equal(queued.status, 200, JSON.stringify(queued.data));
  const human = await action(review, 'edit_evidence', { evidence: { criterionId: 'sale', finding: 'unresolved', citations: [], rationale: 'Human work saved while the recording was queued.' } }); assert.equal(human.status, 200, JSON.stringify(human.data)); review = human.data;
  const original = structuredClone(review.analysis);
  assert.equal(await processNextSegmentedRun(s), true);
  const after = await getReview(review.id); assert.deepEqual(after.analysis, original); assert.equal(after.revision, review.revision);
  const final = await getRun(review); assert.ok(final.attempts.items.some(a => a.scope.kind === 'synthesis' && !a.eligibleAtCompletion));
  assert.equal(final.measures.some(m => m.eligible), false);
});

test('forged or cross-review segmented references cannot acquire authority', async () => {
  const review = await completed(); const original = await proposal(review); const other = await create();
  const forged = await action(other, 'edit_evidence', { evidence: original.seed }); assert.ok([400, 404, 409].includes(forged.status), JSON.stringify(forged.data));
  for (const segmentedProposal of [{ ...original.reference, measureId: 'collection' }, { ...original.reference, targetIds: ['sale', 'sale'] }, { ...original.reference, outcomeId: 'f'.repeat(64) }]) {
    const response = await action(review, 'edit_evidence', { evidence: { ...original.seed, segmentedProposal } }); assert.ok([400, 404, 409].includes(response.status), JSON.stringify(response.data));
  }
  const missing = await action(review, 'edit_evidence', { evidence: { ...original.seed, context: undefined } }); assert.equal(missing.status, 400, JSON.stringify(missing.data));
});

test('actor-scoped receipts preserve the original attempt effect and replay current human state', async () => {
  let review = await started(); const run = await getRun(review); const id = randomUUID();
  const body = { action: 'run_segmented_attempt', revision: review.revision, runId: run.run.id, runRevision: run.run.revision, scope: { kind: 'segment', segmentId: run.segments[0].id } };
  const sent = await call(`reviews/${review.id}`, body, 'reviewer', id); assert.equal(sent.status, 200, JSON.stringify(sent.data));
  const receipt = await call(`commands/${id}`); assert.equal(receipt.status, 200); assert.equal(receipt.data.state, 'applied'); assert.ok(receipt.data.segmented.attemptId);
  const saved = await action(review, 'edit_evidence', { evidence: { criterionId: 'sale', finding: 'unresolved', citations: [], rationale: 'Later human state must win over receipt replay.' } }); assert.equal(saved.status, 200); review = saved.data;
  const replay = await call(`reviews/${review.id}`, body, 'reviewer', id); assert.equal(replay.status, 200); assert.equal(replay.data.revision, review.revision); assert.deepEqual(replay.data.analysis, review.analysis);
  assert.deepEqual((await call(`commands/${id}`)).data.segmented, receipt.data.segmented);
  assert.equal((await getRun(review)).run.attemptCount, 1);
  assert.equal((await call(`commands/${id}`, undefined, 'admin')).data.state, 'not_found');
  assert.equal((await call(`reviews/${review.id}`, { ...body, runRevision: body.runRevision + 1 }, 'reviewer', id)).status, 409);
  await processNextSegmentedRun(s);
});

test('segmented read/write boundaries cover every audience and direct Firestore access', async () => {
  const review = await completed(); const run = await getRun(review); const attemptId = run.attempts.items[0].id;
  const paths = [`reviews/${review.id}/segmented-runs`, `reviews/${review.id}/segmented-runs/${run.run.id}`, `reviews/${review.id}/segmented-runs/${run.run.id}/attempts/${attemptId}`];
  for (const role of ['anonymous', 'nonmember', 'staff', 'viewer', 'reviewer', 'admin']) {
    const canRead = ['viewer', 'reviewer', 'admin'].includes(role);
    for (const path of paths) assert.equal((await call(path, undefined, role)).status, canRead ? 200 : role === 'anonymous' ? 401 : 403);
    const db = role === 'anonymous' ? env.unauthenticatedContext().firestore() : env.authenticatedContext(uids[role], { email: `segmented-${role}@school.example`, email_verified: true }).firestore();
    for (const path of [`${base}/reviews/${review.id}/segmentedRuns/${run.run.id}`, `${base}/reviews/${review.id}/segmentedRuns/${run.run.id}/attempts/${attemptId}`]) { await assertFails(getDoc(doc(db, path))); await assertFails(setDoc(doc(db, path), { forged: true })); }
    if (!['reviewer', 'admin'].includes(role)) assert.equal((await call(`reviews/${review.id}`, { action: 'start_segmented_run', revision: review.revision }, role)).status, role === 'anonymous' ? 401 : 403);
  }
});

test('an explicitly queued retry immediately disables an untouched old draft', async () => {
  const review = await completed(); const original = await proposal(review); const run = await getRun(review);
  const response = await action(review, 'run_segmented_attempt', { runId: run.run.id, runRevision: run.run.revision, scope: { kind: 'segment', segmentId: run.segments[0].id } });
  assert.equal(response.status, 200, JSON.stringify(response.data));
  const historical = await proposal(review, 'sale', original.reference.outcomeId); assert.equal(historical.current, false); assert.equal(historical.eligible, false); assert.equal(historical.seed, null);
  assert.deepEqual(historical.reference, original.reference);
  const stale = await action(review, 'edit_evidence', { evidence: original.seed }); assert.equal(stale.status, 409, JSON.stringify(stale.data));
  assert.equal((await getReview(review.id)).analysis, null);
  assert.equal(await processNextSegmentedRun(s), true);
});

test('a late return during correction preserves an older run’s human attribution and private state', async () => {
  let review = await completed(); const original = await proposal(review);
  let response = await action(review, 'edit_evidence', { evidence: original.seed }); assert.equal(response.status, 200, JSON.stringify(response.data)); review = response.data;
  const first = await getRun(review);
  response = await action(review, 'cancel_segmented_run', { runId: first.run.id, runRevision: first.run.revision }); assert.equal(response.status, 200); review = response.data;
  response = await action(review, 'start_segmented_run'); assert.equal(response.status, 200, JSON.stringify(response.data)); review = response.data;
  const second = await getRun(review);
  response = await action(review, 'run_segmented_attempt', { runId: second.run.id, runRevision: second.run.revision, scope: { kind: 'segment', segmentId: second.segments[0].id } }); assert.equal(response.status, 200);
  let human: Review | undefined;
  const { generateSegmentedRecording } = await import('../../server/analysis/segmented-recording.ts');
  assert.equal(await processNextSegmentedRun(s, { transport: async (input, signal) => {
    const result = await generateSegmentedRecording(input, signal);
    const saved = await action(review, 'edit_evidence', { evidence: { ...original.seed, rationale: 'Human correction saved after dispatch; original proposal attribution stays intact.' } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data)); human = saved.data;
    return result;
  } }), true);
  assert.ok(human); const after = await getReview(review.id); assert.deepEqual(after, human);
  assert.deepEqual(after.analysis!.findings.find(f => f.id === 'sale')!.segmentedProvenance?.reference, original.reference);
  const final = await getRun(after); const retained = final.attempts.items.at(-1)!;
  assert.ok(retained.outputId, 'Original late output remains inspectable'); assert.equal(retained.eligibleAtCompletion, false);
  assert.equal(final.run.currentOutcomeId, null); assert.equal(after.published, false);
});
