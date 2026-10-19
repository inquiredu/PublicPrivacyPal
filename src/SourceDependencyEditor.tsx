import type { CaptureDefinitions } from '../shared/capture-definitions';
import { BUNDLE_LIMITS, type SourceBundleInput } from '../shared/source-bundle';

type Document = SourceBundleInput['documents'][number];
const documentName = (d: Document, index: number) => d.label.trim() || `Document ${index + 1}`;
export const sameScope = (a: SourceBundleInput['scope'], b: SourceBundleInput['scope']) => (['product', 'accounts', 'jurisdiction'] as const).every(key => a[key].trim() === b[key].trim());
export function dependencyLabel(target: string, definitions?: CaptureDefinitions) {
  if (target === '*') return 'All enabled measures and clauses';
  const [measureId, clauseId] = target.split('/');
  const measure = definitions?.measures.find(m => m.id === measureId);
  const clause = measure?.requirements.find(r => r.id === clauseId);
  return measure && (!clauseId || clause) ? `${measure.label}${clause ? ` — ${clause.proposition}` : ''}` : target;
}
const validTargets = (definitions?: CaptureDefinitions) => new Set(['*', ...(definitions?.measures.filter(m => m.enabled).flatMap(m => [m.id, ...m.requirements.map(r => `${m.id}/${r.id}`)]) || [])]);
const covers = (document: Document, target: string) => document.requiredFor.some(t => t === '*' || t === target || t === target.split('/')[0]);

/** Feedback for declarations only; the server still validates the captured manifest and coverage. */
export function dependencyErrors(value: SourceBundleInput, definitions: CaptureDefinitions | undefined): string[] {
  const errors: string[] = [];
  if (!definitions) errors.push('Load and adopt the review measures before saving document dependencies.');
  const valid = validTargets(definitions);
  for (const [index, d] of value.documents.entries()) {
    const name = documentName(d, index);
    if (new Set(d.requiredFor).size !== d.requiredFor.length || d.requiredFor.length > 100) errors.push(`${name}: choose each dependency once, with at most 100 selections.`);
    if (definitions && d.requiredFor.some(t => !valid.has(t))) errors.push(`${name}: reconcile the retained dependencies that are no longer enabled or defined.`);
    if (!d.requiredFor.length && !d.exclusionReason.trim()) errors.push(`${name}: explain why this document is excluded from required coverage.`);
    if (d.requiredFor.length && d.exclusionReason.trim()) errors.push(`${name}: apply the exclusion or explicitly clear its reason before requiring this document.`);
    if (d.requiredFor.length && !sameScope(d.scope, value.scope)) errors.push(`${name}: reconcile its declared scope with the review scope.`);
  }
  for (const m of definitions?.measures.filter(m => m.enabled) || []) {
    const targets = m.requirements.length ? m.requirements.map(r => `${m.id}/${r.id}`) : [m.id];
    const missing = targets.filter(t => !value.documents.some(d => covers(d, t)));
    if (missing.length) errors.push(`${m.label}: declare at least one required document${m.requirements.length ? ` for ${missing.map(t => t.split('/')[1]).join(', ')}` : ''}.`);
  }
  for (const [index, link] of value.links.entries()) {
    const name = `Linked material ${index + 1}`;
    if (!value.documents.some(d => d.id === link.from)) errors.push(`${name}: select the document containing this reference.`);
    if (!link.label.trim()) errors.push(`${name}: supply a link or reference label.`);
    if (link.documentId !== null && !value.documents.some(d => d.id === link.documentId)) errors.push(`${name}: select an included document, including an unavailable one when needed.`);
    if (link.documentId === null && !link.exclusionReason.trim()) errors.push(`${name}: explain the exclusion or select an included document.`);
    if (link.documentId !== null && link.exclusionReason.trim()) errors.push(`${name}: explicitly clear its exclusion reason before including the document.`);
  }
  return errors;
}

/** Explicit selection changes never touch text, scope, applicability, dates or linked material. */
export function chooseDependency(value: SourceBundleInput, documentId: string, target: string, checked: boolean): SourceBundleInput {
  return { ...value, documents: value.documents.map(d => d.id === documentId && !(checked && !d.requiredFor.includes(target) && d.requiredFor.length >= 100) ? { ...d, requiredFor: checked ? [...d.requiredFor.filter(t => t !== target), target] : d.requiredFor.filter(t => t !== target) } : d) };
}

