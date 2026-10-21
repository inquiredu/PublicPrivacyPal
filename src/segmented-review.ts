import type { z } from 'zod';
import { evidenceDraftSchema } from '../shared/drafts';
import { measuresFor } from '../shared/evaluation';
import { requirementCitations } from '../shared/requirements';
import type { Review } from '../shared/review';
import { documentForRange, measureCoverage } from '../shared/source-bundle';
import type { SegmentedCandidate, SegmentedProposalRef, SegmentedProposalView } from '../shared/segmented-assistance';
import type { DraftStore } from './draft-store';

export type SegmentedEvidenceDraft = z.infer<typeof evidenceDraftSchema>;
const segmentedReasons: Record<string, string> = {
  no_current_proposal: 'No current proposal is ready for review.',
  run_cancelled: 'This run was cancelled. Its retained evidence remains available for inspection.',
  requester_access_revoked: 'The required author access changed. This result is retained for inspection.',
  not_eligible_at_completion: 'This result could not start a new review draft when it completed. Inspect the attempt details.',
  evidence_or_synthesis_changed: 'A later attempt changed the evidence or synthesis. Inspect the current proposal before starting a new draft.',
  evidence_changed: 'The evidence changed after this attempt began. Its result is retained for inspection.',
  human_finding_already_reviewed: 'A human finding is already saved. Make corrections in the evidence editor to retain its original reference.',
  human_finding_changed: 'This finding changed after the run started. Your saved human work is retained.',
  review_revision_changed: 'The review changed after this run started. Its retained evidence remains available for inspection.',
};
export function segmentedReasonText(reason: string): string {
  if (Object.hasOwn(segmentedReasons, reason)) return segmentedReasons[reason];
  return /^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(reason)
    ? 'This result is available for inspection but cannot start a new review draft.' : reason;
}
// Coarse preflight only. The server counts the complete finding, including attribution and
// coverage; a smaller edit can still exceed that limit and must retain its draft on rejection.
export function segmentedEvidenceSizeError(evidence: unknown): string | null {
  return new TextEncoder().encode(JSON.stringify(evidence)).length > 64 * 1024
    ? 'The selected evidence exceeds the 64 KiB finding limit. Select fewer or shorter passages before saving. Original candidates remain retained and inspectable.' : null;
}
export function sameSegmentedReference(a: SegmentedProposalRef | undefined, b: SegmentedProposalRef | undefined): boolean {
  return !!a && !!b && a.version === b.version && a.runId === b.runId && a.synthesisAttemptId === b.synthesisAttemptId
    && a.outcomeId === b.outcomeId && a.evidenceRevision === b.evidenceRevision && a.measureId === b.measureId
    && a.targetIds.length === b.targetIds.length && new Set(a.targetIds).size === a.targetIds.length
    && new Set(b.targetIds).size === b.targetIds.length && a.targetIds.every(id => b.targetIds.includes(id));
}
export function segmentedProposalPath(reviewId: string, ref: Pick<SegmentedProposalRef, 'runId' | 'outcomeId' | 'measureId'>, cursor?: string): string {
  return `/api/reviews/${encodeURIComponent(reviewId)}/segmented-runs/${encodeURIComponent(ref.runId)}/proposals/${encodeURIComponent(ref.outcomeId)}/${encodeURIComponent(ref.measureId)}${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''}`;
}

/** Only install a freshly fetched server seed. A late response never replaces another draft. */
export function installSegmentedDraft(store: DraftStore, review: Review, proposal: SegmentedProposalView, requestedRevision: number): void {
  const key = `evidence:${review.id}`;
  if (store.has(key) || store.has(`decision:${review.id}`) || store.has(`service:${review.id}`) || store.has('pending-command')) throw new Error('Save or discard the existing draft or pending command first. Your work has been kept.');
  if (review.revision !== requestedRevision) throw new Error('The review changed while the proposal loaded. Inspect the current review and try again; no draft was replaced.');
  const seed = proposal.seed;
  if (!proposal.current || !proposal.eligible || !seed) throw new Error(segmentedReasonText(proposal.reason) || 'This historical proposal is available for inspection only.');
  if (!sameSegmentedReference(seed.segmentedProposal, proposal.reference) || seed.criterionId !== proposal.reference.measureId) throw new Error('The server seed does not match the inspected proposal.');
  const measure = measuresFor(review).find(c => c.id === seed.criterionId);
  const targetIds = measure && 'requirements' in measure && measure.requirements ? measure.requirements.map(r => `${measure.id}/${r.id}`) : measure ? [measure.id] : [];
  if (!targetIds.length || targetIds.length !== proposal.reference.targetIds.length || !targetIds.every(id => proposal.reference.targetIds.includes(id))) throw new Error('The proposal does not include every adopted target for this measure.');
  const prior = review.analysis?.findings.find(f => f.id === seed.criterionId);
  if (prior?.provenance || (prior?.segmentedProvenance && !sameSegmentedReference(prior.segmentedProvenance.reference, proposal.reference))) throw new Error('This finding retains its original suggestion. Select it in the evidence editor to make a correction.');
  if (seed.finding !== 'unresolved' || seed.citations.length || seed.sourceReview?.segmentIds.length || seed.context.resolution !== 'retained'
    || seed.requirements && (seed.requirements.scopeStatus !== 'unresolved' || seed.requirements.requirements.some(r => !['ambiguous', 'unavailable'].includes(r.status) || r.citations.length))) throw new Error('A segmented handoff must start unresolved without accepted citations or human range acknowledgments.');
  store.set(key, evidenceDraftSchema.parse({ ...seed, revision: requestedRevision, quoteText: '' }));
}

