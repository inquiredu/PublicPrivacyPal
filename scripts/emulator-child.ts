import { emulatorEnvironment } from '../server/config.ts';
import type { LocalConfig } from '../shared/config.ts';
/** Only strip the Firebase CLI's generated config after checking the intended demo identity. */
export function childEnvironment(config: LocalConfig): NodeJS.ProcessEnv {
  if (JSON.parse(process.env.FIREBASE_CONFIG || '{}').projectId !== config.projectId) throw new Error('Launch through the local emulator runner.');
  const { FIREBASE_CONFIG: _generated, ...clean } = process.env;
  return emulatorEnvironment(config, clean);
}
