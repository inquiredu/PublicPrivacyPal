// Frozen findings-v2 reconstruction for pre-versioned archives. Never use for new commands.
import { measuresFor, type EvaluationContract } from '../shared/evaluation.ts';
import { getProfile } from '../shared/scoring/profiles.ts';
import { calculateScore } from '../shared/scoring/engine.ts';
import type { EvidenceEdit, Finding, Analysis } from '../shared/review.ts';
import { sourceHash, validateEvidence } from './evidence.ts';
export function editLegacyAnalysis(source: string, profileVersion: string, previous: Analysis | null, edit: EvidenceEdit, id: string, actorUid: string, at: string, contract?: EvaluationContract): Analysis {
  const validated = validateEvidence(source, edit, contract);
  if (validated.finding === 'unresolved' || validated.context || validated.proposalId) throw new Error('Unsupported legacy evidence.');
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
    score: calculateScore(criteria.map((c, i) => ({ id: c.id, weight: c.weight, assessment: ({ yes: 'meets', no: 'does_not_meet', partial: 'partial', not_specified: 'not_addressed', unresolved: 'unresolved' } as const)[findings[i].finding] })), profile.engineVersion),
  };
}