/** Candidate selection records an explicit human action, never a model assessment or acknowledgment. */
export function attachSegmentedCandidate(draft: SegmentedEvidenceDraft, reference: SegmentedProposalRef, candidate: SegmentedCandidate, review: Review): SegmentedEvidenceDraft {
  if (!sameSegmentedReference(draft.segmentedProposal, reference) || draft.criterionId !== reference.measureId) throw new Error('This candidate belongs to a different proposal. The existing draft has been kept.');
  if (draft.revision !== review.revision) throw new Error('The review changed. Your draft is preserved; inspect it before making a new correction.');
  if (!reference.targetIds.includes(candidate.target)) throw new Error('This candidate is outside the adopted proposal targets.');
  if (!review.sourceBundle || !review.contract || candidate.quote.length > 2000 || !candidate.quote.trim()
    || review.sourceText.slice(candidate.start, candidate.end) !== candidate.quote) throw new Error('The candidate does not match this saved source.');
  const document = documentForRange(review.sourceBundle, candidate.start, candidate.end);
  const target = measureCoverage(review.sourceBundle, review.contract, draft.criterionId).targets.find(t => t.target === candidate.target);
  if (!document || document.id !== candidate.documentId || document.textHash !== candidate.textHash || !target?.documents.includes(document.id)) throw new Error('The candidate is outside this target’s declared source dependencies.');
  const citation = { quote: candidate.quote, start: candidate.start, end: candidate.end };
  const sameRange = (q: { start: number; end: number }) => q.start === candidate.start && q.end === candidate.end;
  if (draft.requirements) {
    const requirementId = candidate.target.slice(draft.criterionId.length + 1);
    const requirement = draft.requirements.requirements.find(r => r.id === requirementId);
    if (!requirement) throw new Error('Select a candidate for an adopted clause.');
    if (requirement.status === 'not_stated') throw new Error('Change the clause assessment before attaching evidence to confirmed silence.');
    if (requirement.citations.some(sameRange)) throw new Error('This passage is already attached to the clause. Review its evidence role in the editor.');
    if (requirement.citations.length >= 3) throw new Error('Select up to three passages for this clause. All original candidates remain available below.');
    const role = ({ supporting: 'support', limiting: 'limitation', opposing: 'opposition' } as const)[candidate.role];
    const requirements = { ...draft.requirements, requirements: draft.requirements.requirements.map(r => r.id === requirementId ? { ...r, citations: [...r.citations, { ...citation, role }] } : r) };
    const citations = [...draft.citations];
    for (const q of requirementCitations(requirements)) if (!citations.some(c => c.start === q.start && c.end === q.end)) citations.push(q);
    if (citations.length > requirements.requirements.length * 3) throw new Error('The draft passage pool is full. Remove an unused passage before attaching this candidate; no existing evidence was removed.');
    return evidenceDraftSchema.parse({ ...draft, requirements, citations });
  }
  if (candidate.target !== draft.criterionId) throw new Error('This candidate belongs to a different measure.');
  if (draft.finding === 'not_specified') throw new Error('Change the finding before attaching evidence to confirmed silence.');
  if (draft.citations.some(sameRange)) throw new Error('This passage is already attached.');
  if (draft.citations.length >= 3) throw new Error('Select up to three passages for this measure. All original candidates remain available below.');
  return evidenceDraftSchema.parse({ ...draft, citations: [...draft.citations, citation] });
}
