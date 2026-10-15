import { createHash } from 'node:crypto';
import { z } from 'zod';
import { criteria, findingSchema, PROFILE_VERSION, type Finding, type Review, type Analysis } from '../shared/review.ts';
import { getProfile } from '../shared/scoring/profiles.ts';
import { calculateScore } from '../shared/scoring/engine.ts';

const sentences = [
  'We collect student names and classroom identifiers.',
  'We use student information only to provide the learning service.',
  'We never sell student information.',
  'Schools can request deletion of all student information.',
  'We encrypt information in transit and at rest and restrict employee access.',
  'Our service providers may access information only to deliver this service.',
  'Contact privacy@learning.example for privacy questions.',
  'We notify schools before material privacy policy changes take effect.',
];
export const fixtures = {
  complete: { label: 'Clear commitments', text: sentences.join('\n') },
  gaps: { label: 'Missing and conflicting commitments', text: [sentences[0], sentences[1], 'We may sell student information.', sentences[6]].join('\n') },
  retry: { label: 'Temporary failure — retry practice', text: sentences.join('\n') },
} as const;
export function validateFindings(source: string, raw: unknown): Finding[] {
  const findings = z.array(findingSchema).length(criteria.length).parse(raw);
  if (new Set(findings.map(f => f.id)).size !== criteria.length || findings.some(f => !criteria.some(c => c.id === f.id))) throw new Error('Unexpected criteria.');
  for (const f of findings) {
    if (f.finding === 'not_specified') {
      if (f.quote !== '' || f.start !== null || f.end !== null) throw new Error('Missing findings cannot claim evidence.');
    } else if (!f.quote.trim() || f.start === null || f.end === null || f.end <= f.start || f.end > source.length || source.slice(f.start, f.end) !== f.quote) {
      throw new Error('Evidence does not match the source.');
    }
  }
  return criteria.map(c => findings.find(f => f.id === c.id)!);
}
/** Offline fixture adapter, not general-purpose extraction. The server selects all findings. */
export function analyzeSynthetic(fixtureId: Review['fixtureId'], source: string, id: string, profileVersion: string = PROFILE_VERSION): Analysis {
  const profile = getProfile(profileVersion);
  if (source !== fixtures[fixtureId].text) throw new Error('Only the bundled synthetic policies are supported.');
  const findings = validateFindings(source, criteria.map((c, i) => {
    const quote = fixtureId === 'gaps' && c.id === 'sale' ? 'We may sell student information.' : sentences[i];
    const start = source.indexOf(quote);
    return { id: c.id, finding: start < 0 ? 'not_specified' : fixtureId === 'gaps' && c.id === 'sale' ? 'no' : 'yes', quote: start < 0 ? '' : quote, start: start < 0 ? null : start, end: start < 0 ? null : start + quote.length };
  }));
  return { id, profileVersion: profile.version, adapterVersion: 'synthetic-fixtures-v1', schemaVersion: 'findings-v1', sourceHash: createHash('sha256').update(source).digest('hex'), findings,
    evidenceCount: findings.filter(f => f.finding !== 'not_specified').length,
    score: calculateScore(criteria.map((c, i) => ({ id: c.id, weight: c.weight, assessment: ({ yes: 'meets', no: 'does_not_meet', partial: 'partial', not_specified: 'not_addressed' } as const)[findings[i].finding] })), profile.engineVersion),
  };
}
