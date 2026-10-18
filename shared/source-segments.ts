import { z } from 'zod';
import type { SourceBundle } from './source-bundle.ts';

export const LONG_BUNDLE_VERSION = 'pasted-source-bundle-v2';
export const SEGMENT_PLAN_VERSION = 'source-segments-v1';
export const SEGMENT_LIMITS = { textLength: 128000, rawBytes: 384 * 1024, bundleBytes: 480 * 1024, coreLength: 8000, contextLength: 400, segments: 24, requestBytes: 256 * 1024, outputBytes: 128 * 1024, archiveBytes: 16 * 1024 * 1024 } as const;
export type SourceSegment = { id: string; documentId: string; textHash: string; start: number; end: number; contextStart: number; contextEnd: number };
// Move a boundary to the left if it falls inside a surrogate pair.
function boundary(text: string, n: number) { return n > 0 && n < text.length && /[\uD800-\uDBFF]/.test(text[n - 1]) && /[\uDC00-\uDFFF]/.test(text[n]) ? n - 1 : n; }
/** Every canonical character belongs to exactly one core. Context never counts as a second core. */
export function sourceSegments(bundle: SourceBundle): SourceSegment[] {
  const result: SourceSegment[] = [];
  for (const d of bundle.documents) {
    let start = 0;
    while (start < d.text.length) {
      let end = boundary(d.text, Math.min(start + SEGMENT_LIMITS.coreLength, d.text.length));
      if (end < d.text.length) {
        const paragraph = d.text.lastIndexOf('\n\n', end - 1);
        const line = d.text.lastIndexOf('\n', end - 1);
        const structural = paragraph >= end - 1000 ? paragraph + 2 : line >= end - 1000 ? line + 1 : end;
        end = Math.max(end - 1000, structural);
      }
      if (end <= start) throw new Error('Source segmentation did not advance.');
      result.push({ id: `s${result.length + 1}`, documentId: d.id, textHash: d.textHash, start: d.start + start, end: d.start + end,
        contextStart: d.start + boundary(d.text, Math.max(0, start - SEGMENT_LIMITS.contextLength)), contextEnd: d.start + boundary(d.text, Math.min(d.text.length, end + SEGMENT_LIMITS.contextLength)) });
      start = end;
    }
  }
  if (result.length > SEGMENT_LIMITS.segments) throw new Error('Source exceeds the segment count budget.');
  return result;
}
export const humanSourceReviewSchema = z.object({ version: z.literal('human-source-review-v1'), bundleId: z.string().regex(/^[a-f0-9]{64}$/), segmentIds: z.array(z.string().regex(/^s[1-9][0-9]*$/)).max(SEGMENT_LIMITS.segments) }).strict();
export type HumanSourceReview = z.infer<typeof humanSourceReviewSchema>;
