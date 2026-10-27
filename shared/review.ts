import { requestHandoffSchema } from './requests';
import { humanSourceReviewSchema, type HumanSourceReview } from './source-segments.ts';
import { segmentedActionSchemas, segmentedProposalRefSchema, type SegmentedProvenance, type SegmentedReviewMarker } from './segmented-assistance.ts';
import { serviceEditSchema, type ServiceRecord } from './service.ts';
import type { EvaluationContract } from './evaluation.ts';
import { measuresFor } from './evaluation.ts';
import { z } from 'zod';
import { policyTextSchema } from './policy-source.ts';
import { requirementReviewSchema, type RequirementReview } from './requirements';
import { sourceBundleInputSchema, type SourceBundle, type SourceCoverage } from './source-bundle';
export { MAX_POLICY_LENGTH, policyTextSchema } from './policy-source.ts';
import type { calculateScore } from './scoring/engine.ts';
import { criteria, profileVersions, DEFAULT_PROFILE, type ProfileVersion } from './scoring/profiles.ts';
export { criteria } from './scoring/profiles.ts';
export const PROFILE_VERSION = 'community-demo-v1'; // Legacy records without a profile stay on this version.
export const fixtureIds = ['complete', 'gaps', 'retry'] as const;
export const MAX_REVIEW_IMPORT_BYTES = 2 * 1024 * 1024;
const reviewFields = { requestHandoff: requestHandoffSchema.optional(), serviceSettingsRevision: z.number().int().positive().optional(), name: z.string().trim().min(1).max(120), profileVersion: z.enum(profileVersions).default(DEFAULT_PROFILE) };
export const fixtureReviewSchema = z.object({ ...reviewFields, fixtureId: z.enum(fixtureIds) }).strict();
export const pastedReviewSchema = z.object({ ...reviewFields, sourceKind: z.literal('pasted'), sourceLabel: z.string().trim().min(1).max(160), sourceText: policyTextSchema }).strict();
export const districtReviewSchema = pastedReviewSchema.omit({ profileVersion: true }).extend({ rubricMode: z.literal('district'), settingsRevision: z.number().int().positive(), engineVersion: z.enum(['upstream-weighted-v1', 'evidence-weighted-v1']) }).strict().transform(i => ({ ...i, profileVersion: i.engineVersion === 'upstream-weighted-v1' ? 'community-demo-v1' as const : 'community-evidence-v1' as const }));
export const bundleReviewSchema = pastedReviewSchema.omit({ sourceKind: true, sourceText: true }).extend({ sourceKind: z.literal('bundle'), sourceDefinitionId: z.string().regex(/^[a-f0-9]{64}$/).optional(), sourceBundle: sourceBundleInputSchema }).strict();
export const districtBundleReviewSchema = bundleReviewSchema.omit({ profileVersion: true }).extend({ rubricMode: z.literal('district'), settingsRevision: z.number().int().positive(), engineVersion: z.enum(['upstream-weighted-v1', 'evidence-weighted-v1']) }).strict().transform(i => ({ ...i, profileVersion: i.engineVersion === 'upstream-weighted-v1' ? 'community-demo-v1' as const : 'community-evidence-v1' as const }));
export const createReviewSchema = z.union([fixtureReviewSchema, pastedReviewSchema, districtReviewSchema, bundleReviewSchema, districtBundleReviewSchema]);
export const citationSchema = z.object({ quote: z.string().min(1).max(2000), start: z.number().int().min(0), end: z.number().int().positive() }).strict();
export type Citation = z.infer<typeof citationSchema>;
export const reviewContextSchema = z.object({
  scope: z.string().trim().max(400),
  uncertainty: z.enum(['none', 'exception', 'conflict', 'scope', 'missing_statement', 'missing_source', 'ambiguous_wording']),
  question: z.string().trim().max(500),
  resolution: z.enum(['retained', 'resolved']),
  note: z.string().trim().max(1000), citations: z.array(citationSchema).max(3),
}).strict();
export type ReviewContext = z.infer<typeof reviewContextSchema>;
export type ProposalProvenance = { jobId: string; resultId: string; sourceHash: string; rubricId: string; promptVersion: string; schemaVersion: string; provider: string; model: string; state: string; sourceStatus: string };
export const evidenceEditSchema = z.object({
  sourceReview: humanSourceReviewSchema.optional(),
  criterionId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  finding: z.enum(['yes', 'no', 'partial', 'not_specified', 'unresolved']), citations: z.array(citationSchema).max(3),
  rationale: z.string().trim().min(1).max(1000),
  context: reviewContextSchema.optional(), proposalId: z.uuid().optional(), segmentedProposal: segmentedProposalRefSchema.optional(), requirements: requirementReviewSchema.optional(),
}).strict().refine(d => !(d.proposalId && d.segmentedProposal), 'Choose one suggestion reference.');
export type EvidenceEdit = z.infer<typeof evidenceEditSchema>;
export const decisionSchema = z.object({ outcome: z.enum(['approved', 'conditional', 'declined']), rationale: z.string().trim().min(1).max(2000), conditions: z.string().trim().max(1500), summary: z.string().trim().min(1).max(1000), category: z.string().trim().min(1).max(80) }).strict().refine(d => d.outcome !== 'conditional' || d.conditions.length > 0, 'Conditions are required.');
export const actionSchema = z.discriminatedUnion('action', [
  ...segmentedActionSchemas,
  z.object({ action: z.literal('adopt_service'), revision: z.number().int().positive(), settingsRevision: z.number().int().positive() }).strict(),
  z.object({ action: z.literal('edit_service'), revision: z.number().int().positive(), service: serviceEditSchema }).strict(),
  z.object({ action: z.literal('decide'), revision: z.number().int().positive(), decision: decisionSchema }).strict(),
  z.object({ action: z.literal('edit_evidence'), revision: z.number().int().positive(), evidence: evidenceEditSchema }).strict(),
  ...(['publish', 'unpublish', 'retry', 'reanalyze', 'cancel', 'start_assistance', 'cancel_assistance'] as const).map(action => z.object({ action: z.literal(action), revision: z.number().int().positive() }).strict()),
]);
export const findingSchema = z.object({ id: z.string(), finding: z.enum(['yes', 'no', 'partial', 'not_specified']), quote: z.string().max(2000), start: z.number().int().min(0).nullable(), end: z.number().int().min(0).nullable() }).strict();
export type Finding = Omit<z.infer<typeof findingSchema>, 'finding'> & { coverage?: SourceCoverage; sourceReview?: HumanSourceReview; finding: z.infer<typeof evidenceEditSchema>['finding']; additionalEvidence?: Citation[]; rationale?: string; reviewedBy?: string; reviewedAt?: string; context?: ReviewContext & { resolvedBy?: string; resolvedAt?: string }; provenance?: ProposalProvenance; segmentedProvenance?: SegmentedProvenance; requirements?: RequirementReview; proposalRequirements?: RequirementReview };
export type Analysis = { id: string; profileVersion: string; adapterVersion: string; schemaVersion: string; sourceHash: string; findings: Finding[]; score: ReturnType<typeof calculateScore>; evidenceCount: number };
export type Decision = z.infer<typeof decisionSchema> & { serviceRevision?: number; analysisId: string; actorUid: string; at: string };
export type Review = SegmentedReviewMarker & { sourceBundle?: SourceBundle; evidenceVersion?: 3 | 4 | 5 | 6 | 7; assistanceId?: string; assistanceCount?: number; service?: ServiceRecord; contract?: EvaluationContract; id: string; profileVersion?: ProfileVersion; name: string; fixtureId: typeof fixtureIds[number] | null; sourceKind?: 'fixture' | 'pasted' | 'bundle'; sourceLabel?: string; sourceHash?: string; sourceVersion?: number; sourceCapturedAt?: string; sourceText: string; revision: number; analysis: Analysis | null; decision: Decision | null; published: boolean; createdAt: string; updatedAt: string; job: { id: string; status: 'queued' | 'running' | 'awaiting_review' | 'succeeded' | 'failed' | 'cancelled'; attempt: number; actorUid: string; actorEmail: string; leaseUntil: number; error: string | null } };
export type ReviewEvent = { id: string; action: string; actorUid: string; at: string; revision: number; details: unknown };
export const isPastedReview = (r: Review) => r.sourceKind === 'pasted' || r.sourceKind === 'bundle';
export const findingResolved = (f: Finding) => f.finding !== 'unresolved' && (!f.context?.question || f.context.resolution === 'resolved');
export const reviewedCount = (r: Review) => r.analysis?.findings.filter(f => f.reviewedBy && f.reviewedAt && findingResolved(f)).length || 0;
export const unresolvedCount = (r: Review) => r.analysis?.findings.filter(f => !findingResolved(f)).length || 0;
export const evidenceComplete = (r: Review) => !unresolvedCount(r) && (!isPastedReview(r) || reviewedCount(r) === measuresFor(r).length);
export const currentAnalysis = (r: Review) => r.job.status === 'succeeded' && !!r.analysis && r.analysis.id === r.job.id && evidenceComplete(r);
export function citationsFor(f: Finding | undefined): Citation[] {
  if (!f?.quote || f.start === null || f.end === null) return [];
  return [{ quote: f.quote, start: f.start, end: f.end }, ...(f.additionalEvidence || [])];
}
