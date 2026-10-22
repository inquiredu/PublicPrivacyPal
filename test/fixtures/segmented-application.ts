import { randomUUID } from 'node:crypto';
import type { Review } from '../../shared/review.ts';
import { segmentedExampleCapture } from '../../shared/segmented-assistance.ts';
import { captureSourceBundle, bundleText } from '../../server/source-bundle.ts';
import { practiceContract, digest } from '../../server/evaluation.ts';
import { commandIdentity } from '../../server/commands.ts';
import { createSegmentedSpec, findingBaseline, type SegmentedRun } from '../../server/segmented-review-storage.ts';
import { measuresFor } from '../../shared/evaluation.ts';

export function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
/** Pure authored fixtures. Transactions, leases and receipts are exercised against actual emulators. */
export function segmentedFixtureReview(): Review {
  const at = '2026-10-20T12:00:00.000Z', contract = practiceContract('community-evidence-v1');
  const bundle = captureSourceBundle(segmentedExampleCapture().sourceBundle, contract, at);
  return { id: randomUUID(), name: 'Authored segmented unit review', fixtureId: null, sourceKind: 'bundle', sourceLabel: 'Synthetic authored input',
    sourceHash: bundle.id, sourceVersion: 3, sourceCapturedAt: at, sourceBundle: bundle, sourceText: bundleText(bundle), contract, profileVersion: 'community-evidence-v1',
    revision: 1, analysis: null, decision: null, published: false, createdAt: at, updatedAt: at,
    job: { id: randomUUID(), status: 'awaiting_review', attempt: 0, actorUid: 'synthetic-reviewer', actorEmail: 'reviewer@school.example', leaseUntil: 0, error: null } };
}
export function unreservedSegmentedRun(review = segmentedFixtureReview()): SegmentedRun {
  const command = commandIdentity(randomUUID(), `/api/reviews/${review.id}`, { action: 'start_segmented_run', revision: review.revision });
  return { version: 'segmented-run-head-v1', id: randomUUID(), reviewId: review.id, specId: digest(createSegmentedSpec(review)), actorUid: review.job.actorUid,
    actorEmail: review.job.actorEmail, baseReviewRevision: review.revision + 1, baselineFindings: Object.fromEntries(measuresFor(review).map(m => [m.id, findingBaseline(review, m.id)])),
    revision: 1, status: 'open', createdAt: review.createdAt, updatedAt: review.updatedAt, evidenceGeneration: 0, attemptCount: 0, activeAttemptId: null,
    currentOutcomeId: null, currentSynthesisAttemptId: null, admittedBytes: 0, admittedRecords: 0,
    startCommand: { ...command, actorUid: review.job.actorUid, appliedReviewRevision: review.revision + 1, appliedRunRevision: 1 }, cancelCommand: null };
}
