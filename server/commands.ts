import { readReview } from './review-storage.ts';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { DecodedIdToken } from 'firebase-admin/auth';
import type { Transaction } from 'firebase-admin/firestore';
import type { Services } from './firebase.ts';
import { HttpError, membersRef, requireMember } from './operations.ts';
import type { Review } from '../shared/review.ts';

export type CommandIdentity = { id: string; hash: string; route: string };
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function commandIdentity(id: unknown, route: string, body: unknown): CommandIdentity {
  if (!z.uuid().safeParse(id).success) throw new HttpError(400, 'A valid Idempotency-Key is required for review changes.');
  return { id: id as string, route, hash: createHash('sha256').update(canonical({ route, body })).digest('hex') };
}
const receiptRef = (s: Services, uid: string, id: string) => s.db.doc(`districts/${s.config.districtId}/commandReceipts/${uid}/entries/${id}`);
export async function replayCommand(s: Services, tx: Transaction, actor: DecodedIdToken, command?: CommandIdentity): Promise<Review | null> {
  if (!command) return null; // Trusted internal callers; HTTP always supplies an identity.
  const receipt = await tx.get(receiptRef(s, actor.uid, command.id));
  if (!receipt.exists) return null;
  if (receipt.get('hash') !== command.hash || receipt.get('route') !== command.route) throw new HttpError(409, 'This command ID was already used for different content.');
  const review = await tx.get(s.db.doc(`districts/${s.config.districtId}/reviews/${receipt.get('reviewId')}`));
  if (!review.exists) throw new HttpError(409, 'The saved result is unavailable. Do not resubmit as a new command.');
  return readReview(s, tx, receipt.get('reviewId'), review); // Return current state, never roll back to an earlier result.
}
export function recordCommand(s: Services, tx: Transaction, actor: DecodedIdToken, review: Review, command?: CommandIdentity) {
  if (command) tx.create(receiptRef(s, actor.uid, command.id), { ...command, actorUid: actor.uid, reviewId: review.id, appliedRevision: review.revision, at: new Date().toISOString() });
}
export async function commandStatus(s: Services, actor: DecodedIdToken, id: string) {
  return s.db.runTransaction(async tx => {
    requireMember((await tx.get(membersRef(s).doc(actor.uid))).data(), actor, ['admin', 'reviewer']);
    const receipt = await tx.get(receiptRef(s, actor.uid, id));
    if (!receipt.exists) return { state: 'not_found' as const };
    const review = await tx.get(s.db.doc(`districts/${s.config.districtId}/reviews/${receipt.get('reviewId')}`));
    if (!review.exists) throw new HttpError(409, 'The saved result is unavailable. Contact your local operator.');
    return { state: 'applied' as const, appliedRevision: receipt.get('appliedRevision') as number, review: await readReview(s, tx, receipt.get('reviewId'), review) };
  });
}
