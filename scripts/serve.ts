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
if (env.PRIVACYPAL_RESTORE) {
  const manifest = verifyBackup(env.PRIVACYPAL_RESTORE, config);
  const services = localServices(config);
  try { await finishRestore(services, manifest); console.log(`Restored local backup from ${manifest.createdAt}. Existing account passwords still apply.`); }
  finally { await services.close(); }
}
const children: ChildProcess[] = [];
let stopping = false;
function stop(code: number) {
  if (stopping) return; stopping = true; process.exitCode = code;
  for (const child of children) child.kill('SIGINT');
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => stop(0));
for (const args of [['--import', 'tsx', 'server/index.ts'], [resolve('node_modules/vite/bin/vite.js'), '--host', '127.0.0.1']]) {
  const child = spawn(process.execPath, args, { env, stdio: 'inherit' }); children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code ?? 1));
}
