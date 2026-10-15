import { z } from 'zod';
import type { calculateScore } from './scoring/engine.ts';
import { profileVersions, DEFAULT_PROFILE, type ProfileVersion } from './scoring/profiles.ts';
export { criteria } from './scoring/profiles.ts';
export const PROFILE_VERSION = 'community-demo-v1'; // Legacy records without a profile stay on this version.
export const fixtureIds = ['complete', 'gaps', 'retry'] as const;
export const createReviewSchema = z.object({ name: z.string().trim().min(1).max(120), fixtureId: z.enum(fixtureIds), profileVersion: z.enum(profileVersions).default(DEFAULT_PROFILE) }).strict();
export const decisionSchema = z.object({ outcome: z.enum(['approved', 'conditional', 'declined']), rationale: z.string().trim().min(1).max(2000), conditions: z.string().trim().max(1500), summary: z.string().trim().min(1).max(1000), category: z.string().trim().min(1).max(80) }).strict().refine(d => d.outcome !== 'conditional' || d.conditions.length > 0, 'Conditions are required.');
export const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('decide'), revision: z.number().int().positive(), decision: decisionSchema }).strict(),
  ...(['publish', 'unpublish', 'retry', 'reanalyze', 'cancel'] as const).map(action => z.object({ action: z.literal(action), revision: z.number().int().positive() }).strict()),
]);
export const findingSchema = z.object({ id: z.string(), finding: z.enum(['yes', 'no', 'partial', 'not_specified']), quote: z.string().max(2000), start: z.number().int().min(0).nullable(), end: z.number().int().min(0).nullable() }).strict();
export type Finding = z.infer<typeof findingSchema>;
export type Analysis = { id: string; profileVersion: string; adapterVersion: string; schemaVersion: string; sourceHash: string; findings: Finding[]; score: ReturnType<typeof calculateScore>; evidenceCount: number };
export type Decision = z.infer<typeof decisionSchema> & { analysisId: string; actorUid: string; at: string };
export type Review = { id: string; profileVersion?: ProfileVersion; name: string; fixtureId: typeof fixtureIds[number]; sourceText: string; revision: number; analysis: Analysis | null; decision: Decision | null; published: boolean; createdAt: string; updatedAt: string; job: { id: string; status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'; attempt: number; actorUid: string; actorEmail: string; leaseUntil: number; error: string | null } };
export type ReviewEvent = { id: string; action: string; actorUid: string; at: string; revision: number; details: unknown };
