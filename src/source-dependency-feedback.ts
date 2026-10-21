import type { CaptureDefinitions } from '../shared/capture-definitions';
import type { SourceBundleInput } from '../shared/source-bundle';

type Document = SourceBundleInput['documents'][number];
type Link = SourceBundleInput['links'][number];
export const documentName = (document: Document, index: number) => document.label.trim() || `Document ${index + 1}`;
export const sameScope = (a: SourceBundleInput['scope'], b: SourceBundleInput['scope']) => (['product', 'accounts', 'jurisdiction'] as const).every(key => a[key].trim() === b[key].trim());
export const validTargets = (definitions?: CaptureDefinitions) => new Set(['*', ...(definitions?.measures.filter(m => m.enabled).flatMap(m => [m.id, ...m.requirements.map(r => `${m.id}/${r.id}`)]) || [])]);
export const covers = (document: Document, target: string) => document.requiredFor.some(t => t === '*' || t === target || t === target.split('/')[0]);

export type DependencyTarget = { kind: 'dependencies' }
  | { kind: 'document'; id: string; field: 'dependencies' | 'exclusionReason' }
  | { kind: 'link'; index: number; field: 'from' | 'label' | 'documentId' | 'exclusionReason' };
export type DependencyFeedback = { code: string; target: DependencyTarget; message: string };

/** Existing declaration checks, with field targets added; no draft text is normalized or changed. */
export function dependencyFeedback(value: SourceBundleInput, definitions: CaptureDefinitions | undefined): DependencyFeedback[] {
  const feedback: DependencyFeedback[] = [];
  const add = (code: string, target: DependencyTarget, message: string) => feedback.push({ code, target, message });
  if (!definitions) add('definitions', { kind: 'dependencies' }, 'Load and adopt the review measures before saving document dependencies.');
  const valid = validTargets(definitions);
  for (const [index, d] of value.documents.entries()) {
    const name = documentName(d, index);
    const group: DependencyTarget = { kind: 'document', id: d.id, field: 'dependencies' };
    const reason: DependencyTarget = { kind: 'document', id: d.id, field: 'exclusionReason' };
    if (new Set(d.requiredFor).size !== d.requiredFor.length || d.requiredFor.length > 100) add('selections', group, `${name}: choose each dependency once, with at most 100 selections.`);
    if (definitions && d.requiredFor.some(t => !valid.has(t))) add('obsolete', group, `${name}: reconcile the retained dependencies that are no longer enabled or defined.`);
    if (!d.requiredFor.length && !d.exclusionReason.trim()) add('missing-reason', reason, `${name}: explain why this document is excluded from required coverage.`);
    if (d.requiredFor.length && d.exclusionReason.trim()) add('conflicting-reason', reason, `${name}: apply the exclusion or explicitly clear its reason before requiring this document.`);
    if (d.requiredFor.length && !sameScope(d.scope, value.scope)) add('scope', group, `${name}: reconcile its declared scope with the review scope.`);
  }
  for (const m of definitions?.measures.filter(m => m.enabled) || []) {
    const targets = m.requirements.length ? m.requirements.map(r => `${m.id}/${r.id}`) : [m.id];
    const missing = targets.filter(t => !value.documents.some(d => covers(d, t)));
    if (missing.length) add(`coverage-${m.id}`, { kind: 'dependencies' }, `${m.label}: declare at least one required document${m.requirements.length ? ` for ${missing.map(t => t.split('/')[1]).join(', ')}` : ''}.`);
  }
  for (const [index, link] of value.links.entries()) {
    const name = `Linked material ${index + 1}`;
    const target = (field: Extract<DependencyTarget, { kind: 'link' }>['field']): DependencyTarget => ({ kind: 'link', index, field });
    if (!value.documents.some(d => d.id === link.from)) add('source', target('from'), `${name}: select the document containing this reference.`);
    if (!link.label.trim()) add('label', target('label'), `${name}: supply a link or reference label.`);
    if (link.documentId !== null && !value.documents.some(d => d.id === link.documentId)) add('included-document', target('documentId'), `${name}: select an included document, including an unavailable one when needed.`);
    if (link.documentId === null && !link.exclusionReason.trim()) add('missing-reason', target('exclusionReason'), `${name}: explain the exclusion or select an included document.`);
    if (link.documentId !== null && link.exclusionReason.trim()) add('conflicting-reason', target('exclusionReason'), `${name}: explicitly clear its exclusion reason before including the document.`);
  }
  return feedback;
}

export type DependencyLinkIdentity = { source: Link[]; keys: string[]; next: number };
/** Local presentation identity only. Draft reloads may clone every object; values identify retained rows. */
export function reconcileDependencyLinks(previous: DependencyLinkIdentity | undefined, source: Link[]): DependencyLinkIdentity {
  if (previous?.source === source) return previous;
  const unused = new Set(previous?.source.map((_, index) => index));
  const equal = (a: Link, b: Link) => a.from === b.from && a.label === b.label && a.documentId === b.documentId && a.exclusionReason === b.exclusionReason;
  // Reserve unchanged positions first, so editing one of two identical rows cannot steal its sibling's key.
  const matches = source.map((link, index) => {
    if (previous?.source[index] && equal(previous.source[index], link)) { unused.delete(index); return index; }
    return undefined;
  });
  source.forEach((link, position) => {
    if (matches[position] !== undefined) return;
    const index = [...unused].find(i => equal(previous!.source[i], link));
    if (index !== undefined) { unused.delete(index); matches[position] = index; }
  });
  let next = previous?.next || 0;
  const keys = matches.map((match, index) => {
    if (match !== undefined) return previous!.keys[match];
    if (unused.has(index)) { unused.delete(index); return previous!.keys[index]; }
    return `link-${next++}`;
  });
  return { source, keys, next };
}

/** Explicit removal disambiguates identical blank rows without adding identity to the draft. */
export function removeDependencyLinkIdentity(previous: DependencyLinkIdentity, index: number): DependencyLinkIdentity {
  return { source: previous.source.filter((_, i) => i !== index), keys: previous.keys.filter((_, i) => i !== index), next: previous.next };
}

export function dependencyTargetId(prefix: string, target: DependencyTarget, linkKeys: readonly string[]): string {
  if (target.kind === 'dependencies') return `${prefix}-dependencies`;
  if (target.kind === 'document') return `${prefix}-document-${target.id}-${target.field}`;
  return `${prefix}-${linkKeys[target.index]}-${target.field}`;
}
