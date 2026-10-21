import { FieldPath } from 'firebase-admin/firestore';
import type { UserRecord } from 'firebase-admin/auth';
import { configSchema, isDistrictEmail, type LocalConfig } from '../shared/config.ts';
import { emulatorEnvironment } from './config.ts';
import type { Services } from './firebase.ts';

export type ReadinessStatus = 'pass' | 'warn' | 'fail' | 'not_checked';
export type ReadinessCode = 'arguments' | 'configuration' | 'emulator_environment' | 'emulators'
  | 'installation' | 'protected_admin' | 'maintenance' | 'second_admin' | 'backup';
export type ReadinessCheck = { code: ReadinessCode; status: ReadinessStatus; message: string };
export type OperationsReadinessReport = {
  format: 'operations-readiness-v1'; scope: 'synthetic-local-only'; ok: boolean; checks: ReadinessCheck[];
};
export const check = (code: ReadinessCode, status: ReadinessStatus, message: string): ReadinessCheck => ({ code, status, message });
export const readinessReport = (checks: ReadinessCheck[]): OperationsReadinessReport => ({
  format: 'operations-readiness-v1', scope: 'synthetic-local-only', ok: !checks.some(c => c.status === 'fail'), checks,
});
const object = (value: unknown): Record<string, unknown> | undefined => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as Record<string, unknown> : undefined;
type Identity = Pick<UserRecord, 'uid' | 'email' | 'emailVerified' | 'disabled'>;
export function validInstallation(config: LocalConfig, value: unknown): value is { bootstrapAdminUid: string } {
  const data = object(value);
  return !!data && data.districtId === config.districtId && data.bootstrapAdminEmail === config.bootstrapAdminEmail
    && JSON.stringify(data.allowedDomains) === JSON.stringify(config.allowedDomains)
    && typeof data.bootstrapAdminUid === 'string' && data.bootstrapAdminUid.length > 0 && data.bootstrapAdminUid.length <= 128
    && !data.bootstrapAdminUid.includes('/');
}
export function validAdministrator(config: LocalConfig, uid: string, user: Identity | undefined, value: unknown, protectedAdmin = false) {
  const member = object(value);
  return !!user && user.uid === uid && typeof user.email === 'string' && user.emailVerified === true && user.disabled === false
    && isDistrictEmail(config, user.email) && (!protectedAdmin || user.email === config.bootstrapAdminEmail)
    && !!member && member.email === user.email && member.role === 'admin' && member.active === true;
}

/** A deadline abandons only reads. No late completion can change installation state. */
export async function boundedRead<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('Local read deadline exceeded.')), milliseconds);
    })]);
  } finally { clearTimeout(timer); }
}
export const uncheckedInstallation = () => [
  check('installation', 'not_checked', 'Installation was not inspected.'),
  check('protected_admin', 'not_checked', 'Protected administrator was not inspected.'),
  check('maintenance', 'not_checked', 'Maintenance was not inspected.'),
  check('second_admin', 'not_checked', 'A second administrator was not inspected.'),
];

async function inspect(s: Services): Promise<ReadinessCheck[]> {
  // Reuse the same synthetic configuration, fixed loopback and credential guards as localServices.
  configSchema.parse(s.config); emulatorEnvironment(s.config);
  const [setup, maintenance] = await Promise.all([
    s.db.doc('installation/config').get(), s.db.doc('installation/maintenance').get(),
  ]);
  const checks = uncheckedInstallation();
  checks[2] = maintenance.exists
    ? check('maintenance', 'fail', 'Maintenance is active. It was left untouched; investigate the existing operation before resuming.')
    : check('maintenance', 'pass', 'No maintenance fence was present at inspection.');
  if (!validInstallation(s.config, setup.data())) {
    checks[0] = check('installation', 'fail', 'Installation is missing, malformed, or differs from the current synthetic configuration.');
    return checks;
  }
  const uid = setup.get('bootstrapAdminUid') as string;
  checks[0] = check('installation', 'pass', 'Installed identity fields match the current synthetic configuration.');
  try {
    const [user, member] = await Promise.all([s.auth.getUser(uid), s.db.doc(`districts/${s.config.districtId}/members/${uid}`).get()]);
    checks[1] = validAdministrator(s.config, uid, user, member.data(), true)
      ? check('protected_admin', 'pass', 'Protected administrator is enabled, verified, and matches the active administrator membership.')
      : check('protected_admin', 'fail', 'Protected administrator identity or membership is missing, malformed, disabled, unverified, or inconsistent.');
  } catch {
    checks[1] = check('protected_admin', 'fail', 'Protected administrator could not be verified from Auth and membership records.');
  }
  // Only membership candidates are read, and Auth returns at most 100 identities per request.
  // Existence of one qualifying candidate suffices; absence is advisory, never succession authority.
  try {
    let cursor: string | undefined;
    for (let pages = 0; pages < 10; pages++) {
      let query = s.db.collection(`districts/${s.config.districtId}/members`)
        .where('role', '==', 'admin').where('active', '==', true).orderBy(FieldPath.documentId()).limit(100);
      if (cursor) query = query.startAfter(cursor);
      const page = await query.get();
      const candidates = page.docs.filter(d => d.id !== uid && d.id.length <= 128);
      const users = candidates.length ? (await s.auth.getUsers(candidates.map(d => ({ uid: d.id })))).users : [];
      const byId = new Map(users.map(user => [user.uid, user]));
      if (candidates.some(d => validAdministrator(s.config, d.id, byId.get(d.id), d.data()))) {
        checks[3] = check('second_admin', 'pass', 'Another enabled, verified, active administrator was found. Succession and recovery authority are not established.');
        return checks;
      }
      if (page.size < 100) {
        checks[3] = check('second_admin', 'warn', 'No other enabled, verified, active administrator was found. Protected-admin succession remains unimplemented.');
        return checks;
      }
      cursor = page.docs.at(-1)!.id;
    }
    checks[3] = check('second_admin', 'warn', 'No second administrator was confirmed within the 1,000-candidate inspection bound. Succession remains unimplemented.');
  } catch {
    checks[3] = check('second_admin', 'fail', 'Administrator candidates could not be inspected. No access changes were made.');
  }
  return checks;
}

/** Local operator diagnostic only. Reads neither review content nor Auth exports, and performs no writes. */
export async function inspectOperationsReadiness(s: Services): Promise<ReadinessCheck[]> {
  try { return await boundedRead(inspect(s), 10_000); }
  catch {
    return uncheckedInstallation().map(c => check(c.code, 'fail', 'Local installation inspection could not complete within its guarded read boundary.'));
  }
}
