import { syntheticBundle } from './source-bundle.ts';
import { LONG_BUNDLE_VERSION } from '../../shared/source-segments.ts';
/** Authored synthetic text. Deliberately places the exception well beyond the old 32k cap. */
export function longSyntheticBundle() {
  const input = syntheticBundle(); input.version = LONG_BUNDLE_VERSION;
  input.documents[0].text = '# School policy\nWe delete all school records within thirty days.\n' + 'Synthetic neutral administrative text.\n'.repeat(1700) + '\n# Exceptions\nBackups are retained for seven years after termination.';
  return input;
}
