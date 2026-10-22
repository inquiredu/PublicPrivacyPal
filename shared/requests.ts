import { z } from 'zod';
export const REQUEST_LIMITS = { count: 100, events: 64, bytes: 262144, record: 24576, page: 20 } as const;
export const requestIdSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/);
const text = (max: number) => z.string().trim().min(1).max(max);
export const requestCreateSchema = z.object({ toolName: text(120), purpose: text(2000), requestedUrl: z.string().max(2000).refine(v => !v || /^https?:\/\//i.test(v), 'Use an http(s) reference URL.').default('') }).strict();
export const requestActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('claim'), revision: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal('release'), revision: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal('takeover'), revision: z.number().int().nonnegative(), reason: text(1000) }).strict(),
  z.object({ action: z.literal('decide'), revision: z.number().int().nonnegative(), outcome: z.enum(['declined', 'review_linked']), reason: text(1500), reviewId: z.uuid().nullable() }).strict(),
  z.object({ action: z.literal('reopen'), revision: z.number().int().nonnegative(), reason: text(1000) }).strict(),
  z.object({ action: z.literal('archive'), revision: z.number().int().nonnegative(), audience: z.enum(['requester', 'admin']), archived: z.boolean() }).strict(),
]);
export type RequestAction = z.infer<typeof requestActionSchema>;
export const requestStateSchema = z.object({
  version: z.literal(1), id: requestIdSchema, ...requestCreateSchema.shape,
  requestedBy: text(128), createdAt: z.iso.datetime().nullable(), updatedAt: z.iso.datetime().nullable(),
  legacy: z.boolean(), revision: z.number().int().nonnegative().max(REQUEST_LIMITS.events),
  status: z.enum(['pending', 'in_review', 'decided']), assignee: text(128).nullable(),
  outcome: z.object({ kind: z.enum(['declined', 'review_linked']), reason: text(1500), reviewId: z.uuid().nullable() }).strict().nullable(),
  archivedByRequester: z.boolean(), archivedByAdmin: z.boolean(),
}).strict().superRefine((r, ctx) => {
  if ((r.status === 'in_review' && !r.assignee) || (r.status === 'pending' && r.assignee) || (r.status === 'decided') !== !!r.outcome
      || (r.outcome && (r.outcome.kind === 'review_linked') !== !!r.outcome.reviewId)) ctx.addIssue({ code: 'custom', message: 'Inconsistent request state.' });
});
export type RequestState = z.infer<typeof requestStateSchema>;
export const requestHeadSchema = z.object({ state: requestStateSchema, retainedBytes: z.number().int().nonnegative().max(REQUEST_LIMITS.bytes) }).strict();
export const requestEventSchema = z.object({
  version: z.literal(1), requestId: requestIdSchema, revision: z.number().int().min(1).max(REQUEST_LIMITS.events),
  actorUid: text(128), actorRole: z.enum(['admin', 'reviewer', 'viewer', 'staff']), at: z.iso.datetime(),
  action: z.enum(['create', 'claim', 'release', 'takeover', 'decide', 'reopen', 'archive']),
  note: z.string().max(1000), commandId: z.uuid(), before: requestStateSchema.nullable(), after: requestStateSchema,
}).strict();
export const requestReceiptSchema = z.object({ version: z.literal(1), actorUid: text(128), requestId: requestIdSchema,
  commandId: z.uuid(), hash: z.string().regex(/^[a-f0-9]{64}$/), route: z.string().max(200), revision: z.number().int().min(1).max(REQUEST_LIMITS.events), at: z.iso.datetime(),
}).strict();
export type RequestEvent = z.infer<typeof requestEventSchema>;
export type RequestView = Pick<RequestState, 'id' | 'toolName' | 'purpose' | 'requestedUrl' | 'createdAt' | 'updatedAt' | 'legacy' | 'revision' | 'status' | 'outcome'> & {
  own: boolean; archived: boolean; assignee?: string | null; requestedBy?: string; archivedByRequester?: boolean; archivedByAdmin?: boolean;
};
export function requestView(r: RequestState, uid: string, reviewer: boolean): RequestView {
  // Explicit allowlist: future internal fields cannot enter the requester projection accidentally.
  return { id: r.id, toolName: r.toolName, purpose: r.purpose, requestedUrl: r.requestedUrl, createdAt: r.createdAt,
    updatedAt: r.updatedAt, legacy: r.legacy, revision: r.revision, status: r.status, outcome: r.outcome,
    own: r.requestedBy === uid, archived: reviewer ? r.archivedByAdmin : r.archivedByRequester,
    ...(reviewer ? { requestedBy: r.requestedBy, assignee: r.assignee, archivedByRequester: r.archivedByRequester, archivedByAdmin: r.archivedByAdmin } : {}) };
}
/** Request outcomes route work; they never assert that the service is approved or published. */
export function transitionRequest(r: RequestState, cmd: RequestAction, uid: string, role: string): RequestState {
  const reviewer = role === 'reviewer' || role === 'admin';
  if (cmd.action === 'archive') {
    if (cmd.audience === 'requester' ? r.requestedBy !== uid : !reviewer) throw new Error('This archive belongs to another audience.');
    return { ...r, [cmd.audience === 'requester' ? 'archivedByRequester' : 'archivedByAdmin']: cmd.archived };
  }
  if (!reviewer) throw new Error('Reviewer access is required.');
  if (cmd.action === 'claim') {
    if (r.status !== 'pending' || r.assignee) throw new Error('Only an unassigned pending request can be claimed.');
    return { ...r, status: 'in_review', assignee: uid };
  }
  if (cmd.action === 'takeover') {
    if (role !== 'admin' || r.status !== 'in_review' || r.assignee === uid) throw new Error('An administrator may take over another reviewer’s active request.');
    return { ...r, assignee: uid };
  }
  if (cmd.action === 'reopen') {
    if (role !== 'admin' || r.status !== 'decided') throw new Error('An administrator may reopen a decided request.');
    return { ...r, status: 'pending', assignee: null, outcome: null };
  }
  if (r.status !== 'in_review' || r.assignee !== uid) throw new Error('Claim this request before changing its review outcome.');
  if (cmd.action === 'release') return { ...r, status: 'pending', assignee: null };
  if ((cmd.outcome === 'review_linked') !== !!cmd.reviewId) throw new Error('Link a review only for a review-linked outcome.');
  return { ...r, status: 'decided', outcome: { kind: cmd.outcome, reason: cmd.reason, reviewId: cmd.reviewId } };
}
