import { requestQueues, queueLabels, type RequestQueue } from '../shared/request-dashboard';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import type { Role } from '../shared/config';
import { requestCreateSchema, requestActionSchema, type RequestView, type RequestAction, type RequestEvent } from '../shared/requests';
import { api, ApiError } from './api';
import { REQUEST_DRAFT_PREFIX, readRequestJournal, type RequestJournal } from './request-journal';
const statusLabel = { pending: 'Pending', in_review: 'In review', decided: 'Decided' };
const emptyForm = { toolName: '', purpose: '', requestedUrl: '' };
const explain = (e: unknown) => e instanceof Error ? e.message : 'Request service unavailable.';

export function RequestPanel({ user, role, scope, initialQueue = 'active', initialId }: { user: User; role: Role; scope: string; initialQueue?: RequestQueue; initialId?: string }) {
  const detailHeading = useRef<HTMLHeadingElement>(null);
  const openSequence = useRef(0);
  useEffect(() => () => { openSequence.current++; }, []);
  const key = REQUEST_DRAFT_PREFIX + scope + '/' + user.uid;
  const [journal, setJournal] = useState<RequestJournal>(() => {
    try { return readRequestJournal(key) || { savedAt: Date.now(), form: emptyForm, pending: null, reviewDrafts: {} }; }
    catch { return { savedAt: Date.now(), form: emptyForm, pending: null, reviewDrafts: {} }; }
  });
  const [storageError, setStorageError] = useState('');
  useEffect(() => { try { readRequestJournal(key); } catch (e) { setStorageError(explain(e)); } }, [key]);
  const [items, setItems] = useState<RequestView[]>([]); const [selected, setSelected] = useState<RequestView>();
  const [cursor, setCursor] = useState<string>(); const [next, setNext] = useState<string | null>(null);
  const [history, setHistory] = useState<RequestEvent[]>([]); const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false); const [notice, setNotice] = useState(''); const [reload, setReload] = useState(0);
  const [retryReady, setRetryReady] = useState(false); const [failed, setFailed] = useState(false);
  const [queue, setQueue] = useState<RequestQueue>(initialQueue === 'assigned' && role !== 'admin' && role !== 'reviewer' ? 'active' : initialQueue);
  const [loading, setLoading] = useState(true); const [listError, setListError] = useState('');
  const actionDraft = selected ? journal.reviewDrafts[selected.id] : undefined;
  const reason = actionDraft?.reason || ''; const reviewId = actionDraft?.reviewId || '';
  function actionText(patch: Partial<{ reason: string; reviewId: string }>) {
    if (!selected) return;
    try { persist({ ...journal, reviewDrafts: { ...journal.reviewDrafts, [selected.id]: { reason, reviewId, ...patch } } }); }
    catch { setStorageError('Could not preserve request action text. Submission is disabled.'); }
  }
  const reviewer = role === 'admin' || role === 'reviewer';
  function persist(value: RequestJournal) {
    const next = { ...value, savedAt: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(next)); setJournal(next);
  }
  function draft(patch: Partial<typeof emptyForm>) { try { persist({ ...journal, form: { ...journal.form, ...patch } }); } catch { setStorageError('Draft storage is unavailable. Submission is disabled to protect retry identity.'); } }
  useEffect(() => {
    let alive = true;
    const refresh = () => void api<{ items: RequestView[]; nextCursor: string | null }>(`/api/requests?queue=${queue}${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, user)
      .then(data => { if (alive) { setItems(data.items); setNext(data.nextCursor); setListError(''); setLoading(false); } }).catch(e => { if (alive) { setItems([]); setNext(null); setListError(explain(e)); setLoading(false); } });
    refresh(); const timer = setInterval(refresh, 15000); return () => { alive = false; clearInterval(timer); };
  }, [user, cursor, queue, reload]);
  useEffect(() => { if (initialId) void open(initialId); }, [initialId]);
  async function open(id: string) { const sequence = ++openSequence.current; try { const row = await api<RequestView>(`/api/requests/${id}`, user); if (sequence !== openSequence.current) return; setSelected(row); setHistory([]); setHistoryCursor(null); } catch (e) { if (sequence === openSequence.current) { setSelected(undefined); setNotice(explain(e)); } } }
  useEffect(() => { if (selected) detailHeading.current?.focus(); }, [selected?.id]);
  function accepted(r: RequestView, pending: NonNullable<RequestJournal['pending']>) {
    persist({ ...journal, pending: null, form: pending.path === '/api/requests' ? emptyForm : journal.form });
    setSelected(r); setHistory([]); setHistoryCursor(null); setReload(n => n + 1); setNotice('Request change saved. A request outcome does not approve or publish a service.'); setFailed(false); setRetryReady(false);
  }
  async function send(pending: NonNullable<RequestJournal['pending']>) {
    setBusy(true); setRetryReady(false); setFailed(false);
    try { accepted(await api<RequestView>(pending.path, user, pending.body, { commandId: pending.id }), pending); }
    catch (e) { setNotice(explain(e)); if (e instanceof ApiError && !e.uncertain) setFailed(true); }
    finally { setBusy(false); }
  }
  async function start(body: RequestAction | typeof emptyForm, path: string) {
    if (journal.pending || storageError) return;
    const checked = (path === '/api/requests' ? requestCreateSchema : requestActionSchema).safeParse(body);
    if (!checked.success) { setNotice('Complete the request fields, reason and valid review reference before submitting.'); return; }
    const pending = { id: crypto.randomUUID(), body: checked.data, path };
    try { persist({ ...journal, pending }); } catch { setStorageError('Could not preserve command identity. Nothing was submitted.'); return; }
    await send(pending);
  }
  async function reconcile() {
    if (!journal.pending) return; setBusy(true);
    try {
      const result = await api<{ state: 'applied' | 'not_found'; request?: RequestView }>(`/api/request-commands/${journal.pending.id}`, user);
      if (result.state === 'applied') accepted(result.request!, journal.pending);
      else { setRetryReady(true); setNotice('No saved receipt found. Retry uses the same command identity; a late first response cannot create a duplicate.'); }
    } catch (e) { setNotice(explain(e)); } finally { setBusy(false); }
  }
  function act(action: Omit<RequestAction, 'revision'>) { if (selected) void start({ ...action, revision: selected.revision } as RequestAction, `/api/requests/${selected.id}`); }
  async function loadHistory(cursor?: string) {
    if (!selected) return;
    try { const data = await api<{ items: RequestEvent[]; nextCursor: string | null }>(`/api/requests/${selected.id}/history${cursor ? '?cursor=' + cursor : ''}`, user); setHistory(data.items); setHistoryCursor(data.nextCursor); }
    catch (e) { setNotice(explain(e)); }
  }
  const locked = busy || !!journal.pending || !!storageError;
  return <section className="panel request-panel"><h2>Tool requests</h2><p>Request review of a tool and follow the recorded outcome. No automatic analysis, approval or publication.</p>
    {storageError && <p role="alert">{storageError}</p>}<p role="status">{notice}</p>
    {journal.pending && <div className="notice"><p>{failed ? 'The command was rejected. Your request text is retained.' : 'A command is awaiting confirmation. Check its saved result before continuing.'}</p>
      <button disabled={busy} onClick={() => void reconcile()}>Check saved request result</button>
      {retryReady && <button disabled={busy} onClick={() => void send(journal.pending!)}>Retry same request command</button>}
      {failed && <button onClick={() => { try { persist({ ...journal, pending: null }); setFailed(false); } catch (e) { setStorageError(explain(e)); } }}>Keep text and clear rejected command</button>}
    </div>}
    <form onSubmit={(e: FormEvent) => { e.preventDefault(); void start(journal.form, '/api/requests'); }}>
      <fieldset disabled={locked}><legend>Request a tool</legend>
        <label>Tool name<input required maxLength={120} value={journal.form.toolName} onChange={e => draft({ toolName: e.target.value })}/></label>
        <label>How would you use it?<textarea required maxLength={2000} value={journal.form.purpose} onChange={e => draft({ purpose: e.target.value })}/></label>
        <label>Reference URL (optional; never fetched)<input type="url" maxLength={2000} value={journal.form.requestedUrl} onChange={e => draft({ requestedUrl: e.target.value })}/></label>
        <button>Submit request</button>
      </fieldset>
    </form>
    <h3>{reviewer ? 'District requests' : 'Your requests'}</h3>
    <label>Request queue<select value={queue} onChange={e => { setQueue(e.target.value as RequestQueue); setCursor(undefined); setItems([]); setLoading(true); }}>{requestQueues.filter(q => reviewer || q !== 'assigned').map(q => <option key={q} value={q}>{queueLabels[q]}</option>)}</select></label>
    {listError ? <p role="alert">Requests unavailable: {listError}</p> : loading ? <p role="status">Loading requests…</p> : !items.length && <p>No requests in this queue on this page.</p>}
    {items.map(r => <div className="request-row" key={r.id}><button className="secondary" onClick={() => void open(r.id)}>{r.toolName}</button><span>{statusLabel[r.status]}{r.archived ? ' · archived in this view' : ''}</span></div>)}
    <div className="actions"><button disabled={!cursor} onClick={() => setCursor(undefined)}>First requests</button><button disabled={!next} onClick={() => setCursor(next!)}>Next requests</button></div>
    {selected && <section aria-label="Selected request"><h3 ref={detailHeading} tabIndex={-1}>{selected.toolName}</h3><p>{selected.purpose}</p><p>{selected.requestedUrl}</p><p>Status: {statusLabel[selected.status]} · revision {selected.revision}</p>
      {selected.legacy && <p>Earlier pending request. History begins with its first lifecycle command.</p>}
      {selected.outcome && <p>Recorded request outcome: {selected.outcome.kind === 'declined' ? 'Declined' : 'Linked to a review'} — {selected.outcome.reason} {selected.outcome.reviewId && `Review reference: ${selected.outcome.reviewId}. Inspect current staff guidance; this is not approval.`}</p>}
      {selected.assignee && <p>Assigned reviewer: {selected.assignee === user.uid ? 'You' : selected.assignee}</p>}
      <button onClick={() => void open(selected.id)}>Refresh request</button>
      <fieldset disabled={locked}><legend>Request actions</legend>
        {selected.own && <button onClick={() => act({ action: 'archive', audience: 'requester', archived: !(selected.archivedByRequester ?? selected.archived) } as RequestAction)}>{(selected.archivedByRequester ?? selected.archived) ? 'Restore to my list' : 'Archive from my list'}</button>}
        {reviewer && <><button onClick={() => act({ action: 'archive', audience: 'admin', archived: !selected.archivedByAdmin } as RequestAction)}>{selected.archivedByAdmin ? 'Restore to reviewer list' : 'Archive from reviewer list'}</button>
          {selected.status === 'pending' && <button onClick={() => act({ action: 'claim' })}>Claim request</button>}
          {selected.status === 'in_review' && selected.assignee === user.uid && <button onClick={() => act({ action: 'release' })}>Release request</button>}
          <label>Reason (request outcomes are visible to the requester)<textarea maxLength={1000} value={reason} onChange={e => actionText({ reason: e.target.value })}/></label>
          {role === 'admin' && selected.status === 'in_review' && selected.assignee !== user.uid && <button disabled={!reason.trim()} onClick={() => act({ action: 'takeover', reason } as RequestAction)}>Take over with private reason</button>}
          {role === 'admin' && selected.status === 'decided' && <button disabled={!reason.trim()} onClick={() => act({ action: 'reopen', reason } as RequestAction)}>Reopen with private reason</button>}
          {selected.status === 'in_review' && selected.assignee === user.uid && <><button disabled={!reason.trim()} onClick={() => act({ action: 'decide', outcome: 'declined', reason, reviewId: null } as RequestAction)}>Record declined request</button>
            <label>Existing review ID<input maxLength={128} value={reviewId} onChange={e => actionText({ reviewId: e.target.value })}/></label>
            <button disabled={!reason.trim() || !reviewId.trim()} onClick={() => act({ action: 'decide', outcome: 'review_linked', reason, reviewId } as RequestAction)}>Record link to review</button></>}
        </>}
      </fieldset>
      {reviewer && <><button onClick={() => void loadHistory()}>Inspect request history</button>{history.map(e => <p key={e.revision}>{e.revision}: {e.action} — {e.actorRole} {e.actorUid} at {e.at}{e.note && ` — ${e.note}`}{e.after.outcome && ` — ${e.after.outcome.reason}`}</p>)}{historyCursor && <button onClick={() => void loadHistory(historyCursor!)}>Next history page</button>}</>}
    </section>}
  </section>;
}
