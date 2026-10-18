import { createHash } from 'node:crypto';
import { evaluationAreas, evaluationSettingsSchema, type SavedSettings, type EvaluationSettings } from '../shared/settings.ts';
import { criteria, getProfile } from '../shared/scoring/profiles.ts';
import type { EvaluationContract } from '../shared/evaluation.ts';
import type { engineVersions } from '../shared/scoring/engine.ts';
import { HttpError } from './operations.ts';
import { candidate } from '../shared/rubrics/precision-candidate.ts';
import { PRECISION_DEFINITION, PRECISION_PROFILE } from '../shared/requirements.ts';
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical((value as Record<string, unknown>)[k])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const digest = (value: unknown) => createHash('sha256').update(canonical(value)).digest('hex');
export function practiceContract(version: string): EvaluationContract {
  const p = getProfile(version);
  const data = { version: 1 as const, kind: 'practice' as const, definitionVersion: version, profileVersion: version, engineVersion: p.engineVersion, settingsRevision: null, settingsHash: null, context: null, criteria: criteria.map(c => ({ ...c, area: 'practice', requiredFinding: 'yes' })) };
  return { id: digest(data), ...data };
}
export function districtContract(saved: SavedSettings<EvaluationSettings> | undefined, revision: number, engineVersion: typeof engineVersions[number]): EvaluationContract {
  if (!saved?.complete || saved.revision !== revision || !['pef-2.0', PRECISION_PROFILE].includes(saved.values.starterProfile)) throw new HttpError(409, 'Save a district rubric in Settings and use its current revision.');
  const context = evaluationSettingsSchema.parse(saved.values);
  if (saved.contentHash !== createHash('sha256').update(JSON.stringify({ definitionVersion: saved.definitionVersion, values: context })).digest('hex')) throw new HttpError(409, 'The saved settings hash does not match.');
  const data = { version: 1 as const, kind: 'district' as const, definitionVersion: 'pef-2.0-snapshot-v1', profileVersion: 'district-pef-v1', engineVersion, settingsRevision: revision, settingsHash: saved.contentHash, context,
    criteria: evaluationAreas.flatMap(a => a.criteria.map(c => ({ id: c.id, label: c.question, area: a.id, weight: context.evaluationWeights[a.id], evidence: c.evaluation.meets, partial: c.evaluation.partial, failure: c.evaluation.doesNotMeet, requiredFinding: c.requiredFinding }))) };
  if (data.criteria.length !== 50 || new Set(data.criteria.map(c => c.id)).size !== 50) throw new Error('Invalid bundled rubric definition.');
  if (context.starterProfile === PRECISION_PROFILE) {
    const precision = { ...data, version: 2 as const, definitionVersion: PRECISION_DEFINITION, profileVersion: 'district-pef-precision-v1',
      criteria: data.criteria.map(c => {
        const revised = candidate.measures.find(m => m.id === c.id);
        return revised ? { ...c, label: revised.label, requirements: structuredClone(revised.requirements), decisionRule: revised.decision,
          evidence: 'Every listed subrequirement is established within the reviewed scope.',
          partial: 'A defined limitation or mixed resolved support remains; no decisive opposition is established.',
          failure: 'Explicit opposition to a decisive subrequirement, or only opposed/silent requirements with at least one opposed.' } : c;
      }) };
    return { id: digest(precision), ...precision };
  }
  return { id: digest(data), ...data };
}
