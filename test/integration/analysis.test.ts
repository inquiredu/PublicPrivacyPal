import { longSyntheticBundle } from '../fixtures/source-segments.ts';
import { sourceSegments } from '../../shared/source-segments.ts';
import { inspectSegmentArchive } from '../../server/analysis/segments.ts';
import { before, after, test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { ANALYSIS_EXAMPLE } from '../../shared/analysis-example.ts';
import { suggestedEvidence } from '../../shared/assistance.ts';
import { processNextAssistance } from '../../server/analysis/jobs.ts';
import { buildAnalysisRequest, LEGACY_PROMPT_VERSION } from '../../server/analysis/contract.ts';
import { digest } from '../../server/evaluation.ts';
import { offlineProvider } from '../../server/analysis/offline.ts';
import { ProviderFailure, zeroUsage, type AnalysisProvider } from '../../server/analysis/provider.ts';
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
import { reviewedCount, currentAnalysis, type Review } from '../../shared/review.ts';
import { pastedDraft, evidenceEdits } from '../fixtures/pasted-policy.ts';
import { serviceValues } from '../fixtures/service.ts';
import { acquireMaintenance, releaseMaintenance } from '../../server/maintenance.ts';
import { syntheticBundle } from '../fixtures/source-bundle.ts';
const config = loadConfig('config/test.example.json'); const base = `districts/${config.districtId}`;
let s: Services; let env: RulesTestEnvironment; let server: ReturnType<typeof apiServer>;
const tokens: Record<string,string> = {}; const uids: Record<string,string> = {}; const password = randomBytes(24).toString('hex');
async function call(path:string, role='reviewer', body?:unknown, id=randomUUID()) {
  const res=await fetch(`http://127.0.0.1:8787/api${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Origin:'http://127.0.0.1:5173', Connection:'close', 'Content-Type':'application/json', 'Idempotency-Key':id, ...(tokens[role] ? { Authorization:`Bearer ${tokens[role]}` } : {}) }, ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
  return {status:res.status,data:await res.json()};
}
const get=(id:string)=>s.db.runTransaction(tx=>readReview(s,tx,id));
before(async()=>{
  s=localServices(config);env=await initializeTestEnvironment({projectId:config.projectId,firestore:{host:'127.0.0.1',port:8080,rules:readFileSync('firestore.rules','utf8')}});await env.clearFirestore();await fetch(`http://127.0.0.1:9099/emulator/v1/projects/${config.projectId}/accounts`,{method:'DELETE'});await bootstrap(s,password);
  for(const role of ['admin','reviewer','viewer','staff','nonmember']){const email=`service-${role}@school.example`;const u=await s.auth.createUser({email,password,emailVerified:true});uids[role]=u.uid;if(role!=='nonmember')await s.db.doc(`${base}/members/${u.uid}`).set({email,role,active:true});const res=await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=local-demo-key',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true})});tokens[role]=(await res.json() as {idToken:string}).idToken;}
  server=apiServer(s);server.listen(8787,'127.0.0.1');await once(server,'listening');
  const out=await call('/settings','admin',{section:'evaluation',revision:0,values:{...defaultEvaluation(),state:'Colorado',tierPolicy:exampleTierPolicy()}});assert.equal(out.status,200);
});
after(async()=>{server?.close();await once(server,'close');await env?.cleanup();await s?.close();});
async function create() { const out = await call('/reviews', 'reviewer', { ...pastedDraft, name: 'Cedar Intelligence Lab', sourceText: ANALYSIS_EXAMPLE }); assert.equal(out.status, 201); return out.data as Review; }
async function act(r: Review, action: string, extra = {}, role = 'reviewer', id = randomUUID()) { return call(`/reviews/${r.id}`, role, { action, revision: r.revision, ...extra }, id); }
async function queued() { const r = await create(); const out = await act(r, 'start_assistance'); assert.equal(out.status, 200, JSON.stringify(out.data)); return out.data as Review; }
const detail = async (r: Review) => (await call(`/reviews/${r.id}/assistance`)).data;
const jobRef = (r: Review) => s.db.doc(`${base}/assistanceJobs/${r.assistanceId}`);

const longDraft = () => ({ name: 'Long synthetic policy', sourceKind: 'bundle', sourceLabel: 'Synthetic segmented capture', sourceBundle: longSyntheticBundle(), profileVersion: 'community-evidence-v1' });
test('long source capture atomically stores bounded parts, frozen plans and replayable receipts', async () => {
  const draft = longDraft(), command = randomUUID();
  const created = await call('/reviews', 'reviewer', draft, command); assert.equal(created.status, 201, JSON.stringify(created.data));
  const r: Review = created.data; assert.equal(r.sourceVersion, 3); assert.equal(r.evidenceVersion, 6); assert.equal(r.analysis, null);
  assert.equal((await call('/reviews', 'reviewer', draft, command)).data.id, r.id);
  assert.deepEqual(await get(r.id), r);
  const root = s.db.doc(`${base}/reviews/${r.id}`), stored = await root.collection('sources').doc(r.sourceHash!).get();
  const parts = (await root.collection('sourceParts').get()).docs;
  assert.ok(parts.length > 4); assert.equal(stored.get('version'), 3); assert.equal(stored.get('manifest.documents')[0].text, undefined);
  assert.ok(parts.every(p => Buffer.byteLength(JSON.stringify(p.data())) < 128 * 1024));
  assert.ok(Buffer.byteLength(JSON.stringify(stored.data())) < 128 * 1024);
  const preview = await call(`/reviews/${r.id}/prompt`); assert.equal(preview.status, 200); assert.equal(preview.data.format, 'privacypal-segment-review-v1');
  assert.ok(inspectSegmentArchive(preview.data).ledger.every(s => s.state === 'pending'));
  assert.equal((await act(r, 'start_assistance')).status, 409);
  for (const role of ['anonymous','nonmember','staff','viewer','reviewer','admin']) {
    const read = ['viewer','reviewer','admin'].includes(role), write = ['reviewer','admin'].includes(role), denied = role === 'anonymous' ? 401 : 403;
    assert.equal((await call('/reviews', role, draft)).status, write ? 201 : denied);
    assert.equal((await call(`/reviews/${r.id}/prompt`, role)).status, read ? 200 : denied);
    const db = role === 'anonymous' ? env.unauthenticatedContext().firestore() : env.authenticatedContext(uids[role], { email: `service-${role}@school.example`, email_verified: true }).firestore();
    await assertFails(getDoc(doc(db, parts[0].ref.path))); await assertFails(setDoc(doc(db, parts[0].ref.path), { text: 'forged' }));
  }
  const exported = await call(`/reviews/${r.id}/export`); assert.equal(exported.data.format, 'privacypal-source-bundle-v2');
  assert.equal((await call('/reviews/import','reviewer',exported.data)).status,400);
  const first = parts[0], saved = first.data(); await first.ref.delete(); assert.notEqual((await call(`/reviews/${r.id}`)).status, 200);
  await first.ref.set(saved); assert.deepEqual(await get(r.id), r);
  await first.ref.update({ text: saved.text + 'changed' }); assert.notEqual((await call(`/reviews/${r.id}`)).status, 200); await first.ref.set(saved);
});
test('long capture and range acknowledgments preserve failed transaction, maintenance and publication guarantees', async () => {
  const draft = longDraft(); Object.assign(draft.sourceBundle.documents[1], { capture: 'complete', text: 'Complete synthetic backup addendum.' });
  const original = s.db.runTransaction, before = (await s.db.collection(`${base}/reviews`).get()).size, key = randomUUID();
  s.db.runTransaction = ((fn: Parameters<typeof original>[0]) => original.call(s.db, async tx => { const create = tx.create.bind(tx); tx.create = ((ref: FirebaseFirestore.DocumentReference, data: any) => { if (ref.path.includes('/sourceParts/')) throw new Error('Synthetic source-part write failure'); return create(ref,data); }) as typeof tx.create; return fn(tx); })) as typeof original;
  try { assert.equal((await call('/reviews','reviewer',draft,key)).status,503); } finally { s.db.runTransaction=original; }
  assert.equal((await s.db.collection(`${base}/reviews`).get()).size,before);
  let r: Review = (await call('/reviews','reviewer',draft,key)).data;
  const sourceReview = { version: 'human-source-review-v1', bundleId: r.sourceBundle!.id, segmentIds: sourceSegments(r.sourceBundle!).map(s=>s.id) };
  const evidence = { criterionId:'deletion', finding:'not_specified',citations:[],rationale:'Synthetic complete-source manual review.' };
  assert.equal((await act(r,'edit_evidence',{evidence})).status,400);
  assert.equal((await act(r,'edit_evidence',{evidence:{...evidence,sourceReview:{...sourceReview,segmentIds:sourceReview.segmentIds.slice(0,-1)}}})).status,400);
  assert.equal((await act(r,'edit_evidence',{evidence:{...evidence,sourceReview:{...sourceReview,bundleId:'0'.repeat(64)}}})).status,400);
  const lock=await acquireMaintenance(s,'Synthetic segmented capture fencing');
  try { assert.equal((await call('/reviews','reviewer',draft)).status,503); assert.equal((await act(r,'edit_evidence',{evidence:{...evidence,sourceReview}})).status,503); } finally { await releaseMaintenance(s,lock); }
  for (const criterion of r.contract!.criteria) {
    const required = sourceSegments(r.sourceBundle!).filter(s=>s.documentId==='policy'||criterion.id==='deletion').map(s=>s.id);
    const out=await act(r,'edit_evidence',{evidence:{...evidence,criterionId:criterion.id,sourceReview:{...sourceReview,segmentIds:required}}}); assert.equal(out.status,200,JSON.stringify(out.data)); r=out.data;
  }
  assert.equal(r.analysis!.schemaVersion,'findings-v6'); assert.equal(r.analysis!.score.total,0);
  r=(await act(r,'decide',{decision:{outcome:'conditional',rationale:'Synthetic testing',summary:'Synthetic segmented example',category:'Learning',conditions:'Test only'}})).data;
  r=(await act(r,'publish')).data; assert.equal(r.published,true);
  const publicPath=`publicDistricts/${config.districtId}/tools/review-${r.id}`, staffPath=`${base}/staffTools/review-${r.id}`;
  for (const path of [publicPath,staffPath]) { const data=(await s.db.doc(path).get()).data()!; assert.ok(data); assert.equal(JSON.stringify(data).includes('segmentIds'),false); }
  const correction=await act(r,'edit_evidence',{evidence:{...evidence,finding:'unresolved',sourceReview:{...sourceReview,segmentIds:['s1']}}}); assert.equal(correction.status,200); r=correction.data;
  assert.equal(r.analysis!.score.total,null); assert.deepEqual(r.analysis!.findings.find(f=>f.id==='deletion')!.sourceReview!.segmentIds,['s1']);
  assert.deepEqual(await get(r.id),r);
  for (const path of [publicPath,staffPath]) assert.equal((await s.db.doc(path).get()).exists,false);
  assert.equal((await act(r,'publish')).status,409);
});
test('legacy capture retains its raw HTTP budget including whitespace', async () => {
  const res = await fetch('http://127.0.0.1:8787/api/reviews', { method: 'POST', headers: { Origin: 'http://127.0.0.1:5173', Connection: 'close', 'Content-Type': 'application/json', 'Idempotency-Key': randomUUID(), Authorization: `Bearer ${tokens.reviewer}` }, body: ' '.repeat(131072) + JSON.stringify(pastedDraft) });
  assert.equal(res.status, 413);
});
test('maximum Unicode long capture fits HTTP, source-part, detail and preview budgets without truncation',async()=>{
  const draft=longDraft(); draft.sourceBundle.documents[0].text='測'.repeat(128000);
  const out=await call('/reviews','reviewer',draft); assert.equal(out.status,201,JSON.stringify(out.data));
  const restored=await get(out.data.id);assert.equal(restored.sourceText,draft.sourceBundle.documents[0].text);
  const preview=await call(`/reviews/${restored.id}/prompt`);assert.equal(preview.status,200);assert.ok(preview.data.requests.every((r:any)=>Buffer.byteLength(JSON.stringify(r))<=256*1024));
  const tooLong=longDraft();tooLong.sourceBundle.documents[0].text='x'.repeat(128001);assert.equal((await call('/reviews','reviewer',tooLong)).status,400);
  assert.equal((await call('/reviews','reviewer',{...draft,padding:'x'.repeat(512*1024)})).status,413);
});

const bundleDraft = () => ({ name: 'Synthetic bounded bundle', sourceKind: 'bundle', sourceLabel: 'School policy and required backup terms', sourceBundle: syntheticBundle(), profileVersion: 'community-evidence-v1' });
test('bundle capture is private, bounded, replayable and immutable with per-document source identity', async () => {
  const draft = bundleDraft(), key = randomUUID();
  for (const role of ['staff', 'viewer', 'nonmember', 'anonymous']) assert.equal((await call('/reviews', role, draft)).status, role === 'anonymous' ? 401 : 403);
  const created = await call('/reviews', 'reviewer', draft, key); assert.equal(created.status, 201, JSON.stringify(created.data));
  const r: Review = created.data;
  assert.equal((await call('/reviews', 'reviewer', draft, key)).data.id, r.id);
  assert.equal((await call('/reviews', 'reviewer', { ...draft, name: 'Changed content' }, key)).status, 409);
  const head = await s.db.doc(`${base}/reviews/${r.id}`).get(); assert.equal(head.get('evidenceVersion'), 5); assert.equal(head.get('sourceBundle'), undefined);
  const source = await s.db.doc(`${base}/reviews/${r.id}/sources/${r.sourceHash}`).get(); assert.equal(source.get('version'), 2); assert.equal(source.get('text'), undefined);
  assert.equal(source.get('bundle.id'), r.sourceHash); assert.deepEqual(await get(r.id), r);
  for (const role of ['admin', 'reviewer', 'viewer']) {
    assert.equal((await call(`/reviews/${r.id}`, role)).status, 200);
    const db = env.authenticatedContext(uids[role], { email: `service-${role}@school.example`, email_verified: true }).firestore();
    await assertFails(getDoc(doc(db, source.ref.path)));
    await assertFails(setDoc(doc(db, source.ref.path), { version: 1, text: 'forged' }));
  }
  for (const role of ['staff', 'nonmember', 'anonymous']) assert.equal((await call(`/reviews/${r.id}`, role)).status, role === 'anonymous' ? 401 : 403);
  assert.equal((await act(r, 'start_assistance')).status, 409);
  const prompt = await call(`/reviews/${r.id}/prompt`); assert.equal(prompt.status, 200); assert.equal(prompt.data.promptVersion, 'evidence-extraction-v4'); assert.equal(prompt.data.sourceHash, r.sourceBundle!.id);
  assert.equal(prompt.data.coverage.targets.find((t: any) => t.target === 'deletion').ready, false);
  assert.ok(prompt.data.segments.every((segment: any) => segment.state === 'pending'));
  const exported = await call(`/reviews/${r.id}/export`); assert.equal(exported.status, 200); assert.equal(exported.data.format, 'privacypal-source-bundle-v1'); assert.deepEqual(exported.data.sourceBundle, r.sourceBundle);
  assert.equal((await call('/reviews/import', 'reviewer', exported.data)).status, 400);
});
test('human bundle coverage cannot be bypassed by omission, scope, context resolution or forged metadata', async () => {
  let r: Review = (await call('/reviews', 'reviewer', bundleDraft())).data;
  const evidence = { criterionId: 'deletion', finding: 'not_specified', citations: [], rationale: 'Missing addendum is not silence.' };
  assert.equal((await act(r, 'edit_evidence', { evidence })).status, 400);
  assert.equal((await act(r, 'edit_evidence', { evidence: { ...evidence, context: { scope: 'School', uncertainty: 'missing_source', question: 'Where is the annex?', resolution: 'resolved', note: 'Claimed resolved without capture.', citations: [] } } })).status, 400);
  assert.equal((await act(r, 'edit_evidence', { evidence: { ...evidence, coverage: { ready: true } } })).status, 400);
  const saved = await act(r, 'edit_evidence', { evidence: { ...evidence, finding: 'unresolved' } }); assert.equal(saved.status, 200, JSON.stringify(saved.data)); r = saved.data;
  assert.equal(r.analysis!.schemaVersion, 'findings-v5'); assert.equal(r.analysis!.score.total, null);
  assert.deepEqual(r.analysis!.findings.find(f => f.id === 'deletion')!.coverage!.targets[0].missing, ['addendum']);
  assert.equal((await act(r, 'publish')).status, 409); assert.equal((await act(r, 'decide', { decision: { outcome: 'approved', rationale: 'Synthetic', summary: 'Synthetic', category: 'Learning', conditions: '' } })).status, 409);
  assert.equal((await s.db.doc(`publicDistricts/${config.districtId}/tools/review-${r.id}`).get()).exists, false);
});
test('complete bundle evidence supports a separate decision, and correction withdraws both actual projections', async () => {
  const draft = bundleDraft(); Object.assign(draft.sourceBundle.documents[1], { capture: 'complete', text: 'Backups are deleted after thirty days.' });
  let r: Review = (await call('/reviews', 'reviewer', draft)).data;
  for (const c of r.contract!.criteria) {
    const saved = await act(r, 'edit_evidence', { evidence: { criterionId: c.id, finding: 'not_specified', citations: [], rationale: 'Synthetic omission review across both complete documents.' } });
    assert.equal(saved.status, 200, JSON.stringify(saved.data)); r = saved.data;
  }
  assert.equal(r.analysis!.score.total, 0);
  r = (await act(r, 'decide', { decision: { outcome: 'conditional', rationale: 'Synthetic demonstration', summary: 'Synthetic bundle example', category: 'Learning', conditions: 'Test only' } })).data;
  const published = await act(r, 'publish'); assert.equal(published.status, 200); r = published.data;
  const publicPath = `publicDistricts/${config.districtId}/tools/review-${r.id}`, staffPath = `${base}/staffTools/review-${r.id}`;
  for (const path of [publicPath, staffPath]) { const snap = await s.db.doc(path).get(); assert.equal(snap.exists, true); assert.equal(JSON.stringify(snap.data()).includes('rawHash'), false); }
  const saved = await act(r, 'edit_evidence', { evidence: { criterionId: 'deletion', finding: 'unresolved', citations: [], rationale: 'Synthetic unresolved interpretation.' } }); assert.equal(saved.status, 200); r = saved.data;
  assert.equal(r.analysis!.score.total, null);
  for (const path of [publicPath, staffPath]) assert.equal((await s.db.doc(path).get()).exists, false);
});
test('bundle source changes fail read integrity and a failed capture transaction leaves no receipt or partial records', async () => {
  const r: Review = (await call('/reviews', 'reviewer', bundleDraft())).data;
  const source = s.db.doc(`${base}/reviews/${r.id}/sources/${r.sourceHash}`), saved = (await source.get()).data()!;
  await source.update({ 'bundle.scope.accounts': 'Changed after capture' });
  assert.notEqual((await call(`/reviews/${r.id}`)).status, 200);
  await source.set(saved); assert.deepEqual(await get(r.id), r);
  const original = s.db.runTransaction, key = randomUUID(), before = (await s.db.collection(`${base}/reviews`).get()).size;
  s.db.runTransaction = ((fn: Parameters<typeof original>[0]) => original.call(s.db, async tx => {
    const create = tx.create.bind(tx); tx.create = ((ref: FirebaseFirestore.DocumentReference, data: any) => { if (ref.path.includes('/sources/')) throw new Error('Synthetic capture failure'); return create(ref, data); }) as typeof tx.create; return fn(tx);
  })) as typeof original;
  try { assert.equal((await call('/reviews', 'reviewer', bundleDraft(), key)).status, 503); } finally { s.db.runTransaction = original; }
  assert.equal((await s.db.collection(`${base}/reviews`).get()).size, before);
  assert.equal((await call('/reviews', 'reviewer', bundleDraft(), key)).status, 201);
});

test('idempotent suggestion requests, private cache and explicit human saves remain separate', async () => {
  let r = await create(); const original = structuredClone(r); const id = randomUUID();
  const first = await act(r, 'start_assistance', {}, 'reviewer', id); assert.equal(first.status, 200);
  const retry = await act(r, 'start_assistance', {}, 'reviewer', id); assert.equal(retry.status, 200); assert.equal(first.data.assistanceId, retry.data.assistanceId);
  r = first.data; assert.equal((await act(r, 'start_assistance')).status, 409);
  assert.equal(await processNextAssistance(s), true);
  const ready = await detail(r); assert.equal(ready.status, 'succeeded'); assert.equal(ready.result.findings.length, 8);
  assert.deepEqual((await get(r.id)).analysis, original.analysis); assert.deepEqual((await get(r.id)).decision, original.decision);
  const cache = await act(r, 'start_assistance'); assert.equal(cache.status, 200); r = cache.data;
  assert.equal((await detail(r)).reused, true); assert.equal(await processNextAssistance(s), false);
  assert.equal((await s.db.collection(`${base}/reviews/${r.id}/suggestions`).get()).size, 1);
  const deletion = ready.result.findings.find((f: { measureId: string }) => f.measureId === 'deletion');
  const edited = await act(r, 'edit_evidence', { evidence: { ...suggestedEvidence(deletion, ready.result), proposalId: ready.id } }); assert.equal(edited.status, 200);
  assert.equal(edited.data.analysis.findings.filter((f: { reviewedBy?: string }) => f.reviewedBy).length, 1);
  assert.equal(edited.data.analysis.findings.find((f: { id: string }) => f.id === 'deletion').reviewedBy, uids.reviewer);
  assert.equal(edited.data.published, false);
  const prompt = (await call(`/reviews/${r.id}/prompt`)).data;
  assert.equal(prompt.measures.length, 8); assert.equal(JSON.stringify(prompt).includes(uids.reviewer), false);
});
test('arbitrary pasted source and excessive requests fail before any dispatch', async () => {
  const out = await call('/reviews', 'reviewer', pastedDraft); assert.equal(out.status, 201);
  assert.equal((await act(out.data, 'start_assistance')).status, 409);
  const r = await create(); await s.db.doc(`${base}/reviews/${r.id}`).update({ assistanceCount: 20 });
  assert.equal((await act(r, 'start_assistance')).status, 429);
});
test('the adopted district rubric receives all 50 suggestions without automatic evidence approval', async () => {
  const created = await call('/reviews', 'reviewer', { name: 'Full rubric suggestions', sourceKind: 'pasted', sourceLabel: 'Synthetic school terms', sourceText: ANALYSIS_EXAMPLE, rubricMode: 'district', settingsRevision: 1, engineVersion: 'evidence-weighted-v1' });
  assert.equal(created.status, 201); const started = await act(created.data, 'start_assistance'); assert.equal(started.status, 200);
  await processNextAssistance(s); const result = await detail(started.data);
  assert.equal(result.status, 'succeeded'); assert.equal(result.result.findings.length, 50);
  assert.equal(result.result.findings.find((f: { measureId: string }) => f.measureId === 'do_003').state, 'partial');
  assert.equal((await get(created.data.id)).analysis?.findings.filter(f => f.reviewedBy).length || 0, 0);
  assert.equal((await act(started.data, 'publish')).status, 409);
});
test('failed job transaction leaves no job, head or command receipt behind', async () => {
  const r = await create(); const before = await get(r.id); const count = (await s.db.collection(`${base}/assistanceJobs`).get()).size;
  const original = s.db.runTransaction;
  s.db.runTransaction = ((fn: Parameters<typeof original>[0]) => original.call(s.db, async tx => {
    const create = tx.create.bind(tx); tx.create = ((ref: FirebaseFirestore.DocumentReference, data: any) => {
      if (ref.path.includes('/assistanceJobs/')) throw new Error('Synthetic suggestion write failure'); return create(ref, data);
    }) as typeof tx.create; return fn(tx);
  })) as typeof original;
  try { assert.equal((await act(r, 'start_assistance')).status, 503); } finally { s.db.runTransaction = original; }
  assert.deepEqual(await get(r.id), before); assert.equal((await s.db.collection(`${base}/assistanceJobs`).get()).size, count);
});
test('late suggestions cannot replace a newer human correction', async () => {
  const r = await queued(); let release!: () => void; let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }); const called = new Promise<void>(resolve => { entered = resolve; });
  const p = { ...offlineProvider, async generate(...args: Parameters<AnalysisProvider['generate']>) { entered(); await gate; return offlineProvider.generate(...args); } };
  const worker = processNextAssistance(s, p); await called;
  const edit = await act(r, 'edit_evidence', { evidence: { criterionId: 'sale', finding: 'not_specified', citations: [], rationale: 'Human draft for a deliberate race test.' } }); assert.equal(edit.status, 200);
  release(); await worker; assert.equal((await detail(r)).status, 'stale'); assert.equal((await detail(r)).result, null);
  assert.deepEqual((await get(r.id)).analysis, edit.data.analysis);
});
test('renewable leases prevent a second worker from dispatching a slow request', async () => {
  const r = await queued(); let calls = 0; let entered!: () => void; let release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; }); const gate = new Promise<void>(resolve => { release = resolve; });
  const p = { ...offlineProvider, async generate(...args: Parameters<AnalysisProvider['generate']>) { calls++; entered(); await gate; return offlineProvider.generate(...args); } };
  const worker = processNextAssistance(s, p, { leaseMs: 300, timeoutMs: 5000 }); await started; await delay(700);
  assert.equal(await processNextAssistance(s, p, { leaseMs: 300 }), false); release(); await worker;
  assert.equal(calls, 1); assert.equal((await detail(r)).status, 'succeeded');
});
for (const status of ['refused', 'incomplete', 'invalid'] as const) test(`${status} output creates no accepted suggestion`, async () => {
  const r = await queued(); const p: AnalysisProvider = { ...offlineProvider, async generate() { return status === 'invalid' ? { status: 'completed', output: {}, requestId: 'bad', usage: zeroUsage } : { status, requestId: 'no', usage: zeroUsage }; } };
  await processNextAssistance(s, p); assert.equal((await detail(r)).status, 'failed'); assert.equal((await detail(r)).result, null);
});
test('a dispatched uncertain request is reconciled rather than blindly sent again', async () => {
  const r = await queued(); let calls = 0;
  const p: AnalysisProvider = { ...offlineProvider, offline: false, async generate() { calls++; throw new ProviderFailure('unknown', 'Simulated interrupted transport'); } };
  await processNextAssistance(s, p); assert.equal((await detail(r)).status, 'unknown');
  assert.equal((await act(r, 'start_assistance')).status, 409);
  await jobRef(r).update({ leaseUntil: 0 }); await processNextAssistance(s, p); assert.equal(calls, 1);
  await jobRef(r).update({ leaseUntil: 0 });
  await processNextAssistance(s, { ...p, async reconcile(id) { return { status: 'refused', requestId: id, usage: zeroUsage }; } });
  assert.equal((await detail(r)).status, 'failed'); assert.equal((await jobRef(r).get()).get('settled'), true);
});
test('deadline abort and queued cancellation retain a visible unambiguous state', async () => {
  let r = await queued(); let cancelled = await act(r, 'cancel_assistance'); assert.equal(cancelled.status, 200);
  assert.equal((await detail(r)).status, 'cancelled'); assert.equal(await processNextAssistance(s), false);
  r = await queued(); await processNextAssistance(s, { ...offlineProvider, generate: async () => new Promise(() => {}) }, { timeoutMs: 1000 });
  assert.equal((await detail(r)).status, 'unknown');
  await jobRef(r).update({ leaseUntil: 0 }); await processNextAssistance(s); assert.equal((await detail(r)).status, 'succeeded');
});

