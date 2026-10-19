import { practiceContract } from '../../server/evaluation.ts';
import { captureSourceBundle } from '../../server/source-bundle.ts';
import {
  appendSegmentAttempt, buildSynthesisRequest, newSegmentArchive,
  type SegmentArchive, type SegmentOutput, type SynthesisOutput,
} from '../../server/analysis/segments.ts';
import { LONG_BUNDLE_VERSION } from '../../shared/source-segments.ts';
import type { SourceBundleInput } from '../../shared/source-bundle.ts';

/** Authored fictional inputs, not model observations or adjudicated semantic labels. */
export const ADOPTION_AT = '2026-10-18T20:00:00.000Z';
export const commitmentQuote = 'We delete school account records and backups within thirty days after termination.';
export const opposingQuote = 'School account backups remain stored indefinitely after termination.';
export const adultQuote = 'Independent adult accounts can request deletion of their profile.';
export type AdoptionVariant = 'commitment' | 'omission' | 'contradiction' | 'wrong-scope';

export function adoptionArchive(variant: AdoptionVariant = 'commitment', missingAnnex = false): SegmentArchive {
  const contract = practiceContract('community-evidence-v1');
  const scope = { product: 'Fictional Lantern Notebook', accounts: 'District-managed school accounts', jurisdiction: 'Synthetic jurisdiction' };
  const opening = variant === 'omission' ? 'The product offers a notebook interface.' : variant === 'wrong-scope' ? adultQuote : commitmentQuote;
  const ending = variant === 'contradiction' ? opposingQuote : 'The help menu describes notebook navigation.';
  const input: SourceBundleInput = {
    version: LONG_BUNDLE_VERSION, scope,
    documents: [{ id: 'school-policy', label: 'Authored school policy', origin: 'Synthetic fixture', scope,
      applicability: 'matched', effectiveDates: [], capture: 'complete', requiredFor: ['*'], exclusionReason: '',
      text: `# School account terms\n${opening}\n${'Synthetic layout information.\n'.repeat(620)}\n# Final section\n${ending}`,
    }, ...(missingAnnex ? [{ id: 'annex', label: 'Missing retention annex', origin: 'Synthetic fixture', scope,
      applicability: 'matched' as const, effectiveDates: [], capture: 'missing' as const, requiredFor: ['deletion'], exclusionReason: '', text: '',
    }] : [])], links: [],
  };
  return newSegmentArchive(captureSourceBundle(input, contract, ADOPTION_AT), contract);
}

export function emptySegmentOutput(archive: SegmentArchive, index: number): SegmentOutput {
  const request = archive.requests[index];
  return { schemaVersion: 'segment-candidates-v1', requestKey: request.key, segmentId: request.segment.id,
    targets: request.reference.targets.map(target => ({ target, status: 'examined', question: '', candidates: [] })),
  };
}

export function returnSegment(archive: SegmentArchive, index: number, output = emptySegmentOutput(archive, index)) {
  const request = archive.requests[index];
  return appendSegmentAttempt(archive, { segmentId: request.segment.id, requestKey: request.key,
    outcome: { kind: 'returned', raw: JSON.stringify(output) },
  });
}

export function returnAllSegments(archive: SegmentArchive, quotes: { quote: string; role: 'supporting' | 'limiting' | 'opposing' }[] = []) {
  for (let index = 0; index < archive.requests.length; index++) {
    const request = archive.requests[index], output = emptySegmentOutput(archive, index);
    for (const evidence of quotes) {
      const offset = request.text.indexOf(evidence.quote), start = request.segment.contextStart + offset;
      if (offset >= 0 && start < request.segment.end && start + evidence.quote.length > request.segment.start) {
        output.targets.find(t => t.target === 'deletion')!.candidates.push({ ...evidence, rationale: 'Authored candidate for a boundary check.' });
      }
    }
    archive = returnSegment(archive, index, output);
  }
  return archive;
}

export function synthesisOutput(archive: SegmentArchive, deletionState: SynthesisOutput['findings'][number]['state'] = 'not_stated'): SynthesisOutput {
  const request = buildSynthesisRequest(archive);
  return { schemaVersion: 'segment-synthesis-v1', requestKey: request.key, findings: request.coverage.map(coverage => ({
    target: coverage.target, state: coverage.target === 'deletion' ? deletionState : 'not_stated',
    candidateIds: request.candidates.filter(c => c.target === coverage.target).map(c => c.id), segmentIds: coverage.segmentIds,
    rationale: 'Authored synthetic interpretation; semantic correctness requires human review.',
    question: coverage.target === 'deletion' && ['ambiguous', 'unavailable'].includes(deletionState) ? 'Resolve the retained evidence and applicable source scope.' : '',
  })) };
}
