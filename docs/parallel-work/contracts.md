# Shared contract decisions

Coordinator-owned log. Initial proposals are preserved below; dated acceptance entries record
their disposition and assigned implementation scope.
An accepted contract is an engineering decision within the authorized scope, not permission to
enable providers, deploy, publish, merge to main or adopt district policy.

## COV-001 — Capture-time measure and clause definitions

Owner: coordinator. Consumer: review-experience worker. Status: proposed.

The current capture form requires every document for every enabled measure. The API supports
declared dependencies/exclusions, but the form needs the exact adopted measure/clause identifiers
and human-readable definitions before offering precise choices. Inspect the existing rubric endpoint;
do not assume it exposes the necessary definitions or send full private settings to reviewers.

Decide the minimal reader-authorized payload, settings/definition identity, enabled-target rules,
stale-selection behavior and size bound. Retain all-documents as the conservative default. Scope
assertions and exclusions require explicit human input; neither model output nor UI convenience
establishes source completeness. No network fetching or silent removal of required documents.

Until accepted, the worker can implement a presentational editor against a clearly typed synthetic
input and test its controls; production wiring belongs to the coordinator's integration step.

## INT-001 — Segmented results become application suggestions

Owner: coordinator. Author: intelligence-workflow worker. Status: proposed.

Define the transition from an offline qualification packet to authorized, durable application
attempt/result records. Existing offline packets have no application import authority. Decide
identity/hashes, complete-source synthesis prerequisites, versioning, validation, actor checks,
immutable original output versus derived readiness, byte/page limits, cancellation, retries,
lost acknowledgments, stale results, backup/restore and migration behavior.

Acceptance requires a state-transition table and failure cases, including a late result after a
human correction. No suggestion may write a human finding, district decision, service fact, score
or audience projection directly. Application writes remain deferred until the design and ownership
change are recorded here and in the workboard.

## Add a decision

For each new entry record:

- ID, question, consumers, owner and status: proposed / accepted / superseded.
- Current behavior and the concrete failure that motivates a change.
- Interface examples, versions, compatibility and historical-read/hash impact.
- Authorization, source/citation validation, resource bounds and failure semantics.
- Migration/recovery/publication implications and required tests.
- Chosen approach, rejected alternatives with reasons, implementing file owner and reviewer.
- Evidence and any genuinely unresolved owner/policy decision.

## COV-001 accepted increment — 2026-10-18

Coordinator accepts capture-definitions-v1 for UX-01. Implementation owner of shared/server/draft
wiring: coordinator; UI consumer: UX-01; non-author review after assembled checks.

The reader-authorized rubric endpoint adds explicit practice definitions for each existing profile
and the current district definition when available. Each projection contains version, SHA-256 id,
kind, profileVersion, definitionVersion, settingsRevision and up to 50 measures: id, label, area,
enabled and up to eight requirements (id, proposition). No private context, author, law text,
weights, secrets or settings history is included. The canonical identity binds the entire projection;
the response projection is limited to 64 KiB. District engine choice does not change target meaning.

The capture draft retains its chosen projection. Refresh never rebases it. Selecting a different
rubric/profile/revision preserves documents, exact text, dependencies and exclusions. The user must
explicitly adopt the current definitions; obsolete/disabled targets remain visible and must be
reconciled. New UI bundle saves require a current matching projection and valid declared targets.
The optional sourceDefinitionId command field is checked against the adopted server contract within
the capture transaction. Older commands without that field retain their existing validation, receipt
hashes and semantics. No source, scoring, storage or backup version changes are required.

SourceBundleCapture consumes optional `definitions: CaptureDefinitions`; its existing value/onChange
interface remains. SourceDependencyEditor exports `dependencyErrors(value, definitions)` for shared
UI submit feedback; server validation remains authoritative. A missing definition disables precise
selection. All-documents (`*`) remains the default. Explicit exclusions require reasons. Scope edits
preserve the original document declarations and require explicit re-confirmation; they cannot retain
matched applicability by silently rewriting document scope. No auto fetching or completeness claim.

Coordinator owns shared/capture-definitions.ts, server/capture-definitions.ts, shared/drafts.ts,
shared/review.ts, server/reviews.ts, src/Reviews.tsx, src/ReviewDetail.tsx and focused shared/API tests.
Checks: projection allowlist/bounds/identity, each reader/editor role, stale settings/identity rejection,
legacy request/hash compatibility, disabled/unknown targets, draft retention and browser validation.