test('malformed source is rejected at the HTTP ingestion boundary before any review is saved', async () => {
  for (const sourceText of ['\ud800\nPolicy', '\udc00', 'Terms\u0000']) {
    assert.equal((await call('/reviews', 'reviewer', { ...pastedDraft, sourceText })).status, 400);
  }
});

test('v1 queued recordings and saved results remain readable across the prompt upgrade', async () => {
  const r = await queued(); const old = (await jobRef(r).get()).data()!;
  const request = buildAnalysisRequest(r.sourceText, r.contract!, LEGACY_PROMPT_VERSION);
  const provider = { provider: offlineProvider.id, model: offlineProvider.model, version: offlineProvider.version, settings: offlineProvider.settings };
  const key = digest({ request: request.key, ...provider });
  await jobRef(r).update({ key, promptVersion: LEGACY_PROMPT_VERSION });
  await s.db.doc(`${base}/reviews/${r.id}/assistanceKeys/${old.key}`).set({ activeJob: null });
  await s.db.doc(`${base}/reviews/${r.id}/assistanceKeys/${key}`).set({ activeJob: r.assistanceId, attempts: 1, resultId: null });
  await processNextAssistance(s);
  const saved = await detail(r);
  assert.equal(saved.status, 'succeeded'); assert.equal(saved.promptVersion, LEGACY_PROMPT_VERSION);
  assert.equal(saved.result.schemaVersion, 'policy-suggestions-v1');
  const next = await act(r, 'start_assistance'); assert.equal(next.status, 200);
  assert.equal((await detail(next.data)).reused, false);
  await processNextAssistance(s);
  assert.equal((await detail(next.data)).result.schemaVersion, 'policy-suggestions-v2');
});

