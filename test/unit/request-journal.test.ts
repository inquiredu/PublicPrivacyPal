import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { requestJournalSchema, readRequestJournal } from '../../src/request-journal.ts';
test('request drafts preserve incomplete text; pending commands stay strict and never expire', () => {
  const value = { savedAt: 0, form: { toolName: 'Partially typed', purpose: '', requestedUrl: 'htt' }, pending: null };
  assert.ok(requestJournalSchema.safeParse(value).success);
  const pending = { id: randomUUID(), path: '/api/requests', body: { toolName: 'Tool', purpose: 'Use', requestedUrl: '' } };
  assert.ok(!requestJournalSchema.safeParse({ ...value, pending: { ...pending, id: 'bad' } }).success);
  let stored: string | null = JSON.stringify({ ...value, pending });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: { getItem: () => stored, removeItem: () => { stored = null; } } });
  try {
    assert.equal(readRequestJournal('key')?.pending?.id, pending.id);
    stored = JSON.stringify({ ...value, pending: { ...pending, body: { ...pending.body, toolName: '  Tool  ' } } });
    assert.equal((readRequestJournal('key')?.pending?.body as { toolName: string }).toolName, '  Tool  ', 'Validation must not change the saved payload hash');
    stored = JSON.stringify(value); assert.equal(readRequestJournal('key'), null); assert.equal(stored, null);
    stored = '{bad'; assert.throws(() => readRequestJournal('key')); assert.equal(stored, '{bad');
  } finally { if (original) Object.defineProperty(globalThis, 'sessionStorage', original); else Reflect.deleteProperty(globalThis, 'sessionStorage'); }
});
