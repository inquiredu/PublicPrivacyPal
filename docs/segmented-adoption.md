# Reviewable adoption of segmented intelligence

Proposal `segmented-adoption-v1`, October 18, 2026. Non-author coordinator review is complete for
design/offline evidence acceptance; contract-log acceptance and integration remain coordinator-owned.
Durable application work is unassigned. This document and its synthetic tests add no application API,
storage, dispatch, importer or provider. Baseline: `cb5bb04cde8d900f0376d11f5676369636845eae`.

The existing [long-source protocol](source-segments.md) already validates bounded segment attempts
and whole-source synthesis. It retains candidates across retries and separates original output from
derived readiness. Its packets remain private operator artifacts. The application rejects bundle
suggestion jobs; a successful offline synthesis cannot be supplied as human finding provenance.
This proposal supplies the missing durable, inspectable handoff while retaining that boundary.

## Chosen first application increment

Create a server-owned segmented run **from an existing saved long-bundle review**, using its exact
source, definition and frozen plan. Initially use an authored synthetic recording only. Do not add
an upload-to-adopt command: existing `privacypal-segment-review-v1` packets neither establish a
requesting actor nor prove dispatch, freshness, source ownership or human approval. An eventual
operator-assisted import requires a separate contract; it must never trust archived authority.

Keep `evidence-segment-v1`, `segment-candidates-v1`, `evidence-synthesis-v1`,
`segment-synthesis-v1` and their historical hashes unchanged. Introduce an application envelope
`segmented-proposal-v1`, rather than casting synthesis into `policy-suggestions-v4`. The v1
segmented outputs lack per-target applicability/uncertainty qualifications required by ordinary
suggestions. Their candidate roles and exact quotations are structurally checked, not semantically
certified. The first handoff therefore opens a deliberately **unresolved** human draft, preserving
the original target result, questions and declared scope. Human resolution is explicit.

Later prompt improvements need new versions and new cache keys. They must not backfill missing
scope judgments into old outputs or upgrade a historical result by reinterpreting its bytes.

## State transitions and ownership

Local processing, result eligibility and provider settlement are separate state machines. A result
can be valid but stale, and a cancelled run can still have unsettled charges.

| Transition / artifact | Authority and preconditions | Result and prohibited side effects |
| --- | --- | --- |
| Capture → immutable source/definition/plan | Existing reviewer/admin capture command and receipt; server verifies parts and adopted definition | Human-declared dependencies and scope remain fixed. A changed source/definition requires a new review. |
| Saved review → queued run | Current reviewer/admin membership, current review revision, maintenance clear, bounded count/storage reservation; server creates identity | Bind source, definition, plan, requesting actor and base review revision. No finding, score or decision is created. |
| Pending segment → queued attempt | Explicit bounded attempt command; no unresolved prior dispatch for that segment; reserve request/output space | New attempt ID/ordinal; earlier attempts remain immutable. No automatic retry. |
| Queued → claimed → dispatch-marked | Worker lease token and expiry, current membership/identity, source hashes, version support and maintenance checked before dispatch | Durable dispatch marker precedes transport. Timeout after this point is an unknown outcome until reconciled. |
| Dispatched → returned / refused / incomplete / unknown | Provider adapter response or lookup; immutable raw output captured under the attempt identity | Validation cannot overwrite raw output. A transport abort cannot assert zero charge or remote cancellation. |
| Returned → validated / invalid | Recorded validator version, exact request, strict schema, target set, quotes, ranges and byte bounds | Validation outcome is immutable. Invalid raw output is inspectable; it supplies no candidates. |
| Attempts → derived coverage/candidates | Rebuild from all immutable returns; latest attempt controls segment readiness | Retain every earlier valid candidate and all sightings. A failed retry withholds readiness without deleting evidence. |
| Evidence snapshot → synthesis attempt | Bind exact ordered attempt/outcome IDs and hashes, source dependencies, all required ranges/candidates; reserve bounded synthesis request/output | Incomplete coverage may yield an inspectable unavailable result. Confirmed silence requires complete applicable coverage and no retained candidates. |
| Valid synthesis → inspectable proposal | Validator succeeds; current run and evidence revision; worker commit fence succeeds | Preserve original wire state and derived state separately. Never update a human evaluation or public projection. |
| Later attempt / human edit → stale proposal | New attempt changes evidence revision; human edit changes base review revision | Preserve historical proposal and raw bytes. Disable use as a current proposal; do not silently rebase or refresh an open draft. |
| Proposal → human draft | Current reviewer/admin; explicit action; no existing/pending draft; immutable proposal reference fetched and verified | Open unresolved, retain qualifications and original review revision. Machine coverage does not check human range boxes. |
| Human draft → saved finding | Existing revision/receipt checks, explicit criterion save, server-verified provenance, exact selected citations and required human acknowledgments | Create attributed immutable evaluation/history; deterministic scoring and normal correction withdrawal apply. |
| Complete human evaluation → decision → publication | Existing separate district decision and publication commands | Only those commands change decisions/audience projections. A result, cache hit or restored run never restores approval. |
| Run → cancellation requested | Current reviewer/admin, idempotent command; fence further dispatch | Undispatched work becomes cancelled. Dispatched work remains unknown/settling until lookup; a late return is historical only. |

