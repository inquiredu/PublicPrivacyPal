import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createElement, Fragment } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceDependencyEditor, dependencyErrors } from '../../src/SourceDependencyEditor';
import { dependencyFeedback, dependencyTargetId, reconcileDependencyLinks, removeDependencyLinkIdentity } from '../../src/source-dependency-feedback';
import { sourceBundleDraftSchema } from '../../shared/source-bundle';
import { dependencyDefinitions, dependencyWalkthrough } from '../fixtures/source-dependency-editor';
import { identicalBlankLinks, invalidDependencyFeedback } from '../fixtures/source-dependency-feedback';

const render = (value = invalidDependencyFeedback()) => renderToStaticMarkup(createElement(SourceDependencyEditor, { value, definitions: dependencyDefinitions, onChange: () => assert.fail('Rendering must not change a draft') }));
// Inspect relationships in rendered HTML, not exact serialization or class/attribute ordering.
function elements(html: string) {
  return [...html.matchAll(/<([a-z][\w-]*)\b([^>]*)>/g)].map(match => ({
    tag: match[1], attrs: Object.fromEntries([...match[2].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]])),
  }));
}

test('declaration feedback preserves the existing messages, ordering, whitespace and field meaning', () => {
  const value = invalidDependencyFeedback(); const before = structuredClone(value);
  const feedback = dependencyFeedback(value, dependencyDefinitions);
  assert.deepEqual(feedback.map(error => error.message), [
    'Cedar school policy: reconcile the retained dependencies that are no longer enabled or defined.',
    'Cedar school policy: apply the exclusion or explicitly clear its reason before requiring this document.',
    'Cedar school policy: reconcile its declared scope with the review scope.',
    'Required backup addendum: explain why this document is excluded from required coverage.',
    'Deletion commitments: declare at least one required document for copies.',
    'Transfer notice: declare at least one required document.',
    'Linked material 1: select the document containing this reference.',
    'Linked material 1: supply a link or reference label.',
    'Linked material 1: select an included document, including an unavailable one when needed.',
    'Linked material 1: explicitly clear its exclusion reason before including the document.',
    'Linked material 2: supply a link or reference label.',
    'Linked material 2: explain the exclusion or select an included document.',
  ]);
  assert.deepEqual(dependencyErrors(value, dependencyDefinitions), feedback.map(error => error.message));
  assert.deepEqual(feedback.filter(error => error.target.kind === 'link').map(error => error.target), [
    { kind: 'link', index: 0, field: 'from' }, { kind: 'link', index: 0, field: 'label' },
    { kind: 'link', index: 0, field: 'documentId' }, { kind: 'link', index: 0, field: 'exclusionReason' },
    { kind: 'link', index: 1, field: 'label' }, { kind: 'link', index: 1, field: 'exclusionReason' },
  ]);
  assert.deepEqual(value, before);
});

test('document feedback stays attached to document identity after duplicate labels, insertion and removal', () => {
  const value = invalidDependencyFeedback(); value.documents.forEach(document => { document.label = 'Same label'; });
  const ids = (draft: typeof value) => dependencyFeedback(draft, dependencyDefinitions)
    .filter(error => error.target.kind === 'document')
    .map(error => [error.code, dependencyTargetId('capture', error.target, [])]);
  const original = ids(value);
  const inserted = structuredClone(value); inserted.documents.unshift({ ...structuredClone(value.documents[2]), id: 'extra' });
  assert.deepEqual(ids(inserted), original);
  inserted.documents = inserted.documents.filter(document => document.id !== 'extra');
  inserted.documents.reverse();
  assert.deepEqual(ids(inserted).sort(), original.sort());
  assert.notEqual(dependencyTargetId('capture', { kind: 'document', id: 'policy', field: 'exclusionReason' }, []), dependencyTargetId('capture', { kind: 'document', id: 'backup', field: 'exclusionReason' }, []));
});

test('identical blank link fields retain distinct IDs through edits, reload clones, sibling removal and new rows', () => {
  let value = identicalBlankLinks(); let identity = reconcileDependencyLinks(undefined, value.links);
  const originalKeys = [...identity.keys]; assert.equal(new Set(originalKeys).size, 3);
  const lastTarget = () => dependencyTargetId('capture', { kind: 'link', index: identity.keys.length - 1, field: 'label' }, identity.keys);
  const originalLastTarget = lastTarget();
  value = structuredClone(value);
  value.links[0] = { ...value.links[0], label: '  Keep  exact spaces ' };
  value = sourceBundleDraftSchema.parse(value);
  identity = reconcileDependencyLinks(identity, value.links);
  assert.deepEqual(identity.keys, originalKeys);
  value = structuredClone(value);
  value.links[0] = { ...value.links[0], label: '' };
  identity = reconcileDependencyLinks(identity, structuredClone(value.links));
  assert.deepEqual(identity.keys, originalKeys);
  identity = removeDependencyLinkIdentity(identity, 0);
  value.links = identity.source;
  identity = reconcileDependencyLinks(identity, sourceBundleDraftSchema.parse(value).links);
  assert.deepEqual(identity.keys, originalKeys.slice(1)); assert.equal(lastTarget(), originalLastTarget);
  value.links = [...identity.source, { ...identity.source[0] }];
  identity = reconcileDependencyLinks(identity, value.links);
  assert.deepEqual(identity.keys.slice(0, 2), originalKeys.slice(1));
  assert.ok(!originalKeys.includes(identity.keys[2]));
  assert.equal(new Set(identity.keys).size, 3);
  assert.deepEqual(Object.keys(sourceBundleDraftSchema.parse(value).links[0]).sort(), ['documentId', 'exclusionReason', 'from', 'label']);
});

