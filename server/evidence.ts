import { measuresFor, type EvaluationContract } from '../shared/evaluation.ts';
import { createHash } from 'node:crypto';
import { criteria, getProfile } from '../shared/scoring/profiles.ts';
import { calculateScore } from '../shared/scoring/engine.ts';
import { evidenceEditSchema, type EvidenceEdit, type Finding, type Analysis } from '../shared/review.ts';

export const sourceHash = (source: string) => createHash('sha256').update(source).digest('hex');
export function validateEvidence(source: string, raw: unknown, contract?: EvaluationContract): EvidenceEdit {
  const edit = evidenceEditSchema.parse(raw);
  if (!measuresFor({ contract }).some(c => c.id === edit.criterionId)) throw new Error('Choose a known enabled criterion.');
  if (edit.finding === 'not_specified') {
    if (edit.citations.length) throw new Error('Not addressed cannot include a supporting quotation.');
  } else if (!edit.citations.length) throw new Error('Add at least one exact quotation for this finding.');
  const ranges = new Set<string>();
  for (const c of edit.citations) {
    if (!c.quote.trim() || c.end <= c.start || c.end > source.length || source.slice(c.start, c.end) !== c.quote) throw new Error('A quotation does not match its position in the saved policy.');
    const key = `${c.start}:${c.end}`;
    if (ranges.has(key)) throw new Error('The same passage cannot be cited twice for one criterion.');
    ranges.add(key);
  }
  return edit;
}
export function editAnalysis(source: string, profileVersion: string, previous: Analysis | null, edit: EvidenceEdit, id: string, actorUid: string, at: string, contract?: EvaluationContract): Analysis {
  const validated = validateEvidence(source, edit, contract);
  const hash = sourceHash(source);
  if (previous && previous.sourceHash !== hash) throw new Error('Earlier evidence refers to a different source.');
  const profile = contract ? { version: contract.profileVersion, engineVersion: contract.engineVersion } : getProfile(profileVersion);
  const criteria = measuresFor({ contract });
  const findings: Finding[] = criteria.map(c => previous?.findings.find(f => f.id === c.id) || { id: c.id, finding: 'not_specified', quote: '', start: null, end: null });
  const [first, ...additionalEvidence] = validated.citations;
  const replacement: Finding = { id: validated.criterionId, finding: validated.finding, quote: first?.quote || '', start: first?.start ?? null, end: first?.end ?? null, additionalEvidence, rationale: validated.rationale, reviewedBy: actorUid, reviewedAt: at };
  findings[criteria.findIndex(c => c.id === replacement.id)] = replacement;
  return {
    id, profileVersion: profile.version, adapterVersion: 'human-evidence-v1', schemaVersion: 'findings-v2', sourceHash: hash, findings,
    evidenceCount: findings.filter(f => f.finding !== 'not_specified').length,
    score: calculateScore(criteria.map((c, i) => ({ id: c.id, weight: c.weight, assessment: ({ yes: 'meets', no: 'does_not_meet', partial: 'partial', not_specified: 'not_addressed' } as const)[findings[i].finding] })), profile.engineVersion),
  };
}
