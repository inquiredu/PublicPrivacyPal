import { CAPTURE_DEFINITIONS_VERSION, type CaptureDefinitions } from '../../shared/capture-definitions';
import type { EvaluationContract } from '../../shared/evaluation';
import { BUNDLE_VERSION, type SourceBundleInput } from '../../shared/source-bundle';

/** Fictional walkthrough: available policy, unavailable backup addendum, unrelated consumer terms. */
export const dependencyDefinitions: CaptureDefinitions = {
  version: CAPTURE_DEFINITIONS_VERSION, id: 'a'.repeat(64), kind: 'district', profileVersion: 'synthetic-precision',
  definitionVersion: 'synthetic-dependencies-v1', settingsRevision: 4,
  measures: [
    { id: 'deletion', label: 'Deletion commitments', area: 'retention', enabled: true, requirements: [
      { id: 'active', proposition: 'Active records are deleted after an authorized school request.' },
      { id: 'copies', proposition: 'Identifiable backup copies are included in deletion.' },
    ] },
    { id: 'transfer', label: 'Transfer notice', area: 'governance', enabled: true, requirements: [] },
    { id: 'advertising', label: 'Advertising restriction', area: 'commercial', enabled: false, requirements: [] },
  ],
};
export const dependencyContract: EvaluationContract = {
  id: 'b'.repeat(64), version: 2, kind: 'district', definitionVersion: dependencyDefinitions.definitionVersion,
  profileVersion: dependencyDefinitions.profileVersion, engineVersion: 'evidence-weighted-v1', settingsRevision: 4,
  settingsHash: null, context: null,
  criteria: dependencyDefinitions.measures.map(m => ({ id: m.id, label: m.label, area: m.area, weight: m.enabled ? 1 : 0,
    evidence: 'A fictional commitment.', partial: 'A fictional limit.', failure: 'A fictional contrary commitment.', requiredFinding: 'yes',
    ...(m.requirements.length ? { requirements: m.requirements.map(r => ({ ...r, limited: 'Limited coverage.', opposed: 'Explicitly excluded.', decisive: true })) } : {}),
  })),
};
export function dependencyWalkthrough(): SourceBundleInput {
  const scope = { product: 'Cedar Classroom', accounts: 'School-managed accounts', jurisdiction: 'Fictional district' };
  return { version: BUNDLE_VERSION, scope,
    documents: [
      { id: 'policy', label: 'Cedar school policy', origin: 'Synthetic pasted school policy', scope: { ...scope }, applicability: 'matched', effectiveDates: ['Fictional October 2026'], capture: 'complete', text: 'Cedar deletes active records after a school request. Schools receive notice before a corporate transfer. Backup handling is described in the backup addendum.', requiredFor: ['deletion/active', 'transfer'], exclusionReason: '' },
      { id: 'backup', label: 'Required backup addendum', origin: 'Referenced synthetic addendum; unavailable', scope: { ...scope }, applicability: 'unresolved', effectiveDates: [], capture: 'missing', text: '', requiredFor: ['deletion/copies'], exclusionReason: '' },
      { id: 'consumer', label: 'Separate consumer terms', origin: 'Synthetic consumer terms', scope: { ...scope, accounts: 'Independent consumer accounts' }, applicability: 'matched', effectiveDates: [], capture: 'complete', text: 'These fictional terms apply only to independently created consumer accounts.', requiredFor: [], exclusionReason: 'These separate consumer-account terms do not govern the declared school-managed accounts.' },
    ], links: [
      { from: 'policy', label: 'Backup handling addendum', documentId: 'backup', exclusionReason: '' },
      { from: 'policy', label: 'Unrelated consumer promotions page', documentId: null, exclusionReason: 'Promotional page for separate consumer accounts; no school-policy commitment is asserted here.' },
    ],
  };
}
