import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Review } from '../shared/review';
import { SEGMENTED_LIMITS, type SegmentedAttemptScope, type SegmentedAttemptView, type SegmentedOutputView, type SegmentedRequestView, type SegmentedRunsView, type SegmentedRunView } from '../shared/segmented-assistance';
import { api } from './api';
import { useDraftStore, type ReviewCommands } from './ReviewDrafts';
import { SegmentedProposalBrowser } from './SegmentedProposalView';
import { installSegmentedDraft, segmentedReasonText } from './segmented-review';
import './segmented-review.css';

export function SegmentedAssistancePanel({ review, user, commands, editable, disabled = false }: { review: Review; user: User; commands: ReviewCommands; editable: boolean; disabled?: boolean }) {
  const store = useDraftStore(); const [summary, setSummary] = useState<SegmentedRunsView | null>(null); const [detail, setDetail] = useState<SegmentedRunView | null>(null);
  const [runId, setRunId] = useState(''); const [measureId, setMeasureId] = useState(''); const [outcomeId, setOutcomeId] = useState('');
  const [refresh, setRefresh] = useState(0); const [cursors, setCursors] = useState<string[]>([]); const [error, setError] = useState('');
  const latest = useRef({ review, disabled, editable }); latest.current = { review, disabled, editable };
  const base = `/api/reviews/${encodeURIComponent(review.id)}/segmented-runs`;
  const blocked = disabled || commands.blocked;
  useEffect(() => {
    let alive = true; setSummary(null); setError('');
    void api<SegmentedRunsView>(base, user).then(value => {
      if (!alive) return;
      setSummary(value); setRunId(previous => value.runs.items.some(r => r.id === previous) ? previous : value.currentRunId || value.runs.items[0]?.id || '');
    }).catch(e => { if (alive) { setSummary(null); setDetail(null); setError(e instanceof Error ? e.message : 'Segmented runs are unavailable.'); } });
    return () => { alive = false; };
  }, [base, user, review.revision, refresh, commands.blocked]);
  useEffect(() => { setCursors([]); setMeasureId(''); setOutcomeId(''); }, [base, runId]);
  const cursor = cursors.at(-1);
  useEffect(() => {
    let alive = true; let timer: ReturnType<typeof setTimeout> | undefined;
    setDetail(null);
    async function load() {
      if (!runId) return;
      try {
        const value = await api<SegmentedRunView>(`${base}/${encodeURIComponent(runId)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`, user);
        if (!alive) return;
        setDetail(value); setError('');
        if (value.run.activeAttemptId) timer = setTimeout(() => void load(), 2500);
      } catch (e) { if (alive) { setDetail(null); setError(e instanceof Error ? e.message : 'The run could not be loaded.'); } }
    }
    void load(); return () => { alive = false; clearTimeout(timer); };
  }, [base, runId, cursor, user, refresh, review.revision, commands.blocked]);
  async function command(body: object, label: string) { await commands.start(`/api/reviews/${review.id}`, body, label); setRefresh(n => n + 1); }
  function runAttempt(scope: SegmentedAttemptScope) {
    if (!detail || review.revision !== detail.run.baseReviewRevision) return;
    void command({ action: 'run_segmented_attempt', revision: review.revision, runId: detail.run.id, runRevision: detail.run.revision, scope }, scope.kind === 'segment' ? `Run recorded source range ${scope.segmentId}` : 'Synthesize recorded evidence');
  }
  const active = !!detail?.run.activeAttemptId; const cancelled = detail?.run.status === 'cancelled';
  const reviewChanged = !!detail && review.revision !== detail.run.baseReviewRevision;
  return <section className="assistance-panel segmented-panel" aria-labelledby={`segmented-title-${review.id}`}>
    <h3 id={`segmented-title-${review.id}`}>Segmented policy suggestions</h3>
    <p>The Lantern segmented review lab uses authored synthetic recordings. Each run and attempt is explicit. Recorded interpretations remain private proposals until you review and save evidence.</p>
    {summary && <p>{summary.eligibilityMessage}</p>}
    <div className="actions">
      {editable && <button type="button" disabled={blocked || !summary?.eligible || summary.runs.items.some(run => run.status === 'open' || !!run.activeAttemptId) || summary.runs.items.length >= SEGMENTED_LIMITS.runs} onClick={() => void command({ action: 'start_segmented_run', revision: review.revision }, 'Start synthetic segmented run')}>Start synthetic segmented run</button>}
      <button type="button" className="secondary" onClick={() => setRefresh(n => n + 1)}>Refresh runs</button>
    </div>
    {blocked && <p className="notice">Keep working in the current draft or resolve the pending command before starting a run, retrying or creating another draft. Retained proposals remain inspectable.</p>}
    {summary && !summary.runs.items.length && <p>No saved segmented runs. Capture the Lantern segmented review lab from New policy review to try the exact synthetic source.</p>}
    {!!summary?.runs.items.length && <label>Saved segmented run<select value={runId} onChange={e => setRunId(e.target.value)}>{summary.runs.items.map((run, index) => <option key={run.id} value={run.id}>Run {index + 1} · {new Date(run.createdAt).toLocaleString()} · {run.status}</option>)}</select></label>}
    {detail && <>
      <dl className="segmented-status"><div><dt>Run</dt><dd>{detail.run.status}</dd></div><div><dt>Attempt progress</dt><dd>{active ? 'An attempt is active; inspect its status below' : 'No attempt active'} · {detail.run.attemptCount} saved attempts</dd></div><div><dt>Current proposal</dt><dd> {detail.run.currentOutcomeId ? 'Synthesis retained' : 'No current synthesis'}</dd></div></dl>
      <details><summary>Inspect run identity and source</summary><small>Run: {detail.run.id}<br/>Run revision: {detail.run.revision}<br/>Evidence generation: {detail.run.evidenceGeneration}<br/>Source bundle: {detail.spec.bundleId}<br/>Definition: {detail.spec.definitionId}<br/>Plan: {detail.spec.planId}</small></details>
      <p>Progress does not acknowledge human review ranges or change a saved finding. A retry immediately removes the earlier proposal’s eligibility for a new handoff; its original evidence stays inspectable.</p>
      {reviewChanged && <p className="notice">The review changed after this run started. Retained proposals remain available for review. New attempts require a new run; cancel this run first if it is still open. Retained-run limits still apply.</p>}
      {editable && !cancelled && <button type="button" className="secondary" disabled={blocked} onClick={() => void command({ action: 'cancel_segmented_run', revision: review.revision, runId, runRevision: detail.run.revision }, 'Cancel segmented run')}>Cancel segmented run</button>}
      <details open><summary>Source range attempts</summary><ol>{detail.segments.map(segment => {
        const document = review.sourceBundle?.documents.find(d => d.id === segment.documentId);
        return <li key={segment.id}><p><strong>{segment.id}</strong> · {document?.label || segment.documentId} · characters {segment.start - (document?.start || 0) + 1}–{segment.end - (document?.start || 0)} · {segment.state} · {segment.attempts}/{SEGMENTED_LIMITS.perScope} attempts</p>
          {editable && <button type="button" className="secondary" disabled={blocked || active || cancelled || reviewChanged || segment.attempts >= SEGMENTED_LIMITS.perScope || detail.run.attemptCount >= SEGMENTED_LIMITS.attempts} onClick={() => runAttempt({ kind: 'segment', segmentId: segment.id })}>{segment.attempts ? `Explicitly retry ${segment.id}` : `Run recorded range ${segment.id}`}</button>}
        </li>;
      })}</ol></details>
      {editable && <button type="button" disabled={blocked || active || cancelled || reviewChanged || detail.synthesisAttempts >= SEGMENTED_LIMITS.perScope || detail.run.attemptCount >= SEGMENTED_LIMITS.attempts} onClick={() => runAttempt({ kind: 'synthesis' })}>{detail.synthesisAttempts ? 'Explicitly synthesize again' : 'Synthesize retained evidence'}</button>}
      <h4>Source readiness, proposals and human review</h4>
      {detail.measures.map(measure => {
        const finding = review.analysis?.findings.find(f => f.id === measure.id);
        return <section className="segmented-target" key={measure.id}><h5>{measure.label}</h5><p>Required source: {measure.ready ? 'ready' : 'incomplete'} · Proposal: {measure.eligible ? 'available for handoff' : 'inspection only or not prepared'} · Human finding: {finding?.reviewedBy ? finding.finding.replaceAll('_', ' ') : 'not saved'}</p>{measure.reason && <p>{segmentedReasonText(measure.reason)}</p>}
          {measure.proposalOutcomeId && <button type="button" className="secondary" onClick={() => { setMeasureId(measure.id); setOutcomeId(measure.proposalOutcomeId!); }}>Inspect {measure.label} proposal</button>}
        </section>;
      })}
      {measureId && outcomeId && <label>Measure in selected synthesis<select value={measureId} onChange={e => setMeasureId(e.target.value)}>{detail.measures.map(measure => <option key={measure.id} value={measure.id}>{measure.label}</option>)}</select></label>}
      {measureId && outcomeId && <SegmentedProposalBrowser key={`${runId}:${outcomeId}:${measureId}`} review={review} user={user} address={{ runId, outcomeId, measureId }} disabled={blocked} canPrepare={editable} onPrepare={editable ? (proposal, revision) => {
        const current = latest.current;
        if (!current.editable || current.disabled || current.review.id !== review.id) throw new Error('The review or edit access changed. No draft was replaced.');
        installSegmentedDraft(store, current.review, proposal, revision);
      } : undefined}/>}
      <details><summary>Immutable attempts and original returns — page {cursors.length + 1}</summary>
        {detail.attempts.items.map(attempt => <AttemptInspector key={attempt.id} attempt={attempt} base={`${base}/${runId}`} user={user} onInspect={attempt.scope.kind === 'synthesis' && attempt.outcomeId ? () => { setOutcomeId(attempt.outcomeId!); setMeasureId(detail.measures[0]?.id || ''); } : undefined}/>)}
        <div className="actions"><button type="button" className="secondary" disabled={!cursors.length} onClick={() => setCursors(p => p.slice(0, -1))}>Previous attempt page</button><button type="button" className="secondary" disabled={!detail.attempts.nextCursor} onClick={() => setCursors(p => [...p, detail.attempts.nextCursor!])}>Next attempt page</button></div>
      </details>
    </>}
    {error && <p className="notice" role="alert">{error}</p>}
  </section>;
}

