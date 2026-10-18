import { LONG_BUNDLE_VERSION, sourceSegments } from '../shared/source-segments';
import type { EvaluationContract } from '../shared/evaluation';
import { sourceCoverage, type SourceBundle } from '../shared/source-bundle';

export function SourceBundleView({ bundle, contract }: { bundle: SourceBundle; contract: EvaluationContract }) {
  const coverage = sourceCoverage(bundle, contract);
  return <section aria-label="Captured source documents"><h3>Source documents and coverage</h3>
    <p>{bundle.scope.product} · {bundle.scope.accounts} · {bundle.scope.jurisdiction}</p>
    <p>{coverage.targets.filter(t => t.ready).length}/{coverage.targets.length} requirements have complete documents in the declared source set. This does not establish that every relevant vendor document was discovered or that its claims are correct.</p>
    {bundle.version === LONG_BUNDLE_VERSION && <p>{sourceSegments(bundle).length} bounded source ranges. Capture completeness, segment processing and human interpretation are separate. Manual findings record range acknowledgments; offline model candidates need complete-source synthesis.</p>}
    <p>Captured {new Date(bundle.capturedAt).toLocaleString()}. Missing documents or uncertain applicability require a new capture before the affected findings can be resolved.</p>
    {bundle.documents.map(d => <details key={d.id}><summary>{d.label} · {d.capture} · Scope {d.applicability}</summary>
      <p>{d.origin}</p><p>{d.scope.product} · {d.scope.accounts} · {d.scope.jurisdiction}</p>
      <p>Declared effective dates: {d.effectiveDates.join('; ') || 'None supplied'}. Conflicting dates remain for review.</p>
      <p>Required for: {d.requiredFor.includes('*') ? 'All enabled requirements' : d.requiredFor.join(', ') || 'Excluded'}{d.exclusionReason && ` · ${d.exclusionReason}`}</p>
      {d.text ? <pre className="policy-source">{d.text}</pre> : <p>Document not supplied.</p>}
      <small>Document: {d.id} · Text SHA-256: {d.textHash}</small>
    </details>)}
    {!!bundle.links.length && <details><summary>Declared linked documents</summary><ul>{bundle.links.map((link, i) => <li key={i}>{link.from}: {link.label} · {link.documentId ? `Included in manifest: ${link.documentId}` : `Excluded: ${link.exclusionReason}`}</li>)}</ul></details>}
    <details><summary>Requirement coverage</summary><ul>{coverage.targets.map(t => <li key={t.target}>{t.target}: {t.ready ? 'Required documents complete; interpretation awaits review' : `Unresolved documents: ${t.missing.map(id => bundle.documents.find(d => d.id === id)!.label).join('; ')}`}</li>)}</ul></details>
  </section>;
}