All private reads require current admin/reviewer/viewer membership. Start, retry, cancel and human
save require admin/reviewer. Direct browser Firestore access to new records is denied for every
role. Anonymous, staff and unrelated accounts receive no private prompts, candidates or attribution.
An installation operator may settle a recorded dispatch through a future bounded administrative
operation; that authority cannot create findings or pretend to be the original reviewer.

## Identity and immutable records

Proposed paths are under `districts/{district}/reviews/{review}/segmentedRuns/{run}` unless stated
otherwise. The coordinator should assign concrete schema/API owners only after INT-001 acceptance.
These names are design examples, not implemented endpoints.

| Record | Identity and content | Mutation rule |
| --- | --- | --- |
| Run head | UUID; immutable spec hash, actor reference, base review revision, evidence revision, counts, status, current synthesis reference | Small mutable projection; transactional compare-and-set. It cannot contain source/output text. |
| `specs/{hash}` | Source manifest ID **and** canonical text hash, definition ID, plan ID/version, application protocol, provider/model/adapter/settings, prompt/schema/validator versions | Content-addressed, create-only. Requesting actor/time come from the server and are excluded from provider prompts. |
| `requests/{hash}` | Canonical request JSON object plus its original key and provider dispatch key | Create-only. Dispatch key hashes request key, provider/model/adapter/settings. No cross-district cache reuse. |
| `attempts/{uuid}` | Segment or synthesis scope, ordinal, request ID, actor, lease, dispatch marker, provider request ID, usage/reservation and final outcome reference | Lifecycle fields are mutable only behind lease/generation fencing. Request identity never changes. Final response references cannot be replaced. |
| `outputs/{sha256}` | Original bounded response bytes, encoding, byte length/hash, transport status | Create-only. Preserve invalid JSON and whitespace. Do not hash a parsed/re-serialized replacement as the original. |
| `outcomes/{hash}` | Attempt/request/output refs, validation version, accepted/invalid/refused/incomplete reason, source/definition/evidence bindings | Create-only. A revalidation under a new validator creates a new outcome and does not promote historical results. |
| Candidate/coverage view | Reconstructed from the exact source and all attempt outcomes | Derived; never trust client/model readiness or store it as source authority. Optional caches bind every input/algorithm version. |
| Synthesis/proposal view | Original output reference, ordered attempt prefix/hash, validated result and current/stale reason | Original evidence snapshot remains readable even after a new attempt. Currentness is derived at read/save time. |
| District dispatch/settlement index | Attempt ID, provider compatibility, next lookup time, reservation and settled flag | Remains queryable independently of local run/result status, including stale/revoked/cancelled results. |

Raw text uses strict UTF-8 decoding without replacement. Persist the original bytes as base64 with
SHA-256 over those bytes; validate the decoded original string. This avoids JSON escaping making a
128 KiB response look like a 128 KiB stored document. Invalid encoding is an explicit transport
failure. No silent normalization, JSON repair, quoting repair or prefix stripping is permitted.
Over-limit transport output stops acceptance and records overflow; never present a retained prefix
as the original complete response. Reserve space before dispatch for any permitted bounded return.

