import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const usage = 'Use npm run deploy:wizard (or npm run setup), with optional --check | --new [--install] | --restore PATH [--install].';

export function parseSetupArguments(args) {
  const options = { mode: 'interactive', install: false };
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--install' && !options.install) options.install = true;
    else if (args[i] === '--check' && options.mode === 'interactive') options.mode = 'check';
    else if (args[i] === '--new' && options.mode === 'interactive') options.mode = 'new';
    else if (args[i] === '--restore' && options.mode === 'interactive' && args[i + 1]?.trim() && !args[i + 1].startsWith('--')) {
      options.mode = 'restore'; options.backup = args[++i];
    } else throw new Error(usage);
  }
  if (options.install && ['interactive', 'check'].includes(options.mode)) throw new Error(usage);
  return options;
}

export function javaMajor(output) {
  const version = output.match(/(?:openjdk|java) version "(\d+)(?:\.(\d+))?/i);
  return version ? Number(version[1] === '1' ? version[2] : version[1]) : 0;
}

export function prerequisites(nodeVersion, java) {
  return [
    { name: 'Node 24', ok: Number(nodeVersion.split('.')[0]) === 24,
      detail: `Found Node ${nodeVersion}. Select Node 24 with your runtime manager.` },
    { name: 'Java 21 or later', ok: !java.error && java.status === 0 && javaMajor(`${java.stdout || ''}\n${java.stderr || ''}`) >= 21,
      detail: 'Install/select a Java 21+ JDK, then check java -version in this terminal.' },
  ];
}

/** No shell: paths, including backup paths with spaces, remain single arguments. */
export function launchArguments(options) {
  if (options.mode === 'new') return ['--import', 'tsx', 'scripts/setup-start.mjs', 'dev', '--setup'];
  if (options.mode === 'restore') return ['--import', 'tsx', 'scripts/setup-start.mjs', 'dev', '--restore', options.backup];
  throw new Error('Choose a new workspace or a saved backup before starting.');
}

export async function runSetup(args = process.argv.slice(2)) {
  const options = parseSetupArguments(args);
  process.chdir(root);
  console.log('\nPrivacyPal · Deployment wizard for this computer\n');
  console.log('A fictional workspace on this computer. No Firebase login, district account or AI key.');
  console.log('Hosted deployment is not available in this development preview.\n');
  console.log('1 of 4 · Check this computer');
  const java = spawnSync('java', ['-version'], { encoding: 'utf8', timeout: 10_000, windowsHide: true });
  const checks = prerequisites(process.versions.node, java);
  for (const check of checks) console.log(`${check.ok ? 'Ready' : 'Needs attention'} · ${check.name}${check.ok ? '' : `\n  ${check.detail}`}`);
  const dependencies = ['tsx/dist/loader.mjs', 'firebase-tools/lib/bin/firebase.js', 'vite/bin/vite.js', 'zod/package.json']
    .every(path => existsSync(resolve('node_modules', path)));
  console.log(`${dependencies ? 'Present' : 'Not installed'} · Project dependencies`);
  if (checks.some(check => !check.ok)) throw new Error('Resolve the prerequisites above, then run npm run setup again. No workspace was started.');
  if (options.mode === 'check') {
    console.log('\nPrerequisite check complete. No files changed or services started. Configuration, ports and backups are checked when starting.');
    return;
  }

  let prompt;
  let active;
  let cancelled = false;
  let runningWorkspace = false;
  const stop = () => { cancelled = true; prompt?.close(); active?.kill('SIGINT'); };
  process.on('SIGINT', stop); process.on('SIGTERM', stop);
  const run = (args) => new Promise((accept, reject) => {
    if (cancelled) { reject(new Error('Setup cancelled.')); return; }
    const child = spawn(process.execPath, args, { cwd: root, env: process.env, stdio: 'inherit' });
    active = child;
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (active === child) active = undefined;
      if (code === 0 && !signal && !cancelled) accept();
      else reject(new Error(cancelled ? 'Setup cancelled. Save before stopping a running workspace.' : `Setup stopped (${signal || code}). Review the message above; no automatic reset or retry was attempted.`));
    });
  });
  try {
    if (options.mode === 'interactive') {
      if (!process.stdin.isTTY || !process.stdout.isTTY) throw new Error(`Interactive setup needs a terminal. ${usage}`);
      const { createInterface } = await import('node:readline/promises');
      prompt = createInterface({ input: process.stdin, output: process.stdout });
      console.log('\n2 of 4 · Choose your workspace');
      console.log('1 · Restore a saved installation (keeps accounts and saved work)');
      console.log('2 · Start a new fictional workspace (empty session; previous work needs its backup)');
      const choice = (await prompt.question('Choose 1 or 2, or press Enter to cancel: ')).trim();
      if (choice === '1') {
        options.backup = (await prompt.question('Backup directory (paste its path without surrounding quotes): ')).trim();
        if (!options.backup) throw new Error('No backup selected. Nothing was started.');
        options.mode = 'restore';
      } else if (choice === '2') {
        if ((await prompt.question('There is no automatic save on shutdown. Type NEW to start an empty session: ')).trim() !== 'NEW') {
          throw new Error('New workspace cancelled. Nothing was started.');
        }
        options.mode = 'new';
      } else { console.log('Cancelled. Nothing was started.'); return; }
      const installAnswer = (await prompt.question('Install/refresh this checkout’s pinned dependencies with npm ci? [Y/n] ')).trim();
      options.install = installAnswer === '' || /^(y|yes)$/i.test(installAnswer);
      if (!options.install && !/^(n|no)$/i.test(installAnswer)) throw new Error('Choose yes or no. Nothing was installed or started.');
    } else console.log(`\n2 of 4 · ${options.mode === 'restore' ? 'Restore a saved installation' : 'Start an empty fictional workspace'}`);
    prompt?.close(); prompt = undefined;
    if (options.mode === 'restore' && !existsSync(resolve(options.backup))) throw new Error('Backup directory not found. Preserve your archive and check the path.');
    if (options.install) {
      // npm supplies its JS entry point even on Windows; avoid shell execution of user paths.
      if (!process.env.npm_execpath || !existsSync(process.env.npm_execpath)) throw new Error('Run through npm run setup so the pinned install can use your selected npm.');
      await run([process.env.npm_execpath, 'ci']);
    } else if (!dependencies) throw new Error('Dependencies are required. Run npm ci, then npm run setup again.');
    console.log('\n3 of 4 · Validate configuration and prepare local services');
    const configPath = process.env.PRIVACYPAL_CONFIG || 'config/local.json';
    if (!existsSync(configPath)) {
      if (options.mode === 'restore' || process.env.PRIVACYPAL_CONFIG) throw new Error('Matching configuration is missing. Restore needs the original synthetic configuration; it will not be replaced with defaults.');
      await run(['--import', 'tsx', 'scripts/init.ts']);
    }
    console.log('Existing configuration is preserved. Only demo projects and loopback services are accepted.');
    console.log('\n4 of 4 · Start your workspace');
    console.log('Keep this terminal open. Startup may download local emulator binaries the first time.');
    console.log('Before stopping, run npm run local:backup in another terminal and wait for verification.');
    runningWorkspace = true;
    await run(launchArguments(options));
  } catch (error) {
    if (!cancelled) throw error;
    console.log(runningWorkspace
      ? '\nLocal services stopped. Choose Restore next time to resume your verified backup. Unsaved changes are not retained.'
      : '\nSetup cancelled. No workspace was started.');
  } finally {
    prompt?.close(); process.off('SIGINT', stop); process.off('SIGTERM', stop);
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runSetup().catch(error => { console.error(`\n${error.message}`); process.exitCode = 1; });
}
