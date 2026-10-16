# Source provenance

Recorded 2026-10-15.

| Item | Value |
| --- | --- |
| Source repository | https://github.com/inquiredu/privacypal |
| Examined branch | `main` |
| Examined commit | `adad00a05e67bf9ea88d145cf2e0a1100ec27889` |
| Commit date | 2026-10-10 |
| Tracked source files | 255 (including hidden configuration and workflow files) |
| Destination repository | https://github.com/inquiredu/PublicPrivacyPal |
| Initial destination commit | `91ce51f` (README only) |
| Upstream license | GNU Affero General Public License v3.0; original LICENSE copied unchanged |
| Local reference copy | `.private/upstream/`, exported from the pinned commit without `.git` |
| Private audit | `.private/audit/REPORT.md` |

Both repositories were private when inspected. No remote changes, visibility changes, source
pushes, deployments, production authentication, or database maintenance were performed.

This is an independent derivative repository with its own history, rather than a GitHub fork
that copies the original history. Source provenance and license notices will remain explicit.
Private operational records and historical fixtures stay outside releasable source.

The GitHub snapshot is **not proof of the deployed revision** and does not include uncommitted
work from any other workstation. Reconcile that separately before proposing any district update.

## Baseline verification

The pinned source was installed in a temporary directory with lifecycle scripts disabled. Its
own offline CI gate passed under Node 20.20.2:

- App and Cloud Functions TypeScript checks passed.
- ESLint: zero errors, 125 warnings.
- Unit/regression suite: 354 tests in 28 files passed.
- Admin build, public build, and bundle key/model guard passed.
- Existing Firestore rules suite: 43 tests in two files passed in a local demo emulator.

These are baseline results for upstream, not a claim that this new repository contains a working
application. Additional adversarial tests and detailed findings are retained in the private audit.
No live model calls or district data exports were used.

## Independent local foundation

Milestone 1 was implemented and validated on 2026-10-15 in this repository. The application shell,
configuration, operator setup, membership API, security rules, and synthetic fixtures are new code.
The upstream scoring engine has not been copied or changed in this milestone.

- Strict TypeScript checks and 25 unit/isolation tests passed under Node 24.
- 40 integration tests passed against local Auth and Firestore emulators, including a second district.
- The browser build and source/bundle isolation checks passed.
- Browser checks verified the empty-install setup screen, operator-created admin sign-in, membership
  assignment, staff sign-in without administrative controls, and a successful pending tool request.
- The local web server returned 403 for private reference material, local account files, local
  configuration, and Git configuration.
- Runtime dependency audit reported zero vulnerabilities. Development-tool exceptions are recorded
  in `dependencies.md`; the build also reports a large browser bundle that needs later optimization.

This is emulator validation, not a production deployment or security certification. Data is synthetic
and resets when services stop. The upstream snapshot was left untouched; no district updates or remote
repository changes were made. Local validation logs and screenshots are excluded from Git.

## Local scoring and review workflow

Milestone 2's local synthetic slice was implemented on 2026-10-15. The weighted scoring formula in
`shared/scoring/engine.ts` derives from upstream `services/hybridScoringService.ts` and the
`SILENCE_CREDIT = 0.6` constant at the pinned revision above, under the preserved AGPL license.
Its eight-criterion demonstration profile, fictional policies, golden fixtures, job/API implementation,
review UI, and tests are newly authored. No upstream historical fixture or jurisdiction-specific tier
policy was imported. See `review-workflow.md` for formula semantics and the local-only limits.

Validation: strict TypeScript, 37 unit/isolation tests, browser build and source/bundle isolation
checks passed. All 58 integration tests passed in dedicated demo Auth/Firestore emulators, including
role enforcement, job recovery, injected publication failure/rollback, stale revisions, import trust,
and quotas. The browser build retains a large-bundle warning (approximately 899 kB before gzip).

macOS cloud-only file reads interrupted initial runs. Dependencies were restored from the pinned
local npm cache without lifecycle scripts or version changes; an identical temporary working copy
outside the synced Documents folder was used for emulator validation. CI also passed in the original
workspace. The user confirmed that PrivacyPal appears in the local browser. Automated interaction
verification remains pending because the browser tool still sees an internal connection-error page
blocked by its URL policy; the rendering confirmation is not a passed interactive browser walkthrough.

