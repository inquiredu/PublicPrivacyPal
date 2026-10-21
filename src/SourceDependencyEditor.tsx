import { useId, useState, type MouseEvent } from 'react';
import type { CaptureDefinitions } from '../shared/capture-definitions';
import { BUNDLE_LIMITS, type SourceBundleInput } from '../shared/source-bundle';

import { covers, dependencyFeedback, dependencyTargetId, documentName, reconcileDependencyLinks, removeDependencyLinkIdentity, sameScope, validTargets, type DependencyTarget } from './source-dependency-feedback';
export { sameScope } from './source-dependency-feedback';

type Document = SourceBundleInput['documents'][number];
export function dependencyLabel(target: string, definitions?: CaptureDefinitions) {
  if (target === '*') return 'All enabled measures and clauses';
  const [measureId, clauseId] = target.split('/');
  const measure = definitions?.measures.find(m => m.id === measureId);
  const clause = measure?.requirements.find(r => r.id === clauseId);
  return measure && (!clauseId || clause) ? `${measure.label}${clause ? ` — ${clause.proposition}` : ''}` : target;
}
/** Feedback for declarations only; the server still validates the captured manifest and coverage. */
export function dependencyErrors(value: SourceBundleInput, definitions: CaptureDefinitions | undefined): string[] {
  return dependencyFeedback(value, definitions).map(error => error.message);
}

/** Explicit selection changes never touch text, scope, applicability, dates or linked material. */
export function chooseDependency(value: SourceBundleInput, documentId: string, target: string, checked: boolean): SourceBundleInput {
  return { ...value, documents: value.documents.map(d => d.id === documentId && !(checked && !d.requiredFor.includes(target) && d.requiredFor.length >= 100) ? { ...d, requiredFor: checked ? [...d.requiredFor.filter(t => t !== target), target] : d.requiredFor.filter(t => t !== target) } : d) };
}

