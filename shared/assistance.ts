import { z } from 'zod';
import type { Citation, EvidenceEdit } from './review';
import { requirementStatusSchema, evidenceRoleSchema, type RequirementReview } from './requirements';
import type { SourceCoverage, SegmentCoverage } from './source-bundle';

export const SUGGESTION_SCHEMA = 'policy-suggestions-v2';
export const LEGACY_SUGGESTION_SCHEMA = 'policy-suggestions-v1';
export const PRECISION_SUGGESTION_SCHEMA = 'policy-suggestions-v3';
export const BUNDLE_SUGGESTION_SCHEMA = 'policy-suggestions-v4';
export const findingStates = ['supported', 'partial', 'contradicted', 'not_addressed', 'ambiguous', 'unavailable'] as const;
export const uncertaintyReasons = ['none', 'exception', 'conflict', 'scope', 'missing_statement', 'missing_source', 'ambiguous_wording'] as const;
/** One specification drives instructions, JSON Schema, runtime checks and draft eligibility. */
export const findingRules: Record<typeof findingStates[number], readonly typeof uncertaintyReasons[number][]> = {
  supported: ['none', 'exception'],
  partial: ['none', 'exception', 'scope', 'missing_statement', 'ambiguous_wording'],
  contradicted: ['none', 'exception'],
  not_addressed: ['missing_statement'],
  ambiguous: ['conflict', 'scope', 'ambiguous_wording'],
  unavailable: ['missing_source'],
};
export const questionReasons: readonly typeof uncertaintyReasons[number][] = ['conflict', 'scope', 'missing_statement', 'missing_source', 'ambiguous_wording'];
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const text = (n: number) => z.string().trim().min(1).max(n);
export const suggestionSchema = z.object({
  measureId: id, state: z.enum(findingStates), citationIds: z.array(id).max(3),
  rationale: text(1000), scope: text(400), uncertainty: z.enum(uncertaintyReasons),
  question: z.string().trim().max(500),
}).strict();
export const modelOutputSchema = z.object({
  schemaVersion: z.literal(SUGGESTION_SCHEMA), sourceStatus: z.enum(['usable', 'incomplete', 'unreadable']),
  citations: z.array(z.object({ id, sourceId: z.string().regex(/^[a-f0-9]{64}$/), passageId: id, quote: z.string().min(1).max(2000).refine(s => !!s.trim(), 'A quotation must contain text.') }).strict()).max(150),
  findings: z.array(suggestionSchema).min(1).max(50),
  summary: z.array(z.object({ text: text(500), measureIds: z.array(id).min(1).max(10) }).strict()).max(5),
}).strict();
// Retain the original wire shape for historical reads. New dispatches always use v2.
export const legacyModelOutputSchema = modelOutputSchema.extend({ schemaVersion: z.literal(LEGACY_SUGGESTION_SCHEMA) });
export const precisionFindingSchema = z.object({
  measureId: id, rationale: text(1000), scope: text(400), scopeStatus: z.enum(['matched', 'unresolved']), scopeQuestion: z.string().trim().max(500),
  requirements: z.array(z.object({ id, status: requirementStatusSchema, rationale: text(1000), question: z.string().trim().max(500),
    evidence: z.array(z.object({ citationId: id, role: evidenceRoleSchema }).strict()).max(3),
  }).strict()).min(1).max(8),
}).strict();
export const precisionModelOutputSchema = z.object({ schemaVersion: z.literal(PRECISION_SUGGESTION_SCHEMA), sourceStatus: modelOutputSchema.shape.sourceStatus,
  citations: modelOutputSchema.shape.citations.max(234), findings: z.array(z.union([suggestionSchema, precisionFindingSchema])).min(1).max(50),
}).strict();
export type PrecisionModelOutput = z.infer<typeof precisionModelOutputSchema>;
export const bundleModelOutputSchema = precisionModelOutputSchema.omit({ sourceStatus: true }).extend({
  schemaVersion: z.literal(BUNDLE_SUGGESTION_SCHEMA),
  coverage: z.array(z.object({ passageId: id, status: z.enum(['examined', 'unavailable']) }).strict()).min(1).max(24),
  citations: z.array(modelOutputSchema.shape.citations.element.extend({ documentId: id }).strict()).max(234),
}).strict();
export type BundleModelOutput = z.infer<typeof bundleModelOutputSchema>;
export type ModelOutput = z.infer<typeof modelOutputSchema>;
export type Suggestion = z.infer<typeof suggestionSchema> & { requirements?: RequirementReview };
export type ValidatedSuggestions = Omit<ModelOutput, 'citations' | 'schemaVersion' | 'findings'> & { findings: Suggestion[]; coverage?: SourceCoverage; segments?: SegmentCoverage[]; bundleOutput?: BundleModelOutput; schemaVersion: typeof SUGGESTION_SCHEMA | typeof LEGACY_SUGGESTION_SCHEMA | typeof PRECISION_SUGGESTION_SCHEMA | typeof BUNDLE_SUGGESTION_SCHEMA; citations: (ModelOutput['citations'][number] & Citation & { documentId?: string })[] };
/** Preserve the provider wire contract for immutable storage and later versioned revalidation. */
export function suggestionWireOutput(result: ValidatedSuggestions) {
  if (result.schemaVersion === BUNDLE_SUGGESTION_SCHEMA) {
    if (!result.bundleOutput) throw new Error('Missing original bundle output.');
    return result.bundleOutput;
  }
  const citations = result.citations.map(({ start: _s, end: _e, ...c }) => c);
  if (result.schemaVersion !== PRECISION_SUGGESTION_SCHEMA) return { ...result, citations };
  return { schemaVersion: PRECISION_SUGGESTION_SCHEMA, sourceStatus: result.sourceStatus, citations,
    findings: result.findings.map(f => !f.requirements ? f : ({ measureId: f.measureId, rationale: f.rationale, scope: f.requirements.scope,
      scopeStatus: f.requirements.scopeStatus, scopeQuestion: f.requirements.scopeQuestion,
      requirements: f.requirements.requirements.map(r => ({ id: r.id, status: r.status, rationale: r.rationale, question: r.question,
        evidence: r.citations.map(q => { const c = result.citations.find(c => c.start === q.start && c.end === q.end && c.quote === q.quote); if (!c) throw new Error('Missing stored requirement citation.'); return { citationId: c.id, role: q.role }; }),
      })) })),
  };
}
export function findingStateError(f: Suggestion): string | null {
  if (!findingRules[f.state].includes(f.uncertainty)) return 'Assessment and uncertainty are incompatible.';
  if (questionReasons.includes(f.uncertainty) && !f.question.trim()) return 'Unresolved evidence needs a follow-up question.';
  return null;
}
export type AssistanceStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'unknown' | 'cancelled' | 'stale';
export type AssistanceView = {
  id: string; status: AssistanceStatus; provider: string; model: string; promptVersion: string;
  baseRevision: number; createdAt: string; updatedAt: string; message: string; reused: boolean;
  result: ValidatedSuggestions | null;
};
/** This prepares an editable draft, never a reviewed finding or a district decision. */
export function suggestedEvidence(f: Suggestion, result: ValidatedSuggestions): EvidenceEdit | null {
  const mapping = { supported: 'yes', partial: 'partial', contradicted: 'no', not_addressed: 'not_specified' } as const;
  if (!f.requirements && findingStateError(f)) return null;
  const unavailable = result.coverage ? result.coverage.targets.filter(t => t.target === f.measureId || t.target.startsWith(`${f.measureId}/`)).some(t => !t.ready) : result.sourceStatus !== 'usable';
  return { criterionId: f.measureId, finding: unavailable || f.question || !(f.state in mapping) ? 'unresolved' : mapping[f.state as keyof typeof mapping],
    citations: f.citationIds.slice(0, 3).map(id => { const c = result.citations.find(c => c.id === id)!; return { quote: c.quote, start: c.start, end: c.end }; }),
    ...(f.requirements ? { requirements: f.requirements } : {}),
    rationale: f.rationale, context: { scope: f.scope, uncertainty: f.uncertainty, question: f.question, resolution: 'retained', note: '', citations: [] } };
}
/** An overview of validated states, with no unrestricted model-authored assurance. */
export function suggestionOverview(result: ValidatedSuggestions): string[] {
  return [
    `Source readiness: ${result.sourceStatus}.`,
    ...findingStates.map(state => `${state.replaceAll('_', ' ')}: ${result.findings.filter(f => f.state === state).length}.`),
    `Follow-up questions: ${result.findings.filter(f => f.question).length}. Scope and limitations are shown with each proposal.`,
  ];
}