No deployment, push, production authentication, external policy fetch, live model call, or district
instance change occurred. Emulator data remains disposable; API/browser restart recovery is not a
claim of persistent storage after the emulators stop.


## Rubric candidate and local recovery rehearsal

The next local slice was implemented on 2026-10-15. It adds authored evidence/partial/contradiction
criteria guidance and a separately versioned `community-evidence-v1` candidate that gives missing
evidence zero credit. The inherited profile and previously stored reviews keep their original
arithmetic. This is a technical rubric review; district policy approval has not been supplied.

Operator-only native emulator backups now fence application writes, save Auth and Firestore,
check the exact installation configuration and dependency lockfile, inventory files with SHA-256,
and restore into a fresh emulator session. Completed archives are immutable by workflow; checksum
verification is not a cryptographic signature or encryption. New trial and recovery guides explain
those boundaries and the difference from review-as-draft import.

Validation: 52 unit/isolation tests and 62 emulator integration tests passed, along with strict
TypeScript, the browser build and source/bundle isolation checks. A separate recovery rehearsal
passed two complete emulator shutdown/import cycles, comparing every Firestore document and exact
timestamp, preserving original passwords/UIDs, checking disabled and revoked accounts, role denials,
public projections, queued-job recovery and a second backup/restore. Tests cover interrupted exports,
maintenance fencing, in-flight worker completion, damaged archives and legacy scoring compatibility.
The build's approximately 903 kB uncompressed bundle warning remains an optimization task.

The pre-test local preview was backed up and restored; its original administrator password and role
were verified through local endpoints. The restored web/API responded successfully. Account files,
completed backup files and interrupted-export files were denied through the preview server (403).
No new interactive browser walkthrough was claimed; the earlier browser-tool limitation remains.

Verification and the running preview use an identical local staging copy outside the synced
Documents workspace. A direct workspace CI attempt was killed during typechecking; it is not recorded
as a passed run. The staged checks passed, and local validation logs/source comparison evidence are
kept under `.local/validation/`. No dependency versions, production resources, original repository
files, or remote Git state were changed. No deployment, push, live AI call or real district data was used.

## User-reported browser acceptance

On 2026-10-15, the project owner reported completing the local browser walkthrough: signing in,
reviewing a synthetic policy, publishing it, and unpublishing it. This records a successful manual
acceptance check of the basic review-to-publication flow. It supplements the automated permission
and recovery results above; it is not an automated browser test or district approval of the rubric.
The earlier pending manual walkthrough is now complete for those reported actions.

## Pasted-policy review and evidence editing

The tested baseline was committed locally as `9523fbd` on 2026-10-15 before this feature work. New
source capture, evidence editing, rationale/citation validation, immutable-source attribution,
manual review completion gates, and synthetic test policies are authored in this repository.
No real vendor policy, district record or live model output was imported. Scoring continues to use
the existing versioned engine; manual interpretation does not claim automated semantic validation.

Strict TypeScript, 67 unit/isolation tests, the browser build and source/bundle isolation checks
passed. All 79 emulator integration tests passed, including exact evidence rejection, every role,
atomic correction/publication withdrawal, stale approvals, transaction rollback, concurrent edits,
maintenance, revoked/disabled accounts, imports, API restarts and compatibility with fixture analysis.
A recovery rehearsal passed two complete shutdown/import cycles with published and partly reviewed
pasted policies, multiple citations, exact source hashes, reviewer attribution and audit history.
New backups use schema 2; the current reader also accepts baseline schema 1 without relabeling it.
The browser build retains an approximately 913 kB uncompressed bundle warning.

Validation uses the local staging copy because some Documents files again stalled during iCloud
reads. Every changed implementation/test file was compared byte-for-byte before checks. Logs and
source parity records remain excluded under `.local/validation/`. The pre-feature preview was
backed up before testing, then restored with its existing administrator and saved review. Local
sign-in and administrator role checks passed; the saved review ID/revision and analysis history
were verified against the pre-change archive. Existing credential, config, Git and backup files
returned 403 through the preview server. The public library was also visible in the existing
in-app browser tab. Interactive verification at implementation time was still pending; the
subsequent browser acceptance below records its completion. No push, deployment, live AI, outbound
policy fetch, original repository modification or district instance change occurred.

## Interactive pasted-policy browser acceptance

On 2026-10-15, Codex completed the requested walkthrough through the existing local in-app browser
at `127.0.0.1:5173`, using the existing demo administrator and the authored **Orchard Practice —
Browser QA** policy. All policy/review/decision/publication mutations in this exercise used the
browser controls. No application code changes were needed.

