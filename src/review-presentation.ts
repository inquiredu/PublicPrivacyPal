import { measuresFor } from '../shared/evaluation';
import { currentAnalysis, findingResolved, type Review } from '../shared/review';
import { decisionIsCurrent, serviceBlockers } from '../shared/service';

export type ReviewTab = 'overview' | 'compliance' | 'classification' | 'publish';
export const decisionLabels: Record<string, string> = {
  approved: 'Approved', conditional: 'Approved with conditions', declined: 'Declined',
};
export const statusLabels = {
  awaiting_review: 'Evidence review needed', queued: 'Analysis queued', running: 'Analysis running',
  succeeded: 'Saved evaluation available', failed: 'Analysis failed', cancelled: 'Analysis cancelled',
};

/** Present saved findings only. Proposals and historical qualifications are not new review decisions. */
export function reviewQuestions(review: Review) {
  return measuresFor(review).flatMap(measure => {
    const finding = review.analysis?.findings.find(f => f.id === measure.id);
    if (!finding) return [];
    const questions: string[] = [];
    if (finding.requirements) {
      if (finding.requirements.scopeStatus === 'unresolved') questions.push(finding.requirements.scopeQuestion);
      questions.push(...finding.requirements.requirements.map(r => r.question));
    }
    if ((!finding.requirements || !finding.provenance) && finding.context?.resolution !== 'resolved') {
      questions.push(finding.context?.question || '');
    }
    return [...new Set(questions.filter(Boolean))].map(question => ({ measureId: measure.id, label: measure.label, question }));
  });
}

export function reviewProgress(review: Review) {
  const measures = measuresFor(review);
  const findings = measures.map(m => review.analysis?.findings.find(f => f.id === m.id));
  const saved = findings.filter(f => f?.reviewedBy && f.reviewedAt);
  return {
    total: measures.length,
    resolved: saved.filter(f => findingResolved(f!)).length,
    unresolved: saved.filter(f => !findingResolved(f!)).length,
    unreviewed: measures.length - saved.length,
  };
}

/** Navigation guidance only; existing server commands remain the authority for all actions. */
export function reviewNextStep(review: Review, readOnly = false): { title: string; description: string; tab?: ReviewTab; action?: string } {
  const issues = serviceBlockers(review.service);
  if (review.published && issues.length) return { title: 'Published service needs attention', description: 'The service is still published, but its current requirement checks need attention. Review the facts and publication controls.', tab: 'publish', action: 'Inspect publication' };
  if (['queued', 'running'].includes(review.job.status)) return { title: statusLabels[review.job.status], description: 'The saved analysis job is still in progress. A completed job does not record a district decision.' };
  if (['failed', 'cancelled'].includes(review.job.status)) return { title: 'Analysis is incomplete', description: 'Inspect the analysis status and retry controls below. Any earlier evaluation remains historical.' };
  if (!currentAnalysis(review)) return { title: 'Resolve the evidence review', description: 'Review the enabled measures, required source coverage and open questions before recording a district decision.', tab: 'compliance', action: readOnly ? 'Inspect evidence' : 'Continue evidence review' };
  if (decisionIsCurrent(review) && review.decision?.outcome === 'declined') return { title: 'District use declined', description: 'The recorded decision does not permit publication. Inspect the rationale and conditions in Publish & Documents.', tab: 'publish', action: 'Inspect decision' };
  if (issues.length) return { title: 'Check district requirements', description: 'Evidence is ready, but the recorded service facts do not yet satisfy the adopted tier requirements.', tab: 'publish', action: 'Inspect requirements' };
  if (!decisionIsCurrent(review)) return { title: 'District decision needed', description: 'The evidence is ready for a human decision. Any earlier decision must be reconsidered against the saved evaluation and service details.', tab: 'publish', action: readOnly ? 'Inspect decision' : 'Record district decision' };
  return review.published
    ? { title: 'Published in the local libraries', description: 'The staff catalogue and family notice use the saved district wording. Inspect the audience previews or publication controls.', tab: 'publish', action: 'Inspect published wording' }
    : { title: 'Review wording before publication', description: 'A current district decision is recorded. Check the staff and family previews before choosing whether to publish.', tab: 'publish', action: 'Review audience previews' };
}
