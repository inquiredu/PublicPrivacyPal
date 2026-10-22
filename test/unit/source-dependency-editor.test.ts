import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceBundleCapture, changeBundleScope, useReviewScope } from '../../src/SourceBundleCapture';
import { SourceBundleView } from '../../src/SourceBundleView';
import { SourceDependencyEditor, chooseDependency, dependencyErrors } from '../../src/SourceDependencyEditor';
import { dependencyContract, dependencyDefinitions, dependencyWalkthrough } from '../fixtures/source-dependency-editor';
import { captureSourceBundle } from '../../server/source-bundle';
import { sourceCoverage, sourceBundleDraftSchema, sourceBundleInputSchema } from '../../shared/source-bundle';
import { captureDraftSchema } from '../../shared/drafts';
import { DraftStore } from '../../src/draft-store';
import { DEFAULT_PROFILE } from '../../shared/scoring/profiles';

const capturedAt = '2026-10-18T12:00:00.000Z';
test('mixed clause/measure dependencies retain useful policy evidence while a required addendum is unavailable', () => {
  const draft = dependencyWalkthrough();
  assert.deepEqual(dependencyErrors(draft, dependencyDefinitions), []);
  const bundle = captureSourceBundle(draft, dependencyContract, capturedAt);
  const coverage = sourceCoverage(bundle, dependencyContract);
  assert.deepEqual(coverage.targets.map(t => [t.target, t.ready, t.documents]), [
    ['deletion/active', true, ['policy']], ['deletion/copies', false, ['backup']], ['transfer', true, ['policy']],
  ]);
  assert.equal(bundle.documents[0].text, draft.documents[0].text);
  assert.equal(bundle.documents[2].text, draft.documents[2].text);
  assert.equal(bundle.links[1].exclusionReason, draft.links[1].exclusionReason);
});

test('a rubric revision keeps disabled and removed targets visible until the reviewer reconciles them', () => {
  const draft = dependencyWalkthrough();
  draft.documents[0].requiredFor.push('advertising', 'deletion/old_clause');
  const original = JSON.stringify(draft);
  assert.ok(dependencyErrors(draft, dependencyDefinitions).some(e => e.includes('no longer enabled or defined')));
  assert.throws(() => captureSourceBundle(draft, dependencyContract, capturedAt), /Unknown or repeated/);
  const html = renderToStaticMarkup(createElement(SourceDependencyEditor, { value: draft, definitions: { ...dependencyDefinitions, settingsRevision: 5 }, onChange: () => {} }));
  assert.match(html, /Settings revision 5/);
  assert.match(html, /Advertising restriction — disabled/);
  assert.match(html, /deletion\/old_clause/);
  assert.match(html, /Retained selections need review/);
  assert.equal(JSON.stringify(draft), original);
});

test('changing scope preserves exact document declarations and reconfirmation never carries forward matched applicability', () => {
  const draft = dependencyWalkthrough(); const before = JSON.stringify(draft);
  const changed = changeBundleScope(draft, { ...draft.scope, accounts: 'Independent accounts' });
  assert.deepEqual(changed.documents, draft.documents);
  assert.deepEqual(changed.links, draft.links);
  assert.ok(dependencyErrors(changed, dependencyDefinitions).some(e => e.includes('reconcile its declared scope')));
  const reconciled = useReviewScope(changed, 'policy');
  assert.equal(reconciled.documents[0].scope.accounts, 'Independent accounts');
  assert.equal(reconciled.documents[0].applicability, 'unresolved');
  assert.equal(reconciled.documents[0].text, draft.documents[0].text);
  assert.deepEqual(reconciled.documents[0].requiredFor, draft.documents[0].requiredFor);
  assert.deepEqual(reconciled.documents[1], draft.documents[1]);
  assert.equal(JSON.stringify(draft), before);
});

test('selection changes preserve document content, linked references and exclusion rationale', () => {
  const draft = dependencyWalkthrough();
  draft.documents[0].exclusionReason = 'A draft explanation retained until explicitly applied or cleared.';
  const selected = chooseDependency(draft, 'policy', 'deletion/copies', true);
  const removed = chooseDependency(selected, 'policy', 'transfer', false);
  assert.deepEqual(removed.documents[0], { ...draft.documents[0], requiredFor: ['deletion/active', 'deletion/copies'] });
  assert.deepEqual(removed.links, draft.links);
  assert.ok(dependencyErrors(removed, dependencyDefinitions).some(e => e.includes('explicitly clear its reason')));
});

