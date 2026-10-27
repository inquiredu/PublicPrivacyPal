import { useEffect, useRef, useState } from 'react';
import { collection, limit, onSnapshot, query } from 'firebase/firestore';
import type { Client } from './firebase';
import { CATALOGUE_SUGGESTION_LIMIT, CATALOGUE_SUGGESTION_PAGE, catalogueSuggestions, staffSuggestionSchema, type StaffSuggestion } from '../shared/catalogue-suggestions';
import { ServiceNotice } from './ServiceNotice';

export function RequestCatalogueSuggestions({ client, name, locked, onContinue, onEdit }: {
  client: Client; name: string; locked: boolean; onContinue: () => void; onEdit: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [entries, setEntries] = useState<StaffSuggestion[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'error' | 'overflow'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(0);
  const [expanded, setExpanded] = useState('');
  useEffect(() => { heading.current?.focus(); }, []);
  useEffect(() => { setPage(0); setExpanded(''); }, [name]);
  useEffect(() => {
    setEntries([]); setState('loading'); setExpanded('');
    return onSnapshot(query(collection(client.db, `districts/${client.config.districtId}/staffTools`), limit(CATALOGUE_SUGGESTION_LIMIT + 1)), { includeMetadataChanges: true }, snap => {
      if (snap.metadata.fromCache) { setEntries([]); setState('error'); return; }
      if (snap.size > CATALOGUE_SUGGESTION_LIMIT) { setEntries([]); setState('overflow'); return; }
      const parsed = staffSuggestionSchema.array().safeParse(snap.docs.map(d => ({ ...d.data(), id: d.id })));
      if (!parsed.success) { setEntries([]); setState('error'); return; }
      setEntries(parsed.data); setState('ready');
    }, () => { setEntries([]); setState('error'); });
  }, [client, attempt]);
  const matches = catalogueSuggestions(entries, name);
  const activePage = Math.min(page, Math.max(0, Math.ceil(matches.length / CATALOGUE_SUGGESTION_PAGE) - 1));
  const rows = matches.slice(activePage * CATALOGUE_SUGGESTION_PAGE, (activePage + 1) * CATALOGUE_SUGGESTION_PAGE);
  return <section className="notice catalogue-suggestions" aria-label="Staff catalogue suggestions">
    <h3 ref={heading} tabIndex={-1}>Check the staff catalogue before requesting</h3>
    <p>Possible name matches for <strong>{name}</strong>. Similar names may describe different tools. Inspect current conditions of use; a suggestion is not permission to use a service.</p>
    {state === 'loading' && <p role="status">Checking published staff entries… You can continue anyway.</p>}
    {state === 'error' && <p role="alert">Current catalogue suggestions cannot be verified. Previously shown guidance is hidden. Retry, or continue your request anyway.</p>}
    {state === 'overflow' && <p role="alert">The catalogue exceeds the supported suggestion limit. No partial results are shown. You can continue your request anyway.</p>}
    {state !== 'loading' && state !== 'ready' && <button type="button" disabled={locked} onClick={() => setAttempt(n => n + 1)}>Retry catalogue check</button>}
    {state === 'ready' && <>
      <p role="status">{matches.length ? `${matches.length} possible name matches · page ${activePage + 1} of ${Math.ceil(matches.length / CATALOGUE_SUGGESTION_PAGE)}` : 'No name matches in the published staff catalogue. This does not establish that the tool has never been reviewed.'}</p>
      {rows.map(p => <article key={p.id}><h4>{p.name}</h4><p>{p.category}{p.tierLevel ? ` · ${p.tierLevel}` : ' · No tier recorded'}</p>
        <button type="button" aria-expanded={expanded === p.id} onClick={() => setExpanded(expanded === p.id ? '' : p.id)}>{expanded === p.id ? 'Hide' : 'Inspect'} staff guidance for {p.name}</button>
        {expanded === p.id && <ServiceNotice profile={p} staff/>}
      </article>)}
      {matches.length > CATALOGUE_SUGGESTION_PAGE && <div className="actions"><button type="button" disabled={!activePage} onClick={() => setPage(activePage - 1)}>Previous suggestions</button><button type="button" disabled={(activePage + 1) * CATALOGUE_SUGGESTION_PAGE >= matches.length} onClick={() => setPage(activePage + 1)}>Next suggestions</button></div>}
    </>}
    <p>Your request text stays in this tab while you inspect guidance. Continuing submits a separate request; it does not link, approve or publish a service.</p>
    <div className="actions"><button type="button" disabled={locked} onClick={onEdit}>Keep editing request</button><button type="button" disabled={locked} onClick={onContinue}>Continue anyway and submit request</button></div>
  </section>;
}
