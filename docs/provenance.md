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
