import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { loadConfig } from '../server/config.ts';
import { localServices } from '../server/firebase.ts';
import { bootstrap, installation } from '../server/operations.ts';
import { isDistrictEmail } from '../shared/config.ts';
import { acquireMaintenance, releaseMaintenance } from '../server/maintenance.ts';

const config = loadConfig();
const s = localServices(config);
let lock: string | undefined;
try {
  lock = await acquireMaintenance(s, 'Local account setup');
  const command = process.argv[2];
  const password = randomBytes(24).toString('base64url');
  let email: string;
  if (command === 'bootstrap') {
    email = config.bootstrapAdminEmail;
    if (!(await bootstrap(s, password)).created) {
      console.log('Already initialized. No account, role, password, or data was changed.');
      process.exitCode = 0;
      await releaseMaintenance(s, lock); lock = undefined;
      await s.close(); process.exit(0);
    }
  } else if (command === 'user') {
    await installation(s);
    const emailIndex = process.argv.indexOf('--email');
    email = (emailIndex >= 0 ? process.argv[emailIndex + 1] || '' : '').toLowerCase();
    if (!email || !isDistrictEmail(config, email)) throw new Error('Use --email person@your-configured-synthetic-domain.');
    await s.auth.createUser({ email, password, emailVerified: true });
  } else throw new Error('Use bootstrap or user --email.');
  mkdirSync('.local/accounts', { recursive: true, mode: 0o700 });
  const path = `.local/accounts/${config.projectId}-${email.replaceAll(/[^a-z0-9@.-]/g, '_')}.json`;
  writeFileSync(path, JSON.stringify({ email, password, projectId: config.projectId, localEmulatorOnly: true }, null, 2) + '\n', { mode: 0o600 });
  console.log(`Local account created. Sign-in details: ${path}`);
  if (command === 'user') console.log('This account has no access until an administrator assigns a role in the app.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Local setup failed.');
  process.exitCode = 1;
} finally {
  if (lock) await releaseMaintenance(s, lock);
  await s.close();
}