function gate() {
  let release!: () => void; let entered!: () => void;
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const reached = new Promise<void>(resolve => { entered = resolve; });
  return { release, reached, async hold() { entered(); await waiting; } };
}

for (const phase of ['before dispatch', 'after response'] as const) test(`deadline bounds identity lookup ${phase} and a late identity response has no authority`, async () => {
  const r = await queued(); const g = gate(); let lookups = 0; let calls = 0;
  const original = s.auth.getUser;
  s.auth.getUser = (async (...args: Parameters<typeof original>) => {
    if (++lookups === (phase === 'before dispatch' ? 1 : 2)) await g.hold();
    return original.apply(s.auth, args);
  }) as typeof original;
  const provider = { ...offlineProvider, async generate(...args: Parameters<AnalysisProvider['generate']>) { calls++; return offlineProvider.generate(...args); } };
  try {
    const worker = processNextAssistance(s, provider, { timeoutMs: 700 });
    await g.reached; await worker;
    const beforeRelease = (await jobRef(r).get()).data()!;
    assert.equal(beforeRelease.status, phase === 'before dispatch' ? 'failed' : 'unknown');
    assert.equal(beforeRelease.resultId, null);
    g.release(); await delay(30);
    assert.deepEqual((await jobRef(r).get()).data(), beforeRelease);
    assert.equal(calls, phase === 'before dispatch' ? 0 : 1);
  } finally { g.release(); s.auth.getUser = original; }
  if (phase === 'after response') { await jobRef(r).update({ leaseUntil: 0 }); await processNextAssistance(s); }
});

