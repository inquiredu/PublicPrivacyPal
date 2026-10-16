import { z } from 'zod';
import { tierPolicySchema } from './service-policy.ts';
import { tiers, type Tier } from './service-policy.ts';
export { tiers, type Tier } from './service-policy.ts';
import pef from './settings/pef-example.json';

// Adapted from PrivacyPal SetupWizard/LibraryDesignWizard at adad00a (AGPL-3.0-only).
// These examples are configuration choices, not claims of certification or legal sufficiency.
export const SETTINGS_DEFINITION_VERSION = 'district-setup-examples-v1';
export const evaluationAreas = pef.evaluationAreas;
export const priorityOptions = [
  { label: 'Disabled', value: 0 }, { label: 'Low', value: 0.5 },
  { label: 'Standard', value: 1 }, { label: 'High', value: 1.5 }, { label: 'Critical', value: 2 },
] as const;
export const states = ['Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware', 'District of Columbia', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'] as const;
export const standards = [
  { id: '1edtech', name: '1EdTech App Vetting Rubric', description: 'Data collection, security, sharing, and user rights.' },
  { id: 'commonsense', name: 'Common Sense Media Privacy Principles', description: 'Privacy, safety, security, and equity.' },
  { id: 'iste', name: 'ISTE Standards for Students', description: 'Digital citizenship and responsible technology use.' },
  { id: 'student_privacy_pledge', name: 'Student Privacy Pledge', description: 'Transparency and responsible stewardship of student information.' },
  { id: 'gdpr_framework', name: 'GDPR Compliance Framework', description: 'Purposes, consent, data minimization, and individual rights.' },
  { id: 'accessibility_security', name: 'Accessibility & Security Baseline', description: 'Accessibility, safeguards, and incident response.' },
] as const;
export const laws = [
  { id: 'ferpa', name: 'FERPA', description: 'A reference for education-record review.' },
  { id: 'coppa', name: 'COPPA', description: 'A reference for children’s online privacy review.' },
  { id: 'ppra', name: 'PPRA', description: 'A reference for student survey and privacy review.' },
  { id: 'example-state-privacy', name: 'Example State Student Privacy Law', description: 'Fictional state-law entry for testing selection. Not an actual law.' },
] as const;
const plainText = (max: number) => z.string().trim().max(max).refine(s => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s), 'Use plain text without control characters.');
const selections = (ids: readonly string[]) => z.array(z.string().refine(s => ids.includes(s), 'Unknown selection.')).max(ids.length).refine(a => new Set(a).size === a.length, 'Duplicate selection.').transform(a => a.sort());
const priority = z.union([z.literal(0), z.literal(0.5), z.literal(1), z.literal(1.5), z.literal(2)]);
export const evaluationSettingsSchema = z.object({
  sector: z.literal('Education (K-12)'), state: z.enum(['', ...states]).refine((s): boolean => s !== '', 'Select your state.'),
  evaluationStandards: selections(standards.map(s => s.id)),
  laws: selections(laws.map(l => l.id)).refine(a => a.length > 0, 'Select at least one law reference.'),
  customEvaluationContext: plainText(6000), districtMission: plainText(4000), strategicPlan: plainText(12000),
  tierPolicy: tierPolicySchema.optional(),
  starterProfile: z.enum(['pef-2.0', 'none']), evaluationWeights: z.record(z.string(), priority),
}).strict().superRefine((s, ctx) => {
  const keys = Object.keys(s.evaluationWeights);
  if (s.starterProfile === 'none') {
    if (keys.length) ctx.addIssue({ code: 'custom', path: ['evaluationWeights'], message: 'A profile deferred until later cannot include weights.' });
  } else if (keys.length !== evaluationAreas.length || evaluationAreas.some(a => !keys.includes(a.id))) {
    ctx.addIssue({ code: 'custom', path: ['evaluationWeights'], message: 'Provide a priority for every known evaluation area.' });
  } else if (!Object.values(s.evaluationWeights).some(v => v > 0)) {
    ctx.addIssue({ code: 'custom', path: ['evaluationWeights'], message: 'Keep at least one evaluation area enabled, or choose measures later.' });
  }
}).transform(s => ({ ...s, evaluationWeights: Object.fromEntries(evaluationAreas.filter(a => a.id in s.evaluationWeights).map(a => [a.id, s.evaluationWeights[a.id]])) }));
export type EvaluationSettings = z.infer<typeof evaluationSettingsSchema>;
export function defaultWeights(): EvaluationSettings['evaluationWeights'] { return Object.fromEntries(evaluationAreas.map(a => [a.id, a.weight === 'critical' ? 2 : 1])); }
export function defaultEvaluation(): EvaluationSettings {
  return { sector: 'Education (K-12)', state: '', evaluationStandards: ['1edtech', 'student_privacy_pledge', 'accessibility_security'], laws: ['ferpa', 'coppa', 'ppra'], customEvaluationContext: '', districtMission: '', strategicPlan: '', starterProfile: 'pef-2.0', evaluationWeights: defaultWeights() };
}

