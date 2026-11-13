import test from 'node:test';
import assert from 'node:assert/strict';
import { javaMajor, launchArguments, parseSetupArguments, prerequisites } from '../scripts/setup.mjs';

test('setup refuses ambiguous, repeated and incomplete startup choices', () => {
  for (const args of [['--restore'], ['--new', '--restore', 'backup'], ['--check', '--install'], ['--install'], ['--new', '--new'], ['--restore', '--new'], ['--new', '--install', '--install'], ['--unknown']]) {
    assert.throws(() => parseSetupArguments(args));
  }
  assert.deepEqual(parseSetupArguments([]), { mode: 'interactive', install: false });
  assert.deepEqual(parseSetupArguments(['--check']), { mode: 'check', install: false });
});

test('restore paths stay literal and restore never requests bootstrap', () => {
  const path = '/tmp/saved workspace/$(touch unwanted);backup';
  const options = parseSetupArguments(['--restore', path, '--install']);
  assert.deepEqual(launchArguments(options), ['--import', 'tsx', 'scripts/setup-start.mjs', 'dev', '--restore', path]);
  assert.deepEqual(launchArguments(parseSetupArguments(['--new'])), ['--import', 'tsx', 'scripts/setup-start.mjs', 'dev', '--setup']);
  assert.throws(() => launchArguments(parseSetupArguments([])));
});

test('prerequisite checks handle Java errors, old releases and vendor version strings', () => {
  assert.equal(javaMajor('openjdk version "21.0.12" 2026-07-21 LTS'), 21);
  assert.equal(javaMajor('java version "1.8.0_412"'), 8);
  assert.equal(javaMajor('openjdk version "25"'), 25);
  assert.equal(javaMajor('Unable to locate a Java Runtime.'), 0);
  const java = { status: 0, stderr: 'openjdk version "21.0.12"' };
  assert.ok(prerequisites('24.22.3', java).every(check => check.ok));
  assert.equal(prerequisites('25.1.0', java)[0].ok, false);
  assert.equal(prerequisites('24.1.0', { ...java, error: new Error('timeout') })[1].ok, false);
  assert.equal(prerequisites('24.1.0', { ...java, status: 1 })[1].ok, false);
  assert.equal(prerequisites('24.1.0', { status: 0, stdout: 'java version "17.0.1"' })[1].ok, false);
});