for (const phase of ['claim', 'preflight', 'commit'] as const) test(`aborted ${phase} transaction cannot submit buffered writes after it resumes`, async () => {
  const r = await queued(); const g = gate(); const stop = new AbortController(); let held = false; let calls = 0;
  const original = s.db.runTransaction;
  s.db.runTransaction = ((body: Parameters<typeof original>[0]) => original.call(s.db, async tx => {
    const get = tx.get.bind(tx);
    tx.get = (async (...args: Parameters<typeof get>) => {
      const path = (args[0] as unknown as { path?: string }).path;
      const matches = phase === 'claim' ? path === jobRef(r).path : phase === 'preflight' ? path === `${base}/members/${uids.reviewer}` : path?.startsWith(`${base}/assistanceBudgets/`);
      if (!held && matches) { held = true; await g.hold(); }
      return get(...args);
    }) as typeof tx.get;
    return body(tx);
  })) as typeof original;
  try {
    const worker = processNextAssistance(s, { ...offlineProvider, async generate(...args: Parameters<AnalysisProvider['generate']>) { calls++; return offlineProvider.generate(...args); } }, { signal: stop.signal, cleanupTimeoutMs: 100 });
    await g.reached; stop.abort(); await worker;
    const beforeRelease = (await jobRef(r).get()).data()!;
    // The stalled commit already holds the job's Firestore lock, so cleanup also times out.
    // Its durable running lease remains recoverable; no success or failure is invented.
    assert.equal(beforeRelease.status, phase === 'claim' ? 'queued' : phase === 'preflight' ? 'failed' : 'running');
    assert.equal(beforeRelease.resultId, null);
    g.release(); await delay(80);
    assert.deepEqual((await jobRef(r).get()).data(), beforeRelease);
    assert.equal(calls, phase === 'commit' ? 1 : 0);
    assert.equal((await s.db.collection(`${base}/reviews/${r.id}/suggestions`).get()).size, 0);
  } finally { g.release(); s.db.runTransaction = original; }
  if (phase !== 'preflight') { await jobRef(r).update({ leaseUntil: 0 }); await processNextAssistance(s); }
});