Illustrative records below omit cryptographic values for readability; `H(...)` denotes a SHA-256,
not a permitted literal field value. Only the listed fields exist in these proposed strict schemas.

```text
spec: {
  version: "segmented-run-v1", bundleId: H(manifest), textHash: H(canonical text),
  definitionId: H(adopted definition), planId: H(frozen plan), planVersion: "source-segments-v1",
  provider: { id: "authored-recording", model: "lantern-fixture-v1", adapter: "recording-v1", settings: {} },
  segment: { prompt: "evidence-segment-v1", schema: "segment-candidates-v1", validator: "segment-validator-v1" },
  synthesis: { prompt: "evidence-synthesis-v1", schema: "segment-synthesis-v1", validator: "synthesis-validator-v1" }
}
outcome: {
  version: "segmented-outcome-v1", attemptId: UUID, requestId: H(request), outputId: H(raw bytes),
  state: "validated", validator: "segment-validator-v1", scope: { segmentId: "s1" },
  specId: H(spec), evidenceOrdinal: 1
}
proposal reference: {
  version: "segmented-proposal-v1", runId: UUID, synthesisAttemptId: UUID,
  outcomeId: H(outcome), evidenceRevision: H(ordered attempt/outcome refs), target: "deletion"
}
```

Candidate identity remains the existing hash of target, document ID, document text hash, global
canonical start/end, exact quote and role. Repeated sightings/rationales remain visible. Source
separators are not quotable evidence. A candidate's existence does not prove relevance, role,
applicability or completeness; the executable wrong-account case deliberately demonstrates this.

Store each canonical request as a JSON object, not a JSON-escaped raw request string; its object
serialization and envelope must fit the 264 KiB request-record bound below. The hash binds the
canonical object. Exact provider-specific wire bytes, if later required, need a separate explicitly
bounded representation and storage reservation; they are not implicitly included in that allowance.

## Bounds and overflow behavior

Existing capture, record and offline bounds remain unchanged. New limits below are proposed
installation guardrails, not a production capacity claim. Every byte limit measures the serialized
stored/returned UTF-8 JSON unless explicitly labeled transport bytes. Smaller limits can be reached
before count limits; reaching any limit fails explicitly without truncating candidates or history.

| Boundary | Proposed limit / behavior |
| --- | --- |
| Source / plan | Existing 8 documents, 16 links, 128,000 UTF-16 units, 384 KiB raw input, 24 segments; verify every part/hash/range. |
| Attempts | Three per segment, three synthesis attempts, at most 75 total; one active dispatch per run. Retries consume new ordinals. |
| Request / original response | Existing 256 KiB canonical request and 128 KiB transport output per attempt. Future adapters also enforce their actual token/context limits before dispatch. |
| Run head / spec | 8 KiB / 32 KiB; source and full request text remain referenced. |
| Request / attempt / output / outcome record | 264 KiB / 16 KiB / 192 KiB / 16 KiB. Base64 and metadata must fit; enforce the full serialized record size. |
| Retained runs | At most two runs per review, one active. No deletion or unbounded replacement run to evade attempt limits. Additional retention requires an explicit later policy. |
| Per-run storage | 16 MiB and 800 documents including run-owned receipts, audit events, indexes, requests and outputs. Reserve worst-case return/outcome/receipt space transactionally before each attempt. |
| Mutation count | One start, up to 75 attempt starts, one run cancellation and up to 75 final settlement commands per run; identical command replay consumes no new records. Status/lookup polls create no audit document per poll. |
| Installation admission | New segmented records limited to 32 MiB logical JSON total; existing verified backup still caps 64 MiB of files. Logical counters do not guarantee native export size; successful verification remains required. |
| Lists | 20 items, read 21 for continuation; bound cursor to district/review/run, ordering and filter; immutable refs only. Attempt/candidate summary page ≤128 KiB. |
| Selected detail | Request ≤264 KiB; raw output ≤192 KiB; target view ≤512 KiB with candidate pages, never all raw attempts. Existing assembled review stays ≤4 MiB. |
| Human finding / history | Existing 64 KiB / 160 KiB; at most three ordinary assessment citations and three per refined clause. No automatic truncation to make a conversion fit. |
| Worker operation | Existing 60-second whole-operation deadline, 30-second renewable lease and separately bounded five-second status cleanup; token/lease checks fence every write. |
| Dispatch budget | Initial synthetic recording only, zero live calls. Future paid operation needs both per-attempt and whole-run cost reservations including synthesis and retries, separately authorized. |

