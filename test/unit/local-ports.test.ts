import assert from 'node:assert/strict';
import test from 'node:test';
import { assertLocalPortsAvailable, type LocalPortProbe } from '../../scripts/local-ports.ts';

function probe(options: { error?: NodeJS.ErrnoException; synchronous?: boolean; closeError?: Error } = {}) {
  const calls: unknown[][] = [];
  let fail: (error: NodeJS.ErrnoException) => void;
  const socket: LocalPortProbe = {
    once(event, listener) { calls.push(['once', event]); fail = listener; },
    listen(port, host, listener) {
      calls.push(['listen', port, host]);
      if (options.error && options.synchronous) throw options.error;
      queueMicrotask(() => options.error ? fail(options.error) : listener());
    },
    close(listener) { calls.push(['close']); queueMicrotask(() => listener(options.closeError)); },
  };
  return { calls, socket };
}

test('every requested loopback port is released before probing the next port', async () => {
  const probes: ReturnType<typeof probe>[] = [];
  await assertLocalPortsAvailable([5173, 8787], () => {
    assert.ok(!probes.length || probes.at(-1)!.calls.at(-1)![0] === 'close');
    const next = probe(); probes.push(next); return next.socket;
  });
  assert.deepEqual(probes.map(p => p.calls), [
    [['once', 'error'], ['listen', 5173, '127.0.0.1'], ['close']],
    [['once', 'error'], ['listen', 8787, '127.0.0.1'], ['close']],
  ]);
});

for (const code of ['EADDRINUSE', 'EACCES', 'EPERM', 'EADDRNOTAVAIL']) {
  test(`${code} stops the fresh session with its specific cause`, async () => {
    const original = Object.assign(new Error('synthetic socket failure'), { code });
    const fake = probe({ error: original }); let creations = 0;
    await assert.rejects(assertLocalPortsAvailable([5173, 8787], () => { creations++; return fake.socket; }), (error: Error) => {
      assert.equal(error.cause, original); assert.match(error.message, new RegExp(code));
      if (code === 'EADDRINUSE') assert.match(error.message, /occupied.*fresh session/);
      else { assert.doesNotMatch(error.message, /occupied/); assert.match(error.message, /127\.0\.0\.1:5173/); }
      if (code === 'EACCES' || code === 'EPERM') assert.match(error.message, /Permission denied.*sandbox/);
      return true;
    });
    assert.equal(creations, 1); assert.equal(fake.calls.some(call => call[0] === 'close'), false);
  });
}

test('a socket error without an errno is retained without inventing an occupied port', async () => {
  const original = new Error('synthetic uncoded failure');
  await assert.rejects(assertLocalPortsAvailable([5173], () => probe({ error: original }).socket), (error: Error) => {
    assert.equal(error.cause, original); assert.match(error.message, /Cannot bind 127\.0\.0\.1:5173/); assert.doesNotMatch(error.message, /occupied/); return true;
  });
});

test('synchronous listen refusal has the same permission diagnostic', async () => {
  const original = Object.assign(new Error('synthetic sync failure'), { code: 'EPERM' });
  await assert.rejects(assertLocalPortsAvailable([5173], () => probe({ error: original, synchronous: true }).socket), (error: Error) => {
    assert.equal(error.cause, original); assert.match(error.message, /Permission denied/); return true;
  });
});

test('failure to close a successful probe prevents advancing to another port', async () => {
  const original = new Error('synthetic close failure'); let creations = 0;
  await assert.rejects(assertLocalPortsAvailable([5173, 8787], () => { creations++; return probe({ closeError: original }).socket; }), (error: Error) => {
    assert.equal(error.cause, original); assert.match(error.message, /Could not release.*5173/); assert.doesNotMatch(error.message, /occupied/); return true;
  });
  assert.equal(creations, 1);
});