## INT-001 reviewed design acceptance — 2026-10-18

Accepted as the first-wave design/offline-evidence deliverable after coordinator non-author review.
See [segmented adoption](../segmented-adoption.md) and [INT-01 report](reports/INT-01.md). The reviewed
version preserves exact archive configuration on recovery and stores canonical request objects
within the proposed record bound. Its 17 new cases exercise existing helpers, not an implemented
asynchronous application lifecycle. The deliberately accepted wrong-scope quotation demonstrates
a structural-validation limit, not model accuracy.

Choose a separate versioned application envelope, unresolved human handoff, independent run/result/
settlement state, immutable raw evidence and finite admission limits. Future version numbers and
capacity limits remain subject to measured implementation/recovery gates. **No durable write-path,
provider dispatch, importer or schema migration is assigned in this wave.** Implementation must be
assigned as a separate bounded increment with the role, storage and recovery gates in the proposal.

## INT-002 — durable synthetic segmented implementation (2026-10-20)

Accepted for implementation by the coordinator under the owner's instruction to implement the next milestone. INT-001's offline protocol versions and historical request keys remain unchanged. This is synthetic development, not provider qualification or release authorization. Ownership and the exact cb89a66 baseline are recorded in workboard.json before code changes.

- Use a new strict segmented-proposal-v1 application envelope. Proposal references bind one adopted measure and its exact complete target set. Never convert the older synthesis format into an ordinary qualified suggestion. The human seed is deliberately unresolved, contains no accepted citations or machine range acknowledgments, and keeps original questions inspectable through immutable provenance.
- Completion must match the run's base review revision, actor access, source, definition, plan and generation. After a valid completion, a new explicit handoff may use only an unreviewed measure whose finding still equals the baseline captured at run start. Missing findings and canonical untouched placeholder rows have the same baseline identity; no other human fields are normalized away. A human save on a different measure does not disable that unchanged target. This supersedes INT-001's whole-proposal staleness after any human edit, which would otherwise allow only one measure per run. A saved correction always retains its original historical provenance. Existing drafts never rebase.
- Keep materialized v1 attempt identity separately from the durable ordered attempt/outcome identity. Queueing any attempt, including a synthesis retry, advances an evidence generation immediately and disables prior synthesis for new handoff. Historical synthesis remains inspectable against its own prefix.
- All mutations use the existing review route and actor-scoped idempotency receipt. Start and cancel advance review revision; explicit attempt starts advance run revision only. Worker progress never changes a review, score, decision or public projection. Add bounded receipt effect metadata identifying the original run/attempt; replay returns current authorized review state plus inspectable original effect. Keep the current pending-command route/response contract.
- The only registered transport is an authored deterministic synthetic recording bound by the server to exact source and definition identity. No client-provided output, synthetic flag, provider name or packet can confer authority. New attempts always require explicit commands. An interrupted authored recording can recover under its original attempt because this adapter is deterministic, local and zero-cost; this does not authorize paid resends. Transport exceptions retain an unknown outcome, while explicit incomplete/refused returns settle with their original bytes. Original bounded output bytes and invalid returns are preserved. Retention requires a valid worker lease; result eligibility additionally requires all authority/currentness fences. Maintenance blocks both.
- Adopt the finite limits from segmented-adoption.md and add an installation ceiling of 1,600 new run-owned records. The 75-attempt ceiling is not a capacity promise. Reserve worst-case remaining writes before dispatch; fail atomically when any byte or record ceiling is reached. No deletion to evade retention limits. Historical human findings and evaluations are traversed in bounded pages without imposing this new admission cap on old corrections; existing per-record bounds and the 64 MiB whole-archive bound remain authoritative.
- Set a sticky schema-10 marker at first run, including empty or cancelled runs. Independently scan artifacts and reject missing parents, dangling references, incorrect versions/hashes/counters/markers and schema-1–9 archives containing new artifacts. The storage owner supplies the shared strict bounded validator; restore runs it under maintenance before workers and before releasing the fence. Add findings-v7/human-evidence-v6 only for new attributed evidence and preserve them on later corrections. Historical v1–v9 archives are never rewritten.
- Runtime and shared-browser work remain serialized by the coordinator. Acceptance requires CI, role/receipt/lease/storage integration, independent review, saved draft checks, actual maximum-admission native export bounds, and two-cycle schema-10 recovery including a genuine schema-9 restore. Failure of a gate remains an explicit outstanding item rather than a successful result.
