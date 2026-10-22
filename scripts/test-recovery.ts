import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:net';
import { loadConfig, emulatorEnvironment } from '../server/config.ts';
import { stageRestore, verifyBackup } from './backup-files.ts';
import { configSchema, type LocalConfig } from '../shared/config.ts';

if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node 24.');
const config = loadConfig('config/test.example.json');
const arguments_ = process.argv.slice(2);
if (arguments_.length !== 0 && (arguments_.length !== 2 || arguments_[0] !== '--baseline')) {
  throw new Error('Usage: npm run test:recovery -- [--baseline PATH_TO_VERIFIED_SCHEMA_9_ARCHIVE]');
}
for (const port of [5173, 8787, 9099, 8080, 4400, 4500, 9150]) await new Promise<void>((accept, reject) => {
  const server = createServer(); server.once('error', () => reject(new Error(`Stop local services first: port ${port} is occupied.`)));
  server.listen(port, '127.0.0.1', () => server.close(error => error ? reject(error) : accept()));
});
process.umask(0o077);
const directory = resolve('.local/recovery-tests', randomUUID()); mkdirSync(directory, { recursive: true, mode: 0o700 });
async function phase(name: string, imported?: string, selectedConfig: LocalConfig = config) {
  const env = { ...emulatorEnvironment(selectedConfig), PRIVACYPAL_CONFIG: 'config/test.example.json', PRIVACYPAL_RECOVERY_TEST: directory, FIREBASE_CLI_DISABLE_UPDATE_CHECK: 'true', PRIVACYPAL_RECOVERY_BASELINE_CONFIG: name === 'historical-nine' ? JSON.stringify(selectedConfig) : '' };
  const args = [resolve('node_modules/firebase-tools/lib/bin/firebase.js'), 'emulators:exec', '--project', selectedConfig.projectId, '--config', 'firebase.local.json', '--only', 'auth,firestore', ...(imported ? ['--import', imported] : []), 'node --import tsx test/recovery/roundtrip.ts'];
  const child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...env, PRIVACYPAL_RECOVERY_PHASE: name, PRIVACYPAL_RESTORE: imported || '', PRIVACYPAL_RECOVERY_IMPORT_STARTED_AT: imported ? String(Date.now()) : '' } });
  const interrupt = () => child.kill('SIGINT'); process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    await new Promise<void>((accept, reject) => {
      child.once('error', reject); child.once('exit', code => code === 0 ? accept() : reject(new Error(`Recovery ${name} failed (${code}).`)));
    });
  } finally { process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); }
}
if (arguments_.length) {
  const source = resolve(arguments_[1]);
  const original = readFileSync(resolve(source, 'privacypal-backup.json'));
  const savedConfig = configSchema.parse(JSON.parse(original.toString('utf8')).config);
  const manifest = verifyBackup(source, savedConfig);
  if (manifest.dataSchema !== 9) throw new Error('The historical baseline must be a verified schema-9 archive; never relabel one.');
  const staged = stageRestore(source, savedConfig);
  await phase('historical-nine', staged.path, savedConfig);
  // Verification hashes every source file; the manifest comparison also prevents relabeling.
  verifyBackup(source, savedConfig);
  if (!readFileSync(resolve(source, 'privacypal-backup.json')).equals(original)) throw new Error('Historical baseline manifest changed during rehearsal.');
  console.log('Historical schema-9 archive restored with its exact configuration; all original archive bytes remain unchanged.');
}
await phase('seed');
for (const name of ['restore-nine', 'restore', 'restore-again']) {
  const receipt = JSON.parse(readFileSync(resolve(directory, 'receipt.json'), 'utf8'));
  const prepared = stageRestore(receipt.backup, config);
  await phase(name, prepared.path);
}
console.log('Recovery rehearsal passed: a schema-9 import followed by two schema-10 shutdown/import cycles preserved accounts, permissions, reviews, decisions, history and publication.');
