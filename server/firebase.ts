import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { Firestore } from 'firebase-admin/firestore';
import { emulatorEnvironment } from './config.ts';
import type { LocalConfig } from '../shared/config.ts';

export function localServices(config: LocalConfig) {
  Object.assign(process.env, emulatorEnvironment(config));
  // Never discover credentials from the operator's machine or the cloud metadata service.
  // "owner" is an emulator-only token; it cannot authorize a production Firebase request.
  const app = initializeApp({
    projectId: config.projectId,
    credential: { getAccessToken: async () => ({ access_token: 'owner', expires_in: 3600 }) },
  }, `local-${config.projectId}-${crypto.randomUUID()}`);
  const auth = getAuth(app);
  const db = new Firestore({
    projectId: config.projectId,
    host: process.env.FIRESTORE_EMULATOR_HOST,
    ssl: false,
    credentials: { client_email: 'emulator@local.example', private_key: 'unused-in-emulator' },
  });
  return { auth, db, config, close: async () => { await db.terminate(); await deleteApp(app); } };
}
export type Services = ReturnType<typeof localServices>;