The walkthrough confirmed an initially unreviewed draft, rejection of an invented quote, source
selection using keyboard controls, exact pasted quotations, multiple passages for conflicting
statements, and persistence of four saved findings across a browser reload. All eight explicit
findings yielded 64/100 with seven cited criteria. Conditional approval without conditions was
rejected; a complete decision enabled publication. The anonymous library displayed only the
selected public wording and conditions.

The Collection finding was then changed from meets to partial, its quotation removed/replaced with
a narrower exact excerpt, and its private rationale updated. Unsaved evidence disabled decision
submission. Saving recalculated the score to 57/100, withdrew the anonymous library entry, retained
the old decision as stale, and removed the publish action. A fresh decision with revised public
wording and conditions enabled republication. The signed-out browser showed the revised entry.
Visible history contained 14 events, including nine evidence saves and the correction's attributed
before/after quotations, rationale, scores, source hash and analysis IDs.

Screenshots, the observed audit view, final public view and a check receipt are stored privately
under `.local/validation/paste-browser/`. A verified schema-2 installation backup was saved and
copied into the workspace's private `.local/backups/` directory. The fictional QA entry remains
published locally for inspection; the browser is signed out. This completes this browser exercise,
not an independent district pilot or a full accessibility audit. Existing unit/integration/recovery
results above were not rerun because no implementation changed. Nothing was pushed, deployed,
fetched from a real vendor, or changed in the original district instance.

## Original setup and library customization

Implemented locally on 2026-10-15 after reviewing the pinned original `SetupWizard.tsx`,
`LibraryDesignWizard.tsx`, public library and rubric source. The six-section order, selection
controls, five priority levels, white setup card and library-design dialog are adapted from
those components under the preserved AGPL license. `shared/settings/pef-example.json` contains
the original PEF 2.0 definition (50 criteria, 11 areas), with JSON formatting changed. It is an
optional starter example, not a newly endorsed district rubric. No historical fixture,
production configuration or district-specific notice was imported.

The server-owned settings API, validation, immutable versions, conflict handling, audit and
explicit public projection are authored here. Admin authorization is checked again inside
each write transaction. Failed saves do not complete setup, and a library save commits its
private version and public appearance together. The PDF import uses pinned PDF.js 6.4.299 and
a matching bundled worker; it extracts text locally and asks the user to review it before use.
Its one-page PDF and small PNG logo test fixtures are newly authored synthetic assets.

Final strict TypeScript, **72 unit/isolation tests**, browser build and source/bundle isolation
checks passed. **94 emulator integration tests** passed, covering settings read/write denial
for other roles and districts, first-save failure, forged data, image validation, stale revisions,
concurrent sections, atomic rollback, disabled/revoked admins, maintenance and existing-review
preservation. Two complete recovery cycles passed with exact Firestore comparison, settings
versions, private context, weights, empty footer, public appearance and existing accounts.
Runtime dependency audit reported zero vulnerabilities; development-tool exceptions remain in
`dependencies.md`. The main bundle is approximately 976 kB before gzip; lazy PDF code is about
430 kB plus a 1.26 MB worker. Bundle optimization remains open.

The browser walkthrough used the existing synthetic administrator. It verified required-state
validation; custom context and a changed area priority; local PDF extraction, text preview and
use; successful setup and reload persistence; title, accent, logo, notice and contact changes;
footer reordering; compact preview and tier filtering; unsaved-cancel protection; save and
anonymous display without private context. At a 390-pixel viewport, setup and the modal had no
horizontal page overflow. Escape dismissed a clean dialog, and Enter in preview search did
not submit settings. These checks supplement automated tests, not a full accessibility audit.
Browser console inspection showed no warnings or errors. Screenshots and receipts are private
under `.local/validation/setup-browser/`.

Validation and the live preview use a byte-matched temporary working copy outside the synced
Documents folder. Both the pre-switch snapshot and the final synthetic settings state were
saved with the new dependency fingerprint; the prior-lockfile snapshot was also preserved.
Backups and logs are copied into the workspace's ignored `.local/` directories. No old backup
manifest was relabeled. Existing accounts and the previously republished fictional QA entry
remain intact.

