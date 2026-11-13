import { spawn, type ChildProcess } from 'node:child_process';
import { resolve } from 'node:path';
import { loadConfig } from '../server/config.ts';
import { localServices } from '../server/firebase.ts';
import { childEnvironment } from './emulator-child.ts';
import { verifyBackup } from './backup-files.ts';
import { finishRestore } from './backup-operations.ts';

const config = loadConfig();
const env = childEnvironment(config);
delete process.env.FIREBASE_CONFIG;
if (env.PRIVACYPAL_GUIDED_SETUP === '1') {
  // emulators:exec invokes this only after emulator readiness. Reuse the operator's
  // protected, idempotent bootstrap and private credential-file handling.
  await new Promise<void>((accept, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', 'scripts/operator.ts', 'bootstrap'], { env, stdio: 'inherit' });
    const stop = () => child.kill('SIGINT');
    process.on('SIGINT', stop); process.on('SIGTERM', stop);
    const cleanup = () => { process.off('SIGINT', stop); process.off('SIGTERM', stop); };
    child.once('error', error => { cleanup(); reject(error); });
    child.once('exit', code => { cleanup(); code === 0 ? accept() : reject(new Error('Administrator setup failed. No browser service was started. Inspect the operator message before retrying.')); });
  });
}
if (env.PRIVACYPAL_RESTORE) {
  const manifest = verifyBackup(env.PRIVACYPAL_RESTORE, config);
  const services = localServices(config);
  try { await finishRestore(services, manifest); console.log(`Restored local backup from ${manifest.createdAt}. Existing account passwords still apply.`); }
  finally { await services.close(); }
}
console.log('\nOpen http://127.0.0.1:5173 after the browser server is ready.');
console.log(env.PRIVACYPAL_RESTORE
  ? 'Sign in with your original local credentials. No bootstrap or password reset was performed.'
  : env.PRIVACYPAL_GUIDED_SETUP === '1'
    ? 'Sign in under “For your district team” using the local account file printed above (or your existing local credentials).'
    : 'For a new workspace, run npm run local:bootstrap in another terminal, then use the printed local account file to sign in.');
console.log('Quick tour: Public library → sign in → Policy reviews → Bundled synthetic policy → inspect evidence before deciding.');
console.log('Save before stopping: npm run local:backup. Wait for verification; keep your account file privately.\n');
const children: ChildProcess[] = [];
let stopping = false;
function stop(code: number) {
  if (stopping) return; stopping = true; process.exitCode = code;
  for (const child of children) child.kill('SIGINT');
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => stop(0));
for (const args of [['--import', 'tsx', 'server/index.ts'], [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--clearScreen', 'false']]) {
  const child = spawn(process.execPath, args, { env, stdio: 'inherit' }); children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code ?? 1));
}
