import { humanSourceReviewSchema } from './source-segments.ts';
import { requirementDraftSchema } from './requirements';
import { z } from 'zod';
import { serviceValuesSchema } from './service';
import { citationSchema, reviewContextSchema, MAX_POLICY_LENGTH } from './review';
import { profileVersions } from './scoring/profiles';
import { sourceBundleDraftSchema } from './source-bundle';
import { captureDefinitionsSchema } from './capture-definitions';
export const captureDraftSchema = z.object({ captureDefinitions: captureDefinitionsSchema.optional(), completeService: z.boolean().optional(), serviceSettingsRevision: z.number().int().positive().optional(), rubricMode: z.enum(['practice','district']).optional(), settingsRevision: z.number().int().positive().optional(), sourceBundle: sourceBundleDraftSchema.optional(), sourceKind: z.enum(['pasted','fixture','bundle']), name: z.string().max(120), sourceLabel: z.string().max(160), sourceText: z.string().max(MAX_POLICY_LENGTH), fixtureId: z.enum(['complete','gaps','retry']), profileVersion: z.enum(profileVersions) }).strict();
export const decisionDraftSchema = z.object({ revision: z.number().int().positive(), values: z.object({ outcome: z.enum(['approved','conditional','declined']), rationale: z.string().max(2000), conditions: z.string().max(1500), summary: z.string().max(1000), category: z.string().max(80) }).strict() }).strict();
export const evidenceDraftSchema = z.object({ sourceReview: humanSourceReviewSchema.optional(), revision: z.number().int().positive(), criterionId: z.string(), finding: z.enum(['','yes','no','partial','not_specified','unresolved']), citations: z.array(citationSchema).max(9), requirements: requirementDraftSchema.optional(), rationale: z.string().max(1000), quoteText: z.string().max(2000), context: reviewContextSchema.optional(), proposalId: z.uuid().optional() }).strict();

export const serviceDraftSchema = z.object({ revision: z.number().int().positive(), values: serviceValuesSchema, rationale: z.string().max(1000) }).strict();
