import { pathToFileURL } from 'node:url';
import { loadConfig, emulatorEnvironment } from '../server/config.ts';
import { localServices, type Services } from '../server/firebase.ts';
import { boundedRead, check, inspectOperationsReadiness, readinessReport, uncheckedInstallation,
  type OperationsReadinessReport, type ReadinessCheck } from '../server/operations-readiness.ts';
import { verifyBackup } from './backup-files.ts';
import { configSchema, type LocalConfig } from '../shared/config.ts';

export function parseOperationsArguments(args: string[]): { json: boolean; backup?: string } {
  let json = false; let backup: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json' && !json) json = true;
    else if (args[i] === '--backup' && backup === undefined && args[i + 1]?.trim() && !args[i + 1].startsWith('--')) backup = args[++i];
    else throw new Error('Use local:check with optional --json and --backup PATH, once each.');
  }
  return { json, ...(backup === undefined ? {} : { backup }) };
}

/** Fixed loopback GET probes only; never follow redirects or use an input URL. */
export async function probeLocalEmulators() {
  const responses = await Promise.all([9099, 8080].map(port => fetch(`http://127.0.0.1:${port}/`, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(2_000),
  })));
  for (const response of responses) {
    await response.body?.cancel();
    if (!response.ok) throw new Error('Local emulator probe did not succeed.');
  }
}

type Dependencies = {
  load: () => LocalConfig; environment: NodeJS.ProcessEnv; probe: () => Promise<void>;
  services: (config: LocalConfig) => Services;
  inspect: (s: Services) => Promise<ReadinessCheck[]>;
  verify: (path: string, config: LocalConfig) => unknown;
};
const defaults: Dependencies = { load: loadConfig, environment: process.env, probe: probeLocalEmulators,
  services: localServices, inspect: inspectOperationsReadiness, verify: verifyBackup };

export async function runOperationsCheck(args: string[], overrides: Partial<Dependencies> = {}): Promise<OperationsReadinessReport> {
  const deps = { ...defaults, ...overrides };
  let options: ReturnType<typeof parseOperationsArguments>;
  try { options = parseOperationsArguments(args); }
  catch { return readinessReport([check('arguments', 'fail', 'Use local:check with optional --json and --backup PATH, once each.')]); }
  const checks: ReadinessCheck[] = [];
  let config: LocalConfig;
  try { config = configSchema.parse(deps.load()); checks.push(check('configuration', 'pass', 'Current configuration is a valid synthetic installation.')); }
  catch {
    return readinessReport([check('configuration', 'fail', 'Local configuration is missing or invalid. Inspect the configured local file; no initialization was performed.'),
      check('emulator_environment', 'not_checked', 'Emulator environment was not inspected.'), check('emulators', 'not_checked', 'Emulators were not inspected.'),
      ...uncheckedInstallation(), check('backup', 'not_checked', options.backup ? 'Supplied archive was not checked because configuration is invalid.' : 'No archive supplied; backup was not checked.')]);
  }
  try { emulatorEnvironment(config, deps.environment); checks.push(check('emulator_environment', 'pass', 'Only fixed loopback emulators and emulator-only credentials are permitted.')); }
  catch {
    checks.push(check('emulator_environment', 'fail', 'Configuration or shell environment violates the local emulator guard. No service connection was opened.'));
  }
  if (options.backup) {
    try { deps.verify(options.backup, config); checks.push(check('backup', 'pass', 'Supplied archive passed integrity and exact configuration/toolchain verification. No restore was performed.')); }
    catch { checks.push(check('backup', 'fail', 'Supplied archive failed verification. Preserve it and use its matching configuration and toolchain; no restore was attempted.')); }
  } else checks.push(check('backup', 'not_checked', 'No archive supplied; backup was not checked.'));
  if (checks.some(c => c.code === 'emulator_environment' && c.status === 'fail')) {
    checks.push(check('emulators', 'not_checked', 'Emulators were not contacted.'), ...uncheckedInstallation()); return readinessReport(checks);
  }
  try { await boundedRead(deps.probe(), 2_500); checks.push(check('emulators', 'pass', 'Both fixed loopback emulator endpoints responded.')); }
  catch {
    checks.push(check('emulators', 'fail', 'Local emulators are unavailable or did not respond within the read deadline.'), ...uncheckedInstallation()); return readinessReport(checks);
  }
  let s: Services | undefined;
  try { s = deps.services(config); checks.push(...await boundedRead(deps.inspect(s), 11_000)); }
  catch { checks.push(...uncheckedInstallation().map(c => check(c.code, 'fail', 'Local installation inspection failed. No access or configuration changes were made.'))); }
  finally {
    if (s) {
      try { await boundedRead(s.close(), 1_000); }
      catch {
        checks[checks.findIndex(c => c.code === 'emulators')] = check('emulators', 'fail', 'Local read connections did not close within the deadline.');
      }
    }
  }
  return readinessReport(checks);
}

export function formatOperationsReport(report: OperationsReadinessReport, json: boolean) {
  if (json) return JSON.stringify(report, null, 2);
  return ['Local operator check — synthetic emulators only.', ...report.checks.map(c => `${c.status.toUpperCase()} ${c.code}: ${c.message}`),
    'This read-only check does not establish production readiness, a successful restore, or protected-admin succession.'].join('\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const report = await runOperationsCheck(args);
  // Await the pipe callback so a forced exit cannot truncate machine-readable JSON.
  try {
    await new Promise<void>((resolve, reject) => process.stdout.write(`${formatOperationsReport(report, args.includes('--json'))}\n`, error => error ? reject(error) : resolve()));
  } catch { process.exit(1); }
  // Terminate abandoned SDK reads on a deadline; this command has no pending write operations.
  process.exit(report.ok ? 0 : 1);
}