test('each summary destination is focusable and names its exact inline error without unrelated invalid controls', () => {
  const html = render(); const nodes = elements(html);
  const ids = nodes.filter(node => node.attrs.id).map(node => node.attrs.id);
  assert.equal(new Set(ids).size, ids.length);
  const byId = new Map(nodes.filter(node => node.attrs.id).map(node => [node.attrs.id, node]));
  const summaryLinks = nodes.filter(node => node.tag === 'a' && node.attrs.href?.startsWith('#'));
  assert.equal(summaryLinks.length, 12);
  for (const link of summaryLinks) {
    const target = byId.get(link.attrs.href.slice(1)); assert.ok(target, 'summary destination exists');
    assert.ok(['input', 'textarea', 'select'].includes(target.tag) || target.attrs.tabindex === '-1');
    assert.equal(target.attrs['aria-invalid'], 'true');
    for (const error of target.attrs['aria-describedby'].split(' ')) assert.equal(byId.get(error)?.tag, 'p');
  }
  const linkLabel = nodes.find(node => node.attrs.id?.endsWith('-link-1-label'))!;
  assert.ok(linkLabel.attrs['aria-describedby'].endsWith('-label-error-label'));
  const validSource = nodes.find(node => node.attrs.id?.endsWith('-link-1-from'))!;
  assert.equal(validSource.attrs['aria-invalid'], undefined);
  assert.equal(validSource.attrs['aria-describedby'], undefined);
  assert.ok(nodes.filter(node => node.attrs.type === 'checkbox').every(node => !node.attrs['aria-invalid']));
  const summary = nodes.find(node => node.attrs.class === 'notice dependency-feedback')!;
  assert.equal(byId.get(summary.attrs['aria-labelledby'])?.tag, 'h4');
  assert.equal(summary.attrs.role, undefined); assert.equal(summary.attrs['aria-live'], undefined);
});

test('clearing an error removes its association while retaining unrelated errors and exact source drafts', () => {
  const value = invalidDependencyFeedback(); value.links[1].label = '  Unfinished  reference label ';
  const before = structuredClone(value); const nodes = elements(render(value));
  const label = nodes.find(node => node.attrs.id?.endsWith('-link-1-label'))!;
  assert.equal(label.attrs['aria-invalid'], undefined); assert.equal(label.attrs['aria-describedby'], undefined);
  assert.equal(label.attrs.value, value.links[1].label);
  const reason = nodes.find(node => node.attrs.id?.endsWith('-link-1-exclusionReason'))!;
  assert.equal(reason.attrs['aria-invalid'], 'true');
  assert.ok(!nodes.some(node => node.attrs.id?.endsWith('-link-1-label-error-label')));
  assert.deepEqual(value, before);
});

test('link and exclusion-reason errors do not mark otherwise valid dependency groups or choices invalid', () => {
  const value = dependencyWalkthrough();
  value.links[0].label = '';
  value.documents[0].exclusionReason = '  Still deciding  ';
  const nodes = elements(render(value));
  assert.ok(nodes.filter(node => node.attrs.id?.endsWith('-dependencies')).every(node => !node.attrs['aria-invalid'] && !node.attrs['aria-describedby']));
  assert.ok(nodes.filter(node => node.attrs.type === 'checkbox').every(node => !node.attrs['aria-invalid'] && !node.attrs['aria-describedby']));
  assert.equal(nodes.find(node => node.attrs.id?.endsWith('-document-policy-exclusionReason'))?.attrs['aria-invalid'], 'true');
  assert.equal(nodes.find(node => node.attrs.id?.endsWith('-link-0-label'))?.attrs['aria-invalid'], 'true');
});

test('separate editor instances do not share IDs and missing definitions target a named dependency group', () => {
  const value = identicalBlankLinks();
  const props = { value, definitions: dependencyDefinitions, onChange: () => {} };
  const html = renderToStaticMarkup(createElement(Fragment, null, createElement(SourceDependencyEditor, props), createElement(SourceDependencyEditor, props)));
  const ids = elements(html).filter(node => node.attrs.id).map(node => node.attrs.id);
  assert.equal(new Set(ids).size, ids.length);
  const missing = elements(renderToStaticMarkup(createElement(SourceDependencyEditor, { ...props, value: dependencyWalkthrough(), definitions: undefined })));
  const target = missing.find(node => node.attrs.id?.endsWith('-dependencies') && node.attrs.role === 'group')!;
  assert.ok(target.attrs['aria-labelledby']); assert.equal(target.attrs.tabindex, '-1');
  assert.ok(target.attrs['aria-describedby'].endsWith('-dependencies-error-definitions'));
});
