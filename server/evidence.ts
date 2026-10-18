import { LONG_BUNDLE_VERSION, sourceSegments } from '../shared/source-segments.ts';
import { measuresFor, type EvaluationContract } from '../shared/evaluation.ts';
import { createHash } from 'node:crypto';
import { getProfile } from '../shared/scoring/profiles.ts';
import { calculateScore } from '../shared/scoring/engine.ts';
import { evidenceEditSchema, findingResolved, type EvidenceEdit, type Finding, type Analysis, type ProposalProvenance, type ReviewContext } from '../shared/review.ts';
import { isWellFormedText } from '../shared/policy-source.ts';
import { deriveRequirementReview, requirementReviewError, requirementFinding, PRECISION_DEFINITION, type RequirementReview } from '../shared/requirements.ts';
import { measureCoverage, coverageReady, documentForRange, type SourceBundle } from '../shared/source-bundle.ts';

export const sourceHash = (source: string) => {
  if (!isWellFormedText(source)) throw new Error('Source contains invalid Unicode.');
  return createHash('sha256').update(source).digest('hex');
};
export function validateEvidence(source: string, raw: unknown, contract?: EvaluationContract, bundle?: SourceBundle): EvidenceEdit {
  const edit = evidenceEditSchema.parse(raw);
  const coverage = bundle && contract ? measureCoverage(bundle, contract, edit.criterionId) : undefined;
  const missing = coverage && !coverageReady(coverage);
  if (bundle?.version === LONG_BUNDLE_VERSION) {
    const required = sourceSegments(bundle).filter(s => coverage?.targets.some(t => t.documents.includes(s.documentId))).map(s => s.id);
    const reviewed = edit.sourceReview?.segmentIds || [];
    if (edit.sourceReview && (edit.sourceReview.bundleId !== bundle.id || new Set(reviewed).size !== reviewed.length || reviewed.some(id => !required.includes(id)))) throw new Error('Human source coverage refers to an unknown, duplicate or different segment.');
    const complete = required.length > 0 && required.every(id => reviewed.includes(id));
    if (!complete && edit.requirements) edit.requirements.sourceStatus = 'incomplete';
    if (!complete && (edit.finding !== 'unresolved' || edit.requirements?.requirements.some(r => r.status === 'not_stated'))) throw new Error('Review every required source segment together before resolving a long-policy finding or confirming silence.');
  } else if (edit.sourceReview) throw new Error('Human segment coverage requires a v2 source bundle.');
  if (missing && edit.finding !== 'unresolved') throw new Error('Required document coverage is incomplete. Save unresolved work or capture a complete bundle in a new review.');
  const criterion = measuresFor({ contract }).find(c => c.id === edit.criterionId);
  if (!criterion) throw new Error('Choose a known enabled criterion.');
  const definitions = 'requirements' in criterion ? criterion.requirements : undefined;
  if (definitions) {
    if (!edit.requirements) throw new Error('Review the adopted subrequirements before saving this measure.');
    if (bundle) {
      // A reviewer may downgrade readiness, never upgrade the captured manifest.
      if (missing) edit.requirements.sourceStatus = 'incomplete';
      for (const r of edit.requirements.requirements) if (r.status === 'not_stated' && !coverage?.targets.find(t => t.target === `${edit.criterionId}/${r.id}`)?.ready) throw new Error('Unavailable required documents cannot establish silence.');
    }
    const error = requirementReviewError(definitions, edit.requirements); if (error) throw new Error(error);
    const result = deriveRequirementReview(definitions, edit.requirements);
    if (edit.finding !== requirementFinding(result.state)) throw new Error('The finding must match the deterministic subrequirement result.');
  } else if (edit.requirements) throw new Error('This measure has no adopted subrequirements.');
  if (edit.finding === 'not_specified') {
    if (edit.citations.length) throw new Error('Not addressed cannot include a supporting quotation.');
  } else if (edit.finding !== 'unresolved' && !edit.citations.length) throw new Error('Add at least one exact quotation for this finding.');
  if (edit.context && ['conflict', 'scope', 'missing_statement', 'missing_source', 'ambiguous_wording'].includes(edit.context.uncertainty) && !edit.context.question) throw new Error('Record a follow-up question for this uncertainty.');
  if (edit.context?.resolution === 'resolved') {
    if (!edit.context.note.trim() || (edit.finding !== 'not_specified' && !edit.context.citations.length)) throw new Error('Explain the resolution and cite the saved source. For confirmed absence, explain what you checked.');
    if (edit.finding === 'unresolved') throw new Error('Choose a resolved finding before resolving the follow-up.');
  } else if (edit.context?.citations.length || edit.context?.note) throw new Error('Choose resolved to record resolution evidence.');
  for (const { citations, targets } of [
    { citations: edit.citations, targets: coverage?.targets }, { citations: edit.context?.citations || [], targets: coverage?.targets },
    ...(edit.requirements?.requirements.map(r => ({ citations: r.citations, targets: coverage?.targets.filter(t => t.target === `${edit.criterionId}/${r.id}`) })) || []),
  ]) {
    const ranges = new Set<string>();
    for (const c of citations) {
    if (bundle) {
      const doc = documentForRange(bundle, c.start, c.end);
      if (!doc) throw new Error('A quotation must stay within one captured document.');
      if (!targets?.some(t => t.documents.includes(doc.id))) throw new Error('The cited document is outside this requirement’s declared source dependencies. Capture revised dependencies in a new review.');
    }
    if (!c.quote.trim() || c.end <= c.start || c.end > source.length || source.slice(c.start, c.end) !== c.quote) throw new Error('A quotation does not match its position in the saved policy.');
    const key = `${c.start}:${c.end}`;
    if (ranges.has(key)) throw new Error('The same passage cannot be cited twice for one criterion.');
    ranges.add(key);
    }
  }
  return edit;
}
export type VerifiedProposal = { provenance: ProposalProvenance; context: Pick<ReviewContext, 'scope' | 'uncertainty' | 'question'>; requirements?: RequirementReview };
export function editAnalysis(source: string, profileVersion: string, previous: Analysis | null, edit: EvidenceEdit, id: string, actorUid: string, at: string, contract?: EvaluationContract, proposal?: VerifiedProposal, requireExplicitReview = true, bundle?: SourceBundle): Analysis {
  const validated = validateEvidence(source, edit, contract, bundle);
  const hash = bundle?.id || sourceHash(source);
  if (previous && previous.sourceHash !== hash) throw new Error('Earlier evidence refers to a different source.');
  const profile = contract ? { version: contract.profileVersion, engineVersion: contract.engineVersion } : getProfile(profileVersion);
  const criteria = measuresFor({ contract });
  const prior = previous?.findings.find(f => f.id === edit.criterionId);
  if (edit.proposalId && (!proposal || proposal.provenance.jobId !== edit.proposalId)) throw new Error('Suggestion provenance must be verified by the server.');
  if (prior?.provenance && edit.proposalId !== prior.provenance.jobId) throw new Error('Keep the original suggestion reference when correcting this finding.');
  for (const original of [proposal?.context, prior?.context]) {
    if (original && (!validated.context || (['scope', 'uncertainty', 'question'] as const).some(k => original[k] !== validated.context![k]))) throw new Error('Retain the original scope, uncertainty and question; record any correction in the resolution.');
  }
  if (proposal && proposal.provenance.sourceStatus !== 'usable' && edit.finding !== 'unresolved') throw new Error('An incomplete source remains unresolved. Capture a complete source in a new review.');
  if (validated.requirements && validated.context && validated.requirements.scope !== validated.context.scope && validated.context.resolution !== 'resolved') throw new Error('Explain a changed scope in the retained qualification resolution.');
  const findings: Finding[] = criteria.map(c => {
    const f = previous?.findings.find(f => f.id === c.id);
    if (!f || (requireExplicitReview && !f.reviewedBy && previous?.adapterVersion.startsWith('human-evidence'))) return { id: c.id, finding: 'unresolved', quote: '', start: null, end: null };
    return f;
  });
  const [first, ...additionalEvidence] = validated.citations;
  const replacement: Finding = { id: validated.criterionId, finding: validated.finding, quote: first?.quote || '', start: first?.start ?? null, end: first?.end ?? null, additionalEvidence, rationale: validated.rationale, reviewedBy: actorUid, reviewedAt: at,
    ...(validated.context ? { context: { ...validated.context, ...(validated.context.resolution === 'resolved' ? { resolvedBy: actorUid, resolvedAt: at } : {}) } } : {}),
    ...(proposal ? { provenance: proposal.provenance } : {}),
    ...(validated.sourceReview ? { sourceReview: validated.sourceReview } : {}),
    ...(validated.requirements ? { requirements: validated.requirements } : {}),
    ...(bundle && contract ? { coverage: measureCoverage(bundle, contract, edit.criterionId) } : {}),
    ...(proposal?.requirements ? { proposalRequirements: proposal.requirements } : prior?.proposalRequirements ? { proposalRequirements: prior.proposalRequirements } : {}) };
  findings[criteria.findIndex(c => c.id === replacement.id)] = replacement;
  return {
    id, profileVersion: profile.version, adapterVersion: bundle?.version === LONG_BUNDLE_VERSION ? 'human-evidence-v5' : bundle ? 'human-evidence-v4' : contract?.definitionVersion === PRECISION_DEFINITION ? 'human-evidence-v3' : 'human-evidence-v2', schemaVersion: bundle?.version === LONG_BUNDLE_VERSION ? 'findings-v6' : bundle ? 'findings-v5' : contract?.definitionVersion === PRECISION_DEFINITION ? 'findings-v4' : 'findings-v3', sourceHash: hash, findings,
    evidenceCount: findings.filter(f => !!f.quote).length,
    score: { ...calculateScore(criteria.map((c, i) => ({ id: c.id, weight: c.weight, assessment: !findingResolved(findings[i]) ? 'unresolved' : ({ yes: 'meets', no: 'does_not_meet', partial: 'partial', not_specified: 'not_addressed', unresolved: 'unresolved' } as const)[findings[i].finding] })), profile.engineVersion), coverageVersion: 'review-coverage-v1' },
  };
}
