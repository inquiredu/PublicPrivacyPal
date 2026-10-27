import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { queueLabels, type RequestDashboard as Summary, type RequestQueue } from '../shared/request-dashboard';
import { api } from './api';
export function RequestDashboard({ user, onOpen }: { user: User; onOpen: (queue: RequestQueue, id?: string) => void }) {
  const [data, setData] = useState<Summary>();
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    const refresh = async () => {
      try { const result = await api<Summary>('/api/request-dashboard', user); if (alive) { setData(result); setError(''); } }
      catch { if (alive) { setData(undefined); setError('Request totals are unavailable. Retry or open requests directly.'); } }
    };
    void refresh(); const timer = setInterval(() => void refresh(), 15000);
    return () => { alive = false; clearInterval(timer); };
  }, [user, reload]);
  const district = data?.audience === 'district';
  return <section className="panel"><h2>Request overview</h2><p>Follow requests from submission to a recorded outcome. Request outcomes do not approve or publish services.</p>
    <div className="actions"><button className="secondary" onClick={() => setReload(n => n + 1)}>Refresh totals</button><button onClick={() => onOpen('active')}>Open requests</button></div>
    {error ? <p role="alert">{error}</p> : !data ? <p role="status">Loading request totals…</p> : <>
      <p>{district ? 'District requests' : 'Your requests only'} · Updated {new Date(data.asOf).toLocaleTimeString()}. Refreshes every 15 seconds.</p>
      <div className="request-totals">{(['all', 'pending', 'in_review', ...(district ? ['assigned' as const] : []), 'decided', 'archived'] as RequestQueue[]).map(q => <button className="secondary" key={q} onClick={() => onOpen(q)}><strong>{data.counts[q]}</strong><span>{q === 'pending' && district ? 'Unassigned requests' : queueLabels[q]}</span></button>)}</div>
      <p className="subtle">All requests includes archives. Other status totals exclude requests archived in this view; “Assigned to you” is part of “In review”.</p>
      <h3>{district ? 'Needs your attention' : 'Recorded outcomes'}</h3>
      <p>{district ? 'Unassigned requests and active requests assigned to you, oldest first.' : 'Your decided requests, oldest first. These are outcomes, not unread notifications.'}</p>
      {!data.attention.length && <p>{district ? 'No requests need your attention.' : 'No recorded outcomes to show.'}</p>}
      {data.attention.map(r => <div className="request-row" key={r.id}><button className="secondary" onClick={() => onOpen(r.status === 'pending' ? 'pending' : r.status === 'in_review' ? 'assigned' : 'decided', r.id)}>{r.toolName}</button><span>{r.status === 'pending' ? 'Unassigned' : r.status === 'in_review' ? 'Assigned to you' : 'Decided'}</span></div>)}
      <p>Showing up to six requests. Open a total above to see its complete queue.</p>
    </>}
  </section>;
}
