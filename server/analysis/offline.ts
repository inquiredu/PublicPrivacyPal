import { ANALYSIS_EXAMPLE } from '../../shared/analysis-example.ts';
import { SUGGESTION_SCHEMA, PRECISION_SUGGESTION_SCHEMA, type ModelOutput, type Suggestion, type PrecisionModelOutput } from '../../shared/assistance.ts';
import type { Measure } from '../../shared/evaluation.ts';
import { roleForStatus, type RequirementStatus } from '../../shared/requirements.ts';
import { sourceHash } from '../evidence.ts';
import type { AnalysisRequest } from './contract.ts';
import { ProviderFailure, zeroUsage, type AnalysisProvider } from './provider.ts';

/** A recorded teaching example, not an extractor and not an accuracy benchmark. */
export function recordedExample(request: AnalysisRequest): ModelOutput {
  if (request.sourceHash !== sourceHash(ANALYSIS_EXAMPLE)) throw new ProviderFailure('not_sent', 'The offline adapter supports only Cedar Intelligence Lab.');
  const definitions: Record<string, [number, Suggestion['state'], string]> = {
    collection: [1, 'supported', 'The source names the only two collected categories.'],
    purpose: [1, 'supported', 'The named collection is for the classroom service.'],
    sale: [2, 'supported', 'The school-account policy explicitly prohibits sale.'],
    deletion: [3, 'partial', 'School deletion is offered, but backup retention has no stated limit.'],
    security: [4, 'supported', 'Transit, storage encryption and employee access restrictions are named.'],
    sharing: [5, 'supported', 'Provider use is restricted to delivery of the classroom service.'],
    contact: [6, 'supported', 'The policy supplies an actionable privacy email.'],
    dc_001: [1, 'supported', 'The source identifies the only two categories collected.'],
    dc_003: [1, 'supported', 'The stated purpose is provision of the classroom service.'],
    dc_004: [1, 'partial', 'Collection is limited to two categories, but necessity for each is not explained.'],
    do_003: [3, 'partial', 'Deletion is offered but completeness is limited by indefinite backups.'],
    do_005: [3, 'partial', 'Schools can request deletion but backup scope remains unresolved.'],
    dr_001: [3, 'partial', 'Backup retention is mentioned, but no actual period is stated.'],
    dr_002: [3, 'partial', 'Deletion is offered, but the backup period is not tied to a stated educational need.'],
    sec_001: [4, 'supported', 'The policy names specific encryption and access safeguards.'],
    sec_002: [4, 'supported', 'TLS 1.2 is specified for transit.'],
    sec_003: [4, 'supported', 'AES-256 is specified for storage.'],
    sec_005: [7, 'partial', 'School-managed accounts are mentioned, but their authentication controls are not described.'],
    tp_001: [5, 'partial', 'Service providers are mentioned as a category, without individual names.'],
    tp_002: [5, 'partial', 'Student information is mentioned without a per-provider list of data categories.'],
    tp_004: [5, 'partial', 'Provider purpose is limited, but equivalent contractual protections are not confirmed.'],
    mon_001: [2, 'supported', 'Sale is explicitly prohibited.'],
    trans_002: [6, 'supported', 'An actionable privacy contact is provided.'],
    trans_001: [1, 'supported', 'The short source uses direct descriptions of the data and its purpose. Read the full source to assess clarity.'],
    child_003: [2, 'partial', 'Student data sale is prohibited, but a broader set of child-specific protections is not described.'],
    child_004: [7, 'partial', 'School-managed accounts are identified, but student age ranges are not stated.'],
    ed_001: [7, 'partial', 'School-account scope is distinguished from consumer terms; a complete separate education terms document is not supplied.'],
    ed_003: [1, 'supported', 'The stated data purpose is provision of the classroom service.'],
  };
  const citations: ModelOutput['citations'] = [];
  const findings = request.measures.map(measureId => {
    const entry = definitions[measureId];
    if (!entry) return { measureId, state: 'not_addressed' as const, citationIds: [], rationale: 'This short fictional source does not explicitly address this measure. This recorded example requires human review.', scope: 'Supplied school-account policy only.', uncertainty: 'missing_statement' as const, question: 'What policy statement or additional source addresses this requirement?' };
    const [line, state, rationale] = entry; const passage = request.source.passages[line]; const id = `c${line}`;
    if (!citations.some(c => c.id === id)) citations.push({ id, sourceId: request.sourceHash, passageId: passage.id, quote: passage.text });
    const deletion = ['deletion', 'do_003', 'do_005', 'dr_001', 'dr_002'].includes(measureId);
    return { measureId, state, citationIds: [id], rationale, scope: 'School-managed accounts only; consumer terms were not evaluated.', uncertainty: state === 'partial' ? deletion ? 'exception' as const : 'ambiguous_wording' as const : 'none' as const, question: state === 'partial' ? deletion ? 'How long are school backup records retained, and can the district require their deletion?' : `What additional school-account policy language resolves this gap? ${rationale}` : '' };
  });
  const important = findings.filter(f => ['deletion', 'do_003'].includes(f.measureId) && f.state === 'partial');
  return { schemaVersion: SUGGESTION_SCHEMA, sourceStatus: 'usable', citations, findings,
    summary: important.slice(0, 1).map(f => ({ text: 'The fictional policy offers deletion, but backup retention remains unresolved for school accounts.', measureIds: [f.measureId] })) };
}
export const offlineProvider: AnalysisProvider = {
  id: 'offline-recording', model: 'cedar-recording', version: '1', settings: { mode: 'recorded-example' }, maxCostMicros: 0, offline: true,
  async generate(request, { attemptId, signal }) {
    signal.throwIfAborted();
    return { status: 'completed', output: request.schemaVersion === PRECISION_SUGGESTION_SCHEMA ? recordedPrecisionExample(request) : { ...recordedExample(request), schemaVersion: request.schemaVersion }, requestId: attemptId, usage: zeroUsage };
  },
};

