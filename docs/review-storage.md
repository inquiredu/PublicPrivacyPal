# Versioned local review storage

This local milestone keeps the existing review identity while separating its small current state
from immutable source, rubric, evaluation, finding and decision records. It supports the optional
original 50-measure framework without putting the entire evaluation in one Firestore document.
This remains a synthetic, emulator-only implementation, not a hosted capacity claim.

## Explicit rubric adoption

Save the optional PEF 2.0 starter framework in **Settings**. When pasting a new policy, choose
**Saved district rubric (50 measures)** under **Review measures** and review the scoring selection.
The server requires the displayed current settings revision. A stale selection fails without
creating a review; refresh the saved rubric and explicitly adopt its current revision.

Each review stores the exact criteria, evaluation guidance, area priorities, selected standards,
law references, custom context, settings revision/hash, definition version and scoring engine.
Disabled areas remain in that snapshot but are excluded from scoring and completion. Every enabled
measure needs an explicit finding and rationale before a decision. “Meets” means the criterion's
stated expectation is satisfied, including questions whose expected answer is “no.” It is not a
literal yes/no answer to the question. Exact quotations establish source location, not interpretation.

Context supplies information for human review; no AI analysis or law determination runs. Choosing
a named standard does not add a separate rubric. Existing eight-measure reviews keep their practice
contract. Later settings changes never alter an existing review's score, decision or publication.
A changed source or rubric currently requires a new review; replacing either within an existing
review is deliberately unavailable. Each evidence correction creates a new evaluation version.

## Records and bounds

All paths below are under `districts/{district}/reviews/{review}`. Byte limits measure UTF-8 JSON
and leave space below Firestore's document limit for its field/path encoding.

| Record | Purpose | Maximum bytes |
| --- | --- | ---: |
| `services/{hash}` | Attributed service facts and adopted tier requirements | 48 KiB |
| Review head | Identity, revisions, job, publication state, counts and version references | 8 KiB |
| `sources/{hash}` | Fixed policy text, capture metadata and source version | 128 KiB |
| `definitions/{hash}` | Adopted measures, context, priorities and scoring version | 256 KiB |
| `findings/{hash}` | One finding, assessment/resolution citations, qualifications and attribution | 64 KiB |
| `evaluations/{id}` | Score/breakdown and references to at most 50 findings and fixed source/rubric | 64 KiB |
| `decisions/{hash}` | Attributed human decision tied to an evaluation | 32 KiB |
| `history/{id}` | One attributed transition or before/after correction | 160 KiB |
| Assembled detail response | One selected current or historical evaluation | 4 MiB |

Source text remains limited to 32,000 UTF-16 code units; each quotation to 2,000, with at most three
per ordinary finding (precision clauses have separate bounded evidence below); each evidence rationale to 1,000. Hashes use deterministic canonical JSON for structured
records and SHA-256 of the exact normalized text for sources. Reads check content-addressed references.
Unchanged findings are shared across versions and are not rewritten on each correction.

The head, new versions, command receipt, history and public/staff projections commit atomically.
A failed write cannot advance the head, remove evidence, claim success, or leave a stale publication.
Concurrent commands require the same current revision checks as before. Publication still requires
a current approved/conditional human decision; score alone never authorizes it.

Review and history lists return at most 20 entries, reading 21 for a next-page indicator. Browser
subscriptions use those same limits; direct unbounded queries are denied. Detail loads only for the
selected review. API cursors bind the district/review, sort value and ID. The sandbox caps review
creation at 1,000 with a transactional counter; fixture analysis retains its 100/day quota. History
and evaluation versions accumulate: no silent retention/deletion policy is imposed. The existing
64 MiB installation-backup cap still applies, so 1,000 full reviews is not an advertised capacity.

Review readers (admin, reviewer and read-only reviewer) can read the adopted context through the
review API. The live settings record and settings history remain admin-only. Direct client access
to sources, definitions, findings, evaluations and decisions is denied for every role; authorized
API readers receive the assembled private review. Public and staff projections contain no rubric,
source, evidence, internal rationale or reviewer identity.

## History and export

`GET /api/reviews` and `GET /api/reviews/{id}/history` return `{items, nextCursor}`; pass the cursor as
`?cursor=...`. `GET /api/reviews/{id}` assembles current detail. Private readers can inspect a saved
version using `GET /api/reviews/{id}/evaluations/{evaluationId}`. Before/after evaluation IDs are in
correction history. The future service-detail restoration can use these endpoints.

**Export review and history page** includes the source, adopted contract, current findings and
human decision plus up to 20 recent history events, reduced if needed to fit 2 MiB. A continuation
cursor identifies additional history; this is not a complete installation backup. Full-rubric
exports use `privacypal-district-v1` and are inspection archives. For a fresh evaluation, paste the
source and explicitly select current settings. Imported archived settings or approvals cannot
establish authority. Practice imports retain their existing fresh-review behavior.

## Migration and recovery

Restore a verified schema-1/2 backup with the current local application. Before API/worker startup,
it converts each old inline review transactionally under the archive's saved maintenance lock.
Sources, scores, evidence, identities, decisions and projections are preserved; old analysis history
is replaced by references to preserved versions. Evidence edits are replayed and checked against
stored before/after values. Legacy records without a profile retain the inherited arithmetic.
Schema-3 reviews are skipped on repeat runs. A counter records the final review count.

