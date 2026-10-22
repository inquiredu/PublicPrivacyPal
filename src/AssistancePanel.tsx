import { LONG_BUNDLE_VERSION } from '../shared/source-segments';
import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Review } from '../shared/review';
import { measuresFor } from '../shared/evaluation';
import { suggestedEvidence, suggestionOverview, type AssistanceView } from '../shared/assistance';
import { ANALYSIS_EXAMPLE } from '../shared/analysis-example';
import { useDraftStore, type ReviewCommands } from './ReviewDrafts';
import { api } from './api';
import { RequirementFindings } from './RequirementReview';
import { requirementCitations } from '../shared/requirements';

export function AssistancePanel({ review: r, user, readOnly, disabled, commands }: { review: Review; user: User; readOnly: boolean; disabled: boolean; commands: ReviewCommands }) {
  const [job, setJob] = useState<AssistanceView | null>(null);
  const [error, setError] = useState(''); const [refresh, setRefresh] = useState(0);
  const store = useDraftStore(); const criteria = measuresFor(r);
  useEffect(() => {
    let alive = true; let timer: ReturnType<typeof setTimeout>;
    setJob(null); setError('');
    async function load() {
      try {
        const value = await api<AssistanceView | null>(`/api/reviews/${r.id}/assistance`, user);
        if (!alive) return;
        setJob(value);
        if (value && ['queued', 'running', 'unknown'].includes(value.status)) timer = setTimeout(() => void load(), value.status === 'unknown' ? 10000 : 2000);
      } catch (e) { if (alive) { setJob(null); setError(e instanceof Error ? e.message : 'Suggestions are unavailable.'); } }
    }
    void load(); return () => { alive = false; clearTimeout(timer); };
  }, [r.id, r.assistanceId, user, refresh]);
  const active = job && ['queued', 'running', 'unknown'].includes(job.status);
  const result = job?.result; const example = !r.sourceBundle && r.sourceText === ANALYSIS_EXAMPLE;
  return <section className="assistance-panel" aria-labelledby="assistance-title">
    <h3 id="assistance-title">Policy suggestions</h3>
    <p>The Cedar Intelligence Lab example includes recorded suggestions for trying this workflow offline. Check each interpretation and its scope before saving evidence. Suggestions do not change scores or district decisions.</p>
    {r.sourceBundle ? <p>Source bundles support manual review and instruction preview. No recorded bundle or live provider is enabled.</p> : !example && <p>To try it, load the Cedar Intelligence Lab example in a new review. Other policy texts remain available for manual review until this installation has a configured provider.</p>}
    <div className="actions">
      {!readOnly && <button disabled={disabled || !!active || !example || !!error} onClick={() => void commands.start(`/api/reviews/${r.id}`, { action: 'start_assistance', revision: r.revision }, job?.status === 'succeeded' ? 'Reuse suggestions' : 'Prepare suggestions')}>{job?.status === 'succeeded' ? 'Reuse recorded suggestions' : 'Prepare offline suggestions'}</button>}
      {!readOnly && job && ['queued', 'running'].includes(job.status) && <button className="secondary" disabled={disabled} onClick={() => void commands.start(`/api/reviews/${r.id}`, { action: 'cancel_assistance', revision: r.revision }, 'Cancel suggestions')}>Cancel suggestions</button>}
      <button className="secondary" onClick={() => setRefresh(n => n + 1)}>Refresh suggestions</button>
    </div>
    {job && <p role="status"><strong>{job.status.replaceAll('_', ' ')}</strong> · {job.message} {job.reused && 'No new inference request.'}</p>}
    {job?.status === 'unknown' && <p className="notice">The outcome must be reconciled before another request. A timeout does not mean a provider failed to process it.</p>}
    {error && <p role="alert" className="notice">{error}</p>}
    {result && <>
      <p className="subtle">{job.provider} · {job.model} · {job.promptVersion} · Source: {result.sourceStatus}. These are unreviewed proposals.</p>
      <div><h4>Proposal overview</h4><ul>{suggestionOverview(result).map(line => <li key={line}>{line}</li>)}</ul></div>
      <div className="evidence-list">{result.findings.map(f => {
        const draft = suggestedEvidence(f, result);
        const saved = r.analysis?.findings.find(saved => saved.id === f.measureId);
        const reviewed = !!saved?.reviewedBy;
        const linkedElsewhere = !!saved?.provenance && saved.provenance.jobId !== job.id;
        return <details key={f.measureId}><summary>{criteria.find(c => c.id === f.measureId)?.label || f.measureId} · {f.state.replaceAll('_', ' ')}{reviewed ? ' · human finding saved' : ''}</summary>
          <p>{f.rationale}</p><p><strong>Scope:</strong> {f.scope}</p>
          {f.citationIds.map(id => <blockquote key={id}>{result.citations.find(c => c.id === id)?.quote}</blockquote>)}
          {f.uncertainty !== 'none' && <p><strong>Uncertainty:</strong> {f.uncertainty.replaceAll('_', ' ')}</p>}
          {f.question && <p><strong>Follow up:</strong> {f.question}</p>}
          {f.requirements && <RequirementFindings value={f.requirements} title="Proposed subrequirement findings"/>}
          {!readOnly && draft && <button className="secondary" disabled={disabled || linkedElsewhere} onClick={() => {
            store.set(`evidence:${r.id}`, { revision: r.revision, ...draft, ...(draft.requirements ? { citations: requirementCitations(draft.requirements) } : {}), proposalId: job.id, quoteText: '' });
            document.getElementById('evidence-editor-title')?.focus();
          }}>Review this suggestion in editor{reviewed ? ' as a correction' : ''}</button>}
          {linkedElsewhere && <p>This finding keeps its original suggestion reference. Select it in the evidence editor to correct or resolve it.</p>}
          {!draft && <p>Resolve the missing or ambiguous evidence manually in the editor.</p>}
        </details>;
      })}</div>
    </>}
    <AnalysisInstructions review={r} user={user}/>
  </section>;
}