test('stalled cleanup has a separate deadline; late cleanup cannot overwrite lease recovery', async () => {
  const r = await queued(); const g = gate(); const stop = new AbortController(); let blockTransactions = false;
  const original = s.db.runTransaction;
  s.db.runTransaction = ((body: Parameters<typeof original>[0]) => original.call(s.db, async tx => {
    if (blockTransactions) await g.hold();
    return body(tx);
  })) as typeof original;
  try {
    const provider = { ...offlineProvider, async generate() { blockTransactions = true; stop.abort(); return new Promise<never>(() => {}); } };
    await processNextAssistance(s, provider, { signal: stop.signal, cleanupTimeoutMs: 40 });
    assert.equal((await jobRef(r).get()).get('status'), 'running');
    blockTransactions = false;
    await jobRef(r).update({ leaseUntil: 0 }); await processNextAssistance(s);
    const recovered = (await jobRef(r).get()).data(); assert.equal(recovered?.status, 'succeeded');
    g.release(); await delay(80);
    assert.deepEqual((await jobRef(r).get()).data(), recovered);
  } finally { blockTransactions = false; g.release(); s.db.runTransaction = original; }
});
test('cancelling an in-flight recording fences a late completion', async () => {
  const r = await queued(); let release!: () => void; let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }); const called = new Promise<void>(resolve => { entered = resolve; });
  const worker = processNextAssistance(s, { ...offlineProvider, async generate(...args) { entered(); await gate; return offlineProvider.generate(...args); } }); await called;
  assert.equal((await act(r, 'cancel_assistance')).status, 200); release(); await worker;
  assert.equal((await detail(r)).status, 'cancelled'); assert.equal((await detail(r)).result, null);
});
test('maintenance and access revocation fence both dispatch and completion', async () => {
  const r = await queued(); const other = await create(); const lock = await acquireMaintenance(s, 'Suggestion fencing');
  try { assert.equal(await processNextAssistance(s), false); assert.equal((await act(other, 'start_assistance')).status, 503); }
  finally { await releaseMaintenance(s, lock); }
  let release!: () => void; let entered!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; }); const called = new Promise<void>(resolve => { entered = resolve; });
  const worker = processNextAssistance(s, { ...offlineProvider, async generate(...args) { entered(); await gate; return offlineProvider.generate(...args); } }); await called;
  await s.db.doc(`${base}/members/${uids.reviewer}`).update({ active: false }); release(); await worker;
  assert.equal((await jobRef(r).get()).get('status'), 'failed'); assert.equal((await jobRef(r).get()).get('resultId'), null);
  await s.db.doc(`${base}/members/${uids.reviewer}`).update({ active: true });
});
for (const role of ['anonymous', 'nonmember', 'staff', 'viewer', 'reviewer', 'admin']) test(`suggestions and prompts enforce ${role} access`, async () => {
  const r = await create(); const read = ['viewer', 'reviewer', 'admin'].includes(role); const edit = ['reviewer', 'admin'].includes(role); const denied = role === 'anonymous' ? 401 : 403;
  for (const route of ['assistance', 'prompt']) assert.equal((await call(`/reviews/${r.id}/${route}`, role)).status, read ? 200 : denied);
  const out = await act(r, 'start_assistance', {}, role); assert.equal(out.status, edit ? 200 : denied);
  if (edit) await processNextAssistance(s);
  const db = role === 'anonymous' ? env.unauthenticatedContext().firestore() : env.authenticatedContext(uids[role], { email: `service-${role}@school.example`, email_verified: true }).firestore();
  for (const path of [`${base}/assistanceJobs/${out.data.assistanceId || 'missing'}`, `${base}/assistanceBudgets/2026-10-16`, `${base}/reviews/${r.id}/suggestions/missing`, `${base}/reviews/${r.id}/assistanceKeys/missing`]) {
    await assertFails(getDoc(doc(db, path))); await assertFails(setDoc(doc(db, path), { forged: true }));
  }
});


