import { z } from 'zod';
import type { EvidenceEdit, ReviewContext } from './review.ts';
import type { SourceBundleInput, SourceBundle } from './source-bundle.ts';

export const SEGMENTED_STORAGE_VERSION = 1;
export const SEGMENTED_LIMITS = { runs: 2, attempts: 75, perScope: 3, head: 8192, spec: 32768,
  request: 264 * 1024, attempt: 16384, output: 192 * 1024, outcome: 16384,
  runBytes: 16 * 1024 * 1024, runRecords: 800, installationBytes: 32 * 1024 * 1024,
  installationRecords: 1600, page: 20, pageBytes: 128 * 1024, proposalBytes: 512 * 1024,
  transportBytes: 128 * 1024, dailyDispatches: 100 } as const;
export const SEGMENTED_HANDOFF_QUESTION = 'Verify that the retained evidence applies to the declared product, accounts and jurisdiction, and justify your interpretation of every supporting, limiting and opposing statement.';
export const SEGMENTED_HANDOFF_SCOPE = 'The immutable segmented proposal records the full declared product, accounts and jurisdiction.';
export const segmentedHashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const identifier = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
const target = z.string().regex(/^[a-zA-Z0-9_-]{1,80}(\/[a-zA-Z0-9_-]{1,80})?$/);
const revision = z.number().int().positive();
export const segmentedAttemptScopeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('segment'), segmentId: z.string().regex(/^s[1-9][0-9]?$/) }).strict(),
  z.object({ kind: z.literal('synthesis') }).strict(),
]);
export type SegmentedAttemptScope = z.infer<typeof segmentedAttemptScopeSchema>;
export const segmentedActionSchemas = [
  z.object({ action: z.literal('start_segmented_run'), revision }).strict(),
  z.object({ action: z.literal('cancel_segmented_run'), revision, runId: z.uuid(), runRevision: revision }).strict(),
  z.object({ action: z.literal('run_segmented_attempt'), revision, runId: z.uuid(), runRevision: revision, scope: segmentedAttemptScopeSchema }).strict(),
] as const;
export const segmentedActionSchema = z.discriminatedUnion('action', segmentedActionSchemas);
export type SegmentedAction = z.infer<typeof segmentedActionSchema>;
export const segmentedProposalRefSchema = z.object({ version: z.literal('segmented-proposal-v1'), runId: z.uuid(),
  synthesisAttemptId: z.uuid(), outcomeId: segmentedHashSchema, evidenceRevision: segmentedHashSchema,
  measureId: identifier, targetIds: z.array(target).min(1).max(8),
}).strict();
export type SegmentedProposalRef = z.infer<typeof segmentedProposalRefSchema>;
export const segmentedReceiptEffectSchema = z.object({ version: z.literal('segmented-command-v1'), runId: z.uuid(),
  attemptId: z.uuid().optional(), runRevision: revision }).strict();
export type SegmentedReceiptEffect = z.infer<typeof segmentedReceiptEffectSchema>;
export type SegmentedReviewMarker = { segmentedStorageVersion?: 1; segmentedRunId?: string; segmentedRunCount?: number };
export const segmentedProvenanceSchema = z.object({ version: z.literal('segmented-provenance-v1'), reference: segmentedProposalRefSchema,
  bundleId: segmentedHashSchema, textHash: segmentedHashSchema, definitionId: segmentedHashSchema, planId: segmentedHashSchema,
  provider: z.literal('authored-recording'), model: z.literal('lantern-segmented-v1'), adapterVersion: z.literal('recording-v1'),
  promptVersion: z.literal('evidence-synthesis-v1'), schemaVersion: z.literal('segment-synthesis-v1'), validatorVersion: z.literal('synthesis-validator-v1'),
}).strict();
export type SegmentedProvenance = z.infer<typeof segmentedProvenanceSchema>;
export type SegmentedDraftSeed = EvidenceEdit & { segmentedProposal: SegmentedProposalRef; context: ReviewContext };
export type SegmentedPage<T> = { items: T[]; nextCursor: string | null };
export type SegmentedCandidate = { id: string; target: string; documentId: string; textHash: string; start: number; end: number;
  quote: string; role: 'supporting' | 'limiting' | 'opposing'; rationales: string[]; segmentIds: string[] };
