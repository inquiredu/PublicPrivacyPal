import { z } from 'zod';
import type { Requirement } from './rubrics/precision-candidate';
export type { Requirement } from './rubrics/precision-candidate';
export const PRECISION_PROFILE = 'pef-precision-v1';
export const PRECISION_DEFINITION = 'pef-precision-snapshot-v1';
export const REQUIREMENT_VERSION = 'requirements-v1';
export const requirementStatusSchema = z.enum(['established', 'limited', 'opposed', 'not_stated', 'ambiguous', 'unavailable']);
export const evidenceRoleSchema = z.enum(['support', 'limitation', 'opposition', 'conflict']);
export type RequirementStatus = z.infer<typeof requirementStatusSchema>;
export const requirementReviewSchema = z.object({
  version: z.literal(REQUIREMENT_VERSION), scope: z.string().trim().min(1).max(400),
  sourceStatus: z.enum(['usable', 'incomplete', 'unreadable']),
  scopeStatus: z.enum(['matched', 'unresolved']), scopeQuestion: z.string().trim().max(500),
  requirements: z.array(z.object({
    id: z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/), status: requirementStatusSchema,
    rationale: z.string().trim().min(1).max(1000), question: z.string().trim().max(500),
    citations: z.array(z.object({ quote: z.string().min(1).max(2000), start: z.number().int().nonnegative(), end: z.number().int().positive(), role: evidenceRoleSchema }).strict()).max(3),
  }).strict()).min(1).max(8),
}).strict();
export type RequirementReview = z.infer<typeof requirementReviewSchema>;
export const requirementDraftSchema = requirementReviewSchema.extend({ scope: z.string().max(400), requirements: z.array(requirementReviewSchema.shape.requirements.element.extend({ rationale: z.string().max(1000) })).min(1).max(8) });
export function requirementCitations(review: RequirementReview) {
  const seen = new Set<string>();
  return review.requirements.flatMap(r => r.citations).filter(c => { const key = `${c.start}:${c.end}`; if (seen.has(key)) return false; seen.add(key); return true; }).map(({ role: _, ...c }) => c);
}
export function deriveRequirementReview(definitions: Requirement[], review: RequirementReview) {
  return deriveRequirements(definitions, review.requirements, review.scopeStatus, review.sourceStatus === 'usable' ? [] : definitions.map(d => d.id));
}
export const roleForStatus = (status: RequirementStatus) => ({ established: 'support', limited: 'limitation', opposed: 'opposition' } as Partial<Record<RequirementStatus, z.infer<typeof evidenceRoleSchema>>>)[status];
export function requirementReviewError(definitions: Requirement[], review: RequirementReview): string | null {
  const ids = review.requirements.map(r => r.id);
  if (ids.length !== definitions.length || new Set(ids).size !== ids.length || ids.some(id => !definitions.some(d => d.id === id))) return 'Review every adopted subrequirement exactly once.';
  if ((review.scopeStatus === 'unresolved') !== !!review.scopeQuestion.trim()) return 'Unresolved scope needs a question; matched scope must have none.';
  for (const r of review.requirements) {
    if (['ambiguous', 'unavailable'].includes(r.status) !== !!r.question.trim()) return 'Only unresolved subrequirements have clarification questions, and each needs one.';
    if (r.status === 'not_stated' && r.citations.length) return 'Confirmed silence cannot have a quotation.';
    const role = roleForStatus(r.status);
    if (role && !r.citations.some(c => c.role === role)) return 'Attach evidence with the required support, limitation or opposition role.';
    if (r.status === 'ambiguous' && !r.citations.length) return 'Cite the passages causing ambiguity.';
  }
  return null;
}
/** Versioned rule from the precision candidate. Interpretation of text remains a review task. */
export function deriveRequirements(definitions: Requirement[], facts: { id: string; status: RequirementStatus }[], scopeStatus: 'matched' | 'unresolved', missing: string[] = []) {
  if (facts.length !== definitions.length || new Set(facts.map(f => f.id)).size !== facts.length || facts.some(f => !definitions.some(d => d.id === f.id))) throw new Error('Subrequirement coverage mismatch.');
  const unresolved = facts.filter(f => missing.includes(f.id) || ['ambiguous', 'unavailable'].includes(f.status)).map(f => f.id);
  const establishedFailures = facts.filter(f => f.status === 'opposed' && definitions.find(d => d.id === f.id)!.decisive).map(f => f.id);
  const state = unresolved.length || scopeStatus === 'unresolved' ? 'unresolved'
    : establishedFailures.length || facts.every(f => ['opposed', 'not_stated'].includes(f.status)) && facts.some(f => f.status === 'opposed') ? 'contradicted'
    : facts.every(f => f.status === 'established') ? 'supported'
    : facts.every(f => f.status === 'not_stated') ? 'not_addressed' : 'partial';
  return { state, unresolved, establishedFailures, scopeStatus } as const;
}
export const requirementFinding = (state: ReturnType<typeof deriveRequirements>['state']) => ({ supported: 'yes', partial: 'partial', contradicted: 'no', not_addressed: 'not_specified', unresolved: 'unresolved' } as const)[state];
export function blankRequirementReview(definitions: Requirement[], scope = 'School-managed K-12 student personal information.'): RequirementReview {
  return { version: REQUIREMENT_VERSION, sourceStatus: 'usable', scope, scopeStatus: 'unresolved', scopeQuestion: 'Confirm that the supplied terms cover this school use.',
    requirements: definitions.map(d => ({ id: d.id, status: 'unavailable', rationale: 'Review pending.', question: 'Review the applicable source for this requirement.', citations: [] })) };
}
