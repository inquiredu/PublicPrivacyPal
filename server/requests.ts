import { inRequestQueue, summarizeRequests, type RequestQueue } from '../shared/request-dashboard.ts';
import { randomUUID } from 'node:crypto';
import { FieldPath, type Transaction } from 'firebase-admin/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { z } from 'zod';
import type { Services } from './firebase.ts';
import { assertWritable, HttpError, membersRef, requireMember } from './operations.ts';
import type { CommandIdentity } from './commands.ts';
import { digest } from './evaluation.ts';
import { REQUEST_LIMITS as L, requestIdSchema, requestCreateSchema, requestActionSchema, requestStateSchema, requestHeadSchema, requestEventSchema, requestReceiptSchema, requestView, transitionRequest, type RequestState, type RequestEvent } from '../shared/requests.ts';
const roles = ['admin', 'reviewer', 'viewer', 'staff'] as const;
export const requestsRef = (s: Services) => s.db.collection(`districts/${s.config.districtId}/requests`);
const receiptsRef = (s: Services, uid: string) => s.db.collection(`districts/${s.config.districtId}/requestReceipts/${uid}/entries`);
export const eventId = (n: number) => String(n).padStart(6, '0');
export const requestBytes = (x: unknown) => Buffer.byteLength(JSON.stringify(x), 'utf8');
const reviewer = (role: string) => ['admin', 'reviewer'].includes(role);
function parse<T>(schema: z.ZodType<T>, raw: unknown): T { const result = schema.safeParse(raw); if (!result.success) throw new HttpError(400, 'Invalid request fields or state.'); return result.data; }
export function requestHead(id: string, raw: unknown) {
  parse(requestIdSchema, id);
  const data = raw as Record<string, unknown> | undefined;
  if (!data) throw new HttpError(404, 'Request not found.');
  if ('state' in data) { const head = parse(requestHeadSchema, data); if (head.state.id !== id) throw new HttpError(409, 'Request identity mismatch.'); return head; }
  // Legacy requests are interpreted read-only. First command adopts them without inventing prior events.
  const legacy = parse(z.object({ toolName: z.string().min(1).max(120), purpose: z.string().min(1).max(2000), requestedBy: z.string().min(1).max(128),
    status: z.literal('pending'), archived: z.boolean(), createdAt: z.unknown().optional() }).strict(), data);
  let createdAt: string | null = null;
  if (legacy.createdAt !== undefined) {
    const stamp = legacy.createdAt as { toDate?: () => Date };
    const date = stamp?.toDate ? stamp.toDate() : new Date(legacy.createdAt as string);
    if (!Number.isFinite(date.getTime())) throw new HttpError(409, 'Legacy request timestamp is invalid.');
    createdAt = date.toISOString();
  }
  return { state: parse(requestStateSchema, { version: 1, id, toolName: legacy.toolName, purpose: legacy.purpose, requestedUrl: '', requestedBy: legacy.requestedBy,
    createdAt, updatedAt: createdAt, legacy: true, revision: 0, status: 'pending', assignee: null, outcome: null,
    archivedByRequester: legacy.archived, archivedByAdmin: false }), retainedBytes: 0 };
}
async function member(s: Services, tx: Transaction, actor: DecodedIdToken) { return requireMember((await tx.get(membersRef(s).doc(actor.uid))).data(), actor, roles); }
function canRead(r: RequestState, uid: string, role: string) { if (!reviewer(role) && r.requestedBy !== uid) throw new HttpError(403, 'This request is private to its requester and reviewers.'); }
function commandAuthority(action: string, role: string) {
  if (['takeover', 'reopen'].includes(action) && role !== 'admin') throw new HttpError(403, 'Administrator access is required.');
  if (!['create', 'archive'].includes(action) && !reviewer(role)) throw new HttpError(403, 'Reviewer access is required.');
}
export async function requestDetail(s: Services, actor: DecodedIdToken, id: string) {
  parse(requestIdSchema, id);
  return s.db.runTransaction(async tx => { const m = await member(s, tx, actor); const r = requestHead(id, (await tx.get(requestsRef(s).doc(id))).data()).state;
    canRead(r, actor.uid, m.role); return requestView(r, actor.uid, reviewer(m.role)); });
}
export async function listRequests(s: Services, actor: DecodedIdToken, cursor?: string, queue: RequestQueue = 'all') {
  if (cursor) parse(requestIdSchema, cursor);
  return s.db.runTransaction(async tx => {
    const m = await member(s, tx, actor);
    // A bounded installation scan also supports legacy requestedBy fields without two divergent lists.
    const page = await tx.get(requestsRef(s).orderBy(FieldPath.documentId()).limit(L.count + 1));
    if (page.size > L.count) throw new HttpError(409, 'Request inventory exceeds its supported bound.');
    const rows = page.docs.map(d => requestHead(d.id, d.data()).state).filter(r => reviewer(m.role) || r.requestedBy === actor.uid).map(r => requestView(r, actor.uid, reviewer(m.role))).filter(r => inRequestQueue(r, queue, actor.uid)).filter(r => !cursor || r.id > cursor);
    return { items: rows.slice(0, L.page), nextCursor: rows.length > L.page ? rows[L.page - 1].id : null };
  });
}
export async function requestDashboard(s: Services, actor: DecodedIdToken) {
  return s.db.runTransaction(async tx => {
    const m = await member(s, tx, actor);
    const page = await tx.get(requestsRef(s).orderBy(FieldPath.documentId()).limit(L.count + 1));
    if (page.size > L.count) throw new HttpError(409, 'Request inventory exceeds its supported bound.');
    const rows = page.docs.map(d => requestHead(d.id, d.data()).state)
      .filter(r => reviewer(m.role) || r.requestedBy === actor.uid).map(r => requestView(r, actor.uid, reviewer(m.role)));
    return summarizeRequests(rows, actor.uid, reviewer(m.role), new Date().toISOString());
  });
}
export async function requestHistory(s: Services, actor: DecodedIdToken, id: string, cursor?: string) {
  parse(requestIdSchema, id);
  if (cursor && !/^\d{6}$/.test(cursor)) throw new HttpError(400, 'Invalid history cursor.');
  return s.db.runTransaction(async tx => {
    const m = await member(s, tx, actor); const r = requestHead(id, (await tx.get(requestsRef(s).doc(id))).data()).state;
    canRead(r, actor.uid, m.role);
    // Reviewer history includes private takeover/reopen notes. Requesters receive current outcome only.
    if (!reviewer(m.role)) throw new HttpError(403, 'Review history is private to reviewers.');
    let q = requestsRef(s).doc(id).collection('history').orderBy(FieldPath.documentId()).limit(L.page + 1);
    if (cursor) q = q.startAfter(cursor);
    const events = await tx.get(q);
    return { items: events.docs.slice(0, L.page).map(d => parse(requestEventSchema, d.data())), nextCursor: events.size > L.page ? events.docs[L.page - 1].id : null };
  });
}
export async function requestCommandStatus(s: Services, actor: DecodedIdToken, commandId: string) {
  parse(z.uuid(), commandId);
  return s.db.runTransaction(async tx => {
    const m = await member(s, tx, actor); const snap = await tx.get(receiptsRef(s, actor.uid).doc(commandId));
    if (!snap.exists) return { state: 'not_found' as const };
    const receipt = parse(requestReceiptSchema, snap.data());
    if (receipt.actorUid !== actor.uid || receipt.commandId !== commandId) throw new HttpError(409, 'Invalid receipt identity.');
    const r = requestHead(receipt.requestId, (await tx.get(requestsRef(s).doc(receipt.requestId))).data()).state;
    canRead(r, actor.uid, m.role);
    return { state: 'applied' as const, appliedRevision: receipt.revision, request: requestView(r, actor.uid, reviewer(m.role)) };
  });
}
export async function requestCommand(s: Services, actor: DecodedIdToken, id: string | null, raw: unknown, command: CommandIdentity) {
  if (id) parse(requestIdSchema, id);
  const create = id ? null : parse(requestCreateSchema, raw);
  const action = id ? parse(requestActionSchema, raw) : null;
  const expectedRoute = id ? `/api/requests/${id}` : '/api/requests';
  if (command.route !== expectedRoute || !z.uuid().safeParse(command.id).success) throw new HttpError(400, 'Invalid request command identity.');
  // Recompute rather than trusting internal caller-supplied hashes.
  if (command.hash !== digest({ route: expectedRoute, body: raw })) throw new HttpError(400, 'Invalid command hash.');
  const requestId = id || randomUUID();
  return s.db.runTransaction(async tx => {
    await assertWritable(s, tx); const m = await member(s, tx, actor); commandAuthority(action?.action || 'create', m.role);
    const receiptRef = receiptsRef(s, actor.uid).doc(command.id); const existing = await tx.get(receiptRef);
    if (existing.exists) {
      const receipt = parse(requestReceiptSchema, existing.data());
      if (receipt.actorUid !== actor.uid || receipt.commandId !== command.id || receipt.hash !== command.hash || receipt.route !== command.route) throw new HttpError(409, 'This command ID was used for different content.');
      const current = requestHead(receipt.requestId, (await tx.get(requestsRef(s).doc(receipt.requestId))).data()).state;
      canRead(current, actor.uid, m.role);
      if (action?.action === 'archive' && (action.audience === 'admin' ? !reviewer(m.role) : current.requestedBy !== actor.uid)) throw new HttpError(403, 'Archive permission changed.');
      return requestView(current, actor.uid, reviewer(m.role));
    }
    const ref = requestsRef(s).doc(requestId); const head = id ? requestHead(id, (await tx.get(ref)).data()) : null;
    const before = head?.state || null; const at = new Date().toISOString(); let after: RequestState;
    if (before && action) {
      canRead(before, actor.uid, m.role);
      if (action.action === 'archive' && (action.audience === 'admin' ? !reviewer(m.role) : before.requestedBy !== actor.uid)) throw new HttpError(403, 'Archive permission denied.');
      if (action.revision !== before.revision) throw new HttpError(409, 'Request changed. Reload before issuing a new command.');
      try { after = transitionRequest(before, action, actor.uid, m.role); }
      catch (e) { throw new HttpError(409, (e as Error).message); }
      if (action.action === 'decide' && action.reviewId && !(await tx.get(s.db.doc(`districts/${s.config.districtId}/reviews/${action.reviewId}`))).exists) throw new HttpError(400, 'Linked review does not exist in this district.');
    } else {
      const inventory = await tx.get(requestsRef(s).limit(L.count + 1));
      if (inventory.size >= L.count) throw new HttpError(409, 'Local request capacity reached; existing records are preserved.');
      after = { version: 1, id: requestId, ...create!, requestedBy: actor.uid, createdAt: at, updatedAt: at, legacy: false,
        revision: 0, status: 'pending', assignee: null, outcome: null, archivedByRequester: false, archivedByAdmin: false };
    }
    if (after.revision >= L.events) throw new HttpError(409, 'Request history capacity reached; no records were removed.');
    after = parse(requestStateSchema, { ...after, revision: after.revision + 1, updatedAt: at });
    const event: RequestEvent = parse(requestEventSchema, { version: 1, requestId, revision: after.revision, actorUid: actor.uid, actorRole: m.role, at,
      action: action?.action || 'create', note: action && ['takeover', 'reopen'].includes(action.action) ? (action as { reason: string }).reason : '',
      commandId: command.id, before, after });
    const receipt = parse(requestReceiptSchema, { version: 1, actorUid: actor.uid, requestId, commandId: command.id, hash: command.hash, route: command.route, revision: after.revision, at });
    const retainedBytes = (head?.retainedBytes || 0) + requestBytes(event) + requestBytes(receipt);
    if (requestBytes(after) > L.record || requestBytes(event) > L.record * 2 || retainedBytes + requestBytes(after) > L.bytes) throw new HttpError(409, 'Request storage capacity reached; no records were removed.');
    tx.set(ref, { state: after, retainedBytes }); tx.create(ref.collection('history').doc(eventId(after.revision)), event); tx.create(receiptRef, receipt);
    return requestView(after, actor.uid, reviewer(m.role));
  });
}