export function SourceDependencyEditor({ value, definitions, onChange }: { value: SourceBundleInput; definitions?: CaptureDefinitions; onChange: (value: SourceBundleInput) => void }) {
  const valid = validTargets(definitions);
  const errors = dependencyErrors(value, definitions);
  function edit(id: string, patch: Partial<Document>) { onChange({ ...value, documents: value.documents.map(d => d.id === id ? { ...d, ...patch } : d) }); }
  function editLink(index: number, patch: Partial<SourceBundleInput['links'][number]>) { onChange({ ...value, links: value.links.map((link, i) => i === index ? { ...link, ...patch } : link) }); }
  return <section className="source-dependencies" aria-label="Document dependencies and exclusions">
    <h3>Which documents does each measure need?</h3>
    <p>Every document starts as required for all enabled measures. Narrow a dependency only after reviewing its scope. Exclusions record your judgment; they do not verify that missing material is irrelevant.</p>
    {!definitions && <p role="status">Exact measure definitions are unavailable. Captured text and selections are retained; precise selection waits for the adopted rubric.</p>}
    {definitions && <p className="subtle">{definitions.definitionVersion}{definitions.settingsRevision !== null && ` · Settings revision ${definitions.settingsRevision}`}. Disabled measures are shown for reference and cannot be selected.</p>}
    {value.documents.map((d, index) => <fieldset key={d.id} className="dependency-document"><legend>{documentName(d, index)}</legend>
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
        <label>Reason for excluding {documentName(d, index)}<textarea rows={2} maxLength={400} value={d.exclusionReason} onChange={e => edit(d.id, { exclusionReason: e.target.value })}/></label>
        <p>Applying this exclusion clears this document’s selected dependencies. Its text and source details remain in the capture. Every enabled measure still needs at least one required document.</p>
        {!!d.requiredFor.length && <button type="button" className="secondary" disabled={!d.exclusionReason.trim()} onClick={() => edit(d.id, { requiredFor: [] })}>Apply explained exclusion</button>}
        {!!d.exclusionReason && <button type="button" className="secondary" onClick={() => edit(d.id, { exclusionReason: '' })}>Clear exclusion reason</button>}
      </details>
    </fieldset>)}
    {definitions && <details><summary>Preview the effect on required source coverage</summary><p>This preview describes your declarations. The server validates the saved capture; document completeness does not establish an interpretation or score.</p><ul>{definitions.measures.filter(m => m.enabled).flatMap(m => m.requirements.length ? m.requirements.map(r => `${m.id}/${r.id}`) : [m.id]).map(target => {
      const documents = value.documents.filter(d => covers(d, target));
      const incomplete = documents.filter(d => d.capture !== 'complete' || d.applicability !== 'matched' || !sameScope(d.scope, value.scope));
      return <li key={target}><strong>{dependencyLabel(target, definitions)}</strong>: {!documents.length ? 'No required document declared.' : incomplete.length ? `Unresolved source: ${incomplete.map(d => d.label || d.id).join('; ')}.` : 'All declared required documents are full and applicable; interpretation awaits review.'}<small>Required documents: {documents.map(d => d.label || d.id).join('; ') || 'None'}.</small></li>;
    })}</ul></details>}
    <h3>Linked material mentioned by the documents</h3>
    <p>Record included material as a listed document, even when unavailable. An excluded link needs a reason. Nothing is fetched.</p>
    {value.links.map((link, index) => <fieldset key={index} className="dependency-link"><legend>Linked material {index + 1}</legend>
      <label>Referenced by<select value={link.from} onChange={e => editLink(index, { from: e.target.value })}>{!value.documents.some(d => d.id === link.from) && <option value={link.from}>Choose a source document</option>}{value.documents.map((d, i) => <option key={d.id} value={d.id}>{documentName(d, i)}</option>)}</select></label>
      <label>Link or reference label<input maxLength={400} required value={link.label} onChange={e => editLink(index, { label: e.target.value })}/></label>
      <label>Included document or explained exclusion<select value={link.documentId ?? ''} onChange={e => editLink(index, { documentId: e.target.value || null })}><option value="">Excluded — explain below</option>{link.documentId && !value.documents.some(d => d.id === link.documentId) && <option value={link.documentId}>Retained missing document: {link.documentId}</option>}{value.documents.map((d, i) => <option key={d.id} value={d.id}>{documentName(d, i)}{d.capture === 'missing' ? ' — unavailable' : ''}</option>)}</select></label>
      <label>Link exclusion reason<textarea rows={2} maxLength={400} value={link.exclusionReason} onChange={e => editLink(index, { exclusionReason: e.target.value })}/></label>
      {link.documentId !== null && !!link.exclusionReason && <p className="notice">The earlier exclusion reason is retained. <button type="button" className="secondary" onClick={() => editLink(index, { exclusionReason: '' })}>Clear reason and include document</button></p>}
      <button type="button" className="secondary" onClick={() => onChange({ ...value, links: value.links.filter((_, i) => i !== index) })}>Remove linked-material declaration {index + 1}</button>
    </fieldset>)}
    <button type="button" className="secondary" disabled={value.links.length >= BUNDLE_LIMITS.links} onClick={() => onChange({ ...value, links: [...value.links, { from: value.documents[0].id, label: '', documentId: null, exclusionReason: '' }] })}>Add linked-material declaration</button>
    <p className="subtle">Up to {BUNDLE_LIMITS.links} declared links. Removing a link declaration does not remove its document or text.</p>
    {!!errors.length && <div className="notice dependency-feedback" role="status"><strong>Before saving this capture</strong><ul>{errors.map((error, index) => <li key={index}>{error}</li>)}</ul></div>}
  </section>;
}
