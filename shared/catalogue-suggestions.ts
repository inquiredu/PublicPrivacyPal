import { z } from 'zod';
import { tiers } from './service-policy';
export const CATALOGUE_SUGGESTION_LIMIT = 1000;
export const CATALOGUE_SUGGESTION_PAGE = 10;
const optionalText = z.string().max(5000).optional();
// Only published staff fields can be rendered; unknown fields are stripped.
export const staffSuggestionSchema = z.object({
  id: z.string().min(1).max(128), name: z.string().min(1).max(120), summary: z.string().max(5000), category: z.string().max(120),
  tierLevel: z.enum(tiers).optional(), conditions: optionalText, approvedWhen: optionalText,
  permissionWhen: optionalText, alternative: optionalText, grades: optionalText, dataUse: optionalText,
  dataCategories: optionalText, support: optionalText, ageGuidance: optionalText, curriculum: optionalText,
  educationNotes: optionalText, reviewedAt: optionalText, policyUrl: optionalText,
});
export type StaffSuggestion = z.infer<typeof staffSuggestionSchema>;
export const catalogueName = (value: string) => value.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
/** Literal normalized name hints, never identity matching or permission to use a service. */
export function catalogueSuggestions(entries: StaffSuggestion[], name: string) {
  if (entries.length > CATALOGUE_SUGGESTION_LIMIT) throw new Error('Catalogue exceeds the supported suggestion limit.');
  const search = catalogueName(name);
  if (!search) return [];
  return entries.filter(p => catalogueName(p.name).includes(search)).sort((a, b) =>
    Number(catalogueName(b.name) === search) - Number(catalogueName(a.name) === search)
    || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}