The saved full-framework configuration is not yet connected to the eight-measure practice
review. Restoring the original cards/four-tab service detail and carrying the adopted settings
snapshot into full evaluation remain the next increment. Live discovery, AI and Drive remain
unavailable. Nothing was pushed, deployed, authenticated against production or changed in the
original district project.

## Review draft protection and reliable saves

Implemented locally on 2026-10-15 (validation logs use UTC and extend into October 16). New capture,
evidence and decision drafts live in an account/district/role-scoped session-storage envelope.
They keep their original review revision, survive component navigation, and recover from the
stored envelope without submitting a command. Draft disposal fences late callbacks after sign-out
or observed access loss. Storage is bounded, ordinary drafts expire after 12 hours on reopening,
and storage failures warn while retaining in-memory text. This is tab recovery, not a shared or
server-backed draft system.

The server commits command receipts in the same transaction as review/history/projection changes.
HTTP mutations require a UUID command key, bind it to a canonical request hash and route, and check
current authorization before replay. A replay returns current review state, not an obsolete
publication snapshot. The client limits requests to 12 seconds, keeps unknown outcomes pending,
and offers read-only reconciliation followed by an explicit retry using the same key and payload.
No mutation is retried automatically. These guarantees currently cover review commands; settings,
requests and internal notes remain separate workflows.

Strict TypeScript, **80 unit/isolation tests**, browser build and source/bundle isolation passed.
**101 emulator integration tests** passed, including a real committed HTTP write whose response
was deliberately discarded, concurrent identical requests, changed-payload rejection, atomic
receipt failure rollback, stale edits, publish replay after unpublication, quota/history stability,
actor-scoped lookup, direct receipt read/write denials, revoked/disabled users, maintenance and API
restart. Two full emulator shutdown/import cycles passed, including receipt reconciliation and
replay after recovery with exact document equality. No dependency changes were made. The main
bundle is about 985 kB minified / 295 kB gzip; its existing size warning remains open.

Browser checks used only the synthetic administrator and a new **Cedar Draft Lab — Browser QA**
record. New capture text survived section navigation; a confirmed save created one review and
cleared its capture draft. Evidence and decision drafts survived switching reviews. A second tab
had no access to the first tab's unsaved text. Saving a different interpretation there updated the
first tab's current record while retaining its original quotation/rationale, showing a conflict,
and disabling the stale save. Explicit discard loaded current evidence. The new record remains
private with one reviewed criterion; the prior published Orchard QA entry and library settings
remain unchanged.

Sign-out now uses a visible in-page dialog with native modal focus containment. Browser checks
confirmed that Keep editing and Escape retain the draft, Escape restores focus to Sign out,
confirmed sign-out erases it, and signing back in shows a clean capture form and the same three
saved reviews. This replaced a native JavaScript confirmation that stalled browser automation;
the stalled test tab was closed and the working local review tab was retained.
A clean reload preserved the authenticated session and selected review. The final clean load
produced no new console errors; one earlier warning was caused by editing an effect's dependency
array during hot refresh, before the clean reload.

Browser automation cancelled the native leave-page warning rather than completing a dirty reload,
so a completed browser reload with unsaved text is not claimed here. Stored-envelope recovery and
disposal/late-callback fencing passed unit tests. Screenshots and DOM receipts are in
`.local/validation/draft-browser/`.
Automated logs are in `.local/validation/draft-reliability/`. The existing preview was backed up
before testing, restored afterward, then saved to a new verified local backup after browser work.
Nothing was pushed, deployed, fetched from a vendor, or changed in the original district instance.

## Versioned storage and full-rubric acceptance

Implemented locally on 2026-10-15 (logs use October 16 UTC). Schema-3 review heads contain bounded
summary state and references. Source text, adopted rubric/context, content-addressed findings,
evaluation versions and decisions have separate byte-limited records. Evidence edits reuse
unchanged findings and create a new evaluation; head, history, command receipt and audience
projections still commit atomically. List/history reads and browser subscriptions are paged, and
selected detail is assembled through the authorized API. See `review-storage.md` for exact limits.

New pasted reviews may explicitly adopt the administrator's saved 50-measure starter framework,
area priorities and context with its current revision and an explicit scoring engine. A settings
change never rescales a saved evaluation. Disabled areas are excluded from completion/scoring;
eight-measure reviews preserve their practice contract and missing legacy profiles preserve the
inherited arithmetic. Live settings/history remain admin-only; the adopted context is private
review data available to authorized review readers. No context is added to public/staff projections.

