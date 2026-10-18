import { evidenceRoleSchema, requirementStatusSchema, roleForStatus, type Requirement, type RequirementReview } from '../shared/requirements';
import type { Citation } from '../shared/review';

export function RequirementEditor({ definitions, value, passages, onChange, missingRequirements = [] }: { definitions: Requirement[]; value: RequirementReview; passages: Citation[]; onChange: (v: RequirementReview) => void; missingRequirements?: string[] }) {
  function edit(id: string, patch: Partial<RequirementReview['requirements'][number]>) { onChange({ ...value, requirements: value.requirements.map(r => r.id === id ? { ...r, ...patch } : r) }); }
  return <section aria-label="Subrequirement review"><h4>Review each subrequirement</h4>
    <p>The finding is calculated from these interpretations. Each measure keeps its original weight. Add exact passages below, then assign them to the requirements they support or limit.</p>
    <label>Scope reviewed<textarea required maxLength={400} value={value.scope} onChange={e => onChange({ ...value, scope: e.target.value })}/></label>
    <label>Source readiness<select disabled={!!missingRequirements.length} value={missingRequirements.length ? 'incomplete' : value.sourceStatus} onChange={e => onChange({ ...value, sourceStatus: e.target.value as RequirementReview['sourceStatus'] })}><option value="usable">Usable supplied text — check applicable documents</option><option value="incomplete">Incomplete — required source is missing</option><option value="unreadable">Unreadable</option></select></label>
    <label>Does this scope match the intended school use?<select value={value.scopeStatus} onChange={e => onChange({ ...value, scopeStatus: e.target.value as RequirementReview['scopeStatus'], scopeQuestion: e.target.value === 'matched' ? '' : value.scopeQuestion || 'Which terms apply to this school use?' })}><option value="unresolved">Unresolved</option><option value="matched">Matched after review</option></select></label>
    {value.scopeStatus === 'unresolved' && <label>Scope question<textarea required maxLength={500} value={value.scopeQuestion} onChange={e => onChange({ ...value, scopeQuestion: e.target.value })}/></label>}
    {definitions.map(d => { const r = value.requirements.find(r => r.id === d.id)!; return <fieldset key={d.id} className="requirement-review"><legend>{d.id.replaceAll('_', ' ')}</legend>
      <dl className="rubric-definitions"><dt>Established</dt><dd>{d.proposition}</dd><dt>Limited</dt><dd>{d.limited}</dd><dt>Opposed{d.decisive ? ' — decisive for this measure' : ''}</dt><dd>{d.opposed}</dd></dl>
      <label>Requirement assessment<select value={r.status} onChange={e => { const status = e.target.value as typeof r.status; edit(r.id, { status, question: ['ambiguous','unavailable'].includes(status) ? r.question || 'What evidence resolves this requirement?' : '', ...(status === 'not_stated' ? { citations: [] } : {}) }); }}>{requirementStatusSchema.options.map(s => <option disabled={s === 'not_stated' && missingRequirements.includes(r.id)} key={s} value={s}>{s.replaceAll('_',' ')}</option>)}</select></label>
      <label>Requirement rationale<textarea required maxLength={1000} value={r.rationale} onChange={e => edit(r.id, { rationale: e.target.value })}/></label>
      {['ambiguous','unavailable'].includes(r.status) && <label>Requirement question<textarea required maxLength={500} value={r.question} onChange={e => edit(r.id, { question: e.target.value })}/></label>}
      {r.status !== 'not_stated' && <><p>Evidence for this requirement (up to three passages)</p>{passages.map((q, i) => {
        const selected = r.citations.find(c => c.start === q.start && c.end === q.end);
        return <div key={`${q.start}:${q.end}`}><label><input type="checkbox" checked={!!selected} disabled={!selected && r.citations.length >= 3} onChange={e => edit(r.id, { citations: e.target.checked ? [...r.citations, { ...q, role: roleForStatus(r.status) || 'conflict' }] : r.citations.filter(c => c.start !== q.start || c.end !== q.end) })}/>Passage {i + 1}: {q.quote}</label>{selected && <label>Passage {i + 1} evidence role<select value={selected.role} onChange={e => edit(r.id, { citations: r.citations.map(c => c === selected ? { ...c, role: e.target.value as typeof c.role } : c) })}>{evidenceRoleSchema.options.map(role => <option value={role} key={role}>{role}</option>)}</select></label>}</div>;
      })}{!passages.length && <p>Add a passage from the saved policy below.</p>}</>}
    </fieldset>; })}
  </section>;
}

export function RequirementFindings({ value, title = 'Subrequirement findings' }: { value: RequirementReview; title?: string }) {
  return <details><summary>{title}</summary><p>{value.scope} · Scope: {value.scopeStatus} · Source: {value.sourceStatus}</p>{value.scopeQuestion && <p>{value.scopeQuestion}</p>}
    {value.requirements.map(r => <section key={r.id}><h5>{r.id.replaceAll('_',' ')} · {r.status.replaceAll('_',' ')}</h5><p>{r.rationale}</p>{r.citations.map(q => <div key={`${q.start}:${q.end}`}><strong>{q.role}</strong><blockquote>{q.quote}</blockquote></div>)}{r.question && <p><strong>Follow up:</strong> {r.question}</p>}</section>)}
  </details>;
}
