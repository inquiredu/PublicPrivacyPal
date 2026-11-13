import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, chmodSync, copyFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const unix = process.platform !== 'win32';
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'privacypal-install-'));
  const repo = join(root, 'copied repo with spaces'); const bin = join(root, 'bin');
  mkdirSync(repo); mkdirSync(bin);
  for (const name of ['install.sh', 'Install PrivacyPal.command']) copyFileSync(new URL(`../${name}`, import.meta.url), join(repo, name));
  return { root, repo, bin, env: { ...process.env, PATH: bin } };
}

test('repository launcher explains missing Node before attempting any installation', { skip: !unix }, () => {
  const f = fixture();
  try {
    const result = spawnSync('/bin/sh', [join(f.repo, 'install.sh')], { cwd: tmpdir(), env: f.env, encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /needs Node 24/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('repository launcher refuses older Node before loading the wizard or looking for npm', { skip: !unix }, () => {
  const f = fixture();
  try {
    writeFileSync(join(f.bin, 'node'), '#!/bin/sh\necho v16.20.2\n', { mode: 0o755 });
    const result = spawnSync('/bin/sh', [join(f.repo, 'install.sh')], { cwd: tmpdir(), env: f.env, encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /needs Node 24; found v16/);
    assert.doesNotMatch(result.stderr, /needs npm/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('repository launcher explains missing npm separately', { skip: !unix }, () => {
  const f = fixture();
  try {
    writeFileSync(join(f.bin, 'node'), '#!/bin/sh\necho v24.22.3\n', { mode: 0o755 });
    const result = spawnSync('/bin/sh', [join(f.repo, 'install.sh')], { cwd: tmpdir(), env: f.env, encoding: 'utf8' });
    assert.equal(result.status, 1); assert.match(result.stderr, /needs npm/);
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});

test('copied repo and macOS launcher keep the repository directory and backup arguments literal', { skip: !unix }, () => {
  const f = fixture();
  try {
    writeFileSync(join(f.bin, 'node'), '#!/bin/sh\necho v24.22.3\n', { mode: 0o755 });
    const npm = join(f.bin, 'npm'); const record = join(f.root, 'arguments.json');
    writeFileSync(npm, `#!${process.execPath}\nimport fs from 'node:fs'; fs.writeFileSync(process.env.PRIVACYPAL_INSTALL_RECORD, JSON.stringify({cwd:process.cwd(),args:process.argv.slice(2)}));\n`);
    chmodSync(npm, 0o755);
    const backup = '/tmp/backup with spaces/$(touch never-run);archive';
    for (const name of ['install.sh', 'Install PrivacyPal.command']) {
      const result = spawnSync('/bin/sh', [join(f.repo, name), '--restore', backup], {
        cwd: tmpdir(), env: { ...f.env, PRIVACYPAL_INSTALL_RECORD: record }, encoding: 'utf8',
      });
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(JSON.parse(readFileSync(record, 'utf8')), { cwd: realpathSync(f.repo), args: ['run', 'deploy:wizard', '--', '--restore', backup] });
    }
  } finally { rmSync(f.root, { recursive: true, force: true }); }
});
