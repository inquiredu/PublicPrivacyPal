import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { configSchema, ports, type LocalConfig } from '../shared/config.ts';

export function loadConfig(path = process.env.PRIVACYPAL_CONFIG || 'config/local.json'): LocalConfig {
  try { return configSchema.parse(JSON.parse(readFileSync(resolve(path), 'utf8'))); }
  catch (error) { throw new Error(`Local configuration is missing or invalid. Run npm run local:init and check ${path}. ${error instanceof Error ? error.message : ''}`); }
}
export function emulatorEnvironment(config: LocalConfig, environment: NodeJS.ProcessEnv = process.env) {
  const expected = {
    FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${ports.auth}`,
    FIRESTORE_EMULATOR_HOST: `127.0.0.1:${ports.firestore}`,
  };
  configSchema.parse(config);
  for (const [key, value] of Object.entries(expected)) {
    if (environment[key] && environment[key] !== value) throw new Error(`${key} must be ${value}; refusing a different endpoint.`);
  }
  if (environment.GOOGLE_APPLICATION_CREDENTIALS || environment.FIREBASE_TOKEN || environment.FIREBASE_CONFIG) {
    throw new Error('Remove cloud credentials and FIREBASE_CONFIG from this shell. This app runs only against local emulators.');
  }
  return { ...environment, ...expected, GCLOUD_PROJECT: config.projectId, GOOGLE_CLOUD_PROJECT: config.projectId };
}