The per-run cap includes shared indexes attributed to that run. The daily request quota must count
each segment and synthesis dispatch against the existing 100/day ceiling, rather than counting a
75-attempt run as one request. Cache reuse has a separate local-use count and no billable reservation.
Counts and bytes must be transactionally reserved to prevent concurrent starts from exceeding them.
When a complete synthesis request cannot fit all candidates/ranges, leave evidence inspectable and
report that synthesis is blocked by its budget. Hierarchical synthesis is a different contract.

Finite attempts do not make the installation backup unlimited. Before the durable increment is
accepted, its maximum admitted fixture must actually save and verify under the archive cap. If
native export overhead exceeds it, lower admission bounds; do not raise/relabel a backup silently.

## Receipts, recovery and late outcomes

Extend the existing [command receipt semantics](review-workflow.md) with an explicit versioned
segmented action payload. A receipt binds district, current actor, command UUID, immutable payload
hash, run/attempt identity and applied run revision. Replay with identical content returns the
saved effect/current authorized view, never dispatches twice or restores a former current proposal.
Reusing an ID with different content rejects. Receipt lookup is read-only and requires current
permission; a missing receipt does not prove the first request failed. The browser retains its
pending command/draft through timeout and reload and never automatically resubmits a mutation.

Use a separate run revision for attempt progress. Worker completion must not invalidate ordinary
human drafts by advancing the review revision. Explicit run creation/cancellation follows the
existing review command revision rules. Each human save uses the draft's original review revision
and exact proposal reference; no background result may update that reference or draft contents.

Before dispatch and eligibility commit, check current identity, membership, maintenance, lease,
base review revision and source/spec compatibility. Preserve a bounded raw return even when its
proposal eligibility is stale: saving an immutable historical output is different from granting it
authority. After revocation, the worker may perform only private operational retention/settlement
under its service identity; the revoked actor receives no access. Maintenance fences **all** such
writes; defer to durable lookup/lease recovery after the fence clears. No in-memory return becomes
accepted while maintenance is active.

Crash recovery reads the persisted dispatch marker. A recovered non-offline attempt performs only
provider status lookup with the same attempt/provider request mapping; unknown stays unknown.
Never blindly resend a possibly paid request, release unknown reservations, or infer a charge of
zero from refusal, abort, invalid output, stale state or revoked membership. Deterministic synthetic
recording replay is safe only when explicitly marked as such. Historical returned bytes are reused
without dispatch. The current ordinary job implementation discards stale `result.output` and only
queries selected local statuses: reuse its deadline/fencing ideas, not those incomplete retention
and settlement semantics. Queue selection must filter supported provider/version before limiting,
or use bounded pagination so unsupported old jobs cannot starve eligible work.

A late result after a human correction is retained with `stale: review_revision_changed`. Its
synthesis cannot become the current suggestion and cannot create/update a finding. The human
evaluation, qualifications, original attribution and publication state remain exactly as saved.
A later authorized run starts against the new revision with a new identity; it cannot erase the
first run. An already saved finding keeps its original proposal reference on correction; a new
suggestion may be inspected alongside it, never substituted for its provenance.

## Human review handoff

Keep the established Overview / Classification / Compliance / Publish & Documents responsibilities.
Compliance shows run progress, per-target source readiness, original synthesis state, derived
availability and human review state as separate fields. Display every supporting, limiting and
opposing candidate through bounded pages with source context and earlier-attempt sightings. Show
the adopted outcome definitions beside the proposal. Overview may show deterministic counts and
open questions; generated prose never becomes the district's public summary automatically.

For a current proposal, **Review in editor** creates an unresolved draft with a server-verified
`segmented-proposal-v1` reference, source/definition/evidence IDs, declared scope, original question,
and a required question to verify applicability and interpretation. Preserve the original target
state/rationale, candidate links and every question in immutable provenance. Do not claim the v1
model independently assessed the human-declared scope. A generated question and a system-required
handoff question must be distinguishable. If their combined display cannot fit the existing context
field, reference the full immutable proposal; do not truncate a qualification or invent a v1 field.

