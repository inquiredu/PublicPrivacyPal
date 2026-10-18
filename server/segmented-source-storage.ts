import { digest } from './evaluation.ts';
import { verifySourceBundle } from './source-bundle.ts';
import { buildSegmentPlan } from './analysis/segments.ts';
import { LONG_BUNDLE_VERSION, sourceSegments } from '../shared/source-segments.ts';
import type { SourceBundle } from '../shared/source-bundle.ts';
import type { EvaluationContract } from '../shared/evaluation.ts';

/** Immutable source parts stay within the existing per-document source storage bound. */
export function splitSourceBundle(raw: SourceBundle, contract: EvaluationContract) {
  const bundle = verifySourceBundle(raw, contract);
  if (bundle.version !== LONG_BUNDLE_VERSION) throw new Error('Chunk storage requires a v2 source bundle.');
  const parts = sourceSegments(bundle).map(s => {
    const d = bundle.documents.find(d => d.id === s.documentId)!;
    const data = { version: 'source-part-v1', documentId: d.id, textHash: d.textHash, start: s.start, end: s.end, text: d.text.slice(s.start - d.start, s.end - d.start) };
    return { id: digest(data), data };
  });
  const manifest = { ...bundle, documents: bundle.documents.map(({ text: _text, ...d }) => d) };
  return { manifest, parts, plan: buildSegmentPlan(bundle, contract).plan };
}
export function joinSourceBundle(manifest: any, parts: { id: string; data: any }[], plan: unknown, contract: EvaluationContract) {
  if (!Array.isArray(manifest?.documents) || parts.length > 24 || new Set(parts.map(p => p.id)).size !== parts.length) throw new Error('Invalid segmented source references.');
  for (const part of parts) if (digest(part.data) !== part.id) throw new Error('Source part integrity check failed.');
  const bundle = verifySourceBundle({ ...manifest, documents: manifest.documents.map((d: any) => ({ ...d, text: parts.filter(p => p.data.documentId === d.id).map(p => p.data.text).join('') })) }, contract);
  const expected = splitSourceBundle(bundle, contract);
  if (digest(parts) !== digest(expected.parts) || digest(manifest) !== digest(expected.manifest) || digest(plan) !== digest(expected.plan)) throw new Error('Segmented source coverage or part identity changed.');
  return bundle;
}
