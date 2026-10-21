import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { loadConfig } from '../../server/config.ts';
import type { Services } from '../../server/firebase.ts';
import { boundedRead, check, readinessReport, validAdministrator, validInstallation } from '../../server/operations-readiness.ts';
import { parseOperationsArguments, runOperationsCheck, formatOperationsReport } from '../../scripts/operations-check.ts';
import { sealBackup } from '../../scripts/backup-files.ts';

const config = loadConfig('config/test.example.json');
const setup = { districtId: config.districtId, bootstrapAdminEmail: config.bootstrapAdminEmail, allowedDomains: config.allowedDomains, bootstrapAdminUid: 'protected-unit' };
const user = { uid: setup.bootstrapAdminUid, email: config.bootstrapAdminEmail, disabled: false, emailVerified: true };
const member = { email: user.email, role: 'admin', active: true };
const secret = 'private-account-and-error-marker';
const clean = { load: () => config, environment: {}, probe: async () => {} };
const inspected = [check('installation', 'pass', 'Installed.'), check('protected_admin', 'pass', 'Confirmed.'),
  check('maintenance', 'pass', 'Inactive.'), check('second_admin', 'warn', 'No second administrator confirmed.')];
const noServices = () => { throw new Error('Services must not be opened.'); };

test('operator arguments accept either order and reject unknown, repeated, positional and missing values', () => {
  assert.deepEqual(parseOperationsArguments([]), { json: false });
  assert.deepEqual(parseOperationsArguments(['--backup', 'a path', '--json']), { json: true, backup: 'a path' });
  assert.deepEqual(parseOperationsArguments(['--json', '--backup', 'path']), { json: true, backup: 'path' });
  for (const args of [['--json', '--json'], ['--backup'], ['--backup', ''], ['--backup', '  '], ['--backup', '--json'],
    ['--backup', 'one', '--backup', 'two'], ['--unknown'], ['path'], ['--json=true']]) assert.throws(() => parseOperationsArguments(args));
});

test('installation validation requires exact protected identity configuration and a usable Auth UID', () => {
  assert.equal(validInstallation(config, setup), true);
  for (const value of [undefined, null, [], {}, { ...setup, districtId: 'wrong' }, { ...setup, bootstrapAdminEmail: 'wrong@school.example' },
    { ...setup, allowedDomains: ['other.example'] }, ...[undefined, null, 7, '', 'x/y', 'x'.repeat(129)].map(bootstrapAdminUid => ({ ...setup, bootstrapAdminUid }))]) {
    assert.equal(validInstallation(config, value), false);
  }
});

test('administrator checks require exact Auth and membership agreement, enabled verification and configured domain', () => {
  assert.equal(validAdministrator(config, user.uid, user, member, true), true);
  for (const altered of [undefined, { ...user, uid: 'wrong' }, { ...user, disabled: true }, { ...user, emailVerified: false },
    { ...user, email: undefined }, { ...user, email: 'outside@unconfigured.example' }]) {
    assert.equal(validAdministrator(config, user.uid, altered, member, true), false);
  }
  for (const altered of [undefined, {}, { ...member, role: 'reviewer' }, { ...member, active: false }, { ...member, active: 'true' },
    { ...member, email: 'different@school.example' }]) assert.equal(validAdministrator(config, user.uid, user, altered, true), false);
  const other = { ...user, uid: 'second', email: 'second@school.example' };
  assert.equal(validAdministrator(config, other.uid, other, { ...member, email: other.email }), true);
  assert.equal(validAdministrator(config, other.uid, other, { ...member, email: other.email }, true), false);
});

test('argument and configuration failures are redacted and never open services', async () => {
  for (const args of [['--unknown', secret], []]) {
    const report = await runOperationsCheck(args, { load: () => { throw new Error(secret); }, services: noServices });
    assert.equal(report.ok, false);
    for (const json of [false, true]) assert.equal(formatOperationsReport(report, json).includes(secret), false);
  }
});

