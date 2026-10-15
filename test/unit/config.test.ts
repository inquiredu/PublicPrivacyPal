import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { configSchema, publicConfig, publicConfigSchema } from '../../shared/config.ts';
import { emulatorEnvironment, loadConfig } from '../../server/config.ts';
const example = JSON.parse(readFileSync('config/district.example.json', 'utf8'));

test('both independent synthetic district configurations validate', () => {
  const first = loadConfig('config/district.example.json');
  const second = loadConfig('config/second-district.example.json');
  assert.notEqual(first.projectId, second.projectId);
  assert.notEqual(first.districtId, second.districtId);
});
for (const patch of [
  { projectId: 'real-school-project' }, { mode: 'production' }, { districtId: '../other' },
  { allowedDomains: [] }, { allowedDomains: ['school.edu'] }, { bootstrapAdminEmail: 'admin@outsider.example' },
  { apiKey: 'unexpected-field' }, { districtName: '' },
]) test(`configuration rejects ${JSON.stringify(patch)}`, () => assert.equal(configSchema.safeParse({ ...example, ...patch }).success, false));

test('browser configuration exposes no bootstrap identity or private configuration', () => {
  const config = configSchema.parse(example);
  assert.deepEqual(Object.keys(publicConfig(config)).sort(), ['districtId', 'districtName', 'mode', 'projectId']);
  assert.equal(publicConfigSchema.safeParse(config).success, false);
});
test('missing configuration fails with an actionable message', () => assert.throws(() => loadConfig('config/missing.json'), /local:init/));
test('emulator endpoints are fixed to loopback before the SDK is initialized', () => {
  const env = emulatorEnvironment(example, {});
  assert.equal(env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8080');
  assert.equal(env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
  assert.equal(env.GCLOUD_PROJECT, example.projectId);
});
for (const environment of [
  { FIRESTORE_EMULATOR_HOST: 'remote.example:8080' },
  { FIREBASE_AUTH_EMULATOR_HOST: 'localhost.evil.example:9099' },
  { GOOGLE_APPLICATION_CREDENTIALS: '/some/key.json' }, { FIREBASE_TOKEN: 'not-a-real-token' }, { FIREBASE_CONFIG: '{}' },
]) test(`refuses unsafe shell state: ${Object.keys(environment)[0]}`, () => assert.throws(() => emulatorEnvironment(example, environment)));

test('emulator definition includes no cloud deployment target', () => {
  const config = JSON.parse(readFileSync('firebase.local.json', 'utf8'));
  assert.equal(config.hosting, undefined);
  assert.equal(config.functions, undefined);
  assert.equal(config.emulators.auth.host, '127.0.0.1');
  assert.equal(config.emulators.firestore.host, '127.0.0.1');
});
