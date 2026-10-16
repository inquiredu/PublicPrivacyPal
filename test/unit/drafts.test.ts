import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { DraftStore, clearReviewDrafts, DRAFT_LIFETIME_MS } from '../../src/draft-store.ts';
import { captureDraftSchema, evidenceDraftSchema, decisionDraftSchema } from '../../shared/drafts.ts';
class MemoryStorage {
  data = new Map<string, string>(); fail = false;
  get length() { return this.data.size; }
  key(i: number) { return [...this.data.keys()][i] ?? null; }
  getItem(k: string) { return this.data.get(k) ?? null; }
  setItem(k: string, v: string) { if (this.fail) throw new Error('quota'); this.data.set(k,v); }
  removeItem(k: string) { this.data.delete(k); }
}
test('capture, evidence and decision drafts survive remount/reload with their original revision', () => {
  const storage = new MemoryStorage(); const first = new DraftStore('district/user', storage);
  const evidence = { revision: 7, criterionId: 'sale', finding: 'partial', citations: [], rationale: 'Synthetic unfinished interpretation', quoteText: 'Fictional quotation' };
  const decision = { revision: 7, values: { outcome:'conditional', rationale:'Private unfinished decision', conditions:'Test only', summary:'Fictional tool', category:'Learning' } };
  const capture = {sourceKind:'pasted', name:'Synthetic unfinished tool', sourceLabel:'Practice', sourceText:'Fictional policy', fixtureId:'complete', profileVersion:'community-evidence-v1'};
  first.set('capture',capture); first.set('evidence:one',evidence); first.set('decision:one',decision);
  const restored = new DraftStore('district/user',storage);
  assert.deepEqual(restored.get('capture',captureDraftSchema),capture);
  assert.deepEqual(restored.get('evidence:one',evidenceDraftSchema),evidence);
  assert.deepEqual(restored.get('decision:one',decisionDraftSchema),decision);
  assert.equal(restored.get('decision:one',decisionDraftSchema)?.revision,7); // Does not adopt a newer server revision.
  assert.equal(new DraftStore('district/other',storage).has(),false);
  restored.remove('evidence:one'); assert.equal(restored.has('decision:one'),true);
  clearReviewDrafts(storage);
});
test('sign-out/revocation erases all local drafts and fences late request callbacks', () => {
  const storage = new MemoryStorage(); const store = new DraftStore('one',storage); store.set('capture','private');
  clearReviewDrafts(storage); store.set('capture','late response');
  assert.equal(store.has(),false); assert.equal(storage.length,0);
});
test('draft expiry does not discard an unconfirmed command identity', () => {
  const storage = new MemoryStorage(); const first = new DraftStore('one',storage,()=>100);
  first.set('capture','old'); first.set('pending-command',{id:'unresolved'});
  const restored = new DraftStore('one',storage,()=>101+DRAFT_LIFETIME_MS);
  assert.equal(restored.has('capture'),false); assert.deepEqual(restored.get('pending-command',z.unknown()),{id:'unresolved'});
  clearReviewDrafts(storage);
});
test('quota failures retain memory, warn, and remove stale persisted text', () => {
  const storage = new MemoryStorage(); const store = new DraftStore('one',storage);
  store.set('draft','old'); storage.fail=true; store.set('draft','new');
  assert.equal(store.get('draft',z.string()),'new'); assert.match(store.warning,/Reload protection/); assert.equal(storage.length,0);
  clearReviewDrafts(storage);
});
test('corrupt storage is rejected and selection alone is not an unsaved draft', () => {
  const storage = new MemoryStorage(); const store = new DraftStore('one',storage); store.set('location','review'); assert.equal(store.has(),false);
  storage.data.set(store.key,'{invalid'); const restored = new DraftStore('one',storage); assert.match(restored.warning,/could not be recovered/); assert.equal(restored.has(),false);
  clearReviewDrafts(storage);
});
