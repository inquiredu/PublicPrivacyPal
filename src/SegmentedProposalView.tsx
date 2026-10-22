import { useEffect, useRef, useState } from 'react';
import type { User } from 'firebase/auth';
import { measuresFor } from '../shared/evaluation';
import type { Review } from '../shared/review';
import type { SegmentedCandidate, SegmentedProposalRef, SegmentedProposalView as ProposalView } from '../shared/segmented-assistance';
import { api } from './api';
import { sameSegmentedReference, segmentedProposalPath, segmentedReasonText } from './segmented-review';

type Address = Pick<SegmentedProposalRef, 'runId' | 'outcomeId' | 'measureId'>;
export function SegmentedProposalView({ value, review, onAttach, disabled = false }: { value: ProposalView; review: Review; onAttach?: (candidate: SegmentedCandidate) => void; disabled?: boolean }) {
  const measure = measuresFor(review).find(c => c.id === value.reference.measureId);
  return <div className="segmented-proposal">
    <h4>{measure?.label || value.reference.measureId} — retained proposal</h4>
    <p>{value.current ? 'Current evidence generation' : 'Historical evidence generation'} · {value.eligible ? 'Available for a new human review draft' : 'Inspection available'}</p>
    {value.reason && <p className="notice">{segmentedReasonText(value.reason)}</p>}
    <dl className="rubric-definitions"><dt>Declared product</dt><dd>{value.scope.product}</dd><dt>Accounts</dt><dd>{value.scope.accounts}</dd><dt>Jurisdiction</dt><dd>{value.scope.jurisdiction}</dd></dl>
    <p>The original synthesis did not independently verify this declared scope. Exact quotations establish where text occurs; their meaning still requires review.</p>
    <section className="notice" aria-label="Required human handoff question"><h5>Required human handoff question</h5><p>{value.requiredQuestion}</p><p>This question is added by the review workflow. Original generated questions remain separately visible below.</p></section>
    {value.targets.map(target => {
      const clauseId = target.target.split('/')[1];
      const clause = measure && 'requirements' in measure ? measure.requirements?.find(r => r.id === clauseId) : undefined;
      return <section className="segmented-target" key={target.target}>
        <h5>{clause?.id.replaceAll('_', ' ') || measure?.label || target.target}</h5>
        {clause ? <dl className="rubric-definitions"><dt>Established</dt><dd>{clause.proposition}</dd><dt>Limited</dt><dd>{clause.limited}</dd><dt>Opposed</dt><dd>{clause.opposed}</dd></dl>
          : measure && <dl className="rubric-definitions"><dt>Meets</dt><dd>{measure.evidence}</dd><dt>Partial</dt><dd>{measure.partial}</dd><dt>Does not meet</dt><dd>{measure.failure}</dd></dl>}
        <div className="segmented-original"><p><strong>Original synthesis state:</strong> {target.original.state.replaceAll('_', ' ')}</p><p>{target.original.rationale}</p><p><strong>Original generated question:</strong> {target.original.question || 'None recorded'}</p></div>
        <p><strong>Derived availability:</strong> {target.derived.state.replaceAll('_', ' ')} · Source {target.derived.ready ? 'ready' : 'incomplete'}</p>
        {target.derived.question && <p><strong>Derived readiness question:</strong> {target.derived.question}</p>}
        {!!target.derived.missing.length && <p>Unavailable dependencies: {target.derived.missing.map(id => review.sourceBundle?.documents.find(d => d.id === id)?.label || id).join('; ')}</p>}
        <p>{target.candidateCount} retained candidates · Machine ranges: {target.original.segmentIds.join(', ') || 'None'}. Machine ranges are not human review acknowledgments.</p>
      </section>;
    })}
    <h5>Retained candidates — current page</h5>
    <p>Supporting, limiting and opposing statements stay available across all pages. Attaching a passage does not accept the proposed finding, resolve its questions or mark a range reviewed.</p>
    {!value.candidates.items.length && <p>No candidates on this page. This alone does not establish policy silence.</p>}
    <ol className="segmented-candidates">{value.candidates.items.map(candidate => {
      const document = review.sourceBundle?.documents.find(d => d.id === candidate.documentId);
      return <li key={candidate.id}>
        <p><strong>{candidate.role}</strong> · {candidate.target} · {document?.label || candidate.documentId}</p>
        <blockquote>{candidate.quote}</blockquote>
        <p>Document characters {candidate.start - (document?.start || 0) + 1}–{candidate.end - (document?.start || 0)} · Observed in ranges {candidate.segmentIds.join(', ')}</p>
        {candidate.rationales.map((rationale, index) => <p key={index}>{rationale}</p>)}
        <details><summary>Read saved source context and candidate identity</summary><pre>{review.sourceText.slice(Math.max(document?.start || 0, candidate.start - 300), Math.min(document?.end ?? review.sourceText.length, candidate.end + 300))}</pre><small>Candidate: {candidate.id}<br/>Document hash: {candidate.textHash}</small></details>
        {onAttach && <button type="button" className="secondary" disabled={disabled} onClick={() => onAttach(candidate)}>Attach this {candidate.role} passage to {candidate.target.includes('/') ? 'clause' : 'measure'}</button>}
      </li>;
    })}</ol>
    <details><summary>Immutable proposal identity</summary><small>Run: {value.reference.runId}<br/>Synthesis attempt: {value.reference.synthesisAttemptId}<br/>Outcome: {value.reference.outcomeId}<br/>Evidence revision: {value.reference.evidenceRevision}<br/>Source bundle: {value.provenance.bundleId}<br/>Definition: {value.provenance.definitionId}<br/>Plan: {value.provenance.planId}</small></details>
  </div>;
}

