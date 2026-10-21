import type { User } from 'firebase/auth';
import { SegmentedProposalBrowser } from './SegmentedProposalView';
import { attachSegmentedCandidate, segmentedEvidenceSizeError } from './segmented-review';
import { LONG_BUNDLE_VERSION, sourceSegments } from '../shared/source-segments';
import { measuresFor } from '../shared/evaluation';
import { useState, type FormEvent } from 'react';
import { citationsFor, isPastedReview, type Citation, type Review, type ReviewContext } from '../shared/review';
import { evidenceDraftSchema } from '../shared/drafts';
import { uniqueCitation } from '../shared/evidence-selection';
import { useDraftStore, type ReviewCommands } from './ReviewDrafts';
import { RequirementEditor } from './RequirementReview';
import { blankRequirementReview, deriveRequirementReview, requirementFinding, requirementCitations } from '../shared/requirements';
import { measureCoverage, coverageReady, documentForRange } from '../shared/source-bundle';

export function EvidenceEditor({ review: r, disabled, commands, user }: { review: Review; disabled: boolean; commands: ReviewCommands; user?: User }) {
  const criteria = measuresFor(r);
  const store = useDraftStore(); const key = `evidence:${r.id}`;
  const draft = store.get(key, evidenceDraftSchema);
  const [chosen, setChosen] = useState<string>(criteria[0].id);
  const criterionId = draft?.criterionId || chosen;
  const criterion = criteria.find(c => c.id === criterionId) || criteria[0];
  const definitions = 'requirements' in criterion ? criterion.requirements : undefined;
  const f = r.analysis?.findings.find(f => f.id === criterionId);
  const savedContext = f?.context && { scope: f.context.scope, uncertainty: f.context.uncertainty, question: f.context.question, resolution: f.context.resolution, note: f.context.note, citations: f.context.citations };
  const values = draft || { revision: r.revision, criterionId, finding: f && (!isPastedReview(r) || f.reviewedBy) ? f.finding : '' as const, citations: f?.requirements ? requirementCitations(f.requirements) : citationsFor(f), rationale: f?.rationale || '', quoteText: '', ...(f?.sourceReview ? { sourceReview: f.sourceReview } : {}), ...(savedContext ? { context: savedContext } : {}), ...(f?.provenance ? { proposalId: f.provenance.jobId } : {}), ...(f?.segmentedProvenance ? { segmentedProposal: f.segmentedProvenance.reference } : {}), ...(definitions ? { requirements: f?.requirements || blankRequirementReview(definitions) } : {}) };
  const { citations, rationale, quoteText, context, proposalId, segmentedProposal, requirements, sourceReview } = values;
  const coverage = r.sourceBundle && r.contract ? measureCoverage(r.sourceBundle, r.contract, criterionId) : undefined;
  const segments = r.sourceBundle?.version === LONG_BUNDLE_VERSION ? sourceSegments(r.sourceBundle).filter(s => coverage?.targets.some(t => t.documents.includes(s.documentId))) : [];
  const sourceMissing = !!coverage && !coverageReady(coverage);
  const segmentsIncomplete = segments.length > 0 && segments.some(s => !sourceReview?.segmentIds.includes(s.id));
  const finding = sourceMissing || (segmentsIncomplete && !!definitions) ? 'unresolved' : definitions && requirements ? requirementFinding(deriveRequirementReview(definitions, requirements).state) : values.finding;
  const [documentId, setDocumentId] = useState(r.sourceBundle?.documents.find(d => d.text)?.id || '');
  const document = r.sourceBundle?.documents.find(d => d.id === documentId);
  const shownText = document?.text ?? r.sourceText;
  const citationLimit = definitions ? definitions.length * 3 : 3;
  const contextLocked = !!proposalId || !!segmentedProposal || !!f?.context;
  function changeContext(patch: Partial<ReviewContext>) { if (context) change({ context: { ...context, ...patch } }); }
  const [selection, setSelection] = useState<Citation | null>(null);
  const [error, setError] = useState('');
  const dirty = !!draft; const stale = values.revision !== r.revision;
  const busy = commands.blocked;
  function change(patch: Partial<typeof values>) { store.set(key, { ...values, ...patch }); setError(''); }
  function add(citation: Citation) {
    if (r.sourceBundle && !documentForRange(r.sourceBundle, citation.start, citation.end)) throw new Error('Select a quotation within one captured document.');
    if (!citation.quote.trim() || citation.quote.length > 2000) throw new Error('Select a passage between 1 and 2,000 characters.');
    if (citations.length >= citationLimit) throw new Error(`Use up to ${citationLimit} passages for this measure.`);
    if (citations.some(c => c.start === citation.start && c.end === citation.end)) throw new Error('That passage is already included.');
    change({ citations: [...citations, citation], quoteText: '' });
  }
  function attempt(addition: () => void) { try { addition(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not add quotation.'); } }
  async function save(e: FormEvent) {
    e.preventDefault(); setError('');
    if (stale) { setError('The review changed. Your draft is kept; copy any text you need before discarding it and reviewing the current evidence.'); return; }
    if (quoteText.trim()) { setError('Add the typed quotation or clear that field before saving.'); return; }
    setChosen(criterionId);
    const savedCitations = requirements ? requirementCitations(requirements).slice(0, 3) : citations;
    const evidence = { criterionId, finding, citations: savedCitations, rationale, ...(sourceReview ? { sourceReview } : {}), ...(requirements ? { requirements: segmentsIncomplete ? { ...requirements, sourceStatus: 'incomplete' } : requirements } : {}), ...(context ? { context } : {}), ...(proposalId ? { proposalId } : {}), ...(segmentedProposal ? { segmentedProposal } : {}) };
    const sizeError = segmentedProposal && segmentedEvidenceSizeError(evidence);
    if (sizeError) { setError(sizeError); return; }
    await commands.start(`/api/reviews/${r.id}`, { action: 'edit_evidence', revision: values.revision, evidence }, 'Save evidence', [key]);
  }
  return <section className="evidence-editor" aria-labelledby="evidence-editor-title">
    <h3 id="evidence-editor-title" tabIndex={-1}>Review and edit evidence</h3>
    <p>Save one criterion at a time. Include passages that limit or contradict a commitment, and explain your interpretation. Saving evidence requires a new decision before publication.</p>
    {disabled && <p className="notice">Finish the pending save or record/discard decision changes before editing evidence.</p>}
    {stale && dirty && <div className="notice" role="alert">This review changed while you were editing. Your unsaved text is still here. Copy any text you need, then discard this draft to load the current evidence.</div>}
    <form onSubmit={e => void save(e)}>
      <fieldset disabled={disabled || busy}>
        <label>Criterion<select value={criterionId} disabled={dirty} onChange={e => { setChosen(e.target.value); setSelection(null); }}>{criteria.map(c => <option key={c.id} value={c.id}>{c.label}{isPastedReview(r) && !r.analysis?.findings.find(f => f.id === c.id)?.reviewedBy ? ' — needs review' : ''}</option>)}</select></label>
        <dl className="rubric-definitions"><dt>Meets</dt><dd>{criterion.evidence}</dd><dt>Partial</dt><dd>{criterion.partial}</dd><dt>Does not meet</dt><dd>{criterion.failure}</dd></dl>
        {sourceMissing && <p className="notice">Required source coverage is incomplete: {[...new Set(coverage!.targets.flatMap(t => t.missing))].map(id => r.sourceBundle!.documents.find(d => d.id === id)!.label).join('; ')}. Preserve useful evidence below; this measure remains unresolved until a new complete source capture.</p>}
        <label>Finding{definitions && <small>Calculated from the subrequirements below.</small>}<select required disabled={!!definitions || sourceMissing} value={finding} onChange={e => { const f = e.target.value as typeof finding; change({ finding: f, ...(f === 'not_specified' ? { citations: [], quoteText: '' } : {}) }); }}><option value="" disabled>Choose after reviewing the policy</option><option value="yes">Meets</option><option value="partial">Partial</option><option value="no">Does not meet / contradicts</option><option value="not_specified">Not addressed — confirmed after review</option><option value="unresolved">Unresolved / defer for follow-up</option></select></label>
        {definitions && requirements && <><p className="subtle">All selected clause passages are retained. The saved measure overview includes up to three preview passages; the full evidence stays with each clause.</p><p>{'decisionRule' in criterion && criterion.decisionRule}</p><RequirementEditor missingRequirements={coverage?.targets.filter(t => !t.ready).map(t => t.target.split('/')[1])} definitions={definitions} value={requirements} passages={citations} onChange={value => change({ requirements: value })}/></>}
        {r.sourceBundle && <label>Captured document<select value={documentId} onChange={e => { setDocumentId(e.target.value); setSelection(null); }}>{r.sourceBundle.documents.filter(d => d.text).map(d => <option key={d.id} value={d.id}>{d.label} · {d.capture}</option>)}</select></label>}
        <label>Saved policy text — select a passage to cite<textarea className="policy-source selection-source" readOnly rows={10} value={shownText} onSelect={e => { const area = e.currentTarget; const offset = document?.start || 0; const start = offset + area.selectionStart, end = offset + area.selectionEnd; setSelection(end > start ? { start, end, quote: r.sourceText.slice(start, end) } : null); }}/></label>
        <button type="button" className="secondary" disabled={!selection || (!definitions && finding === 'not_specified') || citations.length >= citationLimit} onClick={() => attempt(() => add(selection!))}>Add selected passage</button>
        <label>Or paste an exact quotation<textarea rows={2} maxLength={2000} value={quoteText} disabled={!definitions && finding === 'not_specified'} onChange={e => change({ quoteText: e.target.value })}/></label>
        <button type="button" className="secondary" disabled={!quoteText.trim() || (!definitions && finding === 'not_specified') || citations.length >= citationLimit} onClick={() => attempt(() => { const q = uniqueCitation(shownText, quoteText); const offset = document?.start || 0; add({ ...q, start: q.start + offset, end: q.end + offset }); })}>Add quotation</button>
        {finding === 'not_specified' && <p className="subtle">No citation is attached to “not addressed.” Explain what you checked in the rationale.</p>}
        <ol className="citation-list">{citations.map((c, i) => <li key={`${c.start}:${c.end}`}><blockquote>{c.quote}</blockquote><button type="button" className="secondary" aria-label={`Remove passage ${i + 1}`} onClick={() => change({ citations: citations.filter((_, index) => index !== i), ...(requirements ? { requirements: { ...requirements, requirements: requirements.requirements.map(r => ({ ...r, citations: r.citations.filter(q => q.start !== c.start || q.end !== c.end) })) } } : {}) })}>Remove passage {i + 1}</button></li>)}</ol>
        {!!segments.length && <fieldset><legend>Required source ranges reviewed</legend><p>Read the required documents together, including late exceptions and contradictory statements. These are your review acknowledgments; they do not establish that every vendor document was discovered.</p>
          {segments.map(s => <label key={s.id}><input type="checkbox" checked={!!sourceReview?.segmentIds.includes(s.id)} onChange={e => change({ sourceReview: { version: 'human-source-review-v1', bundleId: r.sourceBundle!.id, segmentIds: e.target.checked ? [...(sourceReview?.segmentIds || []), s.id] : (sourceReview?.segmentIds || []).filter(id => id !== s.id) } })}/>{r.sourceBundle!.documents.find(d => d.id === s.documentId)!.label}: characters {s.start - r.sourceBundle!.documents.find(d => d.id === s.documentId)!.start + 1}–{s.end - r.sourceBundle!.documents.find(d => d.id === s.documentId)!.start}</label>)}
          <small>Unfinished coverage can be saved as unresolved. Every required range must be acknowledged before a resolved finding or confirmed silence.</small>
        </fieldset>}
        <label>Evidence rationale<textarea required maxLength={1000} rows={3} value={rationale} onChange={e => change({ rationale: e.target.value })}/><small>Explain the finding, any exceptions, or why no relevant statement was found. This remains private.</small></label>
        {!context && <button type="button" className="secondary" onClick={() => change({ context: { scope: requirements?.scope || '', uncertainty: 'none', question: '', resolution: 'retained', note: '', citations: [] } })}>Add scope or follow-up question</button>}
        {context && <section aria-label="Scope and follow-up"><h4>Scope and follow-up</h4>
          {contextLocked && <p>The original qualification stays with this finding. Explain corrections or answers in the resolution below.</p>}
          <label>Scope and limitations<textarea maxLength={400} rows={2} readOnly={contextLocked} value={context.scope} onChange={e => changeContext({ scope: e.target.value })}/></label>
          <label>Uncertainty<select disabled={contextLocked} value={context.uncertainty} onChange={e => changeContext({ uncertainty: e.target.value as ReviewContext['uncertainty'] })}>{['none','exception','conflict','scope','missing_statement','missing_source','ambiguous_wording'].map(v => <option value={v} key={v}>{v.replaceAll('_', ' ')}</option>)}</select></label>
          <label>Follow-up question<textarea maxLength={500} rows={2} readOnly={contextLocked} value={context.question} onChange={e => changeContext({ question: e.target.value })}/></label>
          <label>Qualification review<select value={context.resolution} onChange={e => changeContext({ resolution: e.target.value as ReviewContext['resolution'], ...(e.target.value === 'retained' ? { note: '', citations: [] } : {}) })}><option value="retained">Retain qualification / keep question open</option><option value="resolved">Record a supported resolution or correction</option></select></label>
          {context.resolution === 'resolved' && <>
            <label>Resolution and evidence checked<textarea required maxLength={1000} rows={3} value={context.note} onChange={e => changeContext({ note: e.target.value })}/></label>
            <p>Select up to three attached passages that support this resolution. For confirmed absence, explain the source coverage you checked in the note.</p>
            {citations.map(c => <label key={`resolve-${c.start}:${c.end}`}><input type="checkbox" checked={context.citations.some(q => q.start === c.start && q.end === c.end)} disabled={context.citations.length >= 3 && !context.citations.some(q => q.start === c.start && q.end === c.end)} onChange={e => changeContext({ citations: e.target.checked ? [...context.citations.filter(q => q.start !== c.start || q.end !== c.end), c] : context.citations.filter(q => q.start !== c.start || q.end !== c.end) })}/>{c.quote}</label>)}
            {context.citations.filter(c => !citations.some(q => q.start === c.start && q.end === c.end)).map(c => <div key={`saved-resolution-${c.start}:${c.end}`}><blockquote>{c.quote}</blockquote><button type="button" className="secondary" onClick={() => changeContext({ citations: context.citations.filter(q => q !== c) })}>Remove resolution passage</button></div>)}
          </>}
          {context.question && context.resolution !== 'resolved' && <p className="notice">This question stays open. Saving preserves your work; a score and district decision remain unavailable until it is resolved.</p>}
          {segmentedProposal && <p>Original segmented proposal retained. Its generated questions and evidence remain inspectable below; this handoff question is a separate required human check.</p>}
          {proposalId && <small>Suggestion job: {proposalId}. The server verifies its immutable result, source and rubric when you save.</small>}
        </section>}
        {segmentedProposal && user && <SegmentedProposalBrowser review={r} user={user} address={segmentedProposal} expectedReference={segmentedProposal} disabled={disabled || busy || stale} onAttach={(candidate, reference) => {
          if (store.has('pending-command') || disabled || busy) throw new Error('Resolve the pending command or other draft before changing this evidence.');
          const updated = attachSegmentedCandidate(store.get(key, evidenceDraftSchema) || values, reference, candidate, r);
          store.set(key, updated); setError('');
        }}/>}
        {segmentedProposal && !user && <p>The original segmented proposal remains linked. Reopen this review with your signed-in account to inspect its retained evidence.</p>}
        <div className="actions"><button disabled={!dirty || stale}>{finding === 'unresolved' || (context?.question && context.resolution !== 'resolved') ? 'Save unresolved criterion' : 'Save criterion and recalculate'}</button>{dirty && <button type="button" className="secondary" onClick={() => { store.remove(key); setError(''); setSelection(null); }}>{stale ? 'Discard draft and load current evidence' : 'Discard evidence changes'}</button>}</div>
      </fieldset>
    </form>
    {error && <div className="notice" role="alert">{error}</div>}{dirty && <p className="subtle">Draft kept in this tab; not saved to the workspace.</p>}
  </section>;
}
