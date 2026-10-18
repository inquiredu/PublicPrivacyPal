import { z } from 'zod';
import { LONG_BUNDLE_VERSION, SEGMENT_LIMITS } from './source-segments.ts';
import { isWellFormedText } from './policy-source.ts';
import type { EvaluationContract } from './evaluation.ts';

export const BUNDLE_VERSION = 'pasted-source-bundle-v1';
export const COVERAGE_VERSION = 'source-coverage-v1';
export const BUNDLE_LIMITS = { documents: 8, links: 16, passages: 24, passageLength: 4000, requestBytes: 256 * 1024, inputTokenUpperBound: 256 * 1024, rawBytes: 96 * 1024 } as const;
const id = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const label = (max: number) => z.string().trim().min(1).max(max).refine(isWellFormedText);
export const sourceScopeSchema = z.object({ product: label(160), accounts: label(160), jurisdiction: label(160) }).strict();
const rawText = z.string().max(SEGMENT_LIMITS.textLength).refine(isWellFormedText).refine(s => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s));
const target = z.string().regex(/^(\*|[a-zA-Z0-9_-]{1,80}(\/[a-zA-Z0-9_-]{1,80})?)$/);
const documentFields = {
  id, label: label(160), origin: label(400), scope: sourceScopeSchema,
  applicability: z.enum(['matched', 'unresolved']), effectiveDates: z.array(label(80)).max(3),
  capture: z.enum(['complete', 'excerpt', 'missing']), text: rawText,
  requiredFor: z.array(target).max(100), exclusionReason: z.string().trim().max(400).refine(isWellFormedText),
};
export const bundleDocumentInputSchema = z.object(documentFields).strict();
export const sourceBundleInputSchema = z.object({ version: z.enum([BUNDLE_VERSION, LONG_BUNDLE_VERSION]), scope: sourceScopeSchema,
  documents: z.array(bundleDocumentInputSchema).min(1).max(BUNDLE_LIMITS.documents),
  links: z.array(z.object({ from: id, label: label(400), documentId: id.nullable(), exclusionReason: z.string().trim().max(400).refine(isWellFormedText) }).strict()).max(BUNDLE_LIMITS.links),
}).strict();
export type SourceBundleInput = z.infer<typeof sourceBundleInputSchema>;
const scopeDraft = sourceScopeSchema.extend({ product: z.string().max(160), accounts: z.string().max(160), jurisdiction: z.string().max(160) });
export const sourceBundleDraftSchema = sourceBundleInputSchema.extend({ scope: scopeDraft, documents: z.array(bundleDocumentInputSchema.extend({
  label: z.string().max(160), origin: z.string().max(400), scope: scopeDraft, text: z.string().max(SEGMENT_LIMITS.textLength), effectiveDates: z.array(z.string().max(80)).max(3),
})).min(1).max(BUNDLE_LIMITS.documents) });
export function emptySourceBundle(): SourceBundleInput {
  const scope = { product: '', accounts: '', jurisdiction: '' };
  return { version: BUNDLE_VERSION, scope, documents: [{ id: 'document-1', label: '', origin: '', scope, applicability: 'unresolved', effectiveDates: [], capture: 'complete', text: '', requiredFor: ['*'], exclusionReason: '' }], links: [] };
}
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const sourceBundleSchema = sourceBundleInputSchema.extend({ capturedAt: z.iso.datetime(), normalization: z.literal('lf-v1'),
  documents: z.array(bundleDocumentInputSchema.extend({ rawHash: hash, textHash: hash, start: z.number().int().nonnegative(), end: z.number().int().nonnegative() }).strict()).min(1).max(BUNDLE_LIMITS.documents),
  textHash: hash, id: hash,
}).strict();
export type SourceBundle = z.infer<typeof sourceBundleSchema>;
export type CoverageTarget = { target: string; documents: string[]; missing: string[]; ready: boolean };
export type SourceCoverage = { version: typeof COVERAGE_VERSION; bundleId: string; targets: CoverageTarget[] };
export type SegmentCoverage = { passageId: string; documentId: string; textHash: string; start: number; end: number; state: 'pending' | 'validated' | 'unavailable' };
export const targetsFor = (contract: EvaluationContract) => contract.criteria.filter(m => m.weight > 0).flatMap(m => m.requirements ? m.requirements.map(r => `${m.id}/${r.id}`) : [m.id]);

/** Capture declarations are human assertions. This measures completeness only for that declared set. */
export function sourceCoverage(bundle: SourceBundle, contract: EvaluationContract): SourceCoverage {
  return { version: COVERAGE_VERSION, bundleId: bundle.id, targets: targetsFor(contract).map(target => {
    const documents = bundle.documents.filter(d => d.requiredFor.some(t => t === '*' || t === target || t === target.split('/')[0]));
    const missing = documents.filter(d => d.capture !== 'complete' || d.applicability !== 'matched').map(d => d.id);
    return { target, documents: documents.map(d => d.id), missing, ready: documents.length > 0 && !missing.length };
  }) };
}
export function measureCoverage(bundle: SourceBundle, contract: EvaluationContract, measureId: string) {
  const coverage = sourceCoverage(bundle, contract);
  return { ...coverage, targets: coverage.targets.filter(t => t.target === measureId || t.target.startsWith(`${measureId}/`)) };
}
export function coverageReady(coverage: SourceCoverage) { return coverage.targets.length > 0 && coverage.targets.every(t => t.ready); }
export function documentForRange(bundle: SourceBundle, start: number, end: number) {
  return bundle.documents.find(d => d.capture !== 'missing' && start >= d.start && end <= d.end && end > start);
}
