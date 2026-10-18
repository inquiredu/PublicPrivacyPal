import { validateSuggestions, type AnalysisRequest } from './contract.ts';
import { usageSchema } from './provider.ts';
import type { Suggestion } from '../../shared/assistance.ts';

export type BenchmarkCase = { id: string; source: string; expected: Suggestion['state']; evidence: string[]; request: AnalysisRequest };
export type BenchmarkObservation = { caseId: string; output: unknown; elapsedMs?: number; usage?: unknown };
/** Grades supplied outputs; never calls a provider or judges semantic support with another model. */
export function gradeObservations(cases: BenchmarkCase[], observations: BenchmarkObservation[]) {
  if (cases.some(c => c.request.measures.length !== 1)) throw new Error('This legacy benchmark supports one measure per case. Use a per-requirement benchmark for multi-measure output.');
  const seen = new Set<string>();
  const rows = observations.map(o => {
    const c = cases.find(c => c.id === o.caseId);
    if (!c || seen.has(o.caseId)) throw new Error('Unknown or duplicate benchmark case. Use a separate report for each repeated run.');
    seen.add(o.caseId);
    let valid = false, correct = false, evidenceCovered = false, falseAssurance = false;
    let predicted = 'invalid';
    try {
      const result = validateSuggestions(c.request, c.source, o.output); valid = true;
      const f = result.findings[0]; predicted = f.state; correct = f.state === c.expected;
      const quoted = f.citationIds.map(id => result.citations.find(q => q.id === id)!.quote).join('\n');
      evidenceCovered = c.evidence.every(e => quoted.includes(e));
      falseAssurance = f.state === 'supported' && c.expected !== 'supported';
    } catch { /* Invalid output is a failed case, never an omission. */ }
    const usage = usageSchema.safeParse(o.usage);
    return { caseId: c.id, expected: c.expected, predicted, valid, correct, evidenceCovered, falseAssurance,
      elapsedMs: typeof o.elapsedMs === 'number' && Number.isFinite(o.elapsedMs) && o.elapsedMs >= 0 ? o.elapsedMs : null,
      costMicros: usage.success ? usage.data.costMicros : null };
  });
  return { labelStatus: 'provisional-needs-human-review', totalCases: cases.length, observed: rows.length, missing: cases.filter(c => !seen.has(c.id)).map(c => c.id),
    valid: rows.filter(r => r.valid).length, correct: rows.filter(r => r.correct).length,
    evidenceCovered: rows.filter(r => r.valid && r.evidenceCovered).length, falseAssurances: rows.filter(r => r.falseAssurance).length,
    knownCostMicros: rows.reduce((n, r) => n + (r.costMicros || 0), 0), unknownCostCases: rows.filter(r => r.costMicros === null).length,
    note: 'Quotation matching is a support proxy, not proof of interpretation. Invalid, absent and partial runs are not a passing model benchmark. Review semantic support, scope, questions and summaries separately.', rows };
}