test('scope, follow-up and provenance survive an unresolved save, retry, correction, history and export', async () => {
  let r = await queued(); await processNextAssistance(s); const ready = await detail(r);
  const suggestion = ready.result.findings.find((f: { measureId: string }) => f.measureId === 'deletion');
  const evidence = { ...suggestedEvidence(suggestion, ready.result)!, proposalId: ready.id };
  for (const role of ['anonymous','staff','nonmember','viewer']) assert.equal((await act(r,'edit_evidence',{evidence},role)).status,role==='anonymous'?401:403);
  for (const invalid of [ {...evidence, proposalId:randomUUID()}, {...evidence, context:undefined}, {...evidence,context:{...evidence.context,scope:'All accounts without exception.'}} ]) assert.ok([400,409].includes((await act(r,'edit_evidence',{evidence:invalid})).status));
  const id=randomUUID(); const first=await act(r,'edit_evidence',{evidence},'reviewer',id);assert.equal(first.status,200,JSON.stringify(first.data));
  assert.equal((await act(r,'edit_evidence',{evidence},'reviewer',id)).data.analysis.id,first.data.analysis.id);
  const before=r; r=await get(r.id); const originalId=r.analysis!.id;
  const f=r.analysis!.findings.find(f=>f.id==='deletion')!;
  assert.deepEqual(f.context,evidence.context);assert.equal(f.provenance?.jobId,ready.id);assert.equal(f.provenance?.sourceHash,r.sourceHash);assert.equal(f.provenance?.rubricId,r.contract!.id);
  assert.equal(f.provenance?.resultId,(await jobRef(before).get()).get('resultId'));assert.equal(reviewedCount(r),0);assert.equal(currentAnalysis(r),false);assert.equal(r.analysis!.score.total,null);assert.equal(r.analysis!.score.maximum,42);
  assert.equal((await act(r,'publish')).status,409);
  assert.equal((await act(r,'decide',{decision:{outcome:'approved',rationale:'Test only',conditions:'',summary:'Test only',category:'Learning'}})).status,409);
  const bundle=(await call(`/reviews/${r.id}/export`)).data;
  assert.deepEqual(bundle.snapshot.analysis.findings.find((f:{id:string})=>f.id==='deletion').context,evidence.context);
  assert.equal((await call(`/reviews/${r.id}`,'viewer')).data.analysis.findings.find((f:{id:string})=>f.id==='deletion').provenance.resultId,f.provenance!.resultId);
  assert.equal((await act(before,'edit_evidence',{evidence})).status,409);
  const {context:_,proposalId:__,...stripped}=evidence;assert.equal((await act(r,'edit_evidence',{evidence:stripped})).status,400);
  const resolved={...evidence,finding:'partial',context:{...evidence.context!,resolution:'resolved',note:'School deletion is supported for account data, with retained logs as an explicit limitation.',citations:evidence.citations}};
  for(const context of [{...resolved.context,note:''},{...resolved.context,citations:[]},{...resolved.context,citations:[{...evidence.citations[0],quote:'invented'}]}]) assert.equal((await act(r,'edit_evidence',{evidence:{...resolved,context}})).status,400);
  const corrected=await act(r,'edit_evidence',{evidence:resolved},'admin');assert.equal(corrected.status,200,JSON.stringify(corrected.data));r=corrected.data;
  const after=r.analysis!.findings.find(f=>f.id==='deletion')!;assert.equal(after.context?.resolvedBy,uids.admin);assert.ok(after.context?.resolvedAt);assert.equal(after.context?.question,evidence.context!.question);assert.equal(reviewedCount(r),1);
  const old=(await call(`/reviews/${r.id}/evaluations/${originalId}`)).data.analysis;
  assert.equal(old.findings.find((f:{id:string})=>f.id==='deletion').context.resolution,'retained');assert.equal(old.score.total,null);
  const other=await create();assert.equal((await act(other,'edit_evidence',{evidence})).status,409);
  assert.equal((await s.db.doc(`publicDistricts/${config.districtId}/tools/review-${r.id}`).get()).exists,false);
  assert.equal((await s.db.doc(`${base}/staffTools/review-${r.id}`).get()).exists,false);
});
test('incomplete-source proposals can be preserved only as unresolved, not confirmed omissions',async()=>{
  const r=await queued();
  const provider: AnalysisProvider={...offlineProvider,async generate(...args){
    const response=await offlineProvider.generate(...args);assert.equal(response.status,'completed');if(response.status!=='completed')return response;
    const output=structuredClone(response.output) as any;output.sourceStatus='incomplete';output.citations=[];output.summary=[];
    output.findings=output.findings.map((f:any)=>({...f,state:'unavailable',citationIds:[],uncertainty:'missing_source',question:'Where is the missing school agreement?'}));return {...response,output};
  }};
  await processNextAssistance(s,provider);const ready=await detail(r);assert.equal(ready.status,'succeeded');
  const evidence={...suggestedEvidence(ready.result.findings[0],ready.result)!,proposalId:ready.id};
  const out=await act(r,'edit_evidence',{evidence});assert.equal(out.status,200);assert.equal(out.data.analysis.score.total,null);
  assert.equal((await act(out.data,'edit_evidence',{evidence:{...evidence,finding:'not_specified',context:{...evidence.context,resolution:'resolved',note:'Claiming omission without the missing source.',citations:[]}}})).status,400);
});

