import { BUNDLE_VERSION, type SourceBundleInput } from '../../shared/source-bundle.ts';

export const bundleScope = { product: 'Fictional Cedar classroom', accounts: 'School-managed student accounts', jurisdiction: 'Synthetic district' };
export function syntheticBundle(): SourceBundleInput {
  return { version: BUNDLE_VERSION, scope: bundleScope, documents: [
    { id: 'policy', label: 'Fictional school privacy policy', origin: 'Pasted synthetic document', scope: bundleScope, applicability: 'matched', effectiveDates: ['2026-10-01'], capture: 'complete', text: 'We delete school records after termination.\r\nThe backup addendum also applies.', requiredFor: ['*'], exclusionReason: '' },
    { id: 'addendum', label: 'Fictional backup addendum', origin: 'Referenced but not supplied', scope: bundleScope, applicability: 'matched', effectiveDates: [], capture: 'missing', text: '', requiredFor: ['deletion'], exclusionReason: '' },
  ], links: [{ from: 'policy', label: 'Backup addendum', documentId: 'addendum', exclusionReason: '' }] };
}
