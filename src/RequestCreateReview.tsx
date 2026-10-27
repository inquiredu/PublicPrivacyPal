import type { RequestView } from '../shared/requests';
import { captureDraftSchema } from '../shared/drafts';
import { DEFAULT_PROFILE } from '../shared/scoring/profiles';
import { useDraftStore } from './ReviewDrafts';
import { useState } from 'react';

export function RequestCreateReview({ request, reason, onOpen }: { request: RequestView; reason: string; onOpen: () => void }) {
  const store = useDraftStore();
  const [error, setError] = useState('');
  const existing = store.has('capture');
  const saved = store.get('capture', captureDraftSchema);
  function rebind() {
    if (!saved || saved.requestContext?.requestId !== request.id || store.has('pending-command') || !reason.trim()) return;
    store.set('capture', { ...saved, requestContext: { requestId: request.id, revision: request.revision, reason: reason.trim(), toolName: request.toolName, purpose: request.purpose, requestedUrl: request.requestedUrl } });
    if (store.warning) { setError('Reload protection is unavailable. Keep this tab open.'); return; }
    onOpen();
  }
  function resume() { store.remove('location'); onOpen(); }
  function begin() {
    if (existing || store.has('pending-command')) return;
    store.set('capture', captureDraftSchema.parse({ sourceKind: 'pasted', name: request.toolName, sourceLabel: '', sourceText: '',
      fixtureId: 'complete', profileVersion: DEFAULT_PROFILE, completeService: true,
      requestContext: { requestId: request.id, revision: request.revision, reason: reason.trim(), toolName: request.toolName, purpose: request.purpose, requestedUrl: request.requestedUrl } }));
    if (store.warning) { setError('Draft reload protection is unavailable. Keep this tab open and resolve storage before continuing.'); return; }
    store.remove('location'); onOpen();
  }
  return <section aria-label="Create review from request"><p>If no existing review fits, prepare a new review. Supply policy text separately; the reference URL is never fetched. Saving the policy will also record the request link using this reason.</p>
    {existing ? <><p>A review draft already exists. Resume it to inspect or deliberately discard it before starting another. It will not be overwritten.</p><button type="button" onClick={resume}>Resume existing review draft</button>{saved?.requestContext?.requestId === request.id && saved.requestContext.revision !== request.revision && <button type="button" disabled={!reason.trim() || store.has('pending-command')} onClick={rebind}>Use current request revision with saved policy draft</button>}</> : <button type="button" disabled={!reason.trim() || store.has('pending-command')} onClick={begin}>Create review from request</button>}
    {store.has('pending-command') && <><p>Resolve the unconfirmed review save first.</p><button type="button" onClick={onOpen}>Inspect pending review save</button></>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