/** Shared read-only inspection remains available for manual and segmented source reviews. */
export function AnalysisInstructions({ review: r, user }: { review: Review; user: User }) {
  const [prompt, setPrompt] = useState(''); const [error, setError] = useState('');
  const [loadingPrompt, setLoadingPrompt] = useState(false); const generation = useRef(0);
  useEffect(() => { generation.current++; setPrompt(''); setError(''); setLoadingPrompt(false); return () => { generation.current++; }; }, [r.id, user]);
  async function preview() {
    const request = generation.current; setLoadingPrompt(true); setError('');
    try { const value = await api(`/api/reviews/${r.id}/prompt`, user); if (request === generation.current) setPrompt(JSON.stringify(value, null, 2)); }
    catch (e) { if (request === generation.current) { setPrompt(''); setError(e instanceof Error ? e.message : 'Prompt is unavailable.'); } }
    finally { if (request === generation.current) setLoadingPrompt(false); }
  }
  return <section aria-label="Analysis instructions">
    <details><summary>Review the analysis instructions</summary><p>The prompt includes the saved source, enabled measure definitions and adopted district guidance. It excludes identities, district decisions and credentials.</p><button className="secondary" disabled={loadingPrompt} onClick={() => void preview()}>Load prompt preview</button>{prompt && <>{r.sourceBundle?.version === LONG_BUNDLE_VERSION && <button type="button" className="secondary" onClick={() => { const url = URL.createObjectURL(new Blob([JSON.stringify(JSON.parse(prompt))], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = `source-review-packet-${r.id}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Save offline review packet</button>}<pre className="policy-source">{prompt}</pre></>}</details>
    {error && <p role="alert" className="notice">{error}</p>}
  </section>;
}
