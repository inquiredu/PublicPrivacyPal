import { measuresFor } from '../shared/evaluation';
import { useState, type FormEvent } from 'react';
import { citationsFor, isPastedReview, type Citation, type Review, type EvidenceEdit } from '../shared/review';
import { evidenceDraftSchema } from '../shared/drafts';
import { uniqueCitation } from '../shared/evidence-selection';
import { useDraftStore, type ReviewCommands } from './ReviewDrafts';

export function EvidenceEditor({ review: r, disabled, commands }: { review: Review; disabled: boolean; commands: ReviewCommands }) {
  const criteria = measuresFor(r);
  const store = useDraftStore(); const key = `evidence:${r.id}`;
  const draft = store.get(key, evidenceDraftSchema);
  const [chosen, setChosen] = useState<string>(criteria[0].id);
  const criterionId = draft?.criterionId || chosen;
  const f = r.analysis?.findings.find(f => f.id === criterionId);
  const values = draft || { revision: r.revision, criterionId, finding: f && (!isPastedReview(r) || f.reviewedBy) ? f.finding : '' as const, citations: citationsFor(f), rationale: f?.rationale || '', quoteText: '' };
  const { finding, citations, rationale, quoteText } = values;
  const [selection, setSelection] = useState<Citation | null>(null);
  const [error, setError] = useState('');
  const dirty = !!draft; const stale = values.revision !== r.revision;
  const busy = commands.blocked;
  function change(patch: Partial<typeof values>) { store.set(key, { ...values, ...patch }); setError(''); }
  function add(citation: Citation) {
    if (!citation.quote.trim() || citation.quote.length > 2000) throw new Error('Select a passage between 1 and 2,000 characters.');
    if (citations.length >= 3) throw new Error('Use up to three passages per criterion.');
    if (citations.some(c => c.start === citation.start && c.end === citation.end)) throw new Error('That passage is already included.');
    change({ citations: [...citations, citation], quoteText: '' });
  }
  function attempt(addition: () => void) { try { addition(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not add quotation.'); } }
  async function save(e: FormEvent) {
    e.preventDefault(); setError('');
    if (stale) { setError('The review changed. Your draft is kept; copy any text you need before discarding it and reviewing the current evidence.'); return; }
    if (quoteText.trim()) { setError('Add the typed quotation or clear that field before saving.'); return; }
    await commands.start(`/api/reviews/${r.id}`, { action: 'edit_evidence', revision: values.revision, evidence: { criterionId, finding, citations, rationale } }, 'Save evidence', [key]);
  }
  const criterion = criteria.find(c => c.id === criterionId) || criteria[0];
  return <section className="evidence-editor" aria-labelledby="evidence-editor-title">
    <h3 id="evidence-editor-title">Review and edit evidence</h3>
    <p>Save one criterion at a time. Include passages that limit or contradict a commitment, and explain your interpretation. Saving evidence requires a new decision before publication.</p>
    {disabled && <p className="notice">Finish the pending save or record/discard decision changes before editing evidence.</p>}
    {stale && dirty && <div className="notice" role="alert">This review changed while you were editing. Your unsaved text is still here. Copy any text you need, then discard this draft to load the current evidence.</div>}
    <form onSubmit={e => void save(e)}>
      <fieldset disabled={disabled || busy}>
        <label>Criterion<select value={criterionId} disabled={dirty} onChange={e => { setChosen(e.target.value); setSelection(null); }}>{criteria.map(c => <option key={c.id} value={c.id}>{c.label}{isPastedReview(r) && !r.analysis?.findings.find(f => f.id === c.id)?.reviewedBy ? ' — needs review' : ''}</option>)}</select></label>
        <p className="subtle">For full credit: {criterion.evidence}</p>
        <label>Finding<select required value={finding} onChange={e => { const f = e.target.value as typeof finding; change({ finding: f, ...(f === 'not_specified' ? { citations: [], quoteText: '' } : {}) }); }}><option value="" disabled>Choose after reviewing the policy</option><option value="yes">Meets</option><option value="partial">Partial</option><option value="no">Does not meet / contradicts</option><option value="not_specified">Not addressed</option></select></label>
        <label>Saved policy text — select a passage to cite<textarea className="policy-source selection-source" readOnly rows={10} value={r.sourceText} onSelect={e => { const area = e.currentTarget; const start = area.selectionStart, end = area.selectionEnd; setSelection(end > start ? { start, end, quote: r.sourceText.slice(start, end) } : null); }}/></label>
        <button type="button" className="secondary" disabled={!selection || finding === 'not_specified' || citations.length >= 3} onClick={() => attempt(() => add(selection!))}>Add selected passage</button>
        <label>Or paste an exact quotation<textarea rows={2} maxLength={2000} value={quoteText} disabled={finding === 'not_specified'} onChange={e => change({ quoteText: e.target.value })}/></label>
        <button type="button" className="secondary" disabled={!quoteText.trim() || finding === 'not_specified' || citations.length >= 3} onClick={() => attempt(() => add(uniqueCitation(r.sourceText, quoteText)))}>Add quotation</button>
        {finding === 'not_specified' && <p className="subtle">No citation is attached to “not addressed.” Explain what you checked in the rationale.</p>}
        <ol className="citation-list">{citations.map((c, i) => <li key={`${c.start}:${c.end}`}><blockquote>{c.quote}</blockquote><button type="button" className="secondary" aria-label={`Remove passage ${i + 1}`} onClick={() => change({ citations: citations.filter((_, index) => index !== i) })}>Remove passage {i + 1}</button></li>)}</ol>
        <label>Evidence rationale<textarea required maxLength={1000} rows={3} value={rationale} onChange={e => change({ rationale: e.target.value })}/><small>Explain the finding, any exceptions, or why no relevant statement was found. This remains private.</small></label>
        <div className="actions"><button disabled={!dirty || stale}>Save criterion and recalculate</button>{dirty && <button type="button" className="secondary" onClick={() => { store.remove(key); setError(''); setSelection(null); }}>{stale ? 'Discard draft and load current evidence' : 'Discard evidence changes'}</button>}</div>
      </fieldset>
    </form>
    {error && <div className="notice" role="alert">{error}</div>}{dirty && <p className="subtle">Draft kept in this tab; not saved to the workspace.</p>}
  </section>;
}
