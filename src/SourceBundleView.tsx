import { LONG_BUNDLE_VERSION, sourceSegments } from '../shared/source-segments';
import type { EvaluationContract } from '../shared/evaluation';
import { sourceCoverage, type SourceBundle } from '../shared/source-bundle';

export function SourceBundleView({ bundle, contract }: { bundle: SourceBundle; contract: EvaluationContract }) {
  const coverage = sourceCoverage(bundle, contract);
  function targetLabel(target: string) {
    const [measureId, clauseId] = target.split('/');
    const measure = contract.criteria.find(m => m.id === measureId);
    const clause = measure?.requirements?.find(r => r.id === clauseId);
    return `${measure?.label || measureId}${clause ? ` — ${clause.proposition}` : clauseId ? ` / ${clauseId}` : ''}`;
  }
  const documentLabel = (id: string) => bundle.documents.find(d => d.id === id)?.label || id;
  return <section aria-label="Captured source documents"><h3>Source documents and coverage</h3>
    <p>{bundle.scope.product} · {bundle.scope.accounts} · {bundle.scope.jurisdiction}</p>
    <p>{coverage.targets.filter(t => t.ready).length}/{coverage.targets.length} requirements have complete documents in the declared source set. This does not establish that every relevant vendor document was discovered or that its claims are correct.</p>
    {bundle.version === LONG_BUNDLE_VERSION && <p>{sourceSegments(bundle).length} bounded source ranges. Capture completeness, segment processing and human interpretation are separate. Manual findings record range acknowledgments; offline model candidates need complete-source synthesis.</p>}
    <p>Captured {new Date(bundle.capturedAt).toLocaleString()}. Missing documents or uncertain applicability require a new capture before the affected findings can be resolved.</p>
    {bundle.documents.map(d => <details key={d.id}><summary>{d.label} · {d.capture} · Scope {d.applicability}</summary>
      <p>{d.origin}</p><p>{d.scope.product} · {d.scope.accounts} · {d.scope.jurisdiction}</p>
      <p>Declared effective dates: {d.effectiveDates.join('; ') || 'None supplied'}. Conflicting dates remain for review.</p>
      <p>Required for: {d.requiredFor.includes('*') ? 'All enabled requirements' : d.requiredFor.map(targetLabel).join('; ') || 'Excluded'}{d.exclusionReason && ` · ${d.exclusionReason}`}</p>
      {!d.requiredFor.length && <p>This exclusion is a recorded human judgment, not verification that the document is irrelevant.</p>}
      {d.text ? <pre className="policy-source">{d.text}</pre> : <p>Document not supplied.</p>}
      <small>Document: {d.id} · Text SHA-256: {d.textHash}</small>
    </details>)}
    {!!bundle.links.length && <details><summary>Declared linked documents</summary><ul>{bundle.links.map((link, i) => <li key={i}>{documentLabel(link.from)}: {link.label} · {link.documentId ? `Included in manifest: ${documentLabel(link.documentId)}` : `Excluded by reviewer: ${link.exclusionReason}`}</li>)}</ul><p>Links and exclusions are capture declarations. No linked source was fetched or independently verified.</p></details>}
    <details><summary>Requirement coverage</summary><ul>{coverage.targets.map(t => <li key={t.target}><strong>{targetLabel(t.target)}</strong>: {t.ready ? 'Required documents complete; interpretation awaits review' : !t.documents.length ? 'No required document declared' : `Unresolved documents: ${t.missing.map(documentLabel).join('; ')}`}<small> Required documents: {t.documents.map(documentLabel).join('; ') || 'None'}.</small></li>)}</ul></details>
  </section>;
}
