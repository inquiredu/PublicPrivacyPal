import { FieldValue } from 'firebase-admin/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { isDistrictEmail, memberCommandSchema, type Role } from '../shared/config.ts';
import type { Services } from './firebase.ts';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
const installationRef = (s: Services) => s.db.doc('installation/config');
const districtRef = (s: Services) => s.db.doc(`districts/${s.config.districtId}`);
export const membersRef = (s: Services) => districtRef(s).collection('members');

/** Read inside every write transaction so an operator snapshot fences in-flight writes too. */
export async function assertWritable(s: Services, tx: FirebaseFirestore.Transaction) {
  if ((await tx.get(s.db.doc('installation/maintenance'))).exists) {
    throw new HttpError(503, 'The local operator is saving or recovering this sandbox. Try again when maintenance finishes.');
  }
}

export async function installation(s: Services) {
  const snap = await installationRef(s).get();
  if (!snap.exists) throw new HttpError(409, 'This installation needs initial administrator setup from the local operator command.');
  const data = snap.data()!;
  if (data.districtId !== s.config.districtId || data.bootstrapAdminEmail !== s.config.bootstrapAdminEmail
      || JSON.stringify(data.allowedDomains) !== JSON.stringify(s.config.allowedDomains)) {
    throw new HttpError(409, 'Configuration differs from the initialized installation. Use a new demo project or restore the original configuration.');
  }
  return data;
}

export async function authenticate(s: Services, header: string | undefined) {
  if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Sign in to continue.');
  let identity: DecodedIdToken;
  try { identity = await s.auth.verifyIdToken(header.slice(7), true); }
  catch { throw new HttpError(401, 'Your sign-in expired or is not valid. Please sign in again.'); }
  if (!identity.email || !identity.email_verified || !isDistrictEmail(s.config, identity.email)) {
    throw new HttpError(403, 'A verified account in this district is required.');
  }
  await installation(s);
  return identity;
}

export function requireMember(data: FirebaseFirestore.DocumentData | undefined, identity: DecodedIdToken, roles: readonly Role[]) {
  if (!data || data.active !== true || data.email !== identity.email || !roles.includes(data.role)) {
    throw new HttpError(403, 'Your account does not have permission for this action.');
  }
  return data as { role: Role; email: string; active: boolean };
}

export async function currentMember(s: Services, identity: DecodedIdToken) {
  const snap = await membersRef(s).doc(identity.uid).get();
  return { uid: identity.uid, ...requireMember(snap.data(), identity, ['admin', 'reviewer', 'viewer', 'staff']) };
}

export async function listMembers(s: Services, identity: DecodedIdToken) {
  return s.db.runTransaction(async tx => {
    requireMember((await tx.get(membersRef(s).doc(identity.uid))).data(), identity, ['admin']);
    const [members, setup] = await Promise.all([tx.get(membersRef(s)), tx.get(installationRef(s))]);
    return members.docs.map(d => ({ uid: d.id, email: d.get('email'), role: d.get('role'), active: d.get('active'), protected: d.id === setup.get('bootstrapAdminUid') }));
  });
}

