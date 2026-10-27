import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { ReviewDashboard } from '../shared/review-dashboard';
import { api } from './api';

/** Uses the existing bounded, role-checked summary search. Selection never records an outcome. */
export function RequestReviewPicker({ user, selectedId, onSelect, onOpen }: { user: User; selectedId: string; onSelect: (id: string) => void; onOpen: (id: string) => void }) {
  const [draft, setDraft] = useState(''); const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState<string>(); const [reload, setReload] = useState(0);
  const [data, setData] = useState<ReviewDashboard>(); const [error, setError] = useState('');
  useEffect(() => {
    let alive = true; setData(undefined); setError('');
    void api<ReviewDashboard>(`/api/review-dashboard?search=${encodeURIComponent(search)}${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, user)
      .then(result => { if (alive) setData(result); }).catch(() => { if (alive) setError('Review search is unavailable. Retry without changing your request draft.'); });
    return () => { alive = false; };
  }, [user, search, cursor, reload]);
  return <section aria-label="Choose an existing review">
    <p>Select a review, then record the link with your reason. Similar names do not establish a match. Linking does not approve or publish the service.</p>
    <label>Find an existing review<input type="search" maxLength={120} value={draft} onChange={e => setDraft(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setSearch(draft.trim()); setCursor(undefined); setReload(n => n + 1); } }}/></label>
    <button type="button" onClick={() => { setSearch(draft.trim()); setCursor(undefined); setReload(n => n + 1); }}>Search existing reviews</button>
    {error ? <p role="alert">{error}</p> : !data ? <p role="status">Loading review choices…</p> : <>
      <p role="status">{data.matchingTotal} matching reviews</p>
      {data.items.map(r => <div className="request-row" key={r.id}><label><input type="radio" name="request-review" checked={selectedId === r.id} onChange={() => onSelect(r.id)}/>{r.name} · {r.tier === 'unassigned' ? 'No recorded tier' : r.tier} <small>({r.id})</small></label><button type="button" onClick={() => onOpen(r.id)}>Inspect {r.name}</button></div>)}
      <button type="button" disabled={!cursor} onClick={() => setCursor(undefined)}>First choices</button><button type="button" disabled={!data.nextCursor} onClick={() => setCursor(data.nextCursor!)}>Next choices</button>
    </>}
    {selectedId && <p>Selected review reference: {selectedId} <button type="button" onClick={() => onOpen(selectedId)}>Inspect selected review</button><button type="button" onClick={() => onSelect('')}>Clear selection</button></p>}
  </section>;
}
