import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { z } from 'zod';
import type { User } from 'firebase/auth';
import type { Review } from '../shared/review';
import { api, ApiError } from './api';
import type { DraftStore } from './draft-store';
const Context = createContext<DraftStore | null>(null);
export function DraftProvider({ store, children }: { store: DraftStore; children: ReactNode }) {
  useSyncExternalStore(store.subscribe, store.snapshot);
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (store.has()) { event.preventDefault(); } };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [store]);
  return <Context.Provider value={store}>{store.warning && <div className="notice" role="alert">{store.warning}</div>}{children}</Context.Provider>;
}
export function useDraftStore() { const store = useContext(Context); if (!store) throw new Error('Draft provider required.'); useSyncExternalStore(store.subscribe, store.snapshot); return store; }
export const pendingSchema = z.object({ id: z.uuid(), path: z.string().regex(/^\/api\/reviews(?:\/import|\/[a-f0-9-]{36})?$/), body: z.unknown(), label: z.string(), clearKeys: z.array(z.string()) }).strict();
type Pending = z.infer<typeof pendingSchema>;
export function useReviewCommands(user: User, onSaved: (review: Review) => void) {
  const store = useDraftStore(); const pending = store.get('pending-command', pendingSchema);
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const [notFound, setNotFound] = useState(false);
  function confirmed(review: Review, command: Pending) {
    // An old request must never repopulate drafts after sign-out or permission loss.
    if (store.get('pending-command', pendingSchema)?.id !== command.id) return;
    store.remove('pending-command', ...command.clearKeys); setNotFound(false);
    onSaved(review); setMessage('Save confirmed. The current review state is shown below.');
  }
  async function send(command: Pending) {
    setBusy(true); setMessage('Saving…'); setNotFound(false);
    try { confirmed(await api<Review>(command.path, user, command.body, { commandId: command.id }), command); }
    catch (e) {
      if (e instanceof ApiError && !e.uncertain && store.get('pending-command', pendingSchema)?.id === command.id) store.remove('pending-command');
      setMessage(e instanceof Error ? e.message : 'Save outcome is unknown. Check the saved result.');
    } finally { setBusy(false); }
  }
  async function start(path: string, body: unknown, label: string, clearKeys: string[] = []) {
    if (store.has('pending-command')) return;
    const command = { id: crypto.randomUUID(), path, body, label, clearKeys };
    store.set('pending-command', command); await send(command);
  }
  async function check() {
    if (!pending || busy) return; setBusy(true); setMessage('Checking the saved result…');
    try {
      const result = await api<{ state: 'not_found' } | { state: 'applied'; review: Review }>(`/api/commands/${pending.id}`, user);
      if (result.state === 'applied') confirmed(result.review, pending);
      else { setNotFound(true); setMessage('No completed save was found yet. You can retry this same request safely.'); }
    } catch (e) { setMessage(e instanceof Error ? e.message : 'The result could not be checked.'); }
    finally { setBusy(false); }
  }
  const notice = <section aria-label="Save status"><p role="status" aria-atomic="true">{message}</p>{pending && <div className="notice"><strong>{busy ? 'Working' : 'Save outcome not confirmed'}: {pending.label}</strong><p>Your draft is kept. Check the result before making another change. A pending request is never sent automatically after reload.</p><button type="button" className="secondary" disabled={busy} onClick={() => void check()}>Check saved result</button>{notFound && <button type="button" disabled={busy} onClick={() => void send(pending)}>Retry same save</button>}</div>}</section>;
  return { start, notice, blocked: busy || !!pending };
}
export type ReviewCommands = ReturnType<typeof useReviewCommands>;
