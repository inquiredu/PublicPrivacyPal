import { createHash } from 'node:crypto';
import { evaluationAreas, evaluationSettingsSchema, type SavedSettings, type EvaluationSettings } from '../shared/settings.ts';
import { criteria, getProfile } from '../shared/scoring/profiles.ts';
import type { EvaluationContract } from '../shared/evaluation.ts';
import type { engineVersions } from '../shared/scoring/engine.ts';
import { HttpError } from './operations.ts';
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
  if (!saved?.complete || saved.revision !== revision || saved.values.starterProfile !== 'pef-2.0') throw new HttpError(409, 'Save a district rubric in Settings and use its current revision.');
  const context = evaluationSettingsSchema.parse(saved.values);
  if (saved.contentHash !== createHash('sha256').update(JSON.stringify({ definitionVersion: saved.definitionVersion, values: context })).digest('hex')) throw new HttpError(409, 'The saved settings hash does not match.');
  const data = { version: 1 as const, kind: 'district' as const, definitionVersion: 'pef-2.0-snapshot-v1', profileVersion: 'district-pef-v1', engineVersion, settingsRevision: revision, settingsHash: saved.contentHash, context,
    criteria: evaluationAreas.flatMap(a => a.criteria.map(c => ({ id: c.id, label: c.question, area: a.id, weight: context.evaluationWeights[a.id], evidence: c.evaluation.meets, partial: c.evaluation.partial, failure: c.evaluation.doesNotMeet, requiredFinding: c.requiredFinding }))) };
  if (data.criteria.length !== 50 || new Set(data.criteria.map(c => c.id)).size !== 50) throw new Error('Invalid bundled rubric definition.');
  return { id: digest(data), ...data };
}