function AttemptInspector({ attempt, base, user, onInspect }: { attempt: SegmentedAttemptView; base: string; user: User; onInspect?: () => void }) {
  const [request, setRequest] = useState<SegmentedRequestView | null>(null); const [output, setOutput] = useState<SegmentedOutputView | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const epoch = useRef(0); useEffect(() => () => { epoch.current++; }, [base, attempt.id, user]);
  async function inspect() {
    const current = epoch.current; setLoading(true); setError('');
    try {
      const [nextRequest, nextOutput] = await Promise.all([api<SegmentedRequestView>(`${base}/requests/${attempt.requestId}`, user), attempt.outputId ? api<SegmentedOutputView>(`${base}/outputs/${attempt.outputId}`, user) : Promise.resolve(null)]);
      if (current !== epoch.current) return; setRequest(nextRequest); setOutput(nextOutput);
    } catch (e) { if (current === epoch.current) { setRequest(null); setOutput(null); setError(e instanceof Error ? e.message : 'Attempt evidence could not be read.'); } }
    finally { if (current === epoch.current) setLoading(false); }
  }
  return <section className="segmented-target"><h5>{attempt.scope.kind === 'segment' ? attempt.scope.segmentId : 'Synthesis'} — attempt {attempt.ordinal}</h5><p>Local status: {attempt.status} · Eligibility at completion: {attempt.eligibleAtCompletion ? 'accepted' : 'not granted'} · Settlement: {attempt.settled ? 'settled' : 'unsettled'} · Recorded cost: {attempt.knownCostMicros}</p><p>{attempt.message}</p>{attempt.ineligibleReason && <p>{segmentedReasonText(attempt.ineligibleReason)}</p>}
    {attempt.status === 'unknown' && <p className="notice">Unknown is not failed. Inspect or reconcile the existing attempt; the browser never retries it automatically.</p>}
    <button type="button" className="secondary" disabled={loading} onClick={() => void inspect()}>Inspect frozen request and original return</button>{onInspect && <button type="button" className="secondary" onClick={onInspect}>Inspect this historical synthesis</button>}
    {request && <details><summary>Frozen request</summary><pre>{JSON.stringify(request.request, null, 2)}</pre><small>Request: {request.id}<br/>Dispatch: {request.dispatchKey}</small></details>}
    {output && <details><summary>Original return — {output.byteLength} bytes · {output.statuses.join(', ')}</summary>{output.text !== null ? <pre>{output.text}</pre> : <p>{output.decodeError || 'The original bytes are available below.'}</p>}<button type="button" className="secondary" onClick={() => { const bytes = Uint8Array.from(atob(output.base64), c => c.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' })); const link = document.createElement('a'); link.href = url; link.download = `segmented-output-${output.id}.bin`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }}>Save exact original bytes</button><details><summary>Inspect original bytes as base64</summary><pre>{output.base64}</pre></details><small>Output: {output.id}. A retained return is not an accepted interpretation.</small></details>}
    {error && <p role="alert" className="notice">{error}</p>}
  </section>;
}
