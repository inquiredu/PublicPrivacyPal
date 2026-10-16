import { test } from 'node:test';
import assert from 'node:assert/strict';
import { exampleTierPolicy, tierPolicySchema } from '../../shared/service-policy.ts';
import { serviceBlockers, serviceEditSchema, audienceProjection, type ServiceRecord } from '../../shared/service.ts';
import { serviceValues } from '../fixtures/service.ts';
import type { Review } from '../../shared/review.ts';
import { bounded } from '../../server/review-storage.ts';
import { serviceDraftSchema } from '../../shared/drafts.ts';
import { DraftStore, clearReviewDrafts } from '../../src/draft-store.ts';
const service = (): ServiceRecord => ({ version: 1, revision: 1, values: structuredClone(serviceValues), policy: exampleTierPolicy(), settingsRevision: 1, updatedAt: '2026-10-15T00:00:00.000Z', updatedBy: 'private-actor', rationale: 'Private correction rationale' });
test('required agreements distinguish unknown, absent, expired, future and recorded scope', () => {
  const s = service(); assert.deepEqual(serviceBlockers(s, '2026-10-15'), []);
  for (const status of ['unknown','absent','expired','not_required'] as const) { s.values.dpaStatus = status; assert.match(serviceBlockers(s, '2026-10-15').join(' '), /DPA/); }
  s.values.dpaStatus = 'recorded'; s.values.dpaExpires = '2026-10-15'; assert.match(serviceBlockers(s, '2026-10-15').join(' '), /DPA/);
  s.values.dpaExpires = ''; assert.deepEqual(serviceBlockers(s, '2026-10-15'), []);
  s.values.dpaSigned = '2026-10-16'; assert.match(serviceBlockers(s, '2026-10-15').join(' '), /DPA/);
});
test('district policy is explicit, versioned and configurable, separate from score', () => {
  const s = service(); s.values.tier = 'Tier 1: Core System Tool'; assert.match(serviceBlockers(s).join(' '), /rostering/);
  s.policy.rules[s.values.tier].rostering = false; assert.deepEqual(serviceBlockers(s), []);
  s.values.tier = 'Tier 3B: No Account Required'; assert.match(serviceBlockers(s).join(' '), /personal data/);
  s.values.dataUse = 'unknown'; assert.match(serviceBlockers(s).join(' '), /personal data/);
  s.values.tier = 'Tier 3A: Requires Parent Consent'; s.values.permissionWhen = ''; assert.match(serviceBlockers(s).join(' '), /parent-permission/);
  assert.equal(tierPolicySchema.safeParse({ ...s.policy, rules: {} }).success, false);
});
test('service validation rejects invented authority, invalid dates, dangerous URLs and contradictory facts', () => {
  const valid = { values: serviceValues, rationale: 'Synthetic correction' }; assert.equal(serviceEditSchema.safeParse(valid).success, true);
  for (const patch of [{ updatedBy: 'forged' }, { dpaSigned: '2026-02-30' }, { policyUrl: 'javascript:alert(1)' }, { dpaReference: '' }, { dpaScope: '' }, { dpaExpires: '2025-01-01' }, { dataUse: 'no_student_data' }]) assert.equal(serviceEditSchema.safeParse({ ...valid, values: { ...serviceValues, ...patch } }).success, false);
});
test('public and staff projections never include private service, evidence or author fields', () => {
  const r = { id: 'one', name: 'Synthetic', sourceKind: 'pasted', service: service(), decision: { outcome: 'conditional', rationale: 'SECRET', conditions: 'Supervision', summary: 'Synthetic summary', category: 'Learning', at: '2026-10-15', actorUid: 'SECRET' }, analysis: { score: { total: 64 }, evidenceCount: 7 } } as Review;
  const family = audienceProjection(r, 'public')!; const staff = audienceProjection(r, 'staff')!;
  assert.equal('score' in family, false); assert.equal('support' in family, false); assert.equal('score' in staff && staff.score, 64);
  for (const p of [family, staff]) { const text = JSON.stringify(p); for (const secret of ['SECRET', 'private-actor', 'CEDAR-1', 'Private correction rationale', 'governance', 'settingsRevision', 'dpaScope']) assert.ok(!text.includes(secret), secret); }
  assert.deepEqual(Object.keys(family).sort(), ['alternative','approvedWhen','category','conditions','dataCategories','dataUse','grades','name','outcome','permissionWhen','reviewedAt','summary','synthetic','tierLevel']);
});
test('service drafts retain their original revision and disappear on sign-out', () => {
  const map = new Map<string,string>(); const storage = { getItem: (k:string) => map.get(k) ?? null, setItem: (k:string,v:string) => { map.set(k,v); }, removeItem: (k:string) => { map.delete(k); }, key: (i:number) => [...map.keys()][i] ?? null, get length() { return map.size; } };
  const store = new DraftStore('synthetic-owner', storage); const draft = { revision: 7, values: serviceValues, rationale: 'Unsaved correction' };
  store.set('service:one', draft); const restored = new DraftStore('synthetic-owner', storage); assert.deepEqual(restored.get('service:one', serviceDraftSchema), draft);
  clearReviewDrafts(storage); assert.equal(restored.has(), false); assert.equal(map.size, 0);
});
test('service records have a byte bound independent of lightweight heads', () => {
  bounded('service', service()); assert.throws(() => bounded('service', { text: '測'.repeat(20000) }), /byte limit/);
});
