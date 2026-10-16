import { createHash } from 'node:crypto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Services } from './firebase.ts';
import { assertWritable, HttpError, membersRef, requireMember } from './operations.ts';
import { defaultEvaluation, defaultLibrary, initialSettings, MAX_LOGO_BYTES, publicLibrarySettings, settingsCommandSchema, SETTINGS_DEFINITION_VERSION, type SavedSettings } from '../shared/settings.ts';

const settings = (s: Services) => s.db.collection(`districts/${s.config.districtId}/settings`);
export async function getSettings(s: Services, actor: DecodedIdToken) {
  return s.db.runTransaction(async tx => {
    requireMember((await tx.get(membersRef(s).doc(actor.uid))).data(), actor, ['admin']);
    const [evaluation, library] = await Promise.all([tx.get(settings(s).doc('evaluation')), tx.get(settings(s).doc('library'))]);
    return { evaluation: evaluation.data() || initialSettings(defaultEvaluation()), library: library.data() || initialSettings(defaultLibrary(s.config.districtName)) };
  });
}
function validateLogo(logo: string) {
  if (!logo) return;
  const [header, encoded] = logo.split(','); const bytes = Buffer.from(encoded, 'base64');
  const signature = header === 'data:image/png;base64' ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : header === 'data:image/jpeg;base64' ? bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    : bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP';
  if (!signature || bytes.length > MAX_LOGO_BYTES || bytes.toString('base64') !== encoded) throw new HttpError(400, 'Use a valid PNG, JPEG, or WebP logo under 100 KB.');
}
export async function saveSettings(s: Services, actor: DecodedIdToken, raw: unknown) {
  // Authorize before returning validation detail. Recheck in the write transaction below.
  requireMember((await membersRef(s).doc(actor.uid).get()).data(), actor, ['admin']);
  const result = settingsCommandSchema.safeParse(raw);
  if (!result.success) throw new HttpError(400, result.error.issues[0]?.message || 'Invalid settings.');
  const input = result.data;
  if (input.section === 'library') validateLogo(input.values.logo);
  return s.db.runTransaction(async tx => {
    await assertWritable(s, tx);
    requireMember((await tx.get(membersRef(s).doc(actor.uid))).data(), actor, ['admin']);
    const ref = settings(s).doc(input.section); const current = await tx.get(ref);
    if ((current.get('revision') || 0) !== input.revision) throw new HttpError(409, 'These settings changed in another session. Your edits are still here. Reload saved settings before trying again.');
    const record: SavedSettings<typeof input.values> = {
      schemaVersion: 1, revision: input.revision + 1, complete: true, values: input.values,
      updatedAt: new Date().toISOString(), updatedBy: actor.uid, definitionVersion: SETTINGS_DEFINITION_VERSION,
      contentHash: createHash('sha256').update(JSON.stringify({ definitionVersion: SETTINGS_DEFINITION_VERSION, values: input.values })).digest('hex'),
    };
    tx.set(ref, record); tx.create(ref.collection('versions').doc(String(record.revision)), record);
    tx.create(s.db.collection(`districts/${s.config.districtId}/audit`).doc(), { action: `${input.section}_settings_saved`, actorUid: actor.uid, revision: record.revision, contentHash: record.contentHash, at: record.updatedAt });
    if (input.section === 'library') tx.set(s.db.doc(`publicDistricts/${s.config.districtId}`), { librarySettings: publicLibrarySettings(input.values), libraryRevision: record.revision }, { merge: true });
    return record;
  });
}
