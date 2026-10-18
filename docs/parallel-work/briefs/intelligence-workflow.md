# INT-01 — Reviewable adoption of segmented intelligence

You are the intelligence-workflow worker. Read AGENTS.md, the coordinator runbook,
`docs/prompt-intelligence-review.md`, `docs/ai-analysis-refinement.md`, `docs/source-segments.md`,
`docs/review-context.md`, `docs/review-storage.md`, `docs/policy-suggestions.md`, and
`docs/ai-provider-adoption.md`. Inspect `server/analysis/segments.ts`, `contract.ts`, `jobs.ts`,
`shared/assistance.ts`, and existing unit/integration cases without modifying their contracts.

## Deliverable and ownership

Write `docs/segmented-adoption.md`: a versioned, implementable proposal for turning validated
segmented results into inspectable application suggestions. Supply authored synthetic cases in
`test/fixtures/segmented-adoption.ts` and runnable checks of existing boundaries in
`test/unit/segmented-adoption.test.ts`. An isolated offline experiment may use
`scripts/segmented-adoption-lab.ts`. Your report is `reports/INT-01.md`.

This assignment begins with design and offline evidence. Application storage/API/worker writes
need the coordinator to accept `INT-001` and delegate a specific increment first. Do not introduce
a new automatic import or dispatch route. Do not leave speculative failing tests in the default
suite; distinguish proposed acceptance cases from executable current-behavior tests.

## Required design

- Show the state transitions from captured source through segment attempts, synthesis, suggestion
  inspection, human draft and explicit finding save. Keep district decisions/publication separate.
- Define identities, hashes, prompt/schema/model versions, actor authority, source/criterion scope,
  exact citations and immutable original wire output versus derived coverage/readiness.
- Bound attempts, request/output bytes, stored documents, list/detail reads and synthesis budgets.
  Overflow fails explicitly rather than dropping evidence. Do not change existing versions in place.
- Preserve earlier candidates across retries. Later attempts make dependent synthesis stale. Missing
  or failed material cannot become confirmed silence. A source quote's existence does not prove
  the model interpretation is correct.
- Define lost-acknowledgment reconciliation, cancellation, crash/restart, revoked membership,
  maintenance and late results after human corrections. A recovered attempt must not blindly
  repeat an uncertain paid dispatch.
- Specify immutable persistence, receipt semantics, backup schema/version implications and an
  exact recovery rehearsal. Existing offline packets remain private operator artifacts until a
  separately authorized application contract explicitly gives new records authority.
- Explain the UI handoff and preserved human qualifications/corrections. Generated text cannot
  supply human attribution, calculated scores, service facts, district decisions or publication.

## Acceptance

Deliver the transition/ownership table, bounded record examples, compatibility/migration plan,
failure-case matrix, runnable offline evidence and small implementation sequence. Cover complete
commitments, omissions, contradictions, missing final segments, malformed citations, retries and
late results. A non-author reviews the proposal before durable application integration. No live
provider, credential setup, real-policy fetch or spending is authorized.