test('selection limits preserve the existing draft instead of making it fail its storage schema', () => {
  const draft = dependencyWalkthrough();
  draft.documents[0].requiredFor = Array.from({ length: 100 }, (_, i) => `retained_${i}`);
  const selected = chooseDependency(draft, 'policy', 'transfer', true);
  assert.deepEqual(selected.documents[0].requiredFor, draft.documents[0].requiredFor);
  assert.ok(sourceBundleDraftSchema.safeParse(selected).success);
  const removed = chooseDependency(selected, 'policy', 'retained_0', false);
  assert.equal(chooseDependency(removed, 'policy', 'transfer', true).documents[0].requiredFor.length, 100);
});

test('unexplained exclusions, orphan links and uncovered requirements fail before submission and on the server', () => {
  const draft = dependencyWalkthrough();
  draft.documents[1].requiredFor = [];
  draft.links[0].documentId = 'not-in-manifest';
  draft.links[1].exclusionReason = '';
  const errors = dependencyErrors(draft, dependencyDefinitions);
  assert.ok(errors.some(e => e.includes('explain why this document is excluded')));
  assert.ok(errors.some(e => e.includes('Deletion commitments: declare')));
  assert.ok(errors.some(e => e.includes('select an included document')));
  assert.ok(errors.some(e => e.includes('explain the exclusion')));
  assert.throws(() => captureSourceBundle(draft, dependencyContract, capturedAt), /Explain a document excluded/);
});

test('all-documents remains conservative and no definition payload means no invented precise choices', () => {
  const draft = dependencyWalkthrough(); draft.documents.forEach(d => { d.requiredFor = ['*']; d.exclusionReason = ''; d.scope = { ...draft.scope }; });
  const coverage = sourceCoverage(captureSourceBundle(draft, dependencyContract, capturedAt), dependencyContract);
  assert.ok(coverage.targets.every(t => !t.ready && t.documents.length === 3));
  assert.ok(dependencyErrors(draft, undefined).some(e => e.includes('Load and adopt')));
  const html = renderToStaticMarkup(createElement(SourceDependencyEditor, { value: draft, onChange: () => {} }));
  assert.match(html, /Exact measure definitions are unavailable/);
  assert.doesNotMatch(html, /Choose measures or clauses/);
});

test('dependency and scope drafts round-trip across navigation without changing the original revision', () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); }, key: (index: number) => [...memory.keys()][index] ?? null, get length() { return memory.size; } };
  const store = new DraftStore('synthetic-user', storage);
  const capture = { sourceKind: 'bundle' as const, name: 'Cedar dependency walkthrough', sourceLabel: 'Synthetic policy set', sourceText: '', fixtureId: 'complete' as const, profileVersion: DEFAULT_PROFILE, rubricMode: 'district' as const, settingsRevision: 4, sourceBundle: dependencyWalkthrough() };
  capture.sourceBundle.documents[1].exclusionReason = '  Unfinished  explanation\nwhile existing selections stay retained.  ';
  capture.sourceBundle.links[1].exclusionReason = '  Outside  school scope\nwith a retained trailing space. ';
  // Simulate the parse performed between controlled-textarea keystrokes: a space must remain
  // available to separate the next word, not be trimmed into a concatenated word.
  for (const reason of ['Outside', 'Outside ', 'Outside school', 'Outside school ']) {
    const typing = structuredClone(capture);
    typing.sourceBundle.documents[1].exclusionReason = reason;
    typing.sourceBundle.links[1].exclusionReason = reason;
    store.set('capture', typing);
    const rendered = store.get('capture', captureDraftSchema)!;
    assert.equal(rendered.sourceBundle!.documents[1].exclusionReason, reason);
    assert.equal(rendered.sourceBundle!.links[1].exclusionReason, reason);
  }
  store.set('capture', capture); store.set('location', 'another-review');
  const restored = new DraftStore('synthetic-user', storage).get('capture', captureDraftSchema);
  assert.deepEqual(restored, capture);
  assert.equal(restored?.settingsRevision, 4);
  assert.equal(restored?.sourceBundle?.documents[1].exclusionReason, capture.sourceBundle.documents[1].exclusionReason);
  assert.equal(restored?.sourceBundle?.links[1].exclusionReason, capture.sourceBundle.links[1].exclusionReason);
  const submitted = sourceBundleInputSchema.parse(restored!.sourceBundle);
  assert.equal(submitted.documents[1].exclusionReason, capture.sourceBundle.documents[1].exclusionReason.trim());
  assert.equal(submitted.links[1].exclusionReason, capture.sourceBundle.links[1].exclusionReason.trim());
});

