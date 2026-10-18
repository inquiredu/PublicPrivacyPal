# Shared contract decisions

Coordinator-owned log. All entries below are **proposed**, with no implementation delegation yet.
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
