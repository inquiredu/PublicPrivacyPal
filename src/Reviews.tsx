import { useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import type { Client } from './firebase';
import { criteria, type Review, type ReviewEvent } from '../shared/review';
import { DEFAULT_PROFILE, profiles, profileVersions, getProfile } from '../shared/scoring/profiles';
import { api } from './api';
const message = (e: unknown) => e instanceof Error ? e.message : 'The action could not be completed.';
const statusLabels = { queued: 'Queued', running: 'Analyzing', succeeded: 'Ready for review', failed: 'Analysis failed', cancelled: 'Cancelled' };
export function Reviews({ client, user, readOnly }: { client: Client; user: User; readOnly: boolean }) {
  const [rows, setRows] = useState<Review[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => onSnapshot(query(collection(client.db, `districts/${client.config.districtId}/reviews`), orderBy('updatedAt', 'desc')), snap => {
    setRows(snap.docs.map(d => d.data() as Review));
  }, () => { setRows([]); setError('Reviews could not be loaded. Check your membership and local services.'); }), [client]);
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setBusy(true);
    const form = e.currentTarget; const values = new FormData(form);
    try { const r = await api<Review>('/api/reviews', user, { name: values.get('name'), fixtureId: values.get('fixtureId'), profileVersion: values.get('profileVersion') }); setSelected(r.id); form.reset(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  const active = rows.find(r => r.id === selected);
  return <>
    <section className="panel"><h2>Policy review lab</h2><p>Practice the complete workflow with fictional policies. Analysis runs locally using bundled examples. No website is fetched and no AI service is called.</p>
      {!readOnly && <form className="review-create" onSubmit={e => void create(e)}><label>Tool name<input name="name" maxLength={120} required placeholder="e.g. Orchard Learning"/></label><label>Synthetic policy<select name="fixtureId"><option value="complete">Clear commitments</option><option value="gaps">Missing and conflicting commitments</option><option value="retry">Temporary failure — retry practice</option></select></label><label>Scoring profile<select name="profileVersion" defaultValue={DEFAULT_PROFILE}>{profileVersions.map(version => <option key={version} value={version}>{profiles[version].name}</option>)}</select></label><button disabled={busy}>Start analysis</button></form>}
      <details><summary>Review the scoring rubric</summary><p>These eight criteria are a candidate for district review. A score measures the statements in a policy, not a vendor’s actual practices. There is no approval threshold.</p><p>The evidence-first candidate gives missing evidence zero credit. The inherited profile retains 60% missing-evidence credit for comparison. New analyses stay on the profile selected when the review was created.</p><div className="evidence-list">{criteria.map(c => <article key={c.id}><h3>{c.label} · Weight {c.weight}</h3><p><strong>Meets:</strong> {c.evidence}</p><p><strong>Partial:</strong> {c.partial}</p><p><strong>Does not meet:</strong> {c.failure}</p></article>)}</div><p><strong>Not addressed:</strong> no supporting statement. Missing evidence remains distinct from an explicit contradiction. The fixture adapter does not evaluate arbitrary policies.</p></details>
      {!readOnly && <label className="import-control">Import a synthetic review as a new draft<input type="file" accept="application/json,.json" disabled={busy} onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
        setBusy(true); setError('');
        try { if (file.size > 131072) throw new Error('Choose a JSON file smaller than 128 KiB.'); const r = await api<Review>('/api/reviews/import', user, JSON.parse(await file.text())); setSelected(r.id); }
        catch (e) { setError(message(e)); } finally { setBusy(false); }
      }}/><small>Imports recompute scores and require a new decision. Archived approvals and history remain in the export file.</small></label>}
      {error && <div className="notice" role="alert">{error}</div>}
    </section>
    <div className="review-layout"><aside className="review-list" aria-label="Reviews"><h2>Reviews <span className="count">{rows.length}</span></h2>{!rows.length && <p>No reviews yet.</p>}{rows.map(r => <button key={r.id} className={r.id === selected ? 'review-item selected' : 'review-item'} onClick={() => setSelected(r.id)}><strong>{r.name}</strong><span>{r.published ? 'Published locally' : statusLabels[r.job.status]}</span></button>)}</aside>
      <div>{active ? <ReviewDetail key={active.id} review={active} client={client} user={user} readOnly={readOnly}/> : <section className="panel"><h2>From evidence to a district decision</h2><ol className="review-steps"><li>Analyze a synthetic policy.</li><li>Inspect the score, quotes, and evidence gaps.</li><li>Record the district’s decision and public wording.</li><li>Publish to the local library, or remove it.</li></ol></section>}</div>
    </div>
  </>;
}
function ReviewDetail({ review: r, client, user, readOnly }: { review: Review; client: Client; user: User; readOnly: boolean }) {
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<ReviewEvent[]>([]);
  const [dirty, setDirty] = useState(false);
  useEffect(() => onSnapshot(query(collection(client.db, `districts/${client.config.districtId}/reviews/${r.id}/history`), orderBy('at', 'desc')), snap => setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as ReviewEvent))), () => { setHistory([]); setError('Review history could not be loaded.'); }), [client, r.id]);
  const profile = getProfile(r.analysis?.profileVersion || r.profileVersion || 'community-demo-v1');
  const current = r.job.status === 'succeeded' && r.analysis?.id === r.job.id;
  const decided = current && r.decision?.analysisId === r.analysis?.id;
  async function command(action: string, decision?: unknown) {
    setError(''); setNotice(''); setBusy(true);
    try { await api(`/api/reviews/${r.id}`, user, { action, revision: r.revision, ...(decision ? { decision } : {}) }); if (action === 'decide') setDirty(false); setNotice(action === 'publish' ? 'Published in the local public library.' : action === 'unpublish' ? 'Removed from the local public library.' : action === 'decide' ? 'Decision recorded. Publication is a separate step.' : 'Analysis updated. You can leave this page and return.'); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  async function decide(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const f = new FormData(e.currentTarget);
    await command('decide', Object.fromEntries(['outcome', 'rationale', 'conditions', 'summary', 'category'].map(k => [k, f.get(k)])));
  }
  return <section className="panel review-detail"><div className="review-title"><div><p className="eyebrow">SYNTHETIC POLICY REVIEW</p><h2>{r.name}</h2></div><span className="pill">{r.published ? 'Published locally' : 'Private draft'}</span></div>
    <p role="status">{statusLabels[r.job.status]} · Attempt {r.job.attempt}</p>
    {r.job.error && <div className="notice" role="alert">{r.job.error}</div>}
    {!readOnly && <div className="actions">{r.job.status === 'failed' && r.job.attempt < 3 && <button disabled={busy} onClick={() => void command('retry')}>Retry analysis</button>}{['queued', 'running'].includes(r.job.status) ? <button className="secondary" disabled={busy} onClick={() => void command('cancel')}>Cancel analysis</button> : <button className="secondary" disabled={busy} onClick={() => void command('reanalyze')}>Run new analysis</button>}</div>}
    {r.analysis && <><div className="score-panel"><strong>{r.analysis.score.total}<span>/100</span></strong><div><h3>Policy evidence score</h3><p>{r.analysis.evidenceCount} of {criteria.length} criteria have cited evidence.</p><small>{r.analysis.profileVersion} · {r.analysis.score.engineVersion}</small></div></div><p className="subtle">{profile.explanation} A score is not district approval. {profile.status}.</p>{!current && <div className="notice">These are earlier findings. Complete the new analysis and record a new decision before publishing.</div>}
      <details><summary>Inspect evidence and score breakdown</summary><div className="evidence-list">{r.analysis.score.breakdown.map(c => <article key={c.id}><h3>{criteria.find(item => item.id === c.id)?.label || c.id}</h3><p>{c.assessment.replaceAll('_', ' ')} · {Number(c.points.toFixed(2))} / {c.maximum} points</p>{r.analysis!.findings.find(f => f.id === c.id)?.quote ? <blockquote>{r.analysis!.findings.find(f => f.id === c.id)?.quote}</blockquote> : <p className="subtle">No supporting statement in the policy.</p>}</article>)}</div><small>Source SHA-256: {r.analysis.sourceHash}</small></details></>}
    <details><summary>Read synthetic source policy</summary><pre className="policy-source">{r.sourceText}</pre></details>
    <section className="decision-panel"><h3>District decision</h3>{r.decision && <p>{r.decision.outcome}{decided ? '' : ' — earlier analysis; new review required'} · Recorded {new Date(r.decision.at).toLocaleString()}</p>}
      {readOnly ? <><p>{r.decision?.rationale || 'No decision recorded.'}</p><p>{r.decision?.conditions}</p></> : current ? <form key={r.decision?.at || 'new'} className="decision-form" onChange={() => setDirty(true)} onSubmit={e => void decide(e)}><label>Decision<select name="outcome" defaultValue={r.decision?.outcome || 'conditional'}><option value="conditional">Approved with conditions</option><option value="approved">Approved</option><option value="declined">Declined</option></select></label><label>Internal rationale<textarea name="rationale" maxLength={2000} required defaultValue={r.decision?.rationale}/><small>Only reviewers can see this.</small></label><label>Conditions of use<textarea name="conditions" maxLength={1500} defaultValue={r.decision?.conditions}/><small>Required for conditional approval. Published with the library entry.</small></label><label>Public summary<textarea name="summary" maxLength={1000} required defaultValue={r.decision?.summary}/></label><label>Category<input name="category" maxLength={80} required defaultValue={r.decision?.category || 'Learning'}/></label><button disabled={busy}>Record decision</button><small>Recording a new decision removes any existing publication until you publish again.</small></form> : <p>Complete the analysis to record a decision.</p>}
    </section>
    {!readOnly && <div className="actions">{decided && r.decision?.outcome !== 'declined' && !r.published && <button disabled={busy || dirty} onClick={() => void command('publish')}>Publish to local library</button>}{r.published && <button className="secondary" disabled={busy} onClick={() => void command('unpublish')}>Unpublish from local library</button>}</div>}
    {dirty && <p className="subtle">Record your changes before publishing.</p>}
    {error && <div className="notice" role="alert">{error} No success has been confirmed; check the current review before retrying.</div>}{notice && <p role="status">{notice}</p>}
    <details><summary>Review history ({history.length})</summary><ol className="history">{history.map(h => <li key={h.id}><strong>{h.action.replaceAll('_', ' ')}</strong> · {new Date(h.at).toLocaleString()}<small>Actor: {h.actorUid} · Revision {h.revision}</small>{h.action === 'decide' && <pre>{JSON.stringify(h.details, null, 2)}</pre>}</li>)}</ol></details>
    <button className="secondary" disabled={busy} onClick={async () => {
      setError(''); setBusy(true);
      try { const data = await api(`/api/reviews/${r.id}/export`, user); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `synthetic-review-${r.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      catch (e) { setError(message(e)); } finally { setBusy(false); }
    }}>Export review and history</button>
  </section>;
}
