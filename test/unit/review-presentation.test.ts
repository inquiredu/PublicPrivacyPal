import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { analyzeSynthetic, fixtures } from '../../server/synthetic-analysis';
import { exampleTierPolicy } from '../../shared/service-policy';
import type { Review, ReviewContext } from '../../shared/review';
import type { ReviewSummary } from '../../shared/evaluation';
import { serviceValues } from '../fixtures/service';
import { ReviewCard } from '../../src/ReviewCard';
import { ReviewOverview } from '../../src/ReviewOverview';
import { reviewNextStep, reviewProgress, reviewQuestions } from '../../src/review-presentation';

function review(): Review {
  const at = '2026-10-17T12:00:00.000Z';
  const analysis = analyzeSynthetic('complete', fixtures.complete.text, 'analysis');
  analysis.findings.forEach(f => { f.reviewedBy = 'reviewer'; f.reviewedAt = at; });
  return { id: 'review', name: 'Cedar synthetic service', fixtureId: null, sourceKind: 'pasted', sourceText: fixtures.complete.text,
    revision: 1, createdAt: at, updatedAt: at, analysis, decision: null, published: false,
    job: { id: analysis.id, status: 'succeeded', attempt: 1, actorUid: 'reviewer', actorEmail: 'reviewer@maple.example', leaseUntil: 0, error: null },
    service: { version: 1, revision: 1, values: structuredClone(serviceValues), policy: exampleTierPolicy(), settingsRevision: 1, updatedAt: at, updatedBy: 'reviewer', rationale: 'Synthetic facts.' } };
}
const context = (question: string): ReviewContext => ({ scope: 'School accounts', uncertainty: 'missing_source', question, resolution: 'retained', note: '', citations: [] });
function decide(r: Review) { r.decision = { analysisId: r.analysis!.id, serviceRevision: r.service!.revision, actorUid: 'reviewer', at: r.updatedAt, outcome: 'conditional', rationale: 'Synthetic review', conditions: 'Fictional pilot only.', summary: 'District-authored wording.', category: 'Learning' }; }

test('a completed extraction, unresolved finding and failed retry never become a district decision', () => {
  const r = review();
  assert.equal(reviewNextStep(r).title, 'District decision needed');
  r.analysis!.findings[0].finding = 'unresolved';
  assert.equal(reviewNextStep(r).tab, 'compliance');
  r.job.status = 'failed';
  assert.equal(reviewNextStep(r).title, 'Analysis is incomplete');
  r.job.status = 'running';
  assert.equal(reviewNextStep(r).title, 'Analysis running');
  assert.equal(r.decision, null);
});

test('publication guidance distinguishes saved approval, stale decisions, declined use and unmet current requirements', () => {
  const r = review(); decide(r);
  assert.equal(reviewNextStep(r).title, 'Review wording before publication');
  r.published = true;
  assert.equal(reviewNextStep(r).title, 'Published in the local libraries');
  r.service!.values.dpaExpires = '2020-01-01';
  assert.equal(reviewNextStep(r).title, 'Published service needs attention');
  assert.equal(r.published, true);
  r.published = false; r.service!.values.dpaExpires = '2099-01-01';
  r.decision!.serviceRevision = 0;
  assert.equal(reviewNextStep(r).title, 'District decision needed');
  r.decision!.serviceRevision = 1; r.decision!.outcome = 'declined';
  assert.equal(reviewNextStep(r).title, 'District use declined');
  r.service!.values.dpaStatus = 'absent';
  assert.equal(reviewNextStep(r).title, 'District use declined');
});

test('saved unfinished work is distinct from untouched measures and resolved work', () => {
  const r = review();
  r.analysis!.findings[0].finding = 'unresolved';
  r.analysis!.findings[1].reviewedBy = undefined;
  assert.deepEqual(reviewProgress(r), { total: 8, resolved: 6, unresolved: 1, unreviewed: 1 });
  r.analysis!.findings[2].context = context('Which agreement covers backups?');
  assert.deepEqual(reviewProgress(r), { total: 8, resolved: 5, unresolved: 2, unreviewed: 1 });
});

test('open questions use current human clauses, not resolved or superseded original proposal qualifications', () => {
  const r = review(); const f = r.analysis!.findings[0];
  f.context = context('Original proposal question');
  assert.equal(reviewQuestions(r)[0].question, 'Original proposal question');
  f.context.resolution = 'resolved'; assert.equal(reviewQuestions(r).length, 0);
  f.context.resolution = 'retained';
  f.provenance = { jobId: 'original', resultId: 'result', sourceHash: 'source', rubricId: 'rubric', promptVersion: 'v3', schemaVersion: 'v3', provider: 'offline', model: 'recorded', state: 'unresolved', sourceStatus: 'usable' };
  f.requirements = { version: 'requirements-v1', scope: 'School accounts', sourceStatus: 'usable', scopeStatus: 'unresolved', scopeQuestion: 'Which school terms apply?', requirements: [{ id: 'backups', status: 'unavailable', rationale: 'Missing addendum.', question: 'What is the backup retention period?', citations: [] }] };
  assert.deepEqual(reviewQuestions(r).map(q => q.question), ['Which school terms apply?', 'What is the backup retention period?']);
});

test('cards never label job status as a decision or imply a missing score is zero', () => {
  const summary: ReviewSummary = { id: 'one', name: 'Practice', revision: 1, createdAt: '', updatedAt: '', published: false, status: 'succeeded', score: null, reviewed: 0, measureCount: 8 };
  const html = renderToStaticMarkup(createElement(ReviewCard, { review: summary, selected: true, onSelect: () => {} }));
  assert.match(html, /District decision<\/strong><br\/>Inspect in review details/);
  assert.match(html, /Saved evaluation available/); assert.match(html, /Score pending/);
  assert.doesNotMatch(html, /0\/100|Decision: Ready/);
  assert.match(html, /aria-current="true"/);
});

test('overview preserves earlier wording with an explicit stale label and keeps drafts separate from saved facts', () => {
  const r = review(); decide(r); r.decision!.analysisId = 'earlier';
  const before = JSON.stringify(r);
  const html = renderToStaticMarkup(createElement(ReviewOverview, { review: r, readOnly: false, openTab: () => {}, draftTab: 'compliance' }));
  assert.match(html, /Earlier district wording/); assert.match(html, /District-authored wording/);
  assert.match(html, /Continue your unsaved draft/); assert.match(html, /describes the saved record/);
  assert.equal(JSON.stringify(r), before);
  assert.equal(reviewNextStep(review(), true).action, 'Inspect decision');
});
