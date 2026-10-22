import { publicPolicyUrl } from './public-policy';
import { z } from 'zod';
import { tiers, type TierPolicy } from './service-policy.ts';
import type { Review } from './review.ts';

const text = (max: number) => z.string().trim().max(max).refine(v => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v), 'Use plain text.');
const date = z.union([z.literal(''), z.iso.date()]);
export const serviceValuesSchema = z.object({
  tier: z.enum(tiers), support: z.enum(['Unknown', 'System-wide Support', 'Site/Department Support', 'Not Supported']),
  policyUrl: z.union([z.literal(''), z.url().max(500).refine(v => { const u = new URL(v); return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password; }, 'Use an HTTP(S) policy URL.')]),
  ageGuidance: text(300), communication: z.enum(['unknown', 'yes', 'no']),
  educationVersion: z.enum(['unknown', 'yes', 'no']), educationNotes: text(1000),
  dpaStatus: z.enum(['unknown', 'absent', 'recorded', 'expired', 'not_required']),
  dpaReference: text(300), dpaSigned: date, dpaExpires: date, dpaScope: text(500),
  rostering: z.enum(['unknown', 'none', 'manual', 'automated']), sso: z.enum(['unknown', 'yes', 'no']),
  rosteringNotes: text(500), grades: text(120), curriculum: text(500),
  dataUse: z.enum(['unknown', 'student_data', 'no_student_data']), dataCategories: text(800),
  approvedWhen: text(1500), permissionWhen: text(1500), alternative: text(600),
  governance: text(1000),
}).strict();
export type ServiceValues = z.infer<typeof serviceValuesSchema>;
export type ServiceRecord = { version: 1; revision: number; values: ServiceValues; policy: TierPolicy; settingsRevision: number; updatedAt: string; updatedBy: string; rationale: string };
export const serviceEditSchema = z.object({ values: serviceValuesSchema, rationale: text(1000).refine(Boolean, 'Explain the correction.') }).strict().superRefine(({ values: v }, ctx) => {
  if (v.dpaStatus === 'recorded' && (!v.dpaReference || !v.dpaSigned || !v.dpaScope)) ctx.addIssue({ code: 'custom', message: 'A recorded DPA needs a reference, signed date and scope.' });
  if (v.dpaSigned && v.dpaExpires && v.dpaExpires < v.dpaSigned) ctx.addIssue({ code: 'custom', message: 'DPA expiry must not precede signing.' });
  if (v.dataUse === 'no_student_data' && v.dataCategories) ctx.addIssue({ code: 'custom', message: 'Resolve the conflict between no student data and recorded data categories.' });
});
export function emptyService(): ServiceValues {
  return { tier: 'Pending', support: 'Unknown', policyUrl: '', ageGuidance: '', communication: 'unknown', educationVersion: 'unknown', educationNotes: '', dpaStatus: 'unknown', dpaReference: '', dpaSigned: '', dpaExpires: '', dpaScope: '', rostering: 'unknown', sso: 'unknown', rosteringNotes: '', grades: '', curriculum: '', dataUse: 'unknown', dataCategories: '', approvedWhen: '', permissionWhen: '', alternative: '', governance: '' };
}
/** UTC dates, with expiry inclusive: an agreement expiring today is no longer current. */
export function serviceBlockers(service: ServiceRecord | undefined, today = new Date().toISOString().slice(0, 10)): string[] {
  if (!service) return []; // Preserved practice contracts require explicit adoption.
  const v = service.values; const rule = service.policy.rules[v.tier]; const issues: string[] = [];
  if (v.tier === 'Pending') issues.push('Assign a district tier.');
  if (!v.grades || !v.approvedWhen || !v.governance) issues.push('Record grade scope, permitted-use conditions and the district requirement confirmation.');
  if (v.dataUse === 'unknown' || (v.dataUse === 'student_data' && !v.dataCategories)) issues.push('Confirm student-data involvement and its categories.');
  if (rule.dpa && (v.dpaStatus !== 'recorded' || !v.dpaReference || !v.dpaScope || !v.dpaSigned || v.dpaSigned > today || (!!v.dpaExpires && v.dpaExpires <= today))) issues.push('This tier requires a current, signed DPA with recorded reference and scope.');
  if (rule.rostering && (v.rostering !== 'automated' || v.sso !== 'yes')) issues.push('Confirm automated rostering and SSO for this tier.');
  if (rule.noPersonalData && v.dataUse !== 'no_student_data') issues.push('This tier requires confirmed use without student personal data.');
  if (rule.parentPermission && (!v.permissionWhen || !v.alternative)) issues.push('Record parent-permission conditions and an alternative activity.');
  return issues;
}
export const decisionIsCurrent = (r: Review) => r.job.status === 'succeeded' && !!r.analysis && r.decision?.analysisId === r.analysis.id && (!r.service || r.decision?.serviceRevision === r.service.revision);
/** Used by both the preview and server write; fields are selected individually. */
export function audienceProjection(r: Review, audience: 'public' | 'staff') {
  const d = r.decision;
  if (!d) return null;
  const base = { name: r.name, category: d.category, summary: d.summary, outcome: d.outcome, conditions: d.conditions, reviewedAt: d.at, synthetic: r.sourceKind !== 'pasted' };
  if (!r.service) return base;
  const v = r.service.values;
  const policyUrl = publicPolicyUrl(v.policyUrl);
  const publicFields = { ...base, ...(policyUrl ? { policyUrl } : {}), tierLevel: v.tier, grades: v.grades, dataUse: v.dataUse, dataCategories: v.dataCategories, approvedWhen: v.approvedWhen, permissionWhen: v.permissionWhen, alternative: v.alternative };
  return audience === 'public' ? publicFields : { ...publicFields, support: v.support, ageGuidance: v.ageGuidance, curriculum: v.curriculum, educationVersion: v.educationVersion, educationNotes: v.educationNotes, score: r.analysis?.score.total ?? null, evidenceCount: r.analysis?.evidenceCount ?? 0, measureCount: r.contract?.criteria.filter(c => c.weight > 0).length ?? 8 };
}
