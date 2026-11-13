import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export function saveLocalAccount(account: { email: string; password: string; projectId: string }, directory = '.local/accounts') {
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  // Empty sandboxes can reuse an email. Never destroy the sign-in file belonging
  // to an earlier installation backup, and refuse an unlikely filename collision.
  const name = `${account.projectId}-${account.email.replaceAll(/[^a-z0-9@.-]/g, '_')}-${randomUUID()}.json`;
  const path = join(directory, name);
  writeFileSync(path, JSON.stringify({ ...account, localEmulatorOnly: true }, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  return path;
}
