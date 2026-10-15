/** Derived from inquiredu/privacypal hybridScoringService.ts at adad00a (AGPL-3.0).
 * Preserve its weighted formula and 60% silence credit; never treat this score as approval.
 */
export const ENGINE_VERSION = 'upstream-weighted-v1';
export type Assessment = 'meets' | 'partial' | 'not_addressed' | 'does_not_meet' | 'not_applicable';
export type ScoreInput = { id: string; weight: number; assessment: Assessment };
export const engineVersions = ['upstream-weighted-v1', 'evidence-weighted-v1'] as const;
export function calculateScore(criteria: readonly ScoreInput[], engineVersion: typeof engineVersions[number] = ENGINE_VERSION) {
  if (!engineVersions.includes(engineVersion)) throw new Error('Unknown scoring engine.');
  if (new Set(criteria.map(c => c.id)).size !== criteria.length) throw new Error('Duplicate criterion.');
  const credit: Record<Assessment, number> = { meets: 1, partial: 0.5, not_addressed: engineVersion === ENGINE_VERSION ? 0.6 : 0, does_not_meet: 0, not_applicable: 0 };
  const breakdown = criteria.map(c => {
    if (!Number.isFinite(c.weight) || c.weight <= 0 || !Object.hasOwn(credit, c.assessment)) throw new Error('Invalid scoring input.');
    const maximum = c.assessment === 'not_applicable' ? 0 : 3 * c.weight;
    if (!Number.isFinite(maximum)) throw new Error('Scoring weight is too large.');
    return { ...c, points: maximum * credit[c.assessment], maximum };
  });
  const points = breakdown.reduce((n, c) => n + c.points, 0);
  const maximum = breakdown.reduce((n, c) => n + c.maximum, 0);
  if (!Number.isFinite(points) || !Number.isFinite(maximum)) throw new Error('Scoring totals are too large.');
  return { engineVersion, total: maximum ? Math.round(points / maximum * 100) : 0, points, maximum, breakdown };
}
