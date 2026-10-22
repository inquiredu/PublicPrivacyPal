import { useState } from 'react';
import type { User } from 'firebase/auth';
import { SegmentedProposalBrowser } from './SegmentedProposalView';
import type { Finding, Review } from '../shared/review';
import { RequirementFindings } from './RequirementReview';

export function FindingContext({ finding: f, review, user }: { finding: Finding; review?: Review; user?: User }) {
  const [inspect, setInspect] = useState(false);
  return <>
    {f.requirements && <RequirementFindings value={f.requirements}/>}
    {f.proposalRequirements && <RequirementFindings value={f.proposalRequirements} title="Original proposed subrequirements"/>}
    {f.context && <div className="finding-context">{f.segmentedProvenance && <h5>Required human handoff qualification</h5>}{f.requirements && f.provenance && <><h5>Original suggestion qualification</h5><p>Current clause assessments and questions appear in Subrequirement findings above.</p></>}<p><strong>Scope and limitations:</strong> {f.context.scope || 'Not recorded'}</p>
      <p><strong>Uncertainty:</strong> {f.context.uncertainty.replaceAll('_', ' ')}</p>
      {f.context.question && <p><strong>Follow-up:</strong> {f.context.question}</p>}
      <p><strong>Qualification:</strong> {f.context.resolution === 'resolved' ? 'Resolved by reviewer' : f.context.question ? 'Question remains open' : 'Retained in finding'}</p>
      {f.context.resolution === 'resolved' && <><p>{f.context.note}</p>{f.context.citations.map(c => <blockquote key={`${c.start}:${c.end}`}>{c.quote}</blockquote>)}<small>Resolution by {f.context.resolvedBy} · {f.context.resolvedAt}</small></>}
    </div>}
    {f.provenance && <details><summary>Suggestion provenance</summary><p>{f.provenance.provider} · {f.provenance.model} · {f.provenance.promptVersion} · {f.provenance.schemaVersion}</p><p>Original proposal: {f.provenance.state} · Source readiness: {f.provenance.sourceStatus}</p><small>Job: {f.provenance.jobId}<br/>Result: {f.provenance.resultId}<br/>Source: {f.provenance.sourceHash}<br/>Rubric: {f.provenance.rubricId}</small></details>}
    {f.segmentedProvenance && <details onToggle={event => setInspect(event.currentTarget.open)}><summary>Original segmented proposal and provenance</summary><p>{f.segmentedProvenance.provider} · {f.segmentedProvenance.model} · {f.segmentedProvenance.promptVersion} · {f.segmentedProvenance.schemaVersion}</p><p>Human corrections retain this original reference. Current interpretations appear above; original generated questions and derived source readiness remain separate below.</p><small>Run: {f.segmentedProvenance.reference.runId}<br/>Outcome: {f.segmentedProvenance.reference.outcomeId}<br/>Source: {f.segmentedProvenance.bundleId}<br/>Definition: {f.segmentedProvenance.definitionId}</small>
      {inspect && review && user && <SegmentedProposalBrowser review={review} user={user} address={f.segmentedProvenance.reference} expectedReference={f.segmentedProvenance.reference}/>}
    </details>}
  </>;
}
