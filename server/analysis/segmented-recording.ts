import { captureSourceBundle } from '../source-bundle.ts';
import { digest, practiceContract } from '../evaluation.ts';
import type { Review } from '../../shared/review.ts';
import { SEGMENTED_EXAMPLE_OPPOSITION, SEGMENTED_EXAMPLE_SUPPORT, segmentedExampleCapture } from '../../shared/segmented-assistance.ts';
import { buildSynthesisRequest, type SegmentArchive, type SegmentRequest, type SegmentOutput, type SynthesisOutput } from './segments.ts';

export const SEGMENTED_RECORDING = { provider: 'authored-recording', model: 'lantern-segmented-v1', adapterVersion: 'recording-v1' } as const;
export function segmentedRecordingEligible(review: Review): boolean {
  if (!review.sourceBundle || !review.contract) return false;
  const contract = practiceContract('community-evidence-v1');
  if (digest(review.contract) !== digest(contract)) return false;
  const expected = captureSourceBundle(segmentedExampleCapture().sourceBundle, contract, review.sourceBundle.capturedAt);
  return digest(expected) === digest(review.sourceBundle);
}
export type SegmentedTransportResult = { status: 'completed' | 'refused' | 'incomplete'; bytes: Uint8Array };
export type SegmentedTransportInput = { kind: 'segment'; request: SegmentRequest } | { kind: 'synthesis'; archive: SegmentArchive };
/** Authored local responses. No SDK, environment provider selection, network or client output. */
export async function generateSegmentedRecording(input: SegmentedTransportInput, signal: AbortSignal): Promise<SegmentedTransportResult> {
  signal.throwIfAborted();
  let output: SegmentOutput | SynthesisOutput;
  if (input.kind === 'segment') {
    const request = input.request;
    output = { schemaVersion: 'segment-candidates-v1', requestKey: request.key, segmentId: request.segment.id,
      targets: request.reference.targets.map(target => ({ target, status: 'examined', question: '', candidates: target !== 'deletion' ? [] : [
        { quote: SEGMENTED_EXAMPLE_SUPPORT, role: 'supporting' as const }, { quote: SEGMENTED_EXAMPLE_OPPOSITION, role: 'opposing' as const },
      ].filter(c => { const offset = request.text.indexOf(c.quote); const start = request.segment.contextStart + offset;
        return offset >= 0 && start < request.segment.end && start + c.quote.length > request.segment.start; })
        .map(c => ({ ...c, rationale: 'Authored synthetic candidate. A person must judge applicability and interpretation.' })) })),
    };
  } else {
    const request = buildSynthesisRequest(input.archive);
    output = { schemaVersion: 'segment-synthesis-v1', requestKey: request.key,
      findings: request.coverage.map(c => { const candidates = request.candidates.filter(v => v.target === c.target);
        const state = !c.ready ? 'unavailable' : candidates.some(v => v.role === 'supporting') && candidates.some(v => v.role === 'opposing') ? 'ambiguous'
          : candidates.some(v => v.role === 'opposing') ? 'opposed' : candidates.some(v => v.role === 'supporting') ? 'established' : 'not_stated';
        return { target: c.target, state, candidateIds: candidates.map(v => v.id), segmentIds: c.segmentIds,
          rationale: 'Authored synthetic interpretation, not an independent semantic judgment.',
          question: state === 'unavailable' ? 'Obtain and review all required source material.' : state === 'ambiguous' ? 'Resolve the contradictory retention statements.' : '' }; }),
    };
  }
  // Whitespace is deliberately part of the original recording and survives storage and recovery.
  return { status: 'completed', bytes: Buffer.from(`\n${JSON.stringify(output, null, 2)}\n`, 'utf8') };
}
