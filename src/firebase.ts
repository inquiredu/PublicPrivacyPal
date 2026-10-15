import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator, setPersistence, browserSessionPersistence } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { publicConfigSchema, ports, type PublicConfig } from '../shared/config.ts';

export async function connectLocal(raw: PublicConfig) {
  const config = publicConfigSchema.parse(raw); // Reject real project IDs even if the API is misconfigured.
  if (!['127.0.0.1', 'localhost'].includes(location.hostname)) throw new Error('This milestone can run only on localhost.');
  const existing = getApps().find(a => a.name === config.projectId);
  const app = existing || initializeApp({ apiKey: 'local-demo-key', projectId: config.projectId, authDomain: 'localhost', appId: 'local-demo-app' }, config.projectId);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (!existing) {
    connectAuthEmulator(auth, `http://127.0.0.1:${ports.auth}`, { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', ports.firestore);
  }
  await setPersistence(auth, browserSessionPersistence);
  return { auth, db, config };
}
export type Client = Awaited<ReturnType<typeof connectLocal>>;