test('precision adoption preserves old reviews and binds clause evidence, retries, decisions and publication', async () => {
  const settings = (await call('/settings', 'admin')).data.evaluation;
  const legacy = await call('/reviews', 'reviewer', { name: 'Before precision adoption', sourceKind: 'pasted', sourceLabel: 'Synthetic Cedar', sourceText: ANALYSIS_EXAMPLE, rubricMode: 'district', settingsRevision: settings.revision, engineVersion: 'evidence-weighted-v1' });
  assert.equal(legacy.status, 201);
  const values = { ...settings.values, starterProfile: 'pef-precision-v1', evaluationWeights: Object.fromEntries(Object.keys(settings.values.evaluationWeights).map(id => [id, id === 'monetization' ? 1 : 0])) };
  const settingsBody = { section: 'evaluation', revision: settings.revision, values };
  assert.equal((await call('/settings', 'reviewer', settingsBody)).status, 403);
  const adopted = await call('/settings', 'admin', settingsBody); assert.equal(adopted.status, 200);
  try {
    const status = await call('/review-rubric', 'viewer'); assert.equal(status.data.profile, 'pef-precision-v1');
    const created = await call('/reviews', 'reviewer', { name: 'Precision pilot', sourceKind: 'pasted', sourceLabel: 'Synthetic Cedar', sourceText: ANALYSIS_EXAMPLE, rubricMode: 'district', settingsRevision: adopted.data.revision, engineVersion: 'evidence-weighted-v1' });
    assert.equal(created.status, 201); let r = created.data as Review;
    assert.equal(r.contract!.version, 2); assert.equal(r.contract!.criteria.length, 50); assert.equal(r.evidenceVersion, 4);
    const old = await get(legacy.data.id); assert.equal(old.contract!.version, 1); assert.equal(old.contract!.id, legacy.data.contract.id);
    const prompt = await call(`/reviews/${r.id}/prompt`); assert.equal(prompt.data.promptVersion, 'evidence-extraction-v3');
    const started = await act(r, 'start_assistance'); assert.equal(started.status, 200); r = started.data;
    await processNextAssistance(s);
    const proposals = await detail(r); assert.equal(proposals.status, 'succeeded'); assert.equal(proposals.result.schemaVersion, 'policy-suggestions-v3'); assert.equal(proposals.result.findings.length, 6);
    const first = proposals.result.findings.find((f: {measureId:string}) => f.measureId === 'mon_001');
    const edit = { ...suggestedEvidence(first, proposals.result)!, proposalId: proposals.id };
    assert.equal((await call(`/reviews/${r.id}`, 'viewer', { action: 'edit_evidence', revision: r.revision, evidence: edit })).status, 403);
    const wrong = { ...edit, finding: 'no' };
    assert.equal((await call(`/reviews/${r.id}`, 'reviewer', { action: 'edit_evidence', revision: r.revision, evidence: wrong })).status, 400);
    assert.equal((await call(`/reviews/${r.id}`, 'reviewer', { action: 'edit_evidence', revision: r.revision, evidence: { ...edit, proposalRequirements: edit.requirements } })).status, 400);
    const id = randomUUID(), body = { action: 'edit_evidence', revision: r.revision, evidence: edit };
    const saved = await call(`/reviews/${r.id}`, 'reviewer', body, id); assert.equal(saved.status, 200); r = saved.data;
    const replay = await call(`/reviews/${r.id}`, 'reviewer', body, id); assert.equal(replay.status, 200); assert.equal(replay.data.analysis.id, r.analysis!.id);
    assert.equal(r.analysis!.schemaVersion, 'findings-v4'); assert.equal(r.analysis!.score.total, null);
    assert.deepEqual(r.analysis!.findings.find(f => f.id === 'mon_001')!.proposalRequirements, first.requirements);
    for (const f of proposals.result.findings.filter((f: {measureId:string}) => f.measureId !== 'mon_001')) {
      const evidence = { ...suggestedEvidence(f, proposals.result)!, proposalId: proposals.id };
      if (!f.requirements) { evidence.finding = 'not_specified'; evidence.context = { ...evidence.context!, resolution: 'resolved', note: 'Reviewed the complete supplied synthetic text; no statement for this measure.', citations: [] }; }
      const next = await call(`/reviews/${r.id}`, 'reviewer', { action: 'edit_evidence', revision: r.revision, evidence }); assert.equal(next.status, 200, JSON.stringify(next.data)); r = next.data;
    }
    assert.equal(reviewedCount(r), 6); assert.notEqual(r.analysis!.score.total, null); assert.equal(r.analysis!.score.breakdown.length, 6);
    const resolvedId = r.analysis!.id;
    let next = await call(`/reviews/${r.id}`, 'reviewer', { action: 'decide', revision: r.revision, decision: { outcome: 'conditional', rationale: 'Synthetic review of this pilot.', conditions: 'Fictional testing only.', summary: 'Synthetic precision review.', category: 'Learning' } }); assert.equal(next.status, 200); r = next.data;
    next = await act(r, 'publish'); assert.equal(next.status, 200); r = next.data;
    assert.equal(r.published, true);
    assert.ok(!JSON.stringify(audienceProjection(r, 'public')).includes('requirements'));
    const tracking = proposals.result.findings.find((f: {measureId:string}) => f.measureId === 'mon_004');
    const deferred = { ...suggestedEvidence(tracking, proposals.result)!, proposalId: proposals.id, finding: 'unresolved' as const };
    deferred.requirements!.requirements[0] = { ...deferred.requirements!.requirements[0], status: 'unavailable', question: 'Supply the linked tracking terms.', rationale: 'Required terms remain unavailable.' };
    next = await call(`/reviews/${r.id}`, 'reviewer', { action: 'edit_evidence', revision: r.revision, evidence: deferred }); assert.equal(next.status, 200, JSON.stringify(next.data)); r = next.data;
    assert.equal(r.published, false); assert.equal(r.analysis!.score.total, null); assert.equal((await act(r, 'publish')).status, 409);
    const prior = await call(`/reviews/${r.id}/evaluations/${resolvedId}`, 'viewer'); assert.equal(prior.status, 200); assert.notEqual(prior.data.analysis.score.total, null);
    assert.equal((await call(`/reviews/${r.id}`, 'staff')).status, 403);
    const exported = await call(`/reviews/${r.id}/export`, 'viewer'); assert.equal(exported.status, 200); assert.ok(exported.data.snapshot.analysis.findings.some((f: {requirements?:unknown}) => f.requirements));
    assert.equal((await call('/reviews/import', 'reviewer', exported.data)).status, 400);
    const reloaded = await get(r.id); assert.equal(reloaded.analysis!.findings.find(f => f.id === 'mon_004')!.requirements!.requirements[0].question, 'Supply the linked tracking terms.');
    const reused = await act(r, 'start_assistance'); assert.equal(reused.status, 200); assert.equal((await detail(reused.data)).reused, true);
  } finally {
    const latest = (await call('/settings', 'admin')).data.evaluation;
    assert.equal((await call('/settings', 'admin', { section: 'evaluation', revision: latest.revision, values: settings.values })).status, 200);
  }
});