export async function changeMember(s: Services, identity: DecodedIdToken, raw: unknown) {
  const parsed = memberCommandSchema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, 'Provide an email, a valid role, and an active status only.');
  const data = parsed.data;
  // Check authority before looking up an email, avoiding a staff-accessible account lookup.
  requireMember((await membersRef(s).doc(identity.uid).get()).data(), identity, ['admin']);
  if (!isDistrictEmail(s.config, data.email)) throw new HttpError(400, 'The account must belong to this district.');
  const user = await s.auth.getUserByEmail(data.email).catch(() => { throw new HttpError(400, 'Create this local account with the operator command first.'); });
  if (!user.emailVerified || user.disabled) throw new HttpError(400, 'The account must be verified and enabled.');
  if (user.uid === identity.uid) throw new HttpError(403, 'You cannot change your own membership.');
  await s.db.runTransaction(async tx => {
    await assertWritable(s, tx);
    const [actor, setup] = await Promise.all([tx.get(membersRef(s).doc(identity.uid)), tx.get(installationRef(s))]);
    requireMember(actor.data(), identity, ['admin']);
    if (setup.get('bootstrapAdminUid') === user.uid) throw new HttpError(403, 'The initial administrator is protected.');
    const ref = membersRef(s).doc(user.uid);
    const before = await tx.get(ref);
    tx.set(ref, { email: data.email, role: data.role, active: data.active, updatedAt: FieldValue.serverTimestamp(), updatedBy: identity.uid });
    tx.create(districtRef(s).collection('audit').doc(), {
      action: 'membership_changed', actorUid: identity.uid, targetUid: user.uid,
      before: before.exists ? { role: before.get('role'), active: before.get('active') } : null,
      after: { role: data.role, active: data.active }, at: FieldValue.serverTimestamp(),
    });
  });
  return { uid: user.uid };
}

/** Operator-only: never exposed by HTTP. Creates the Auth identity; it cannot adopt a preclaimed account. */
export async function bootstrap(s: Services, password: string) {
  const existing = await installationRef(s).get();
  if (existing.exists) { await installation(s); return { created: false, uid: existing.get('bootstrapAdminUid') as string }; }
  let user;
  try { user = await s.auth.createUser({ email: s.config.bootstrapAdminEmail, password, emailVerified: true }); }
  catch (error) {
    if ((error as { code?: string }).code === 'auth/email-already-exists') throw new Error('Bootstrap email already exists without an installation. Refusing to adopt it. Restart empty local emulators or choose a new demo project.');
    throw error;
  }
  try {
    await s.db.runTransaction(async tx => {
      if ((await tx.get(installationRef(s))).exists) throw new Error('Installation was already initialized.');
      const createdAt = FieldValue.serverTimestamp();
      tx.create(installationRef(s), {
        districtId: s.config.districtId, bootstrapAdminUid: user.uid,
        bootstrapAdminEmail: s.config.bootstrapAdminEmail, allowedDomains: s.config.allowedDomains,
      });
      tx.create(districtRef(s), { name: s.config.districtName, createdAt });
      tx.create(membersRef(s).doc(user.uid), { email: s.config.bootstrapAdminEmail, role: 'admin', active: true, updatedAt: createdAt, updatedBy: user.uid });
      tx.create(districtRef(s).collection('settings').doc('private'), { internalNote: 'Synthetic installation settings. Visible only to administrators.' });
      tx.create(s.db.doc(`publicDistricts/${s.config.districtId}`), { name: s.config.districtName, notice: 'Example records for local testing. These are not real vendor evaluations.' });
      tx.create(districtRef(s).collection('audit').doc(), { action: 'installation_created', actorUid: user.uid, at: createdAt });
      for (const sample of [
        { id: 'reading-garden', name: 'Reading Garden', summary: 'A fictional reading practice tool for exploring the district catalogue.', category: 'Literacy' },
        { id: 'number-studio', name: 'Number Studio', summary: 'A fictional mathematics workspace. This record contains no student information.', category: 'Mathematics' },
        { id: 'creative-atlas', name: 'Creative Atlas', summary: 'A fictional creative learning resource for testing search and public access.', category: 'Creative learning' },
      ]) {
        const profile = { name: sample.name, summary: sample.summary, category: sample.category };
        tx.create(s.db.doc(`publicDistricts/${s.config.districtId}/tools/${sample.id}`), profile);
        tx.create(districtRef(s).collection('staffTools').doc(sample.id), profile);
        tx.create(districtRef(s).collection('tools').doc(sample.id), {
          name: sample.name, url: `https://${sample.id}.example/privacy`, notes: 'Synthetic reviewer note; never part of the public record.',
          createdAt, updatedAt: createdAt, updatedBy: user.uid,
        });
      }
    });
  } catch (error) { await s.auth.deleteUser(user.uid); throw error; }
  return { created: true, uid: user.uid };
}
