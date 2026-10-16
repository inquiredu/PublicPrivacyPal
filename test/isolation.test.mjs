import assert from 'node:assert/strict';
import test from 'node:test';
import { inspectFile, inspectOrigin } from '../scripts/check-isolation.mjs';

test('accepts the independent repository over supported Git transports', () => {
  for (const origin of [
    'https://github.com/inquiredu/PublicPrivacyPal.git',
    'git@github.com:inquiredu/PublicPrivacyPal.git',
    'ssh://git@github.com/inquiredu/PublicPrivacyPal.git',
  ]) assert.deepEqual(inspectOrigin(origin), []);
});

test('rejects an original-repository push URL or a lookalike host', () => {
  assert.ok(inspectOrigin('https://github.com/inquiredu/privacypal.git').length);
  assert.ok(inspectOrigin('https://github.com.evil.example/inquiredu/PublicPrivacyPal.git').length);
});

test('rejects private evidence and local deployment bindings if force-added', () => {
  for (const path of ['.private/upstream/App.tsx', '.local/accounts/account.json', 'config/local.json', '.firebaserc', '.firebase/cache']) {
    assert.ok(inspectFile(path, '').length);
  }
});

test('rejects environment files and credential filenames', () => {
  for (const path of ['.env', 'functions/.env.production', 'keys/service-account.json', 'district-adminsdk-x.json']) {
    assert.ok(inspectFile(path, '').length);
  }
  assert.deepEqual(inspectFile('.env.example', 'PROJECT_ID=demo-community'), []);
});

test('detects district connections in source and documentation', () => {
  const project = ['privacy', 'pal', '89831'].join('-');
  const emailDomain = ['orono', 'k12', 'mn', 'us'].join('.');
  assert.ok(inspectFile('services/firebase.ts', `projectId: '${project}'`).length);
  assert.ok(inspectFile('docs/setup.md', `support@${emailDomain}`).length);
});

test('detects key material without printing the value', () => {
  assert.ok(inspectFile('bundle.js', 'AIza' + 'x'.repeat(35)).includes('embedded Google API key'));
  assert.ok(inspectFile('key.txt', ['-----BEGIN', 'PRIVATE KEY-----'].join(' ')).includes('private key'));
});

test('accepts synthetic configuration', () => {
  assert.deepEqual(inspectFile('config/example.json', '{"projectId":"demo-community","domain":"district.example"}'), []);
});
test('rejects completed and interrupted emulator exports if included in source', () => {
  for (const path of ['firebase-export-123/auth_export/accounts.json', 'copied/auth_export/accounts.json', 'copied/firestore_export/output-0', 'copied/privacypal-backup.json', 'copied/firebase-export-metadata.json']) {
    assert.ok(inspectFile(path, '').includes('local emulator backup data included in source'));
  }
});