test('an unfinished linked-material label survives draft reload but cannot be submitted as a capture', () => {
  const memory = new Map<string, string>();
  const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); }, key: (index: number) => [...memory.keys()][index] ?? null, get length() { return memory.size; } };
  const store = new DraftStore('unfinished-link-user', storage);
  const capture = { sourceKind: 'bundle' as const, name: 'Cedar unfinished link', sourceLabel: 'Synthetic policy set', sourceText: '', fixtureId: 'complete' as const, profileVersion: DEFAULT_PROFILE, rubricMode: 'district' as const, settingsRevision: 4, sourceBundle: dependencyWalkthrough() };
  capture.sourceBundle.links.push({ from: 'policy', label: '', documentId: null, exclusionReason: '' });
  store.set('capture', capture);
  const restored = new DraftStore('unfinished-link-user', storage).get('capture', captureDraftSchema);
  assert.deepEqual(restored, capture);
  assert.equal(restored?.sourceBundle?.documents[0].text, capture.sourceBundle.documents[0].text);
  assert.ok(dependencyErrors(restored!.sourceBundle!, dependencyDefinitions).some(e => e.includes('supply a link or reference label')));
  assert.throws(() => captureSourceBundle(restored!.sourceBundle, dependencyContract, capturedAt));
  restored!.sourceBundle!.links.at(-1)!.label = 'Fictional reference being investigated';
  restored!.sourceBundle!.links.at(-1)!.documentId = 'backup';
  assert.deepEqual(dependencyErrors(restored!.sourceBundle!, dependencyDefinitions), []);
  assert.doesNotThrow(() => captureSourceBundle(restored!.sourceBundle, dependencyContract, capturedAt));
});

test('saved source view uses adopted labels and distinguishes an excluded link from an unavailable included document', () => {
  const bundle = captureSourceBundle(dependencyWalkthrough(), dependencyContract, capturedAt);
  const before = JSON.stringify(bundle);
  const html = renderToStaticMarkup(createElement(SourceBundleView, { bundle, contract: dependencyContract }));
  assert.match(html, /Identifiable backup copies are included in deletion/);
  assert.match(html, /Unresolved documents: Required backup addendum/);
  assert.match(html, /Included in manifest: Required backup addendum/);
  assert.match(html, /Excluded by reviewer:/);
  assert.match(html, /not verification that the document is irrelevant/);
  assert.equal(JSON.stringify(bundle), before);
});

test('capture has native labeled controls, retains unavailable text, and prevents deleting linked empty documents', () => {
  const draft = dependencyWalkthrough();
  draft.documents[1].text = 'Keep this draft until the reviewer chooses excerpt or clears it.';
  draft.documents[1].label = ''; draft.documents[1].origin = '';
  const html = renderToStaticMarkup(createElement(SourceBundleCapture, { value: draft, definitions: dependencyDefinitions, onChange: () => {} }));
  assert.match(html, /Clear this retained text before saving as unavailable/);
  assert.match(html, /Keep this draft until/);
  assert.match(html, /disabled="">Remove empty document 2/);
  assert.match(html, /<legend>Linked material 1<\/legend>/);
  assert.match(html, /<summary>Deletion commitments — selected clauses<\/summary>/);
  assert.match(html, /<label class="dependency-option"><input type="checkbox"/);
  assert.ok(sourceBundleDraftSchema.safeParse(draft).success);
});