export type SegmentedRunSummary = { id: string; revision: number; status: 'open' | 'cancelled'; createdAt: string; updatedAt: string;
  baseReviewRevision: number; evidenceGeneration: number; attemptCount: number; activeAttemptId: string | null;
  currentOutcomeId: string | null; retainedBytes: number; admittedBytes: number; admittedRecords: number };
export type SegmentedRunsView = { eligible: boolean; eligibilityMessage: string; currentRunId: string | null; runs: SegmentedPage<SegmentedRunSummary> };
export type SegmentedAttemptView = { id: string; scope: SegmentedAttemptScope; ordinal: number; sequence: number; requestId: string;
  status: 'queued' | 'running' | 'unknown' | 'completed' | 'failed' | 'cancelled'; dispatched: boolean; createdAt: string; updatedAt: string;
  outcomeId: string | null; outputId: string | null; evidenceGeneration: number; evidenceRevision: string;
  eligibleAtCompletion: boolean; ineligibleReason: string; message: string; knownCostMicros: 0; settled: boolean };
export type SegmentedRunView = { run: SegmentedRunSummary; spec: { id: string; bundleId: string; textHash: string; definitionId: string; planId: string; provider: string; model: string };
  segments: { id: string; documentId: string; start: number; end: number; attempts: number; state: string }[];
  measures: { id: string; label: string; targetIds: string[]; ready: boolean; proposalOutcomeId: string | null; eligible: boolean; reason: string }[];
  synthesisAttempts: number; attempts: SegmentedPage<SegmentedAttemptView> };
export type SegmentedTargetView = { target: string; original: { state: string; rationale: string; question: string; candidateIds: string[]; segmentIds: string[] };
  derived: { state: string; question: string; ready: boolean; missing: string[] }; candidateCount: number };
export type SegmentedProposalView = { reference: SegmentedProposalRef; provenance: SegmentedProvenance; current: boolean; eligible: boolean; reason: string;
  scope: SourceBundle['scope']; requiredQuestion: string; targets: SegmentedTargetView[]; candidates: SegmentedPage<SegmentedCandidate>;
  seed: SegmentedDraftSeed | null };
export type SegmentedRequestView = { id: string; requestKey: string; dispatchKey: string; request: Record<string, unknown> };
export type SegmentedOutputView = { id: string; encoding: 'base64'; byteLength: number; base64: string; text: string | null;
  decodeError: string | null; statuses: ('completed' | 'refused' | 'incomplete')[] };

// Public authored source, not a provider result. The server independently checks every input field
// and the exact adopted practice definition before accepting the recording.
export const SEGMENTED_EXAMPLE_SUPPORT = 'We delete school account records and backups within thirty days after termination.';
export const SEGMENTED_EXAMPLE_OPPOSITION = 'School account backups remain stored indefinitely after termination.';
export function segmentedExampleCapture(): { name: string; sourceKind: 'bundle'; sourceLabel: string; profileVersion: 'community-evidence-v1'; sourceBundle: SourceBundleInput } {
  const scope = { product: 'Fictional Lantern Notebook', accounts: 'District-managed school accounts', jurisdiction: 'Synthetic jurisdiction' };
  return { name: 'Lantern segmented review lab', sourceKind: 'bundle', sourceLabel: 'Authored synthetic segmented fixture', profileVersion: 'community-evidence-v1',
    sourceBundle: { version: 'pasted-source-bundle-v2', scope, documents: [
      { id: 'school-policy', label: 'Authored school policy', origin: 'Synthetic fixture', scope, applicability: 'matched', effectiveDates: [], capture: 'complete', requiredFor: ['*'], exclusionReason: '',
        text: `# School account terms\n${SEGMENTED_EXAMPLE_SUPPORT}\n${'Synthetic layout information. 🌱\n'.repeat(620)}\n# Final section\n${SEGMENTED_EXAMPLE_OPPOSITION}` },
      { id: 'annex', label: 'Missing retention annex', origin: 'Synthetic fixture', scope, applicability: 'matched', effectiveDates: [], capture: 'missing', requiredFor: ['deletion'], exclusionReason: '', text: '' },
    ], links: [] } };
}