export function SegmentedProposalBrowser({ review, user, address, expectedReference, disabled = false, canPrepare = false, onPrepare, onAttach }: {
  review: Review; user: User; address: Address; expectedReference?: SegmentedProposalRef; disabled?: boolean; canPrepare?: boolean;
  onPrepare?: (proposal: ProposalView, requestedRevision: number) => void;
  onAttach?: (candidate: SegmentedCandidate, reference: SegmentedProposalRef) => void;
}) {
  const [value, setValue] = useState<ProposalView | null>(null); const [error, setError] = useState('');
  const [cursors, setCursors] = useState<string[]>([]); const [refresh, setRefresh] = useState(0); const [loading, setLoading] = useState(false); const [preparing, setPreparing] = useState(false);
  const identity = `${review.id}:${address.runId}:${address.outcomeId}:${address.measureId}`;
  const epoch = useRef(0); const priorIdentity = useRef(identity);
  // A changed address must not issue a cursor from a different candidate collection.
  const cursor = priorIdentity.current === identity ? cursors.at(-1) : undefined;
  useEffect(() => { priorIdentity.current = identity; setCursors([]); }, [identity]);
  useEffect(() => {
    const request = ++epoch.current; setLoading(true); setError(''); setValue(null);
    void api<ProposalView>(segmentedProposalPath(review.id, address, cursor), user).then(next => {
      if (request !== epoch.current) return;
      if (expectedReference && !sameSegmentedReference(expectedReference, next.reference)) throw new Error('The returned proposal does not match this saved reference.');
      setValue(next);
    }).catch(e => { if (request === epoch.current) setError(e instanceof Error ? e.message : 'The retained proposal could not be loaded.'); }).finally(() => { if (request === epoch.current) setLoading(false); });
    return () => { epoch.current++; };
  }, [identity, cursor, user, refresh, review.revision]);
  async function prepare() {
    const requestedRevision = review.revision; const request = epoch.current; setPreparing(true); setError('');
    try {
      const fresh = await api<ProposalView>(segmentedProposalPath(review.id, address), user);
      if (request !== epoch.current) return;
      if (expectedReference && !sameSegmentedReference(expectedReference, fresh.reference)) throw new Error('The proposal reference changed; your existing work was kept.');
      onPrepare?.(fresh, requestedRevision);
      requestAnimationFrame(() => document.getElementById('evidence-editor-title')?.focus());
    } catch (e) { if (request === epoch.current) setError(e instanceof Error ? e.message : 'The draft could not be prepared.'); }
    finally { setPreparing(false); }
  }
  return <section className="segmented-proposal" aria-label="Segmented proposal inspection">
    {loading && <p role="status">Loading retained proposal…</p>}
    {value && <>
      <SegmentedProposalView value={value} review={review} disabled={disabled} onAttach={onAttach ? candidate => { try { onAttach(candidate, value.reference); setError(''); } catch (e) { setError(e instanceof Error ? e.message : 'The candidate could not be attached.'); } } : undefined}/>
      <div className="actions"><button type="button" className="secondary" disabled={loading || !cursors.length} onClick={() => setCursors(p => p.slice(0, -1))}>Previous candidate page</button><button type="button" className="secondary" disabled={loading || !value.candidates.nextCursor} onClick={() => setCursors(p => [...p, value.candidates.nextCursor!])}>Next candidate page</button></div>
      <p className="subtle">Candidate page {cursors.length + 1}. Earlier valid evidence is retained even when a later attempt omits it.</p>
      {onPrepare && <button type="button" disabled={disabled || !canPrepare || !value.current || !value.eligible || !value.seed || preparing} onClick={() => void prepare()}>Create unresolved review draft</button>}
    </>}
    <button type="button" className="secondary" disabled={loading || preparing} onClick={() => setRefresh(n => n + 1)}>Refresh retained proposal</button>
    {error && <p className="notice" role="alert">{error}</p>}
  </section>;
}