Human range acknowledgments start empty, regardless of the machine ledger. Existing drafts block
replacement; tab reload preserves the original revision and pending command identity. The reviewer
explicitly selects bounded citations from the full evidence, records their interpretation, confirms
required ranges and resolves or retains qualifications. An unavailable dependency cannot become
confirmed silence through a generic note. A quote proves where text occurs, not that it supports
the interpretation. More than three ordinary or per-clause citations requires explicit selection
with a visible retained-candidate list; all originals remain referenced and inspectable.

For refined measures, keep every adopted clause and its separate evidence roles. Seed clauses as
unresolved, retain the original proposal per clause, and use the existing deterministic aggregation
only after the explicit human edits. Do not collapse opposing/limiting evidence into a positive
aggregate or substitute model scoring. Save unresolved work without completing the measure;
unresolved points/total remain null with the full denominator. Later corrections retain original
qualifications and server attribution. New finding/provenance versions are required for these extra
references; do not squeeze them into existing v1–v6 findings using unchecked fields.

## Compatibility, migration and exact recovery rehearsal

Propose backup **schema 10** for the first durable segmented-run record, including an empty queued
run with no saved finding. Allocate the final number with the coordinator at implementation time.
The review head needs a durable segmented-storage marker so backup detection does not overlook
cancelled/failed runs. Existing schema 1–9 archives, ordinary suggestion jobs, v1 packets, source
parts, definitions and human evaluations keep their original identities and readers. No automatic
migration/import of private packets; keep their raw files separately backed up as today.

Use additive collections and versioned provenance. Existing records need no rewrite merely to
support the new reader. A first human save linked to a segmented proposal needs a new finding and
human-adapter version (proposed `findings-v7` / `human-evidence-v6`), without changing scoring
arithmetic. New readers dispatch on saved versions; unsupported versions fail clearly. Old builds
reject schema 10. Never relabel a backup to force compatibility. Keep the verified pre-upgrade
schema-9 archive and matching source/toolchain for rollback; rollback cannot include later writes
unless a separately reviewed reverse migration exists. Portable review exports remain inspection
archives and cannot restore approval or actor authority.

The durable increment must perform this synthetic rehearsal under coordinator runtime ownership:

1. Restore a verified schema-9 installation into a fresh disposable runtime using the archive's
   exact synthetic project, district and configuration, retaining the old archive. Never change or
   relabel its project identity to make restoration succeed. Verify old reviews, prompts, receipt
   replays, historical evaluations and projections.
2. Create a long Unicode review with a late opposing statement and a missing annex. Store a valid
   attempt, its invalid retry with original whitespace, a failed final segment, a stale historical
   synthesis, and a current unavailable synthesis. Leave a human partial draft in the browser and
   save a separate attributed unresolved finding with partial human acknowledgments.
3. Create fake-transport attempts paused before dispatch and after a durable dispatch marker.
   Include unknown billing, cancelled/revoked/stale outcomes and a saved human correction before
   a late return. Reserve them without real inference. Persist one command whose acknowledgment
   is deliberately lost; retain its exact command ID/payload for replay.
4. Acquire maintenance and attempt a late completion: no output/eligibility/settlement write may
   cross the fence. Save and verify schema 10, including every request/output/outcome/receipt,
   original bytes/hash, dispatch mapping, reservation and human provenance. Browser drafts remain
   private tab state, not installation backup contents; verify their independent reload behavior.
5. Stop only the owned disposable runtime and restore that archive. Before worker startup compare
   every Firestore/Auth document and all raw byte hashes; revalidate historical synthesis against
   its recorded prefix, not current attempts. Verify no automatic restart dispatch from a marked
   non-offline attempt, and no authority for revoked/stale/cancelled results.
6. Replay the lost-ack command exactly: same attempt/effect, no extra quota or dispatch. Exercise
   fake provider lookup to settle once, retaining unknown reservations until explicit resolution.
   Confirm human correction/qualifications, null score, historical versions and audience projections
   match pre-stop state. Verify all roles, including denied direct Firestore access.
7. Save a second verified schema-10 archive, restore again and compare every document/hash. Run
   maximum admitted storage plus intentional overflow. Tampered/missing output, source part,
   request/version or receipt must fail restore/read validation and retain maintenance on failure.

