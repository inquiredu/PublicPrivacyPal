import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { evidenceDraftSchema } from '../../shared/drafts';
import { SegmentedProposalView } from '../../src/SegmentedProposalView';
import { FindingContext } from '../../src/FindingContext';
import { DraftStore } from '../../src/draft-store';
import { attachSegmentedCandidate, installSegmentedDraft, sameSegmentedReference, segmentedEvidenceSizeError, segmentedProposalPath } from '../../src/segmented-review';
import { segmentedReviewFixture, SegmentedMemoryStorage } from '../fixtures/segmented-review';

function prepared(clauses = 0) {
  const fixture = segmentedReviewFixture(clauses); const storage = new SegmentedMemoryStorage(); const store = new DraftStore('synthetic-reviewer', storage);
  installSegmentedDraft(store, fixture.review, fixture.proposal, fixture.review.revision);
  return { ...fixture, store, storage, draft: store.get(`evidence:${fixture.review.id}`, evidenceDraftSchema)! };
}
test('explicit handoff uses the verified unresolved seed without accepting original findings or machine acknowledgments', () => {
  const { draft, proposal } = prepared(2);
  assert.equal(proposal.targets[0].original.state, 'established'); assert.equal(proposal.targets[0].derived.state, 'unavailable');
  assert.equal(draft.finding, 'unresolved'); assert.deepEqual(draft.citations, []); assert.deepEqual(draft.sourceReview?.segmentIds, []);
  assert.ok(draft.requirements!.requirements.every(r => r.status === 'unavailable' && !r.citations.length));
  assert.equal(draft.requirements?.scopeStatus, 'unresolved'); assert.equal(draft.context?.question, proposal.requiredQuestion);
  assert.deepEqual(draft.segmentedProposal, proposal.reference); assert.notEqual(draft.context?.question, proposal.targets[0].original.question);
});
test('late preparation cannot replace evidence, decision, service or pending-command work', () => {
  const { review, proposal } = segmentedReviewFixture();
  for (const key of [`evidence:${review.id}`, `decision:${review.id}`, `service:${review.id}`, 'pending-command']) {
    const store = new DraftStore(`case-${key}`, new SegmentedMemoryStorage()); const original = { unfinished: 'Exact text ' }; store.set(key, original);
    assert.throws(() => installSegmentedDraft(store, review, proposal, review.revision), /existing draft or pending/);
    assert.equal(store.has(key), true); assert.deepEqual(store.get(key, z.unknown()), original);
  }
});
test('revision changes, stale results and altered seed authority fail without writing a draft', () => {
  const { review, proposal } = segmentedReviewFixture(); const store = new DraftStore('stale', new SegmentedMemoryStorage());
  assert.throws(() => installSegmentedDraft(store, { ...review, revision: review.revision + 1 }, proposal, review.revision), /review changed/);
  assert.throws(() => installSegmentedDraft(store, review, { ...proposal, current: false }, review.revision), /historical/);
  assert.throws(() => installSegmentedDraft(store, review, { ...proposal, seed: { ...proposal.seed!, finding: 'yes' } }, review.revision), /must start unresolved/);
  assert.throws(() => installSegmentedDraft(store, review, { ...proposal, seed: { ...proposal.seed!, sourceReview: { ...proposal.seed!.sourceReview!, segmentIds: ['s1'] } } }, review.revision), /must start unresolved/);
  assert.equal(store.has(`evidence:${review.id}`), false);
});
test('a refined handoff requires every adopted target exactly once', () => {
  const { review, proposal } = segmentedReviewFixture(2); const store = new DraftStore('targets', new SegmentedMemoryStorage());
  const reference = { ...proposal.reference, targetIds: [proposal.reference.targetIds[0]] };
  assert.throws(() => installSegmentedDraft(store, review, { ...proposal, reference, seed: { ...proposal.seed!, segmentedProposal: reference } }, review.revision), /every adopted target/);
  assert.equal(sameSegmentedReference(proposal.reference, { ...proposal.reference, targetIds: [proposal.reference.targetIds[0], proposal.reference.targetIds[0]] }), false);
});
test('ordinary candidate attachment is explicit, limited to three, and retains supporting, limiting and opposing originals', () => {
  const { review, proposal, candidates, draft } = prepared(); let selected = draft;
  for (const candidate of candidates.slice(0, 3)) selected = attachSegmentedCandidate(selected, proposal.reference, candidate, review);
  assert.equal(selected.citations.length, 3); assert.equal(selected.finding, 'unresolved'); assert.deepEqual(selected.sourceReview?.segmentIds, []);
  assert.throws(() => attachSegmentedCandidate(selected, proposal.reference, candidates[3], review), /up to three passages/);
  assert.throws(() => attachSegmentedCandidate(selected, proposal.reference, candidates[0], review), /already attached/);
  assert.equal(proposal.candidates.items.length, 4); assert.deepEqual(selected.context, draft.context); assert.deepEqual(selected.segmentedProposal, draft.segmentedProposal);
});
test('eight clauses can each retain three explicitly selected role-specific passages without resolving any clause', () => {
  const { review, proposal, candidates, draft } = prepared(8); let selected = draft;
  for (const target of proposal.reference.targetIds) for (const candidate of candidates.filter(c => c.target === target).slice(0, 3)) selected = attachSegmentedCandidate(selected, proposal.reference, candidate, review);
  assert.equal(selected.citations.length, 24);
  for (const clause of selected.requirements!.requirements) { assert.equal(clause.status, 'unavailable'); assert.deepEqual(clause.citations.map(c => c.role), ['support', 'limitation', 'opposition']); }
  assert.throws(() => attachSegmentedCandidate(selected, proposal.reference, candidates[3], review), /up to three passages for this clause/);
  assert.deepEqual(selected.sourceReview?.segmentIds, []); assert.equal(selected.requirements?.scopeStatus, 'unresolved');
});
test('foreign outcome, target, source or document cannot attach to an existing draft', () => {
  const { review, proposal, candidates, draft } = prepared(); const candidate = candidates[0];
  assert.throws(() => attachSegmentedCandidate(draft, { ...proposal.reference, outcomeId: 'f'.repeat(64) }, candidate, review), /different proposal/);
  assert.throws(() => attachSegmentedCandidate(draft, proposal.reference, { ...candidate, target: 'sale' }, review), /outside the adopted/);
  assert.throws(() => attachSegmentedCandidate(draft, proposal.reference, { ...candidate, quote: 'Invented quote' }, review), /saved source/);
  assert.throws(() => attachSegmentedCandidate(draft, proposal.reference, { ...candidate, documentId: 'annex' }, review), /dependencies/);
  assert.deepEqual(draft.citations, []);
});
test('adding evidence to a matching historical correction preserves qualification, partial acknowledgments and original identity', () => {
  const { review, proposal, candidates, draft } = prepared();
  const correction = { ...draft, sourceReview: { ...draft.sourceReview!, segmentIds: ['s1'] }, context: { ...draft.context!, resolution: 'retained' as const }, rationale: '  Unfinished human correction ' };
  const next = attachSegmentedCandidate(correction, proposal.reference, candidates[0], review);
  assert.deepEqual(next.sourceReview, correction.sourceReview); assert.deepEqual(next.context, correction.context); assert.equal(next.rationale, correction.rationale); assert.deepEqual(next.segmentedProposal, correction.segmentedProposal);
  assert.throws(() => attachSegmentedCandidate(correction, proposal.reference, candidates[1], { ...review, revision: review.revision + 1 }), /review changed/);
});
test('segmented drafts reload exact unfinished qualification text and original revision without following newer results', () => {
  const { review, proposal, draft, store, storage } = prepared(2); const text = '  Human  words\nwith trailing space ';
  const edited = { ...draft, rationale: text, context: { ...draft.context!, scope: text, question: text, note: text }, requirements: { ...draft.requirements!, scope: text, scopeQuestion: text, requirements: draft.requirements!.requirements.map(r => ({ ...r, rationale: text, question: text })) } };
  store.set(`evidence:${review.id}`, edited); store.set('location', 'another-review');
  const restored = new DraftStore('synthetic-reviewer', storage).get(`evidence:${review.id}`, evidenceDraftSchema);
  assert.deepEqual(restored, edited); assert.deepEqual(restored?.segmentedProposal, proposal.reference); assert.equal(restored?.revision, review.revision);
});
test('inspection renders original versus derived state, full questions, roles and source context distinctly', () => {
  const { review, proposal } = segmentedReviewFixture(); proposal.targets[0].original.question = 'Original qualification '.repeat(20);
  const html = renderToStaticMarkup(createElement(SegmentedProposalView, { review, value: proposal, onAttach: () => {} }));
  assert.match(html, /Original synthesis state:<\/strong> established/); assert.match(html, /Derived availability:<\/strong> unavailable/);
  assert.ok(html.includes(proposal.targets[0].original.question)); assert.ok(html.includes(proposal.requiredQuestion));
  assert.match(html, /Required human handoff question/); assert.match(html, /Original generated question/); assert.match(html, /Missing fictional annex/);
  assert.match(html, /supporting/); assert.match(html, /limiting/); assert.match(html, /opposing/); assert.match(html, /Retained earlier-attempt sighting/); assert.match(html, /Machine ranges are not human review acknowledgments/);
});
test('saved context retains original segmented provenance independently from human interpretation', () => {
  const { proposal } = segmentedReviewFixture();
  const html = renderToStaticMarkup(createElement(FindingContext, { finding: { id: 'deletion', finding: 'unresolved', quote: '', start: null, end: null, context: proposal.seed!.context, segmentedProvenance: proposal.provenance } }));
  assert.match(html, /Required human handoff qualification/); assert.match(html, /Human corrections retain this original reference/); assert.ok(html.includes(proposal.reference.outcomeId));
});
test('a full draft pool keeps existing passages and explains how to attach another clause candidate', () => {
  const { review, proposal, candidates, draft } = prepared(2);
  const pool = { ...draft, citations: candidates.slice(0, 6).map(({ quote, start, end }) => ({ quote, start, end })) };
  assert.throws(() => attachSegmentedCandidate(pool, proposal.reference, candidates[6], review), /draft passage pool is full/);
  assert.equal(pool.citations.length, 6); assert.ok(pool.requirements!.requirements.every(r => !r.citations.length));
});
test('citation overflow and cursor construction fail visibly without truncation or a guessed endpoint', () => {
  assert.match(segmentedEvidenceSizeError({ quote: '🌱'.repeat(18000) })!, /fewer or shorter passages/);
  assert.equal(segmentedEvidenceSizeError({ quote: 'Short exact passage' }), null);
  const { proposal } = segmentedReviewFixture();
  assert.equal(segmentedProposalPath('review', proposal.reference, 'page +/='), `/api/reviews/review/segmented-runs/${proposal.reference.runId}/proposals/${proposal.reference.outcomeId}/deletion?cursor=page%20%2B%2F%3D`);
});
