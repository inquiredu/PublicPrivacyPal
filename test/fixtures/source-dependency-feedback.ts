import { dependencyWalkthrough } from './source-dependency-editor';

export function invalidDependencyFeedback() {
  const draft = dependencyWalkthrough();
  draft.documents[0].requiredFor = ['deletion/active', 'retired/old'];
  draft.documents[0].scope.accounts = 'Earlier declared account scope';
  draft.documents[0].exclusionReason = '  Still  reviewing this exclusion. ';
  draft.documents[1].requiredFor = [];
  draft.documents[1].exclusionReason = '  ';
  draft.links = [
    { from: 'removed-source', label: ' ', documentId: 'removed-target', exclusionReason: '  An earlier  explanation. ' },
    { from: 'policy', label: '', documentId: null, exclusionReason: '' },
  ];
  return draft;
}

export function identicalBlankLinks() {
  const draft = dependencyWalkthrough();
  draft.links = Array.from({ length: 3 }, () => ({ from: 'policy', label: '', documentId: null, exclusionReason: '' }));
  return draft;
}