export const DEFAULT_NOTICE = 'This local practice library contains fictional examples. It does not represent official district approvals.';
export const DEFAULT_FOOTER = [
  { id: 'questions', heading: 'Questions about a resource', body: 'Contact {email} for information about this practice library.' },
  { id: 'examples', heading: 'About these examples', body: 'All examples in this local sandbox are synthetic. Review your district’s guidance before using a real service.' },
];
export const MAX_LOGO_BYTES = 100_000;
export const logoSchema = z.string().max(134000).refine(s => s === '' || /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(s), 'Use a PNG, JPEG, or WebP logo under 100 KB.');
export const librarySettingsSchema = z.object({
  title: plainText(120).refine(s => s.length > 0, 'Enter a library title.'), logo: logoSchema,
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a six-digit hex color.').transform(s => s.toLowerCase()),
  customDisclaimer: plainText(4000),
  contactEmail: z.union([z.literal(''), z.email().max(200).toLowerCase().refine(s => /\.(example|test)$/.test(s), 'Use a synthetic .example or .test address in this sandbox.')]),
  footerHeading: plainText(120),
  footerSections: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9-]{1,60}$/), heading: plainText(120).refine(s => !!s, 'Enter a section heading.'), body: plainText(2000).refine(s => !!s, 'Enter section text.') }).strict()).max(8).refine(a => new Set(a.map(s => s.id)).size === a.length, 'Footer IDs must be unique.'),
  defaultViewMode: z.enum(['cards', 'compact']), defaultSortMode: z.enum(['library_order', 'name_asc', 'tier_asc']),
  defaultFilterTier: z.union([z.literal('all'), z.enum(tiers)]),
}).strict();
export type LibrarySettings = z.infer<typeof librarySettingsSchema>;
export function defaultLibrary(districtName: string): LibrarySettings {
  return { title: `${districtName} — Digital Resource Library`.slice(0, 120), logo: '', themeColor: '#0284c7', customDisclaimer: '', contactEmail: '', footerHeading: 'Important information', footerSections: structuredClone(DEFAULT_FOOTER), defaultViewMode: 'cards', defaultSortMode: 'library_order', defaultFilterTier: 'all' };
}
export type SavedSettings<T> = { schemaVersion: 1; revision: number; complete: boolean; values: T; updatedAt: string | null; updatedBy: string | null; definitionVersion: string; contentHash: string | null };
export const settingsCommandSchema = z.discriminatedUnion('section', [
  z.object({ section: z.literal('evaluation'), revision: z.number().int().nonnegative(), values: evaluationSettingsSchema }).strict(),
  z.object({ section: z.literal('library'), revision: z.number().int().nonnegative(), values: librarySettingsSchema }).strict(),
]);
export function initialSettings<T>(values: T): SavedSettings<T> {
  return { schemaVersion: 1, revision: 0, complete: false, values, updatedAt: null, updatedBy: null, definitionVersion: SETTINGS_DEFINITION_VERSION, contentHash: null };
}
/** Explicit field projection: never expose settings attribution, evaluation context or history. */
export function publicLibrarySettings(s: LibrarySettings): LibrarySettings {
  return librarySettingsSchema.parse({ title: s.title, logo: s.logo, themeColor: s.themeColor, customDisclaimer: s.customDisclaimer, contactEmail: s.contactEmail, footerHeading: s.footerHeading, footerSections: s.footerSections.map(f => ({ id: f.id, heading: f.heading, body: f.body })), defaultViewMode: s.defaultViewMode, defaultSortMode: s.defaultSortMode, defaultFilterTier: s.defaultFilterTier });
}
export function accentText(color: string): '#000000' | '#ffffff' {
  if (!/^#[a-f\d]{6}$/i.test(color)) return '#ffffff';
  const c = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16) / 255).map(v => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  const luminance = c[0] * .2126 + c[1] * .7152 + c[2] * .0722;
  return (luminance + .05) / .05 >= 1.05 / (luminance + .05) ? '#000000' : '#ffffff';
}
export type LibraryProfile = { grades?: string; dataUse?: string; dataCategories?: string; approvedWhen?: string; permissionWhen?: string; alternative?: string; support?: string; ageGuidance?: string; curriculum?: string; educationVersion?: string; educationNotes?: string; score?: number | null; evidenceCount?: number; measureCount?: number; reviewedAt?: string; id: string; name: string; summary: string; category: string; tierLevel?: Tier; sortOrder?: number; synthetic?: boolean; outcome?: string; conditions?: string };
export function visibleProfiles(profiles: LibraryProfile[], search: string, tier: string, sort: LibrarySettings['defaultSortMode']) {
  return profiles.filter(p => `${p.name} ${p.category} ${p.summary}`.toLowerCase().includes(search.toLowerCase()) && (tier === 'all' || (p.tierLevel || 'Pending') === tier)).sort((a, b) => {
    const primary = sort === 'tier_asc' ? tiers.indexOf(a.tierLevel || 'Pending') - tiers.indexOf(b.tierLevel || 'Pending') : sort === 'library_order' ? (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER) : 0;
    return primary || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}
