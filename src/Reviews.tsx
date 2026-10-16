import { PAGE_SIZE, measuresFor, type ReviewSummary } from '../shared/evaluation';
import { z } from 'zod';
import { captureDraftSchema, decisionDraftSchema } from '../shared/drafts';
import { useDraftStore, useReviewCommands, type ReviewCommands } from './ReviewDrafts';
import { useEffect, useState, type FormEvent } from 'react';
import type { User } from 'firebase/auth';
import { collection, doc, documentId, onSnapshot, orderBy, query, limit, startAfter } from 'firebase/firestore';
import type { Client } from './firebase';
import { criteria, citationsFor, currentAnalysis, isPastedReview, reviewedCount, MAX_POLICY_LENGTH, MAX_REVIEW_IMPORT_BYTES, type Review, type ReviewEvent } from '../shared/review';
import { DEFAULT_PROFILE, profiles, profileVersions, getProfile } from '../shared/scoring/profiles';
import { api } from './api';
import { EvidenceEditor } from './EvidenceEditor';
const message = (e: unknown) => e instanceof Error ? e.message : 'The action could not be completed.';
const statusLabels = { awaiting_review: 'Evidence review needed', queued: 'Queued', running: 'Analyzing', succeeded: 'Ready for review', failed: 'Analysis failed', cancelled: 'Cancelled' };
export function Reviews({ client, user, readOnly }: { client: Client; user: User; readOnly: boolean }) {
  const [rows, setRows] = useState<ReviewSummary[]>([]);
  const [active, setActive] = useState<Review>();
  const [detailError, setDetailError] = useState('');
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [page, setPage] = useState<{ at: string; id: string }[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [rubric, setRubric] = useState<{ available: boolean; revision: number; measureCount: number }>();
  const store = useDraftStore();
  const capture = store.get('capture', captureDraftSchema) || { sourceKind: 'pasted' as const, name: '', sourceLabel: '', sourceText: '', fixtureId: 'complete' as const, profileVersion: DEFAULT_PROFILE };
  const sourceKind = capture.sourceKind;
  const selected = store.get('location', z.string()) || '';
  const setSelected = (id: string) => store.set('location', id);
  const changeCapture = (patch: Partial<typeof capture>) => store.set('capture', { ...capture, ...patch });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let q = query(collection(client.db, `districts/${client.config.districtId}/reviews`), orderBy('createdAt', 'desc'), orderBy(documentId(), 'desc'), limit(PAGE_SIZE + 1));
    const cursor = page.at(-1); if (cursor) q = query(q, startAfter(cursor.at, cursor.id));
    return onSnapshot(q, snap => {
      setHasNext(snap.size > PAGE_SIZE); setRows(snap.docs.slice(0, PAGE_SIZE).map(d => { const r = d.data(); return { id: d.id, name: r.name, revision: r.revision, createdAt: r.createdAt, updatedAt: r.updatedAt, published: r.published, status: r.job.status, score: r.score, reviewed: r.reviewed, measureCount: r.measureCount }; }));
    }, () => { setRows([]); setError('Reviews could not be loaded. Check your membership and local services.'); });
  }, [client, page]);
  useEffect(() => { let alive = true; void api<{ available: boolean; revision: number; measureCount: number }>('/api/review-rubric', user).then(r => { if (alive) setRubric(r); }).catch(e => { if (alive) setError(message(e)); }); return () => { alive = false; }; }, [user]);
  useEffect(() => {
    if (!selected) return; let sequence = 0; let alive = true; setDetailError('');
    const stop = onSnapshot(doc(client.db, `districts/${client.config.districtId}/reviews/${selected}`), snap => {
      const request = ++sequence;
      if (!snap.exists()) { setActive(undefined); return; }
      void api<Review>(`/api/reviews/${selected}`, user).then(r => { if (alive && request === sequence) setActive(old => old?.id === r.id && old.revision > r.revision ? old : r); }).catch(e => { if (alive && request === sequence) { setActive(undefined); setDetailError(message(e)); } });
    }, () => { setActive(undefined); setDetailError('Review access is unavailable.'); });
    return () => { alive = false; stop(); };
  }, [client, selected, user, loadAttempt]);
  function acceptReview(r: Review) { setActive(old => old?.id === r.id && old.revision > r.revision ? old : r); }
  const commands = useReviewCommands(user, r => { acceptReview(r); setSelected(r.id); });
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('');
    await commands.start('/api/reviews', { name: capture.name, ...(sourceKind === 'pasted' && capture.rubricMode === 'district' ? { rubricMode: 'district', settingsRevision: capture.settingsRevision, engineVersion: profiles[capture.profileVersion].engineVersion } : { profileVersion: capture.profileVersion }), ...(sourceKind === 'pasted' ? { sourceKind, sourceLabel: capture.sourceLabel, sourceText: capture.sourceText } : { fixtureId: capture.fixtureId }) }, 'Create review', ['capture']);
  }
  return <>
    {commands.notice}
    <section className="panel"><h2>Local policy review</h2><p>Paste policy text for manual evidence review, or practice with a bundled fictional policy. Everything stays in your local sandbox. No website is fetched and no AI service is called.</p><p className="subtle">Choose the eight-measure practice profile or explicitly adopt your saved district rubric. Each review keeps its chosen source, rubric and scoring rule; changing Settings does not rescore existing reviews.</p>
      {!readOnly && <form className="review-create" onSubmit={e => void create(e)}><fieldset disabled={busy || commands.blocked}>
        <label>Policy source<select value={sourceKind} onChange={e => changeCapture({ sourceKind: e.target.value as typeof sourceKind })}><option value="pasted">Paste policy text</option><option value="fixture">Bundled synthetic policy</option></select></label>
        <label>Tool name<input name="name" value={capture.name} onChange={e => changeCapture({ name: e.target.value })} maxLength={120} required placeholder="e.g. Orchard Learning"/></label>
        <label>Scoring profile<select name="profileVersion" value={capture.profileVersion} onChange={e => changeCapture({ profileVersion: e.target.value as typeof capture.profileVersion })}>{profileVersions.map(version => <option key={version} value={version}>{profiles[version].name}</option>)}</select></label>
        {sourceKind === 'pasted' && <label>Review measures<select value={capture.rubricMode || 'practice'} onChange={e => changeCapture({ rubricMode: e.target.value as 'practice' | 'district', ...(rubric?.available ? { settingsRevision: rubric.revision } : {}) })}><option value="practice">Eight-measure practice profile</option><option value="district" disabled={!rubric?.available}>Saved district rubric (50 measures)</option></select>{capture.rubricMode === 'district' && <small>Adopting settings revision {capture.settingsRevision}. Disabled areas are excluded from scoring and completion. {rubric?.available && rubric.revision !== capture.settingsRevision && <button type="button" onClick={() => changeCapture({ settingsRevision: rubric.revision })}>Use current settings revision {rubric?.revision}</button>}</small>}<button type="button" className="secondary" onClick={() => { setError(''); void api<typeof rubric>('/api/review-rubric', user).then(setRubric).catch(e => setError(message(e))); }}>Refresh saved rubric</button></label>}
        {sourceKind === 'pasted' ? <><label className="full-width">Source label<input name="sourceLabel" value={capture.sourceLabel} onChange={e => changeCapture({ sourceLabel: e.target.value })} maxLength={160} required placeholder="e.g. Orchard fictional policy, October 2026"/></label><label className="full-width">Policy text<textarea name="sourceText" value={capture.sourceText} onChange={e => changeCapture({ sourceText: e.target.value })} rows={8} maxLength={MAX_POLICY_LENGTH} required/><small>Up to 32,000 characters. Use synthetic text for this local trial. This saved copy is fixed; create a new review for a changed policy. Review every enabled criterion before recording a decision.</small></label></> : <label>Synthetic policy<select name="fixtureId" value={capture.fixtureId} onChange={e => changeCapture({ fixtureId: e.target.value as typeof capture.fixtureId })}><option value="complete">Clear commitments</option><option value="gaps">Missing and conflicting commitments</option><option value="retry">Temporary failure — retry practice</option></select></label>}
        <button disabled={busy || commands.blocked}>{sourceKind === 'pasted' ? 'Save policy for review' : 'Start synthetic analysis'}</button>
      </fieldset></form>}
      {store.has('capture') && !readOnly && <p className="subtle">Draft kept in this tab; not saved to the workspace. <button type="button" className="secondary" disabled={commands.blocked} onClick={() => store.remove('capture')}>Discard new review draft</button></p>}
      <details><summary>Eight-measure practice rubric</summary><p>These eight criteria are a candidate for district review. A score measures the statements in a policy, not a vendor’s actual practices. There is no approval threshold.</p><p>The evidence-first candidate gives missing evidence zero credit. The inherited profile retains 60% missing-evidence credit for comparison. New analyses stay on the profile selected when the review was created.</p><div className="evidence-list">{criteria.map(c => <article key={c.id}><h3>{c.label} · Weight {c.weight}</h3><p><strong>Meets:</strong> {c.evidence}</p><p><strong>Partial:</strong> {c.partial}</p><p><strong>Does not meet:</strong> {c.failure}</p></article>)}</div><p><strong>Not addressed:</strong> no supporting statement. Missing evidence remains distinct from an explicit contradiction. The fixture adapter does not evaluate arbitrary policies.</p></details>
      {!readOnly && <label className="import-control">Import a review as a new draft<input type="file" accept="application/json,.json" disabled={busy || commands.blocked} onChange={async e => {
        const file = e.target.files?.[0]; e.target.value = ''; if (!file) return;
        setBusy(true); setError('');
        try { if (file.size > MAX_REVIEW_IMPORT_BYTES) throw new Error('Choose a JSON file no larger than 2 MiB.'); await commands.start('/api/reviews/import', JSON.parse(await file.text()), 'Import review'); }
        catch (e) { setError(message(e)); } finally { setBusy(false); }
      }}/><small>Pasted imports require fresh evidence review. Synthetic imports rerun the fixture analysis. District-rubric exports are archives: paste the source into a new review and explicitly select the current saved rubric. Archived findings, approvals, and history cannot authorize publication.</small></label>}
      {error && <div className="notice" role="alert">{error}</div>}
    </section>
    <div className="review-layout"><aside className="review-list" aria-label="Reviews"><h2>Reviews <span className="count">{rows.length}</span></h2>{!rows.length && <p>No reviews yet.</p>}{rows.map(r => <button key={r.id} className={r.id === selected ? 'review-item selected' : 'review-item'} onClick={() => setSelected(r.id)}><strong>{r.name}</strong><span>{r.published ? 'Published locally' : statusLabels[r.status as keyof typeof statusLabels]}</span></button>)}<div className="actions"><button className="secondary" disabled={!page.length} onClick={() => setPage(p => p.slice(0, -1))}>Previous reviews</button><button className="secondary" disabled={!hasNext} onClick={() => { const last = rows.at(-1); if (last) setPage(p => [...p, { at: last.createdAt, id: last.id }]); }}>Next reviews</button></div></aside>
      <div>{active?.id === selected ? <ReviewDetail key={active.id} review={active} client={client} user={user} readOnly={readOnly} commands={commands}/> : <section className="panel">{detailError && <div role="alert" className="notice">{detailError} <button className="secondary" onClick={() => setLoadAttempt(n => n + 1)}>Retry loading review</button></div>}<h2>From evidence to a district decision</h2><ol className="review-steps"><li>Paste policy text or analyze a synthetic policy.</li><li>Inspect the score, quotes, and evidence gaps.</li><li>Record the district’s decision and public wording.</li><li>Publish to the local library, or remove it.</li></ol></section>}</div>
    </div>
  </>;
}
function ReviewDetail({ review: r, client, user, readOnly, commands }: { review: Review; client: Client; user: User; readOnly: boolean; commands: ReviewCommands }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const criteria = measuresFor(r);
  const [historyPage, setHistoryPage] = useState<{ at: string; id: string }[]>([]);
  const [historyNext, setHistoryNext] = useState(false);
  const [history, setHistory] = useState<ReviewEvent[]>([]);
  const store = useDraftStore();
  const decisionKey = `decision:${r.id}`;
  const draft = store.get(decisionKey, decisionDraftSchema);
  const dirty = !!draft;
  const evidenceDirty = store.has(`evidence:${r.id}`);
  const decisionRevision = draft?.revision ?? r.revision;
  const decisionValues = draft?.values || { outcome: r.decision?.outcome || 'conditional', rationale: r.decision?.rationale || '', conditions: r.decision?.conditions || '', summary: r.decision?.summary || '', category: r.decision?.category || 'Learning' };
  function changeDecision(patch: Partial<typeof decisionValues>) { store.set(decisionKey, { revision: decisionRevision, values: { ...decisionValues, ...patch } }); }
  useEffect(() => {
    let q = query(collection(client.db, `districts/${client.config.districtId}/reviews/${r.id}/history`), orderBy('at', 'desc'), orderBy(documentId(), 'desc'), limit(PAGE_SIZE + 1));
    const cursor = historyPage.at(-1); if (cursor) q = query(q, startAfter(cursor.at, cursor.id));
    return onSnapshot(q, snap => { setHistoryNext(snap.size > PAGE_SIZE); setHistory(snap.docs.slice(0, PAGE_SIZE).map(d => ({ id: d.id, ...d.data() } as ReviewEvent))); }, () => { setHistory([]); setError('Review history could not be loaded.'); });
  }, [client, r.id, historyPage]);
  const profile = getProfile(r.profileVersion || 'community-demo-v1');
  const current = currentAnalysis(r);
  const pasted = isPastedReview(r);
  const decided = current && r.decision?.analysisId === r.analysis?.id;
  async function command(action: string, decision?: unknown) {
    await commands.start(`/api/reviews/${r.id}`, { action, revision: decision ? decisionRevision : r.revision, ...(decision ? { decision } : {}) }, action.replaceAll('_', ' '), action === 'decide' ? [decisionKey] : []);
  }
  async function decide(e: FormEvent<HTMLFormElement>) { e.preventDefault(); await command('decide', decisionValues); }
  return <section className="panel review-detail"><div className="review-title"><div><p className="eyebrow">{pasted ? 'PASTED POLICY REVIEW' : 'SYNTHETIC POLICY REVIEW'}</p><h2>{r.name}</h2></div><span className="pill">{r.published ? 'Published locally' : 'Private draft'}</span></div>
    <p role="status">{statusLabels[r.job.status]}{!pasted && ` · Attempt ${r.job.attempt}`}
      {pasted && ` · ${reviewedCount(r)} of ${criteria.length} criteria reviewed`}</p>
    {r.job.error && <div className="notice" role="alert">{r.job.error}</div>}
    {!readOnly && !pasted && <div className="actions">{r.job.status === 'failed' && r.job.attempt < 3 && <button disabled={busy || commands.blocked} onClick={() => void command('retry')}>Retry analysis</button>}{['queued', 'running'].includes(r.job.status) ? <button className="secondary" disabled={busy || commands.blocked} onClick={() => void command('cancel')}>Cancel analysis</button> : <button className="secondary" disabled={busy || commands.blocked || dirty || evidenceDirty} onClick={() => void command('reanalyze')}>Rerun fixture analysis</button>}</div>}
    {r.analysis && <><div className="score-panel"><strong>{r.analysis.score.total}<span>/100</span></strong><div><h3>{pasted && !current ? 'Provisional evidence score' : 'Policy evidence score'}</h3><p>{r.analysis.evidenceCount} of {criteria.length} criteria have cited evidence.</p><small>{r.analysis.profileVersion} · {r.analysis.score.engineVersion}</small></div></div><p className="subtle">{profile.explanation} A score is not district approval. {profile.status}.</p>{!current && <div className="notice">{pasted ? 'Finish all enabled evidence findings before recording a decision. Unreviewed criteria are not confirmed evidence gaps.' : 'These are earlier findings. Complete the new analysis and record a new decision before publishing.'}</div>}
      <details><summary>Inspect evidence and score breakdown</summary><div className="evidence-list">{r.analysis.score.breakdown.map(c => {
        const f = r.analysis!.findings.find(f => f.id === c.id); const quotes = citationsFor(f);
        return <article key={c.id}><h3>{criteria.find(item => item.id === c.id)?.label || c.id}</h3><p>{pasted && !f?.reviewedBy ? 'Needs review' : c.assessment.replaceAll('_', ' ')} · {Number(c.points.toFixed(2))} / {c.maximum} points</p>{quotes.map(q => <blockquote key={`${q.start}:${q.end}`}>{q.quote}</blockquote>)}{!quotes.length && <p className="subtle">No quotation attached.</p>}{f?.rationale && <p><strong>Reviewer’s rationale:</strong> {f.rationale}</p>}{f?.reviewedAt && <small>Reviewed {new Date(f.reviewedAt).toLocaleString()} · {f.reviewedBy}</small>}</article>;
      })}</div><small>Source SHA-256: {r.analysis.sourceHash}</small></details></>}
    {r.contract && <details><summary>Adopted rubric and scoring version</summary><p>{r.contract.definitionVersion} · {r.contract.engineVersion} · {criteria.length} enabled measures{r.contract.settingsRevision !== null && ` · Settings revision ${r.contract.settingsRevision}`}</p><p>Later Settings changes apply only to a new review. Disabled areas are excluded. Findings mean whether the stated criterion is met, not a yes/no answer to its question.</p><ul>{r.contract.criteria.map(c => <li key={c.id}>{c.id}: {c.label} · {c.weight ? `Weight ${c.weight}` : 'Disabled'}</li>)}</ul></details>}
    <details><summary>Read saved policy text</summary><p>{r.sourceLabel || 'Bundled synthetic policy'}{r.sourceCapturedAt && ` · Saved ${new Date(r.sourceCapturedAt).toLocaleString()} · Version ${r.sourceVersion}`}</p><pre className="policy-source">{r.sourceText}</pre></details>
    {!readOnly && (evidenceDirty || ['awaiting_review', 'succeeded'].includes(r.job.status)) && <EvidenceEditor review={r} disabled={busy || commands.blocked || dirty} commands={commands}/>}
    {!pasted && !readOnly && r.analysis && <p className="subtle">Rerunning the fixture replaces manual findings with synthetic analysis and removes publication. Earlier evidence changes remain in history.</p>}
    <section className="decision-panel"><h3>District decision</h3>{r.decision && <p>{r.decision.outcome}{decided ? '' : ' — earlier analysis; new review required'} · Recorded {new Date(r.decision.at).toLocaleString()}</p>}
      {readOnly ? <><p>{r.decision?.rationale || 'No decision recorded.'}</p><p>{r.decision?.conditions}</p></> : (current || dirty) ? <form className="decision-form" onSubmit={e => void decide(e)}><fieldset disabled={busy || commands.blocked || evidenceDirty}><label>Decision<select name="outcome" value={decisionValues.outcome} onChange={e => changeDecision({ outcome: e.target.value as typeof decisionValues.outcome })}><option value="conditional">Approved with conditions</option><option value="approved">Approved</option><option value="declined">Declined</option></select></label><label>Internal rationale<textarea name="rationale" maxLength={2000} required value={decisionValues.rationale} onChange={e => changeDecision({ rationale: e.target.value })}/><small>Only reviewers can see this.</small></label><label>Conditions of use<textarea name="conditions" maxLength={1500} value={decisionValues.conditions} onChange={e => changeDecision({ conditions: e.target.value })}/><small>Required for conditional approval. Published with the library entry.</small></label><label>Public summary<textarea name="summary" maxLength={1000} required value={decisionValues.summary} onChange={e => changeDecision({ summary: e.target.value })}/></label><label>Category<input name="category" maxLength={80} required value={decisionValues.category} onChange={e => changeDecision({ category: e.target.value })}/></label><button disabled={!current || (dirty && decisionRevision !== r.revision)}>Record decision</button>{dirty && <button type="button" className="secondary" onClick={() => store.remove(decisionKey)}>Discard decision changes</button>}<small>Recording a new decision removes any existing publication until you publish again.</small></fieldset></form> : <><p>Complete the evidence review to record a decision.</p>{dirty && <button className="secondary" onClick={() => store.remove(decisionKey)}>Discard earlier decision changes</button>}</>}
    </section>
    {!readOnly && <div className="actions">{decided && r.decision?.outcome !== 'declined' && !r.published && <button disabled={busy || commands.blocked || dirty || evidenceDirty} onClick={() => void command('publish')}>Publish to local library</button>}{r.published && <button className="secondary" disabled={busy || commands.blocked} onClick={() => void command('unpublish')}>Unpublish from local library</button>}</div>}
    {dirty && <p className="subtle">Draft kept in this tab; not saved to the workspace. {decisionRevision !== r.revision ? "This review changed. Discard these decision changes and review the current evidence before deciding." : "Record or discard your decision changes before editing evidence or publishing."}</p>}{evidenceDirty && <p className="subtle">Save or discard evidence changes before deciding or publishing.</p>}
    {error && <div className="notice" role="alert">{error} No success has been confirmed; check the current review before retrying.</div>}
    <details><summary>Review history — page {historyPage.length + 1} ({history.length} events)</summary><ol className="history">{history.map(h => <li key={h.id}><strong>{h.action.replaceAll('_', ' ')}</strong> · {new Date(h.at).toLocaleString()}<small>Actor: {h.actorUid} · Revision {h.revision}</small>{['decide', 'edit_evidence'].includes(h.action) && <pre>{JSON.stringify(h.details, null, 2)}</pre>}</li>)}</ol><div className="actions"><button className="secondary" disabled={!historyPage.length} onClick={() => setHistoryPage(p => p.slice(0, -1))}>Newer history</button><button className="secondary" disabled={!historyNext} onClick={() => { const last = history.at(-1); if (last) setHistoryPage(p => [...p, { at: last.at, id: last.id }]); }}>Older history</button></div></details>
    <button className="secondary" disabled={busy || commands.blocked} onClick={async () => {
      setError(''); setBusy(true);
      try { const data = await api(`/api/reviews/${r.id}/export`, user); const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `local-review-${r.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
      catch (e) { setError(message(e)); } finally { setBusy(false); }
    }}>Export review and history page</button>
  </section>;
}
