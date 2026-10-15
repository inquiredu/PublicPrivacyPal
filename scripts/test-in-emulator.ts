import { spawn } from 'node:child_process';
import { loadConfig, emulatorEnvironment } from '../server/config.ts';
// Firebase CLI injects FIREBASE_CONFIG into its child. Validate its demo identity, then remove
// it before starting our app tests so no SDK can silently consume a deployment configuration.
const config = loadConfig('config/test.example.json');
if (JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId !== config.projectId) {
  throw new Error('Integration tests must be launched by the dedicated demo emulator command.');
}
const { FIREBASE_CONFIG: _generatedConfig, ...cleanEnvironment } = process.env;
const child = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', 'test/integration/permissions.test.ts', 'test/integration/reviews.test.ts'], {
  stdio: 'inherit', env: emulatorEnvironment(config, cleanEnvironment),
});
child.on('exit', code => { process.exitCode = code ?? 1; });
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
