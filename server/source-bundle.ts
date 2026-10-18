import { LONG_BUNDLE_VERSION, SEGMENT_LIMITS, sourceSegments } from '../shared/source-segments.ts';
import { sourceHash } from './evidence.ts';
import { digest } from './evaluation.ts';
import { canonicalTextSchema, MAX_POLICY_LENGTH } from '../shared/policy-source.ts';
import { BUNDLE_LIMITS, sourceBundleInputSchema, sourceBundleSchema, targetsFor, type SourceBundle, type SourceBundleInput } from '../shared/source-bundle.ts';
import { measuresFor, type EvaluationContract } from '../shared/evaluation.ts';

const limits = (bundle: SourceBundleInput) => bundle.version === LONG_BUNDLE_VERSION ? { length: SEGMENT_LIMITS.textLength, bytes: SEGMENT_LIMITS.rawBytes, storage: SEGMENT_LIMITS.bundleBytes } : { length: MAX_POLICY_LENGTH, bytes: BUNDLE_LIMITS.rawBytes, storage: 124 * 1024 };
function validateManifest(input: SourceBundleInput, contract: EvaluationContract) {
  if (input.documents.some(d => d.text.length > limits(input).length)) throw new Error('Document exceeds its versioned text limit.');
  const ids = input.documents.map(d => d.id);
  if (new Set(ids).size !== ids.length) throw new Error('Document IDs must be unique.');
  const targets = new Set(['*', ...targetsFor(contract), ...measuresFor({ contract }).map(m => m.id)]);
  for (const d of input.documents) {
    if (d.capture === 'missing' ? d.text !== '' : !d.text.trim()) throw new Error('Missing documents have no text; captured documents require text.');
    if (new Set(d.requiredFor).size !== d.requiredFor.length || d.requiredFor.some(t => !targets.has(t))) throw new Error('Unknown or repeated document dependency.');
    if ((!d.requiredFor.length) !== !!d.exclusionReason) throw new Error('Explain a document excluded from required coverage; required documents cannot be excluded.');
  }
  for (const link of input.links) {
    if (!ids.includes(link.from) || (link.documentId && !ids.includes(link.documentId))) throw new Error('Linked document reference is missing. Declare an unavailable document explicitly.');
    if ((link.documentId === null) !== !!link.exclusionReason) throw new Error('Excluded links need a reason; included links identify a declared document.');
  }
  if (!input.documents.some(d => d.capture !== 'missing')) throw new Error('Capture at least one document.');
  for (const t of targetsFor(contract)) if (!input.documents.some(d => d.requiredFor.some(dep => dep === '*' || dep === t || dep === t.split('/')[0]))) throw new Error('Declare required documents for every enabled requirement.');
}
export function captureSourceBundle(raw: unknown, contract: EvaluationContract, capturedAt: string): SourceBundle {
  const input = sourceBundleInputSchema.parse(raw); validateManifest(input, contract);
  if (input.documents.reduce((n, d) => n + d.text.length, 0) > limits(input).length || input.documents.reduce((n, d) => n + Buffer.byteLength(d.text), 0) > limits(input).bytes) throw new Error('Source bundle exceeds the total text budget.');
  let text = '';
  const documents = input.documents.map(d => {
    const canonical = d.capture === 'missing' ? '' : canonicalTextSchema(limits(input).length).parse(d.text.replace(/\r\n?/g, '\n'));
    if (canonical && text) text += '\n\n';
    const start = text.length; text += canonical;
    return { ...d, text: canonical, rawHash: sourceHash(d.text), textHash: sourceHash(canonical), start, end: text.length };
  });
  canonicalTextSchema(limits(input).length).parse(text);
  const data = { ...input, documents, capturedAt, normalization: 'lf-v1' as const, textHash: sourceHash(text) };
  const bundle = sourceBundleSchema.parse({ ...data, id: digest(data) });
  if (Buffer.byteLength(JSON.stringify(bundle)) > limits(bundle).storage) throw new Error('Source bundle exceeds its storage budget.');
  if (bundle.version === LONG_BUNDLE_VERSION) sourceSegments(bundle);
  return bundle;
}
export const bundleText = (bundle: SourceBundle) => bundle.documents.filter(d => d.capture !== 'missing').map(d => d.text).join('\n\n');
export function verifySourceBundle(raw: unknown, contract: EvaluationContract): SourceBundle {
  const bundle = sourceBundleSchema.parse(raw); validateManifest(bundle, contract);
  const { id, ...data } = bundle;
  if (digest(data) !== id) throw new Error('Source bundle identity mismatch.');
  const text = canonicalTextSchema(limits(bundle).length).parse(bundleText(bundle));
  if (sourceHash(text) !== bundle.textHash || Buffer.byteLength(text) > limits(bundle).bytes || Buffer.byteLength(JSON.stringify(bundle)) > limits(bundle).storage) throw new Error('Source bundle text or budget mismatch.');
  let cursor = 0;
  for (const d of bundle.documents) {
    if (d.capture !== 'missing') { canonicalTextSchema(limits(bundle).length).parse(d.text); if (cursor) cursor += 2; }
    if (d.start !== cursor || d.end !== cursor + d.text.length || sourceHash(d.text) !== d.textHash || text.slice(d.start, d.end) !== d.text) throw new Error('Source document identity or range mismatch.');
    cursor = d.end;
  }
  if (bundle.version === LONG_BUNDLE_VERSION) sourceSegments(bundle);
  return bundle;
}
