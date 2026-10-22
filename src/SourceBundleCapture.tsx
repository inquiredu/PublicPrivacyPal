import { LONG_BUNDLE_VERSION, SEGMENT_LIMITS } from '../shared/source-segments';
import { BUNDLE_LIMITS, BUNDLE_VERSION, type SourceBundleInput } from '../shared/source-bundle';
import type { CaptureDefinitions } from '../shared/capture-definitions';
import { sameScope, SourceDependencyEditor } from './SourceDependencyEditor';

/** Review scope changes retain each document's declaration until explicitly reconciled. */
export function changeBundleScope(value: SourceBundleInput, scope: SourceBundleInput['scope']): SourceBundleInput { return { ...value, scope }; }
export function useReviewScope(value: SourceBundleInput, documentId: string): SourceBundleInput {
  return { ...value, documents: value.documents.map(d => d.id === documentId ? { ...d, scope: { ...value.scope }, applicability: 'unresolved' } : d) };
}
export function SourceBundleCapture({ value, definitions, onChange }: { value: SourceBundleInput; definitions?: CaptureDefinitions; onChange: (v: SourceBundleInput) => void }) {
  function edit(id: string, patch: Partial<SourceBundleInput['documents'][number]>) { onChange({ ...value, documents: value.documents.map(d => d.id === id ? { ...d, ...patch } : d) }); }
  const maxLength = value.version === LONG_BUNDLE_VERSION ? SEGMENT_LIMITS.textLength : 32000;
  const length = value.documents.reduce((n, d) => n + d.text.length, 0) + Math.max(0, value.documents.filter(d => d.capture !== 'missing').length - 1) * 2;
  return <section className="full-width source-bundle-capture" aria-label="Source bundle capture"><h3>Capture the required documents</h3>
    <p>List the policies, school or consumer terms and addenda needed for this review, including documents you do not have. Documents start as required for every enabled measure; review precise dependencies and explained exclusions below. “Complete” means the full document for this declared set; it does not establish that every relevant vendor document was discovered.</p>
    <label>Policy length<select value={value.version} onChange={e => onChange({ ...value, version: e.target.value as SourceBundleInput['version'] })}><option value={BUNDLE_VERSION}>Up to 32,000 characters</option><option value={LONG_BUNDLE_VERSION}>Long policy set — up to 128,000 characters</option></select></label>
    {value.version === LONG_BUNDLE_VERSION && <p>Long policies use bounded segments with shared boundary context. Manual findings require confirmation that all required ranges were reviewed together. Offline extraction requires every segment and a final synthesis; live inference is disabled.</p>}
    <div className="form-grid">{(['product', 'accounts', 'jurisdiction'] as const).map(key => <label key={key}>{({ product: 'Product being reviewed', accounts: 'Account types being reviewed', jurisdiction: 'Jurisdiction being reviewed' })[key]}<input required maxLength={160} value={value.scope[key]} onChange={e => onChange(changeBundleScope(value, { ...value.scope, [key]: e.target.value }))}/></label>)}</div>
    <p className="subtle">Changing review scope keeps each document’s earlier declaration. Use the review scope for a document explicitly, then reassess its applicability.</p>
    {value.documents.map((d, i) => <fieldset key={d.id}><legend>Document {i + 1}{d.label && ` — ${d.label}`}</legend>
      <label>Document label<input required maxLength={160} value={d.label} onChange={e => edit(d.id, { label: e.target.value })}/></label>
      <label>Source URL or upload label<input required maxLength={400} value={d.origin} onChange={e => edit(d.id, { origin: e.target.value })}/><small>Recorded as a reference. No website is fetched.</small></label>
      <label>Capture status<select value={d.capture} onChange={e => edit(d.id, { capture: e.target.value as typeof d.capture })}><option value="complete">Full document supplied</option><option value="excerpt">Excerpt or truncated document</option><option value="missing">Required document unavailable</option></select></label>
      <p className="source-scope">Document scope: {d.scope.product || 'Product not declared'} · {d.scope.accounts || 'Accounts not declared'} · {d.scope.jurisdiction || 'Jurisdiction not declared'}</p>
      {!sameScope(d.scope, value.scope) && <div className="notice"><p>This document retains a different scope declaration. Required documents must be reconciled before saving; an excluded document can retain its original scope.</p><button type="button" className="secondary" onClick={() => onChange(useReviewScope(value, d.id))}>Use review scope and reassess applicability</button></div>}
      <label>Applicability to the document’s declared scope<select value={d.applicability} onChange={e => edit(d.id, { applicability: e.target.value as typeof d.applicability })}><option value="unresolved">Unresolved — confirm applicable terms</option><option value="matched">Confirmed for the declared scope after review</option></select></label>
      <details><summary>Declared effective dates, if supplied</summary><p>Keep conflicting dates for review.</p>{[0, 1, 2].map(j => <label key={j}>Effective date or date statement {j + 1}<input maxLength={80} value={d.effectiveDates[j] || ''} onChange={e => edit(d.id, { effectiveDates: [0, 1, 2].map(k => k === j ? e.target.value : d.effectiveDates[k] || '') })}/></label>)}</details>
      {d.capture !== 'missing' || d.text ? <label>Document text<textarea required={d.capture !== 'missing'} maxLength={SEGMENT_LIMITS.textLength} rows={6} value={d.text} onChange={e => edit(d.id, { text: e.target.value })}/>{d.capture === 'missing' && <small>Clear this retained text before saving as unavailable, or select excerpt to preserve it in the capture.</small>}</label> : <p>No text will be recorded for this unavailable document.</p>}
      {value.documents.length > 1 && <button type="button" className="secondary" disabled={!!d.text || !!d.label || !!d.origin || !!d.exclusionReason || d.requiredFor.length !== 1 || d.requiredFor[0] !== '*' || d.effectiveDates.some(date => !!date.trim()) || value.links.some(link => link.from === d.id || link.documentId === d.id)} onClick={() => onChange({ ...value, documents: value.documents.filter(v => v.id !== d.id) })}>Remove empty document {i + 1}</button>}
    </fieldset>)}
    <button type="button" className="secondary" disabled={value.documents.length >= BUNDLE_LIMITS.documents} onClick={() => onChange({ ...value, documents: [...value.documents, { id: crypto.randomUUID(), label: '', origin: '', scope: value.scope, applicability: 'unresolved', effectiveDates: [], capture: 'missing', text: '', requiredFor: ['*'], exclusionReason: '' }] })}>Add required document</button>
    <p className={length > maxLength ? 'notice' : 'subtle'}>{length.toLocaleString()}/{maxLength.toLocaleString()} characters across up to eight documents. The saved bundle is immutable. Changed or newly supplied documents require a new review.</p>
    <SourceDependencyEditor value={value} definitions={definitions} onChange={onChange}/>
  </section>;
}
