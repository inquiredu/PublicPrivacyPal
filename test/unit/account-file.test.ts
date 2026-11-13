import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveLocalAccount } from '../../scripts/account-file.ts';

test('new sandbox credentials preserve the password needed for an older installation backup', () => {
  const dir = mkdtempSync(join(tmpdir(), 'privacypal-account-'));
  try {
    const account = { email: 'admin@maple.example', projectId: 'demo-account-test', password: 'first-fictional-password' };
    const first = saveLocalAccount(account, join(dir, 'accounts'));
    const before = readFileSync(first);
    const second = saveLocalAccount({ ...account, password: 'second-fictional-password' }, join(dir, 'accounts'));
    assert.notEqual(first, second);
    assert.deepEqual(readFileSync(first), before);
    assert.equal(JSON.parse(readFileSync(first, 'utf8')).password, account.password);
    assert.equal(JSON.parse(readFileSync(second, 'utf8')).password, 'second-fictional-password');
    assert.equal(JSON.parse(readFileSync(second, 'utf8')).localEmulatorOnly, true);
    if (process.platform !== 'win32') {
      assert.equal(statSync(first).mode & 0o777, 0o600);
      assert.equal(statSync(second).mode & 0o777, 0o600);
      assert.equal(statSync(join(dir, 'accounts')).mode & 0o777, 0o700);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