Strict TypeScript, **83 unit/isolation tests**, build and isolation checks passed. **113 emulator
integration tests** passed. New cases cover a complete 50-measure review with 32,000-character
Unicode source, three maximum-length quotes and maximum rationale per measure; the combined review
exceeds 1 MiB, while each stored record meets its cap. Earlier evaluations remain reproducible,
unchanged findings are shared, settings changes/stale revisions/disabled areas are checked, and
failed/concurrent corrections cannot leave stale publication. Tests deny direct version access for
all roles, enforce paged list permissions, and traverse 1,000 synthetic summaries without omissions
or duplication. The 1,001st create is rejected. This is a bounded correctness fixture, not a hosted
performance or capacity benchmark.

Legacy conversion runs per review under maintenance, checks reconstructed evidence history,
preserves source/score/decision/projections and resumes safely after an injected write failure.
The recovery rehearsal saved a mixed schema-2 archive, migrated it during restore, and compared
every resulting Firestore document exactly. A fully reviewed/published 50-measure Unicode record,
its first partial evaluation, permissions, accounts, earlier decisions and command receipts survived.
A subsequent schema-3 backup and second full shutdown/import passed exact comparison again. Old
archives remained unchanged. No dependencies changed in this storage milestone. The existing
main bundle warning remains: approximately 992 kB minified / 296 kB gzip.

The previous local workspace was backed up before testing and restored with the new migration.
Browser checks verified its four-resource public library and previously published Orchard QA
review still showing 57/100, 8/8 reviewed and its prior conditions. A new private **Cedar Full Rubric
— Browser QA** adopted 50 measures at settings revision 1, saved one quoted finding, saved a rationale
correction and retained both changes after a clean reload. The UI shows 1/50 reviewed and a
provisional 1/100 score; approval/publication remain unavailable until review is complete. The
adopted definition and scoring version were inspected. Final browser console inspection returned
no warnings or errors. Full-review publication/correction/republication is covered by the emulator
tests; fifty manual browser entries are not claimed.

Logs and screenshot evidence are in `.local/validation/review-storage/`. The preview runs from the
isolated temporary validation copy, with matching source and a verified final backup copied into
the original workspace. The original service card and four-tab restoration remain next; this is
its storage foundation. No push, deployment, production login, live fetching or model call occurred,
and the existing district instance and original repository were untouched.

## Complete service card and four-tab restoration

Local checkpoint `fae8d20` preserves the preceding milestones. This increment adapts the workflow
from pinned original `ToolCard`, `ToolDetailView`, `tierPolicy`, `StaffToolCard`, `PublicNoticeLibrary`
and `publicProjection` source at `adad00a05e67bf9ea88d145cf2e0a1100ec27889`, read locally without
running it. Original license/attribution remain in this repository. No production bindings or
operational data were imported. Implementation and deliberate behavior changes are mapped in
[service detail](service-detail.md).

The new server commands preserve immutable service versions, enforce configurable adopted tier
requirements, and bind human decisions to both evidence and service revisions. Preview/publication
share an allowlisted builder. Service backups use schema 4 so earlier readers reject them.

The synthetic browser walkthrough created Cedar Complete Service using settings revision 2 and the
full 50-measure rubric. Repetitive findings were populated through the local API (one partial
quotation, 49 explicit omissions), not falsely claimed as fifty manual entries. Browser checks
confirmed navigation-safe service drafts, an unresolved DPA blocker, document confirmation,
conditional publication, a 1-to-0 evidence correction, actual withdrawal, a fresh decision and
republication, and reload persistence. Original Orchard QA remained 57/100. Anonymous family and
staff-account screens were inspected independently. A dedicated synthetic staff account was added
for this check; its credentials remain in ignored `.local/accounts/`.

Arrow-key tab navigation and 390-pixel layout were checked; the narrow page had no horizontal
overflow. Broader screen-reader/zoom/accessibility and measured performance remain release work.
The existing large main-bundle warning remains open. Full-rubric service data and decisions survived
two complete backup/restore cycles. Final counts and local artifacts are recorded in the handoff.
No push, deployment, production login, live policy fetch or AI call occurred. The original district
instance and repository remained untouched.

The accessibility/bundle follow-up preserves restoration commit `edc75f7`. See
`accessibility-performance.md` for measured build sizes, keyboard/reflow evidence and limitations.
It adds no dependencies and makes no server, authorization or storage changes.