These are required future acceptance steps, not completed recovery evidence for this proposal.

## Failure cases and evidence classification

The executable cases use actual existing production helpers and authored fictional text. They
contain no fake implementation of proposed receipt, storage or transport APIs. A deliberate
wrong-scope structural pass is evidence of a known validation limit, not a quality success.

| Case | Required outcome | Evidence now / future gate |
| --- | --- | --- |
| Complete commitment / genuine omission | Exact candidates or complete no-candidate coverage; all ranges/targets acknowledged | Runnable `segmented-adoption.test.ts`. |
| Commitment plus late contradiction | Both retained; established rejects; ambiguous requires question | Runnable. |
| Pending/failed/invalid/unavailable final range | Original state preserved, derived unavailable; no confirmed silence | Runnable, four independent cases. |
| Missing annex for one target | That target unavailable; unrelated complete targets remain inspectable | Runnable. |
| Invented/ambiguous/out-of-segment citation | Raw return retained invalid; no accepted candidate | Runnable, three independent cases. |
| Retry omits prior candidate or fails | Candidate retained, earlier synthesis stale but historically revalidated | Runnable. |
| Forged authority / cross-segment identity | Strict schema/request rejects | Runnable. |
| Output/attempt/synthesis bound exceeded | Explicit rejection; no overwrite | Runnable; complete-synthesis overflow also covered by existing `source-segments.test.ts`. |
| Exact irrelevant/wrong-account quote | May pass structural validation; reviewer must challenge meaning | Runnable known-limit demonstration. |
| Machine completion → human save | No automatic range acknowledgment or accepted offline provenance | Runnable production evidence boundary. |
| Late offline output after human correction | No server-verified provenance; human record preserved | Runnable helper boundary; **not** an asynchronous segmented-worker test. |
| Lost ack / concurrent start / crash / cancel / access revocation / maintenance | One receipt/effect; fenced eligibility; no blind paid retry; independent settlement | Proposed segmented API/worker and emulator gate. Existing ordinary-job tests are references, not proof for the new path. |
| Historical read / two-cycle schema-10 restore | Exact original bytes, qualifiers, reservations and human authority survive | Proposed rehearsal above. |

Run current-boundary evidence with Node 24 and the pinned dependencies:

```sh
node --import tsx --test test/unit/segmented-adoption.test.ts test/unit/source-segments.test.ts
npm run typecheck
```

Observed commands and revisions belong in the [INT-01 report](parallel-work/reports/INT-01.md).
No provider/model quality, paid lifecycle, new authorization path or schema-10 recovery is proved
by this offline suite.

## Small implementation sequence and decisions

1. **Review this proposal and current-boundary evidence.** Coordinator records INT-001 decision,
   versions, bounds, implementation owner and independent reviewer. No write-path delegation is
   implied by accepting the documentation increment.
2. **Pure protocol and storage increment.** Freeze strict application envelopes/provenance and
   converters; implement immutable records, bounded reads/reservations, schema marker and recovery
   validation together. Keep dispatch disabled. Test all roles and failed atomic writes.
3. **Synthetic run lifecycle.** Add explicit receipt-backed commands and deterministic recording
   worker, preserving raw invalid/stale outputs. Fake non-offline lookup tests cover uncertain
   dispatch/settlement; no live adapter registration. Complete CI/integration/recovery gates.
4. **Inspection and human handoff.** Integrate bounded candidate browsing, unresolved draft
   preparation, qualification retention and explicit human saves. Non-author review plus draft,
   stale-result and atomic-publication regression checks precede acceptance.
5. **Provider qualification separately.** Actual transport/tokenizer/spend policy, adjudicated
   semantic holdout and operator reconciliation are separate work. No live calls are authorized here.

Engineering decisions proposed for acceptance: inspection-first unresolved handoff, no packet
import, separate run/result/settlement status, the finite admission limits, and additive versioned
storage. No district rubric or policy choice is needed to deliver this proposal. Human adjudication
of semantic labels, retention above these finite bounds, operating budgets and real provider/data
scope remain later decisions. Preserve Gemini provenance and vendor-independent qualification as
described in [provider adoption](ai-provider-adoption.md).