/** Separately authored recording for the precision pilot. The legacy recording above is frozen. */
export function recordedPrecisionExample(request: AnalysisRequest): PrecisionModelOutput {
  const original = recordedExample(request);
  const facts: Record<string, Record<string, [RequirementStatus, number | null, string]>> = {
    mon_001: { sale: ['established', 2, 'The school policy prohibits student-information sale without a stated exception.'] },
    gov_001: { continuity: ['not_stated', null, 'No corporate-transfer terms.'], notice: ['not_stated', null, 'No transfer-notice terms.'], choice: ['not_stated', null, 'No pre-transfer choice.'] },
    do_003: { active: ['limited', 3, 'Classroom deletion can be requested, but all active personal records are not expressly covered.'], copies: ['limited', 3, 'Backups may remain for an unspecified period; this is not an explicit indefinite-retention commitment.'] },
    do_005: { authority: ['established', 3, 'Schools can request deletion.'], route: ['limited', 3, 'No specific deletion channel is given. The separate privacy contact is for general questions.'] },
    dr_003: { trigger: ['not_stated', null, 'No termination trigger.'], deadline: ['not_stated', null, 'No termination deadline.'], completion: ['limited', 3, 'Retained backups limit disposition completeness.'] },
    sec_002: { transit: ['established', 4, 'The policy specifies TLS 1.2 for transit.'] },
    sec_003: { coverage: ['limited', 4, 'Storage encryption is stated without explicit backup coverage.'], algorithm: ['established', 4, 'The stated storage algorithm is AES-256.'] },
    mon_002: { behavioral: ['not_stated', null, 'No advertising statement.'] }, mon_004: { tracking: ['not_stated', null, 'No cross-context tracking statement.'] },
    tp_001: { names: ['limited', 5, 'Providers are a category, without names.'], purposes: ['limited', 5, 'A general provider purpose is stated without a per-recipient list.'] },
    tp_006: { identification: ['limited', 5, 'Providers are unnamed.'], contract: ['not_stated', null, 'No equivalent-protection contract clause.'], notice: ['not_stated', null, 'No subprocessor change notice.'] },
    child_002: { route: ['not_stated', null, 'No under-13 consent mechanism.'], boundary: ['not_stated', null, 'No school-authorization and parent review statement.'] },
    ed_002: { commitment: ['not_stated', null, 'No FERPA commitment.'], role: ['not_stated', null, 'No asserted FERPA role.'] },
    ed_003: { purpose: ['limited', 1, 'An educational purpose is stated; this does not establish a prohibition on every secondary use.'] },
  };
  const measures = JSON.parse(request.reference).measures as Measure[];
  const citations = [...original.citations];
  const findings: PrecisionModelOutput['findings'] = measures.map(m => {
    if (!m.requirements) return original.findings.find(f => f.measureId === m.id)!;
    return { measureId: m.id, rationale: 'Recorded interpretation of this short synthetic school policy; review every subrequirement.',
      scope: 'School-managed accounts only; consumer terms were not evaluated.', scopeStatus: 'matched', scopeQuestion: '',
      requirements: m.requirements.map(d => {
        const fact = facts[m.id]?.[d.id]; if (!fact) throw new Error('The recording does not cover this requirement.');
        const [status, line, rationale] = fact;
        if (line !== null && !citations.some(c => c.id === `c${line}`)) citations.push({ id: `c${line}`, sourceId: request.sourceHash, passageId: request.source.passages[line].id, quote: request.source.passages[line].text });
        return { id: d.id, status, rationale, question: '', evidence: line === null ? [] : [{ citationId: `c${line}`, role: roleForStatus(status)! }] };
      }) };
  });
  const used = new Set(findings.flatMap(f => 'requirements' in f ? f.requirements.flatMap(r => r.evidence.map(e => e.citationId)) : f.citationIds));
  return { schemaVersion: PRECISION_SUGGESTION_SCHEMA, sourceStatus: 'usable', findings, citations: citations.filter(c => used.has(c.id)) };
}
