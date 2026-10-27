import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeRequests } from '../../shared/request-dashboard.ts';
import type { RequestView } from '../../shared/requests.ts';
const row = (id: string, patch: Partial<RequestView> = {}): RequestView => ({ id, toolName: id, purpose: 'Synthetic', requestedUrl: '', createdAt: null, updatedAt: null, legacy: true, revision: 0, status: 'pending', outcome: null, own: true, archived: false, ...patch });
test('empty inventory is explicit; archives and assignments are separate dimensions', () => {
  assert.deepEqual(summarizeRequests([], 'me', true, 'now').counts, { all: 0, active: 0, pending: 0, in_review: 0, assigned: 0, decided: 0, archived: 0 });
  const data = summarizeRequests([row('a'), row('b', { status: 'in_review', assignee: 'me' }), row('c', { status: 'in_review', assignee: 'other' }), row('d', { archived: true }), row('e', { status: 'decided' })], 'me', true, 'now');
  assert.deepEqual(data.counts, { all: 5, active: 3, pending: 1, in_review: 2, assigned: 1, decided: 1, archived: 1 });
  assert.deepEqual(data.attention.map(r => r.id), ['a', 'b']);
});
test('attention has deterministic order and six-row bound; requester outcomes omit private fields', () => {
  const rows = Array.from({ length: 9 }, (_, i) => row(String(i), { status: 'decided', requestedBy: 'private', assignee: 'private' })).reverse();
  const data = summarizeRequests(rows, 'me', false, 'now');
  assert.equal(data.counts.decided, 9); assert.deepEqual(data.attention.map(r => r.id), ['0','1','2','3','4','5']);
  assert.deepEqual(Object.keys(data.attention[0]).sort(), ['id','status','toolName']);
});
