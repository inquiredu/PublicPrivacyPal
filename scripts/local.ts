import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { loadConfig, emulatorEnvironment } from '../server/config.ts';
import { stageRestore } from './backup-files.ts';
import { assertLocalPortsAvailable } from './local-ports.ts';

const mode = process.argv[2];
// Firebase's native exporter creates temporary files in its working directory before moving them.
// Its child process inherits this mask, keeping account exports private from their first write.
process.umask(0o077);
if (!['dev', 'test'].includes(mode)) throw new Error('Use dev or test.');
if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node 24: nvm use.');
const configPath = mode === 'test' ? 'config/test.example.json' : process.env.PRIVACYPAL_CONFIG || 'config/local.json';
const config = loadConfig(configPath);
const options = process.argv.slice(3);
const guided = mode === 'dev' && options.length === 1 && options[0] === '--setup';
const restoring = mode === 'dev' && options.length === 2 && options[0] === '--restore';
if (options.length && !guided && !restoring) throw new Error('Use npm run setup, npm run dev, or npm run dev -- --restore BACKUP_PATH.');
// A restore never attaches to an existing emulator or merges with a running installation.
await assertLocalPortsAvailable([5173, 8787, 9099, 8080, 4400, 4500, 9150]);
const cleanEnv = emulatorEnvironment(config);
const restored = restoring ? stageRestore(options[1], config) : undefined;
const env = { ...cleanEnv, PRIVACYPAL_CONFIG: configPath, FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true', PRIVACYPAL_RESTORE: restored?.path || '', PRIVACYPAL_GUIDED_SETUP: guided ? '1' : '' };
const bin = (name: string) => resolve('node_modules', name);
const firebase = bin('firebase-tools/lib/bin/firebase.js');
const firebaseConfig = resolve('firebase.local.json');
if (!existsSync(firebase)) throw new Error('Run npm ci first.');
const children: ChildProcess[] = [];
let stopping = false;
function stop(code: number) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) {
    try {
      // emulators:exec also owns the API/Vite grandchildren. Signal their isolated group on Unix.
      if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, 'SIGINT');
      else child.kill('SIGINT');
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  }
}
function run(args: string[]) {
  const child = spawn(process.execPath, args, { env, stdio: 'inherit', detached: process.platform !== 'win32' });
  children.push(child);
  child.on('error', error => { console.error(error.message); stop(1); });
  child.on('exit', code => stop(code ?? 0));
  return child;
}
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => stop(0));
const firebaseArgs = ['--project', config.projectId, '--config', firebaseConfig, '--only', 'auth,firestore'];
if (mode === 'test') {
  run([firebase, 'emulators:exec', ...firebaseArgs, 'node --import tsx scripts/test-in-emulator.ts']);
} else {
  console.log(`Local sandbox: ${config.projectId}. Save with npm run local:backup before stopping. No automatic save or cloud deployment.`);
  run([firebase, 'emulators:exec', ...firebaseArgs, ...(restored ? ['--import', restored.path] : []), 'node --import tsx scripts/serve.ts']);
}
