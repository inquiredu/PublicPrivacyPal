import { z } from 'zod';
const PREFIX = 'privacypal-review-drafts-v1:';
const MAX_BYTES = 4 * 1024 * 1024;
export const DRAFT_LIFETIME_MS = 12 * 60 * 60 * 1000;
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
type Entry = { savedAt: number; value: unknown };
const envelope = z.object({ version: z.literal(1), entries: z.record(z.string().max(160), z.object({ savedAt: z.number(), value: z.unknown() }).strict()) }).strict();
const stores = new Set<DraftStore>();
export function clearReviewDrafts(storage?: StorageLike) {
  for (const store of stores) store.dispose();
  try {
    const target = storage ?? sessionStorage;
    for (let i = target.length - 1; i >= 0; i--) { const key = target.key(i); if (key?.startsWith(PREFIX)) target.removeItem(key); }
  } catch { /* In-memory drafts were still erased. */ }
}
export class DraftStore {
  private entries: Record<string, Entry> = {};
  private listeners = new Set<() => void>();
  private alive = true;
  private revision = 0;
  warning = '';
  readonly key: string;
  constructor(owner: string, private storage?: StorageLike, private clock = Date.now) {
    this.key = PREFIX + owner; stores.add(this);
    try {
      const text = storage?.getItem(this.key);
      if (text) {
        if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Oversized drafts');
        const parsed = envelope.parse(JSON.parse(text));
        this.entries = Object.fromEntries(Object.entries(parsed.entries).filter(([key, e]) => e.savedAt <= clock() && (key === 'pending-command' || clock() - e.savedAt < DRAFT_LIFETIME_MS)));
      }
      if (!storage) this.warning = 'Tab storage is unavailable. Keep this page open; drafts cannot survive reload.';
    } catch { this.warning = 'The previous tab drafts could not be recovered. New edits will remain in memory if tab storage is unavailable.'; this.entries = {}; }
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.revision;
  private notify() { this.revision++; for (const listener of this.listeners) listener(); }
  get<T>(key: string, schema: z.ZodType<T>): T | undefined {
    const entry = this.entries[key]; if (!this.alive || !entry) return;
    const parsed = schema.safeParse(entry.value);
    return parsed.success ? parsed.data : undefined;
  }
  has(key?: string) { return this.alive && (key ? !!this.entries[key] : Object.keys(this.entries).some(k => k !== 'location')); }
  set(key: string, value: unknown) {
    if (!this.alive) return;
    this.entries[key] = { savedAt: this.clock(), value }; this.persist(); this.notify();
  }
  remove(...keys: string[]) {
    if (!this.alive) return;
    for (const key of keys) delete this.entries[key]; this.persist(); this.notify();
  }
  private persist() {
    try {
      if (!this.storage) throw new Error('Storage unavailable');
      const text = JSON.stringify({ version: 1, entries: this.entries });
      if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('Draft storage limit');
      this.storage.setItem(this.key, text);
    } catch { try { this.storage?.removeItem(this.key); } catch { /* Best effort to avoid restoring stale text. */ } this.warning = 'Reload protection is unavailable. Keep this page open and save or copy your draft before leaving.'; }
  }
  dispose() {
    this.alive = false; this.entries = {};
    try { this.storage?.removeItem(this.key); } catch { /* Storage can be blocked. */ }
    this.notify(); stores.delete(this);
  }
}
export function browserDraftStore(owner: string) {
  let storage: Storage | undefined; try { storage = sessionStorage; } catch { /* handled by store */ }
  try { if (storage) for (let i = storage.length - 1; i >= 0; i--) { const key = storage.key(i); if (key?.startsWith(PREFIX) && key !== PREFIX + owner) storage.removeItem(key); } } catch { /* The new store reports unavailable storage. */ }
  return new DraftStore(owner, storage);
}