export function SourceDependencyEditor({ value, definitions, onChange }: { value: SourceBundleInput; definitions?: CaptureDefinitions; onChange: (value: SourceBundleInput) => void }) {
  const valid = validTargets(definitions);
  const prefix = useId();
  const [retainedLinks, setRetainedLinks] = useState(() => reconcileDependencyLinks(undefined, value.links));
  const links = reconcileDependencyLinks(retainedLinks, value.links);
  if (links !== retainedLinks) setRetainedLinks(links);
  const targetId = (target: DependencyTarget) => dependencyTargetId(prefix, target, links.keys);
  const errors = dependencyFeedback(value, definitions).map(error => ({ ...error,
    targetId: targetId(error.target), id: `${targetId(error.target)}-error-${error.code}` }));
  function feedbackProps(target: DependencyTarget) {
    const id = targetId(target); const applicable = errors.filter(error => error.targetId === id);
    return { id, 'aria-describedby': applicable.length ? applicable.map(error => error.id).join(' ') : undefined,
      'aria-invalid': applicable.length ? true : undefined };
  }
  function feedback(target: DependencyTarget) {
    return errors.filter(error => error.targetId === targetId(target)).map(error => <p key={error.id} id={error.id} className="dependency-error">{error.message}</p>);
  }
  function focusError(event: MouseEvent<HTMLAnchorElement>, id: string) {
    event.preventDefault();
    const target = event.currentTarget.ownerDocument.getElementById(id);
    if (!target) return;
    for (let ancestor = target.parentElement; ancestor; ancestor = ancestor.parentElement) {
      if (ancestor.tagName === 'DETAILS') (ancestor as HTMLDetailsElement).open = true;
    }
    target.focus();
  }
  function removeLink(index: number) {
    const next = removeDependencyLinkIdentity(links, index);
    setRetainedLinks(next);
    onChange({ ...value, links: next.source });
  }
  function edit(id: string, patch: Partial<Document>) { onChange({ ...value, documents: value.documents.map(d => d.id === id ? { ...d, ...patch } : d) }); }
  function editLink(index: number, patch: Partial<SourceBundleInput['links'][number]>) { onChange({ ...value, links: value.links.map((link, i) => i === index ? { ...link, ...patch } : link) }); }
  return <section className="source-dependencies" aria-label="Document dependencies and exclusions">
    <h3 id={`${prefix}-heading`}>Which documents does each measure need?</h3>
    <p>Every document starts as required for all enabled measures. Narrow a dependency only after reviewing its scope. Exclusions record your judgment; they do not verify that missing material is irrelevant.</p>
    {!!errors.length && <section className="notice dependency-feedback" aria-labelledby={`${prefix}-feedback-heading`}>
      <h4 id={`${prefix}-feedback-heading`}>Before saving this capture</h4>
      <ul>{errors.map(error => <li key={error.id}><a href={`#${error.targetId}`} onClick={event => focusError(event, error.targetId)}>{error.message}</a></li>)}</ul>
    </section>}
    {!definitions && <p role="status">Exact measure definitions are unavailable. Captured text and selections are retained; precise selection waits for the adopted rubric.</p>}
    {definitions && <p className="subtle">{definitions.definitionVersion}{definitions.settingsRevision !== null && ` · Settings revision ${definitions.settingsRevision}`}. Disabled measures are shown for reference and cannot be selected.</p>}
    <div role="group" tabIndex={-1} aria-labelledby={`${prefix}-heading`} {...feedbackProps({ kind: 'dependencies' })}>
    {feedback({ kind: 'dependencies' })}
    {value.documents.map((d, index) => <fieldset key={d.id} className="dependency-document" tabIndex={-1} {...feedbackProps({ kind: 'document', id: d.id, field: 'dependencies' })}><legend>{documentName(d, index)}</legend>
      {feedback({ kind: 'document', id: d.id, field: 'dependencies' })}
      {!!d.requiredFor.length && !sameScope(d.scope, value.scope) && <p>Review this document’s scope above in Capture the required documents, or explain its exclusion here.</p>}
      <p>{d.requiredFor.includes('*') ? 'Required for all enabled measures and clauses.' : d.requiredFor.length ? `Required for ${d.requiredFor.length} selected measure or clause entries.` : 'Excluded from required coverage; a reason is required.'} {!!d.requiredFor.length && (d.capture !== 'complete' || d.applicability !== 'matched' ? 'Its required measures remain unresolved until a full applicable document is captured.' : 'Full capture and applicability are human declarations; interpretation still needs review.')}</p>
      {definitions && <div className="dependency-actions">
        {d.requiredFor.includes('*') ? <button type="button" className="secondary" disabled={new Set([...d.requiredFor.filter(t => t !== '*'), ...definitions.measures.filter(m => m.enabled).map(m => m.id)]).size > 100} onClick={() => edit(d.id, { requiredFor: [...new Set([...d.requiredFor.filter(t => t !== '*'), ...definitions.measures.filter(m => m.enabled).map(m => m.id)])] })}>Choose measures or clauses</button>
          : <button type="button" className="secondary" onClick={() => edit(d.id, { requiredFor: ['*'] })}>Replace selections with all enabled measures</button>}
      </div>}
      {d.requiredFor.length >= 100 && <p className="notice">This document has reached the 100-selection limit. Remove a selection or use the whole-measure option for its clauses.</p>}
      {definitions && !d.requiredFor.includes('*') && <div className="dependency-measures">{definitions.measures.map(m => <details key={m.id}>
        <summary>{m.label}{!m.enabled ? ' — disabled' : d.requiredFor.includes(m.id) ? ' — whole measure selected' : m.requirements.some(r => d.requiredFor.includes(`${m.id}/${r.id}`)) ? ' — selected clauses' : ' — not selected'}</summary>
        <label className="dependency-option"><input type="checkbox" checked={d.requiredFor.includes(m.id)} disabled={!m.enabled || !d.requiredFor.includes(m.id) && d.requiredFor.length >= 100} onChange={e => onChange(chooseDependency(value, d.id, m.id, e.target.checked))}/>{m.requirements.length ? 'Require for every clause of this measure' : 'Require for this measure'}</label>
        {!!m.requirements.length && <p className="subtle">Selecting the whole measure covers every clause. Individual clause selections are retained when the whole measure is selected.</p>}
        {m.requirements.map(r => { const target = `${m.id}/${r.id}`; return <label key={r.id} className="dependency-option"><input type="checkbox" checked={d.requiredFor.includes(target)} disabled={!m.enabled || !d.requiredFor.includes(target) && d.requiredFor.length >= 100} onChange={e => onChange(chooseDependency(value, d.id, target, e.target.checked))}/><span>{r.proposition}{d.requiredFor.includes(m.id) && <small>Also covered by the whole-measure selection.</small>}</span></label>; })}
      </details>)}</div>}
      {definitions && d.requiredFor.some(t => !valid.has(t)) && <div className="notice"><strong>Retained selections need review</strong><ul>{d.requiredFor.filter(t => !valid.has(t)).map((target, i) => <li key={`${target}-${i}`}>{dependencyLabel(target, definitions)} ({target}) <button type="button" className="secondary" onClick={() => onChange(chooseDependency(value, d.id, target, false))}>Remove retained selection</button></li>)}</ul></div>}
      <details open={!d.requiredFor.length || !!d.exclusionReason}><summary>Explain an exclusion</summary>
        <label>Reason for excluding {documentName(d, index)}<textarea {...feedbackProps({ kind: 'document', id: d.id, field: 'exclusionReason' })} rows={2} maxLength={400} value={d.exclusionReason} onChange={e => edit(d.id, { exclusionReason: e.target.value })}/></label>
        {feedback({ kind: 'document', id: d.id, field: 'exclusionReason' })}
        <p>Applying this exclusion clears this document’s selected dependencies. Its text and source details remain in the capture. Every enabled measure still needs at least one required document.</p>
        {!!d.requiredFor.length && <button type="button" className="secondary" disabled={!d.exclusionReason.trim()} onClick={() => edit(d.id, { requiredFor: [] })}>Apply explained exclusion</button>}
        {!!d.exclusionReason && <button type="button" className="secondary" onClick={() => edit(d.id, { exclusionReason: '' })}>Clear exclusion reason</button>}
      </details>
    </fieldset>)}
    </div>
    {definitions && <details><summary>Preview the effect on required source coverage</summary><p>This preview describes your declarations. The server validates the saved capture; document completeness does not establish an interpretation or score.</p><ul>{definitions.measures.filter(m => m.enabled).flatMap(m => m.requirements.length ? m.requirements.map(r => `${m.id}/${r.id}`) : [m.id]).map(target => {
      const documents = value.documents.filter(d => covers(d, target));
      const incomplete = documents.filter(d => d.capture !== 'complete' || d.applicability !== 'matched' || !sameScope(d.scope, value.scope));
      return <li key={target}><strong>{dependencyLabel(target, definitions)}</strong>: {!documents.length ? 'No required document declared.' : incomplete.length ? `Unresolved source: ${incomplete.map(d => d.label || d.id).join('; ')}.` : 'All declared required documents are full and applicable; interpretation awaits review.'}<small>Required documents: {documents.map(d => d.label || d.id).join('; ') || 'None'}.</small></li>;
    })}</ul></details>}
    <h3>Linked material mentioned by the documents</h3>
    <p>Record included material as a listed document, even when unavailable. An excluded link needs a reason. Nothing is fetched.</p>
    {value.links.map((link, index) => <fieldset key={links.keys[index]} className="dependency-link"><legend>Linked material {index + 1}</legend>
      <label>Referenced by<select {...feedbackProps({ kind: 'link', index, field: 'from' })} value={link.from} onChange={e => editLink(index, { from: e.target.value })}>{!value.documents.some(d => d.id === link.from) && <option value={link.from}>Choose a source document</option>}{value.documents.map((d, i) => <option key={d.id} value={d.id}>{documentName(d, i)}</option>)}</select></label>
      {feedback({ kind: 'link', index, field: 'from' })}
      <label>Link or reference label<input {...feedbackProps({ kind: 'link', index, field: 'label' })} maxLength={400} required value={link.label} onChange={e => editLink(index, { label: e.target.value })}/></label>
      {feedback({ kind: 'link', index, field: 'label' })}
      <label>Included document or explained exclusion<select {...feedbackProps({ kind: 'link', index, field: 'documentId' })} value={link.documentId ?? ''} onChange={e => editLink(index, { documentId: e.target.value || null })}><option value="">Excluded — explain below</option>{link.documentId && !value.documents.some(d => d.id === link.documentId) && <option value={link.documentId}>Retained missing document: {link.documentId}</option>}{value.documents.map((d, i) => <option key={d.id} value={d.id}>{documentName(d, i)}{d.capture === 'missing' ? ' — unavailable' : ''}</option>)}</select></label>
      {feedback({ kind: 'link', index, field: 'documentId' })}
      <label>Link exclusion reason<textarea {...feedbackProps({ kind: 'link', index, field: 'exclusionReason' })} rows={2} maxLength={400} value={link.exclusionReason} onChange={e => editLink(index, { exclusionReason: e.target.value })}/></label>
      {feedback({ kind: 'link', index, field: 'exclusionReason' })}
      {link.documentId !== null && !!link.exclusionReason && <p className="notice">The earlier exclusion reason is retained. <button type="button" className="secondary" onClick={() => editLink(index, { exclusionReason: '' })}>Clear reason and include document</button></p>}
      <button type="button" className="secondary" onClick={() => removeLink(index)}>Remove linked-material declaration {index + 1}</button>
    </fieldset>)}
    <button type="button" className="secondary" disabled={value.links.length >= BUNDLE_LIMITS.links} onClick={() => onChange({ ...value, links: [...value.links, { from: value.documents[0].id, label: '', documentId: null, exclusionReason: '' }] })}>Add linked-material declaration</button>
    <p className="subtle">Up to {BUNDLE_LIMITS.links} declared links. Removing a link declaration does not remove its document or text.</p>
  </section>;
}
