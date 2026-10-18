# UX-01 — Document dependencies and review experience

You are the review-experience worker. Read AGENTS.md, the coordinator runbook, your workboard entry,
`docs/service-detail.md`, `docs/source-bundles.md`, `docs/source-segments.md` and
`docs/design-continuity-plan.md`. Read the pinned original card/detail implementation as reference
without starting it. If private references are unavailable, report that limitation rather than
fetching or running a district application.

## Deliverable

Make a reviewer able to declare which supplied or missing documents each enabled measure/clause
depends on, inspect exclusions and understand how those choices affect coverage. Retain the
conservative all-documents default and the recognizable four-tab workflow.

Initial owned files: `src/SourceBundleCapture.tsx`, `src/SourceBundleView.tsx`, new
`src/SourceDependencyEditor.tsx`, `src/source-dependencies.css`,
`test/fixtures/source-dependency-editor.ts`, `test/unit/source-dependency-editor.test.ts`, and your
report. `src/Reviews.tsx`, shared schemas, APIs and global styles remain coordinator-owned.

## Work

1. Inspect the source-manifest validation and `COV-001`. Identify the exact definition payload
   needed at capture time. Work against explicit synthetic typed inputs until the coordinator
   accepts the interface; do not infer full rubric definitions from a count or stale settings.
2. Design controls for all-target / selected-target dependencies, clause-level selection where
   defined, included linked material and explicit exclusions with reasons. Prevent accidental
   loss of captured text or selections when scope/rubric choices change.
3. Make incomplete captures and uncertain applicability visible. An exclusion is a recorded human
   assertion, never verification that missing material is irrelevant. Preserve target/coverage
   validation on the server; do not supply client-owned readiness or alter scoring rules.
4. Retain tab-scoped drafts, original revisions and existing command receipts. Saved captures stay
   immutable; changed material needs a new review. Keep scope assumptions and missing documents
   alongside available supporting/opposing evidence.
5. Provide a synthetic walkthrough the owner can inspect. Implement a bounded UI increment and
   focused meaningful tests. Coordinate wiring/browser checks through the coordinator.

## Acceptance

Explicit missing addendum, excluded irrelevant link, mixed measure/clause dependencies, disabled
measures, changed rubric revision, narrow reflow, keyboard use, and draft navigation all have an
explainable result. Available evidence survives unresolved coverage. No source is fetched and no
model/publication action occurs. Submit [the report](../report-template.md) as `reports/UX-01.md`.
