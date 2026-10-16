import { serviceEditSchema, type ServiceRecord } from './service.ts';
import type { EvaluationContract } from './evaluation.ts';
import { measuresFor } from './evaluation.ts';
import { z } from 'zod';
import type { calculateScore } from './scoring/engine.ts';
import { criteria, profileVersions, DEFAULT_PROFILE, type ProfileVersion } from './scoring/profiles.ts';
export { criteria } from './scoring/profiles.ts';
export const PROFILE_VERSION = 'community-demo-v1'; // Legacy records without a profile stay on this version.
export const fixtureIds = ['complete', 'gaps', 'retry'] as const;
export const MAX_POLICY_LENGTH = 32000;
export const MAX_REVIEW_IMPORT_BYTES = 2 * 1024 * 1024;
const reviewFields = { serviceSettingsRevision: z.number().int().positive().optional(), name: z.string().trim().min(1).max(120), profileVersion: z.enum(profileVersions).default(DEFAULT_PROFILE) };
export const fixtureReviewSchema = z.object({ ...reviewFields, fixtureId: z.enum(fixtureIds) }).strict();
export const policyTextSchema = z.string().max(MAX_POLICY_LENGTH).refine(s => s.trim().length > 0, 'Paste policy text.').refine(s => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s), 'Use plain text without control characters.').transform(s => s.replace(/\r\n?/g, '\n'));
export const pastedReviewSchema = z.object({ ...reviewFields, sourceKind: z.literal('pasted'), sourceLabel: z.string().trim().min(1).max(160), sourceText: policyTextSchema }).strict();
export const districtReviewSchema = pastedReviewSchema.omit({ profileVersion: true }).extend({ rubricMode: z.literal('district'), settingsRevision: z.number().int().positive(), engineVersion: z.enum(['upstream-weighted-v1', 'evidence-weighted-v1']) }).strict().transform(i => ({ ...i, profileVersion: i.engineVersion === 'upstream-weighted-v1' ? 'community-demo-v1' as const : 'community-evidence-v1' as const }));
export const createReviewSchema = z.union([fixtureReviewSchema, pastedReviewSchema, districtReviewSchema]);
export const citationSchema = z.object({ quote: z.string().min(1).max(2000), start: z.number().int().min(0), end: z.number().int().positive() }).strict();
export type Citation = z.infer<typeof citationSchema>;
export const evidenceEditSchema = z.object({
  criterionId: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/),
  finding: z.enum(['yes', 'no', 'partial', 'not_specified']), citations: z.array(citationSchema).max(3),
  rationale: z.string().trim().min(1).max(1000),
}).strict();
export type EvidenceEdit = z.infer<typeof evidenceEditSchema>;
export const decisionSchema = z.object({ outcome: z.enum(['approved', 'conditional', 'declined']), rationale: z.string().trim().min(1).max(2000), conditions: z.string().trim().max(1500), summary: z.string().trim().min(1).max(1000), category: z.string().trim().min(1).max(80) }).strict().refine(d => d.outcome !== 'conditional' || d.conditions.length > 0, 'Conditions are required.');
export const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('adopt_service'), revision: z.number().int().positive(), settingsRevision: z.number().int().positive() }).strict(),
  z.object({ action: z.literal('edit_service'), revision: z.number().int().positive(), service: serviceEditSchema }).strict(),
  z.object({ action: z.literal('decide'), revision: z.number().int().positive(), decision: decisionSchema }).strict(),
  z.object({ action: z.literal('edit_evidence'), revision: z.number().int().positive(), evidence: evidenceEditSchema }).strict(),
  ...(['publish', 'unpublish', 'retry', 'reanalyze', 'cancel'] as const).map(action => z.object({ action: z.literal(action), revision: z.number().int().positive() }).strict()),
]);
export const findingSchema = z.object({ id: z.string(), finding: z.enum(['yes', 'no', 'partial', 'not_specified']), quote: z.string().max(2000), start: z.number().int().min(0).nullable(), end: z.number().int().min(0).nullable() }).strict();
export type Finding = z.infer<typeof findingSchema> & { additionalEvidence?: Citation[]; rationale?: string; reviewedBy?: string; reviewedAt?: string };
export type Analysis = { id: string; profileVersion: string; adapterVersion: string; schemaVersion: string; sourceHash: string; findings: Finding[]; score: ReturnType<typeof calculateScore>; evidenceCount: number };
export type Decision = z.infer<typeof decisionSchema> & { serviceRevision?: number; analysisId: string; actorUid: string; at: string };
export type Review = { service?: ServiceRecord; contract?: EvaluationContract; id: string; profileVersion?: ProfileVersion; name: string; fixtureId: typeof fixtureIds[number] | null; sourceKind?: 'fixture' | 'pasted'; sourceLabel?: string; sourceHash?: string; sourceVersion?: number; sourceCapturedAt?: string; sourceText: string; revision: number; analysis: Analysis | null; decision: Decision | null; published: boolean; createdAt: string; updatedAt: string; job: { id: string; status: 'queued' | 'running' | 'awaiting_review' | 'succeeded' | 'failed' | 'cancelled'; attempt: number; actorUid: string; actorEmail: string; leaseUntil: number; error: string | null } };
export type ReviewEvent = { id: string; action: string; actorUid: string; at: string; revision: number; details: unknown };
export const isPastedReview = (r: Review) => r.sourceKind === 'pasted';
export const reviewedCount = (r: Review) => r.analysis?.findings.filter(f => f.reviewedBy && f.reviewedAt).length || 0;
export const evidenceComplete = (r: Review) => !isPastedReview(r) || reviewedCount(r) === measuresFor(r).length;
export const currentAnalysis = (r: Review) => r.job.status === 'succeeded' && !!r.analysis && r.analysis.id === r.job.id && evidenceComplete(r);
export function citationsFor(f: Finding | undefined): Citation[] {
  if (!f?.quote || f.start === null || f.end === null) return [];
  return [{ quote: f.quote, start: f.start, end: f.end }, ...(f.additionalEvidence || [])];
}
