import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { dashboardTiers, tierLabel, type DashboardTier, reviewQueues, reviewQueueLabels, attentionQueues, type ReviewQueue, type ReviewDashboard as Summary } from '../shared/review-dashboard';
import { api } from './api';
export function ReviewDashboard({ user, onOpen, active = true }: { user: User; onOpen: (id?: string) => void; active?: boolean }) {
  const queueHeading = useRef<HTMLHeadingElement>(null); const focusQueue = useRef(false);
  const [data, setData] = useState<Summary>(); const [error, setError] = useState('');
  const [searchDraft, setSearchDraft] = useState(''); const [search, setSearch] = useState(''); const [tier, setTier] = useState<DashboardTier | 'all'>('all');
  const [queue, setQueue] = useState<ReviewQueue>('all'); const [cursor, setCursor] = useState<string>(); const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!active) return;
    let alive = true; let sequence = 0;
    const refresh = async () => { const n = ++sequence; try {
      const result = await api<Summary>(`/api/review-dashboard?queue=${queue}&search=${encodeURIComponent(search)}&tier=${encodeURIComponent(tier)}${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`, user);
      if (alive && n === sequence) { setData(result); setError(''); }
    } catch { if (alive && n === sequence) { setData(undefined); setError('Review summaries are unavailable. Retry or open Policy reviews directly.'); } } };
    void refresh(); const timer = setInterval(() => void refresh(), 15000); return () => { alive = false; clearInterval(timer); };
  }, [user, queue, cursor, reload, search, tier, active]);
  useEffect(() => { if (active && data && focusQueue.current) { queueHeading.current?.focus(); focusQueue.current = false; } }, [data, active]);
  function filter(q: ReviewQueue) { focusQueue.current = true; setQueue(q); setCursor(undefined); setReload(n => n + 1); setData(undefined); setError(''); }
  function changeFilters(nextSearch: string, nextTier: DashboardTier | 'all') { setSearch(nextSearch.trim()); setTier(nextTier); filter(queue); }
  return <section className="panel"><h2>Reviews and publication</h2><p>Review progress and saved publication records. Evidence scores do not confer district approval.</p>
    <div className="actions"><button className="secondary" onClick={() => setReload(n => n + 1)}>Refresh review totals</button><button onClick={() => onOpen()}>Open policy reviews</button></div>
    <form onSubmit={e => { e.preventDefault(); changeFilters(searchDraft, tier); }}><label>Search review names<input type="search" maxLength={120} value={searchDraft} onChange={e => setSearchDraft(e.target.value)}/></label>
      <label>Review tier<select value={tier} onChange={e => changeFilters(search, e.target.value as DashboardTier | 'all')}><option value="all">All tiers</option>{dashboardTiers.map(t => <option key={t} value={t}>{tierLabel(t)}</option>)}</select></label>
      <div className="actions"><button>Search reviews</button><button type="button" className="secondary" onClick={() => { setSearchDraft(''); setSearch(''); setTier('all'); filter('all'); }}>Clear review filters</button></div></form>
    {error ? <p role="alert">{error}</p> : !data ? <p role="status">Loading review summaries…</p> : <>
      <p>Updated {new Date(data.asOf).toLocaleTimeString()}. Refreshes every 15 seconds.</p>
      <div className="request-totals">{reviewQueues.map(q => <button className="secondary" key={q} aria-pressed={queue === q} onClick={() => filter(q)}><strong>{data.counts[q]}</strong><span>{reviewQueueLabels[q]}</span></button>)}</div>
      <p className="subtle">Publication totals count existing review notices in each audience, excluding sample catalogue entries. Attention categories can overlap; {data.attentionTotal} distinct reviews need attention. Requirement gaps reflect the last save, not ongoing agreement monitoring.</p>
      <h3>Tier distribution · all reviews</h3><p>A recorded tier describes district classification, not approval. Pending and no recorded tier are separate. Selecting a tier total clears other filters; selecting a queue total keeps your search and tier.</p>
      <div className="request-totals">{dashboardTiers.map(t => <button className="secondary" key={t} aria-pressed={tier === t} onClick={() => { setSearchDraft(''); setSearch(''); setTier(t); filter('all'); }}><strong>{data.tierCounts[t]}</strong><span>{tierLabel(t)}</span></button>)}</div>
      <h3>Review attention · all reviews</h3>{!data.attention.length && <p>No review attention flags.</p>}
      {data.attention.map(r => <div className="request-row" key={r.id}><button className="secondary" onClick={() => onOpen(r.id)}>{r.name}</button><span>{r.queues.filter(q => attentionQueues.includes(q)).map(q => reviewQueueLabels[q]).join(' · ')}</span></div>)}
      <p>Up to six attention rows, with publication mismatches and failed jobs first. Open a total for the complete queue.</p>
      <h3 ref={queueHeading} tabIndex={-1}>{reviewQueueLabels[queue]}</h3><p role="status">{data.matchingTotal} matching reviews{search && ` · Name contains “${search}”`}{tier !== 'all' && ` · ${tierLabel(tier)}`}. Totals and attention above always cover all reviews.</p>{!data.items.length && <p>No reviews in this queue on this page.</p>}
      {data.items.map(r => <div className="request-row" key={r.id}><button className="secondary" onClick={() => onOpen(r.id)}>{r.name}</button><span>{tierLabel(r.tier ?? 'unassigned')}</span></div>)}
      <div className="actions"><button className="secondary" disabled={!cursor} onClick={() => { focusQueue.current = true; setCursor(undefined); setData(undefined); }}>First review page</button><button className="secondary" disabled={!data.nextCursor} onClick={() => { focusQueue.current = true; setCursor(data.nextCursor!); setData(undefined); }}>Next review page</button></div>
    </>}
  </section>;
}
