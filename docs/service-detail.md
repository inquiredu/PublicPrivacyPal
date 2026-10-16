# Complete local service review

The reviewer card and four-tab detail now use the bounded review contract. This is an emulator-only
adaptation of the pinned PrivacyPal experience, using synthetic data. Existing practice reviews keep
their source, arithmetic and publication until explicitly changed. No external fetching or AI runs.

## Starting a service review

An administrator opens Settings and explicitly adopts the optional **Service tier requirements**
example. Its name, version, per-tier DPA/rostering/no-personal-data/parent-permission checks and
additional requirement text are editable. This is district configuration, not universal policy or a
legal certification. Saving produces a new settings revision.

In Policy reviews, leave **Complete service review with saved district tier requirements** selected
and choose either practice measures or the saved full rubric. Creation binds the current displayed
settings revision; stale settings are rejected. An existing review can explicitly adopt the tier
policy from Overview. Adoption withdraws publication and requires a fresh decision, while retaining
the source and evaluation. A service's adopted policy cannot silently change with later settings.
Create a new review to adopt a different policy or source/rubric.

## Original feature map and deliberate refinements

| Original surface / feature | Working destination and behavior |
| --- | --- |
| Reviewer card | Separate publication and decision status, score, reviewed coverage, tier, grades, data involvement and requirement warnings. Open a bounded detail on selection; keyboard focus moves to its heading. |
| Overview: tier and requirements | Editable tier/support, adopted policy/version, requirement checks, document/rostering summary and a link to their controls. Tier assignment itself is not approval. |
| Overview: age, communication, education version | Attributed service fields with explicit unknown/yes/no states and education notes. |
| Overview: policy URL and paste remedy | URL is a reference only, never fetched. The immutable saved policy is visible. A different source requires a new pasted review; changing a reference URL does not pretend to analyze a new page. |
| Overview: plain-language summary | Saved district decision wording, edited with the decision in Publish & Documents. |
| Compliance | Grouped full-rubric measures, exact quotations, points, rationale, omitted/contradictory/unreviewed counts, enabled/disabled criteria and adopted context. The existing evidence editor and paged history are integrated here. Prior evaluation scores can be inspected from correction events. |
| Standards and law assessments | Adopted references/context remain visible. Live discovery and generated legal assessments stay deferred; the interface explicitly says none were made. |
| Classification | Permitted-use conditions, permission conditions, alternative activity, grades, curriculum, student-data involvement/categories and private district requirement confirmation. These human facts survive evidence corrections and fixture reanalysis. |
| Publish & Documents | Unknown/absent/recorded/expired/not-required DPA states, signed/expiry dates, reference and scope, manual/automated rostering, SSO and private ClassLink notes. Human decision and exact audience previews use the publication projection. |
| Staff catalogue | My workspace leads with tier, permitted use, permission conditions, grades and data. Support, age, curriculum and education notes follow. Score/coverage are supporting context, never permission. |
| Family notice | Existing configurable card/compact library includes only approved disclosure fields. No score, evidence, rubric, actor, private rationale, agreement reference or settings enters its projection. |
| Bulk actions, deletion, claims | Deferred: this increment proves one complete service. A batch/assignment lifecycle needs its own concurrency and retry design. |
| DPA generation/signing, mail, Drive, automated monitoring | Deferred. Manual agreement and rostering facts are usable without them. |
| Clickable classification tags / audience detail dialogs | Grade/data facts and conditions are visible directly on audience cards and compact rows. Dedicated tag browsing and separate audience dialogs remain later refinements. |

## Persistence and publication guarantees

Service changes use `edit_service` with an expected review revision, a required rationale, and an
actor-scoped command receipt. Service drafts use the same tab-scoped private storage, original base
revision, expiration and sign-out cleanup as evidence and decisions. Navigation preserves drafts;
failed or uncertain saves retain them. A concurrent update never silently rebases a draft. Editing
another type of draft is disabled until the current one is saved/discarded.

Immutable `reviews/{id}/services/{hash}` records hold a schema-version-1 service snapshot (48 KiB
UTF-8 JSON limit). The 8 KiB head stores only its hash and a small card summary. API-only version
access uses the existing reader/editor role matrix. Direct client reads and writes to service
versions are denied. Detail remains capped at 3 MiB; mutation requests are capped at 64 KiB.
History retains attributed before/after service snapshots within its existing bound.

Every service correction atomically withdraws both audience projections. A decision binds both the
exact evaluation and service revision. Approval/conditional approval and publication independently
check the adopted requirements on the server; a current DPA needs its reference, scope and signed
date. Future signing dates and expired required agreements cannot satisfy the check. Expiry is
inclusive in UTC. A declined decision remains recordable after evidence review despite blockers.

The preview and publication writer call the same explicit projection builder. The public projection
adds only tier, grades, student-data involvement/categories, permitted-use/permission conditions and
an alternative. The staff projection additionally selects support, age, curriculum, education notes,
score and evidence coverage. Publication badges reflect acknowledged saved state.

There is no time-triggered withdrawal job: a DPA becoming expired after publication needs operator
review/unpublication. The server rechecks dates on the next approval/publication, and detail checks
reflect the current date when rendered. Card warnings summarize the last write. Automated expiry
monitoring must be designed before using this workflow with real agreements.

Backups containing service records use **schema 4**, including archives with mixed legacy records.
Older readers reject them; never relabel an archive. The current reader accepts schemas 1–4 and
converts any legacy inline reviews under maintenance when restoring a mixed schema-4 archive.
Rollback means restoring the preserved pre-service backup with compatible source, not opening a
new service backup in the checkpoint build. Export includes the current service snapshot; importing
an inspection archive does not confer its tier policy, document confirmations or approval.

## Repeatable synthetic acceptance

1. Restore the saved local installation. Save the optional tier policy in Settings.
2. Create **Cedar Complete Service — Browser QA**, explicitly adopting the saved full rubric.
3. Record Tier 2, an education version, grades 6–8, student-data categories and conditional use.
   Navigate away/back before saving; verify the draft remains. Leave DPA unknown.
4. Review all enabled measures, including explicit omissions. The browser acceptance fixture uses
   one partial quotation and 49 missing-evidence findings populated through the local API; this is
   interaction test data, not an assessment of a vendor. Approval remains blocked by the DPA.
5. Record a fictional agreement reference, signed date and scope. Save with a rationale.
6. Record a synthetic conditional decision and publish. Inspect the staff and anonymous family views.
7. Correct the cited finding to not addressed. Verify withdrawal from the actual family library,
   preserved service facts, an earlier decision label and a disabled publication button.
8. Record a fresh decision and republish. Reload and verify both the saved facts and publication.
9. Check arrow/Home/End tab navigation, heading focus and narrow-screen layout. Save and verify a
   whole-installation backup before stopping the demo services.

Automated tests cover the role matrix, requirements, stale settings, date boundaries, projection
allowlists, service write failure, concurrent corrections, command replay, maintenance and draft
retention. Recovery tests preserve a published 50-measure service and its adopted policy/decision
through two whole-installation restore cycles. These checks do not establish production capacity,
full screen-reader conformance, hosting readiness or legal sufficiency.