test('cloud credentials and different emulator endpoints fail before any service connection', async () => {
  for (const environment of [{ GOOGLE_APPLICATION_CREDENTIALS: secret }, { FIREBASE_TOKEN: secret },
    { FIREBASE_CONFIG: secret }, { FIRESTORE_EMULATOR_HOST: 'external.example:8080' }, { FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9999' }]) {
    const report = await runOperationsCheck([], { ...clean, environment, services: noServices, probe: async () => assert.fail('probe must not run') });
    assert.equal(report.checks.find(c => c.code === 'emulator_environment')?.status, 'fail');
    assert.equal(JSON.stringify(report).includes(secret), false);
  }
});

test('unavailable emulator errors are bounded, redacted and do not initialize services', async () => {
  const report = await runOperationsCheck([], { ...clean, services: noServices, probe: async () => { throw new Error(secret); } });
  assert.equal(report.checks.find(c => c.code === 'emulators')?.status, 'fail');
  assert.equal(report.checks.find(c => c.code === 'installation')?.status, 'not_checked');
  assert.equal(JSON.stringify(report).includes(secret), false);
  await assert.rejects(boundedRead(new Promise(() => {}), 10), /deadline/);
});

test('advisories alone succeed, no supplied archive stays not_checked, and read services close', async () => {
  let closed = 0; let verified = 0;
  const report = await runOperationsCheck([], { ...clean, services: () => ({ close: async () => { closed++; } }) as Services,
    inspect: async () => inspected, verify: () => { verified++; } });
  assert.equal(report.ok, true); assert.equal(closed, 1); assert.equal(verified, 0);
  assert.equal(report.checks.find(c => c.code === 'backup')?.status, 'not_checked');
  assert.equal(report.checks.find(c => c.code === 'second_admin')?.status, 'warn');
  assert.equal(JSON.parse(formatOperationsReport(report, true)).format, 'operations-readiness-v1');
  assert.match(formatOperationsReport(report, false), /does not establish production readiness/);
});

test('SDK failures are redacted, close services, and fail the report', async () => {
  let closed = false;
  const report = await runOperationsCheck([], { ...clean, services: () => ({ close: async () => { closed = true; } }) as Services,
    inspect: async () => { throw new Error(secret); } });
  assert.equal(report.ok, false); assert.equal(closed, true); assert.equal(JSON.stringify(report).includes(secret), false);
  assert.equal(readinessReport([check('maintenance', 'fail', 'Active.')]).ok, false);
});

test('connection-close failure updates its stable code once', async () => {
  const report = await runOperationsCheck([], { ...clean, services: () => ({ close: async (): Promise<void> => { throw new Error(secret); } }) as Services,
    inspect: async () => inspected });
  assert.equal(report.ok, false);
  assert.equal(report.checks.filter(c => c.code === 'emulators').length, 1);
  assert.equal(report.checks.find(c => c.code === 'emulators')?.status, 'fail');
  assert.equal(JSON.stringify(report).includes(secret), false);
});

test('CLI flushes complete redacted JSON to a pipe and returns nonzero for missing configuration', () => {
  const output = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/operations-check.ts', '--json'], {
    encoding: 'utf8', timeout: 5000, env: { ...process.env, PRIVACYPAL_CONFIG: `/nonexistent/${secret}` },
  });
  assert.equal(output.status, 1); assert.equal(output.stderr, '');
  assert.equal(JSON.parse(output.stdout).format, 'operations-readiness-v1');
  assert.equal(output.stdout.includes(secret), false); assert.ok(output.stdout.endsWith('}\n'));
});

test('optional archive uses existing exact verifier without modifying the archive or exposing its path', async t => {
  const root = mkdtempSync(join(tmpdir(), 'privacypal-readiness-unit-'));
  t.after(() => rmSync(root, { recursive: true }));
  mkdirSync(join(root, 'auth_export')); mkdirSync(join(root, 'firestore_export'));
  const version = JSON.parse(readFileSync('package.json', 'utf8')).devDependencies['firebase-tools'];
  const files: Record<string, string> = {
    'firebase-export-metadata.json': JSON.stringify({ version, auth: { version, path: 'auth_export' },
      firestore: { version: 'synthetic', path: 'firestore_export', metadata_file: 'firestore_export/firestore_export.overall_export_metadata' } }),
    'auth_export/accounts.json': '{"users":[]}', 'auth_export/config.json': '{}',
    'firestore_export/firestore_export.overall_export_metadata': 'synthetic', 'firestore_export/output-0': 'synthetic',
  };
  for (const [path, content] of Object.entries(files)) writeFileSync(join(root, path), content);
  sealBackup(root, config, randomUUID());
  const paths = [...Object.keys(files), 'privacypal-backup.json'];
  const before = paths.map(path => readFileSync(join(root, path)));
  const deps = { ...clean, services: () => ({ close: async () => {} }) as Services, inspect: async () => inspected };
  const report = await runOperationsCheck(['--backup', root], deps);
  assert.equal(report.checks.find(c => c.code === 'backup')?.status, 'pass');
  assert.deepEqual(paths.map(path => readFileSync(join(root, path))), before);
  const mismatch = await runOperationsCheck(['--backup', root], { ...deps, load: () => ({ ...config, projectId: 'demo-another' }) });
  assert.equal(mismatch.checks.find(c => c.code === 'backup')?.status, 'fail');
  writeFileSync(join(root, 'firestore_export/output-0'), 'damaged synthetic');
  const failed = await runOperationsCheck(['--backup', root], deps);
  assert.equal(failed.ok, false); assert.equal(failed.checks.find(c => c.code === 'backup')?.status, 'fail');
  assert.equal(JSON.stringify(failed).includes(root), false);
  assert.equal(readFileSync(join(root, 'firestore_export/output-0'), 'utf8'), 'damaged synthetic');
});
