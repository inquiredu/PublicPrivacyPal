import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { loadConfig, emulatorEnvironment } from '../server/config.ts';
import { stageRestore } from './backup-files.ts';

if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node 24.');
const config = loadConfig('config/test.example.json');
for (const port of [5173, 8787, 9099, 8080, 4400, 4500, 9150]) await new Promise<void>((accept, reject) => {
  const server = createServer(); server.once('error', () => reject(new Error(`Stop local services first: port ${port} is occupied.`)));
  server.listen(port, '127.0.0.1', () => server.close(error => error ? reject(error) : accept()));
});
process.umask(0o077);
const directory = resolve('.local/recovery-tests', randomUUID()); mkdirSync(directory, { recursive: true, mode: 0o700 });
const env = { ...emulatorEnvironment(config), PRIVACYPAL_CONFIG: 'config/test.example.json', PRIVACYPAL_RECOVERY_TEST: directory, FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true' };
async function phase(name: string, imported?: string) {
  const args = [resolve('node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:exec', '--project', config.projectId, '--config', 'firebase.local.json', '--only', 'auth,firestore', ...(imported ? ['--import', imported] : []), 'node --import tsx test/recovery/roundtrip.ts'];
  const child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...env, PRIVACYPAL_RECOVERY_PHASE: name, PRIVACYPAL_RESTORE: imported || '' } });
  const interrupt = () => child.kill('SIGINT'); process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    await new Promise<void>((accept, reject) => {
      child.once('error', reject); child.once('exit', code => code === 0 ? accept() : reject(new Error(`Recovery ${name} failed (${code}).`)));
    });
  } finally { process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); }
}
await phase('seed');
for (const name of ['restore', 'restore-again']) {
  const receipt = JSON.parse(readFileSync(resolve(directory, 'receipt.json'), 'utf8'));
  const prepared = stageRestore(receipt.backup, config);
  await phase(name, prepared.path);
}
console.log('Recovery rehearsal passed: two full emulator shutdown/import cycles preserved accounts, permissions, reviews, decisions, history and publication.');
