import { z } from 'zod';
import { requestActionSchema, requestCreateSchema } from '../shared/requests';
export const REQUEST_DRAFT_PREFIX = 'privacypal-request-v1/';
export const requestJournalSchema = z.object({ savedAt: z.number(), form: z.object({ toolName: z.string().max(120), purpose: z.string().max(2000), requestedUrl: z.string().max(2000) }).strict(),
  reviewDrafts: z.record(z.string(), z.object({ reason: z.string().max(1000), reviewId: z.string().max(128) }).strict()).default({}),
  pending: z.object({ id: z.uuid(), path: z.string().regex(/^\/api\/requests(?:\/[a-zA-Z0-9_-]{1,128})?$/), body: z.custom<z.infer<typeof requestCreateSchema> | z.infer<typeof requestActionSchema>>(value => z.union([requestCreateSchema, requestActionSchema]).safeParse(value).success) }).strict().nullable(),
}).strict();
export type RequestJournal = z.infer<typeof requestJournalSchema>;
export function clearRequestDrafts() {
  try { for (const key of Object.keys(sessionStorage)) if (key.startsWith(REQUEST_DRAFT_PREFIX)) sessionStorage.removeItem(key); } catch { /* No storage available. */ }
}
export function readRequestJournal(key: string): RequestJournal | null {
  const raw = sessionStorage.getItem(key); if (!raw) return null;
  const parsed = requestJournalSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) throw new Error('The saved request draft cannot be read. Preserve this tab and contact the local operator.');
  // An unresolved command never expires into a new submission. The same identity must be reconciled.
  if (!parsed.data.pending && Date.now() - parsed.data.savedAt > 86400000) { sessionStorage.removeItem(key); return null; }
  return parsed.data;
}

export function hasRequestDrafts(): boolean {
  try { return Object.keys(sessionStorage).some(key => key.startsWith(REQUEST_DRAFT_PREFIX)); } catch { return true; }
}
