import type { ReviewSummary } from '../shared/evaluation';
import { decisionLabels, statusLabels } from './review-presentation';

export function ReviewCard({ review: r, selected, onSelect }: { review: ReviewSummary; selected: boolean; onSelect: () => void }) {
  return <article className={`review-item${selected ? ' selected' : ''}`}>
    <span className="review-publication">{r.published ? 'Published locally' : 'Not published'}</span>
    <h3><button className="review-card-link" aria-current={selected ? 'true' : undefined} onClick={onSelect}>{r.name}</button></h3>
    <p className="review-card-decision"><strong>District decision</strong><br/>{r.service ? decisionLabels[r.service.decision] || r.service.decision : 'Inspect in review details'}</p>
    {r.service && <><p>{r.service.tier}</p><small>Grades {r.service.grades || 'not recorded'} · {r.service.dataUse === 'unknown' ? 'Student data unconfirmed' : r.service.dataUse.replaceAll('_', ' ')}</small></>}
    <div className="review-card-evidence"><p><strong>{r.score === null ? 'Score pending' : `${r.score}/100`}</strong>{r.score !== null && ' saved evidence score'}</p><p>{r.reviewed}/{r.measureCount} measures reviewed and resolved</p><small>{statusLabels[r.status as keyof typeof statusLabels] || r.status}</small></div>
    {!!r.service?.blockers.length && <p className="card-warning">{r.service.blockers.length} requirement {r.service.blockers.length === 1 ? 'check flagged' : 'checks flagged'} at last save</p>}
  </article>;
}
