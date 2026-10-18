import { z } from 'zod';
import { digest } from '../evaluation.ts';
import { sourceHash } from '../evidence.ts';
import type { AnalysisRequest, Passage } from './contract.ts';
import { measuresFor, type EvaluationContract, type Measure } from '../../shared/evaluation.ts';
import { precisionModelOutputSchema, PRECISION_SUGGESTION_SCHEMA, findingStateError, type Suggestion, type ValidatedSuggestions } from '../../shared/assistance.ts';
import { deriveRequirementReview, requirementReviewError, REQUIREMENT_VERSION, type RequirementReview } from '../../shared/requirements.ts';

export const PRECISION_PROMPT_VERSION = 'evidence-extraction-v3';
export function buildPrecisionRequest(source: string, contract: EvaluationContract, passages: Passage[], baseInstructions: string): AnalysisRequest {
  const measures = measuresFor({ contract });
  if (!measures.length || measures.length > 50 || new Set(measures.map(m => m.id)).size !== measures.length) throw new Error('Invalid adopted measures.');
  const instructions = `${baseInstructions}
For measures with subrequirements, use the requirement output shape instead of an aggregate finding. Return every adopted subrequirement exactly once; do not supply an aggregate state, score or summary. For the remaining measures, use the ordinary finding shape and its state/uncertainty rules.
Requirement states: established means the proposition is supported; limited means its defined limitation applies; opposed means its defined opposing condition applies; not_stated means no relevant statement in the supplied complete source; ambiguous means unresolved meaning, conflict or applicability; unavailable means missing required evidence. Give exact supporting, limiting and opposing evidence with their roles. Never infer silence from an absent annex. A source-status claim is unverified model input; a human must review source completeness.
Keep account/product/jurisdiction scope. scopeStatus unresolved requires a scopeQuestion; matched scope requires an empty scopeQuestion. Requirement questions are required for ambiguous/unavailable and empty otherwise. Explicit opposing text needs no invented uncertainty. Missing or ambiguous requirements block an overall assurance. Decisive failures remain visible even when another requirement is unresolved.
Quote integrity cannot establish semantic support. Transit does not prove storage encryption; advertising restrictions do not establish tracking restrictions; a protected corporate transfer does not establish commercial sale. Legal references and roles are policy assertions only. Read each measure's decisionRule and all subrequirements. Return only the supplied JSON schema, with no summary.`;
  const reference = JSON.stringify({ measures, districtGuidance: contract.context?.customEvaluationContext || '',
    lawReferences: contract.context?.laws || [], standardReferences: contract.context?.evaluationStandards || [],
    requirementVersion: REQUIREMENT_VERSION, sourceCoverage: 'Single supplied text only; no linked-document completeness certification.',
    referenceNote: 'Reference names are context, not source evidence or a legal requirements corpus.' });
  const input = { sourceHash: sourceHash(source), definitionHash: contract.id, promptVersion: PRECISION_PROMPT_VERSION,
    schemaVersion: PRECISION_SUGGESTION_SCHEMA, instructions, reference, source: { id: sourceHash(source), passages },
    schema: z.toJSONSchema(precisionModelOutputSchema), measures: measures.map(m => m.id) };
  return { key: digest(input), ...input };
}
export function validatePrecision(request: AnalysisRequest, source: string, raw: unknown): ValidatedSuggestions {
  if (request.schemaVersion !== PRECISION_SUGGESTION_SCHEMA) throw new Error('Prompt/schema version mismatch.');
  const parsed = precisionModelOutputSchema.parse(typeof raw === 'string' ? JSON.parse(raw) : raw);
  const measures = JSON.parse(request.reference).measures as Measure[];
  const ids = parsed.findings.map(f => f.measureId);
  if (ids.length !== request.measures.length || new Set(ids).size !== ids.length || ids.some(id => !request.measures.includes(id))) throw new Error('Missing, duplicate or unknown enabled measure.');
  const ranges = new Set<string>(), citationIds = new Set<string>();
  const citations = parsed.citations.map(c => {
    if (citationIds.has(c.id)) throw new Error('Duplicate citation ID.'); citationIds.add(c.id);
    const passage = request.source.passages.find(p => p.id === c.passageId);
    if (c.sourceId !== request.sourceHash || !passage || source.slice(passage.start, passage.end) !== passage.text) throw new Error('Citation source or passage mismatch.');
    const index = passage.text.indexOf(c.quote);
    if (index < 0 || passage.text.indexOf(c.quote, index + 1) !== -1) throw new Error('Quotation is missing or ambiguous within its passage.');
    const start = passage.start + index, end = start + c.quote.length, key = `${start}:${end}`;
    if (ranges.has(key)) throw new Error('Duplicate citation range; share its citation ID.'); ranges.add(key);
    return { ...c, start, end };
  });
  const used = new Set<string>();
  function refs(ids: string[]) {
    if (new Set(ids).size !== ids.length || ids.some(id => !citationIds.has(id))) throw new Error('Invalid finding citation reference.');
    ids.forEach(id => used.add(id));
  }
  const findings: Suggestion[] = request.measures.map(id => {
    const f = parsed.findings.find(f => f.measureId === id)!, measure = measures.find(m => m.id === id)!;
    if (!measure?.requirements) {
      if ('requirements' in f) throw new Error('This measure has no adopted subrequirements.');
      refs(f.citationIds);
      const error = findingStateError(f); if (error) throw new Error(error);
      if (['supported', 'partial', 'contradicted'].includes(f.state) && !f.citationIds.length) throw new Error('An interpreted commitment needs exact evidence.');
      if (['not_addressed', 'unavailable'].includes(f.state) && f.citationIds.length) throw new Error('An omission or unavailable source cannot claim a quotation.');
      if (f.state === 'not_addressed' && parsed.sourceStatus !== 'usable') throw new Error('Only a usable source can support a policy omission.');
      if (parsed.sourceStatus === 'unreadable' && f.state !== 'unavailable') throw new Error('Unreadable source cannot support findings.');
      return f;
    }
    if (!('requirements' in f)) throw new Error('The adopted measure requires subrequirement output.');
    const review: RequirementReview = { version: REQUIREMENT_VERSION, sourceStatus: parsed.sourceStatus, scope: f.scope, scopeStatus: f.scopeStatus, scopeQuestion: f.scopeQuestion,
      requirements: f.requirements.map(r => {
        refs(r.evidence.map(e => e.citationId));
        if (r.status === 'not_stated' && parsed.sourceStatus !== 'usable') throw new Error('Missing evidence is not policy silence.');
        if (parsed.sourceStatus === 'unreadable' && (r.status !== 'unavailable' || r.evidence.length)) throw new Error('Unreadable source cannot support findings.');
        return { id: r.id, status: r.status, rationale: r.rationale, question: r.question, citations: r.evidence.map(e => {
          const c = citations.find(c => c.id === e.citationId)!; return { quote: c.quote, start: c.start, end: c.end, role: e.role };
        }) };
      }) };
    const error = requirementReviewError(measure.requirements, review); if (error) throw new Error(error);
    const result = deriveRequirementReview(measure.requirements, review);
    const missing = parsed.sourceStatus !== 'usable' || review.requirements.some(r => r.status === 'unavailable');
    const scope = review.scopeStatus === 'unresolved';
    const state = result.state === 'unresolved' ? missing ? 'unavailable' : 'ambiguous' : result.state;
    return { measureId: id, rationale: f.rationale, scope: f.scope, state,
      uncertainty: result.state !== 'unresolved' ? 'none' : missing ? 'missing_source' : scope ? 'scope' : 'ambiguous_wording',
      question: result.state !== 'unresolved' ? '' : parsed.sourceStatus !== 'usable' ? 'Capture the complete applicable source in a new review.' : f.scopeQuestion || review.requirements.find(r => r.question)!.question,
      citationIds: [...new Set(f.requirements.flatMap(r => r.evidence.map(e => e.citationId)))], requirements: review };
  });
  if (used.size !== citationIds.size) throw new Error('Unreferenced citation.');
  return { schemaVersion: PRECISION_SUGGESTION_SCHEMA, sourceStatus: parsed.sourceStatus, citations, findings, summary: [] };
}