For an already running legacy local emulator, `npm run local:migrate-reviews` first saves a verified
pre-migration backup, then obtains the write fence and migrates. Keep that archive and the matching
old source for rollback. The backup writer marks legacy/mixed data as schema 2 and converted data as
schema 3. Old archives are never rewritten or relabeled.

An unsupported record, missing history dependency, mismatched reconstructed evaluation, or more
than 100 legacy history events stops conversion and leaves maintenance active. Earlier converted
reviews remain readable and a repeat run skips them. After resolving the cause locally, use
`npm run local:migrate-reviews -- --resume-lock LOCK_ID`. Do not release maintenance merely to
bypass a failed migration. To roll back, stop services and restore the preserved archive with its
compatible old source/toolchain. Nothing here migrates or changes the original district instance.

## Acceptance evidence

Synthetic tests exercise 50 maximum-length Unicode findings whose assembled review exceeds 1 MiB,
shared findings and earlier evaluation retrieval, settings changes/disabled areas, atomic failure
and concurrent correction, all reader/editor boundaries, 1,000 summary pagination, legacy conversion
and injected conversion failure. The recovery rehearsal imports a mixed old/new-format archive,
compares every migrated document, verifies a fully reviewed/published 50-measure record and its
first partial evaluation, then saves schema 3 and restores again. These are correctness checks;
production transfer, render-time and cost budgets remain future pilot work.

## Service-detail extension

The service workflow adds an immutable service snapshot, a lightweight head reference/summary and
a service-revision binding on decisions. Existing evaluations remain unchanged. See
[complete service review](service-detail.md) for fields, commands, projections and schema-4 backups.

## Policy-suggestion extension

Suggestions remain separate from evaluations and human corrections. A review head stores only
`assistanceId` and a bounded request counter. Private `suggestions/{hash}` records store at most
256 KiB of output plus 8 KiB of metadata; `assistanceKeys/{hash}` tracks exact-request reuse.
District-level `assistanceJobs/{id}` records have a 16 KiB bound. Jobs/results are limited to
20 requests per review, three uncached attempts per exact request and 100 requests per UTC day.
The installation-wide backup limit still applies; there is no silent retention/deletion job.

All direct client reads/writes to these paths and `assistanceBudgets/{day}` are denied. Private
readers receive the current validated result through the API; prompts/results never appear in
staff or public projections. Completed suggestions do not advance the review revision or overwrite
a draft. Human acceptance uses the existing evidence command, creates an attributed evaluation,
and withdraws publication under existing rules. Results and jobs are included in schema-5 whole
installation backups; portable review exports currently exclude them. See
[policy suggestions](policy-suggestions.md) and [provider adoption](ai-provider-adoption.md).

## Review-context extension

New human saves preserve scope, questions, suggestion provenance and attributed resolutions in
`findings-v3`. Unresolved measures retain their maximum but withhold the aggregate score under
`review-coverage-v1`; decisions/publication remain blocked. Prior evaluations keep their saved
arithmetic. Archives with this evidence use schema 6. See [durable review context](review-context.md)
for draft behavior, correction rules, storage limits and compatibility.

## Precision-profile extension

The optional [precision pilot](rubric-adoption.md) adopts a version-2 evaluation contract with
14 refined measures and 26 clauses. Human `findings-v4` records retain clause interpretations,
evidence roles and original proposals; the server derives aggregate findings. The head marks
`evidenceVersion: 4` from creation. The 64 KiB finding, 160 KiB history and 4 MiB detail bounds stay
unchanged. Clause evidence permits up to three quotes each, with a nine-passage editor pool.
Schema-7 installation backups preserve adoption even if the current settings later revert.
Prior contracts, evaluation arithmetic, prompt identities and archived data remain unchanged.

## Bounded source bundles

Explicit bundle captures use source version 2 and head evidenceVersion 5. Documents are stored once
in an immutable manifest; combined canonical text is reconstructed and verified on reads. Human
saves use human-evidence-v4 / findings-v5 and bind server-owned per-requirement coverage to the
bundle identity. Existing byte bounds and unresolved arithmetic remain unchanged. See
[source bundles](source-bundles.md) for the source/request contract and schema-8 backups.

## Long source parts

Explicit v2 source bundles use a version-3 `sources` manifest and hashed `sourceParts` records,
each still within the 128 KiB source cap. The server reconstructs and validates every part,
order, full-source hash and frozen segment plan on reads. Heads mark `evidenceVersion: 6`; human
`findings-v6` retains `human-source-review-v1` acknowledgments. Existing finding/history/detail
bounds remain unchanged. Schema-9 backups identify this format before any finding is saved.
See [source segments](source-segments.md) for request, coverage, offline packet and recovery contracts.

## Saved segmented attempts

The [synthetic segmented lab](segmented-reviews.md) stores immutable requests, original returned
bytes, outcomes and their attempt order below private run heads. Each review retains up to two
runs and three attempts per range or synthesis. Permanent admission reservations cover future
output records; per-run limits are 16 MiB / 800 records and installation limits are 32 MiB / 1,600
new run-owned records. Existing human finding/history bounds and the 64 MiB whole-archive limit
remain separate. No history is deleted to make room.

The first run leaves a sticky storage marker, including empty cancelled runs, requiring schema 10.
An explicit human save with segmented provenance uses `findings-v7` / `human-evidence-v6` and keeps
that format for later corrections. Historical findings and evaluations retain their original
identities. Worker completion cannot write human evidence, scores, decisions or projections.
Recovery validates the complete attributed graph before releasing maintenance or starting workers.
