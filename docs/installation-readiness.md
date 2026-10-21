# Installation readiness

PublicPrivacyPal currently supports a synthetic local development rehearsal. This is not evidence
of production provisioning, a supported release or a completed independent district pilot.
The adopter instructions are [local setup](local-development.md) and
[independent trial](independent-trial.md); they require no author's account or temporary path.

## Current fresh-clone rehearsal — DOC-03

The October 20, 2026 adoption wave starts from an actual GitHub clone of
`inquiredu/PublicPrivacyPal` at `2f3709f37c601815bed653a468d062c15aff3067`, on the development branch
`codex/coordinated-milestone-2026-10-19`. It is not a `main` merge. The coordinator supplied only the
new coordination brief/contracts/workboard after verifying clone parity. No configuration, accounts,
archives, private material or dependency directory was copied into this installation workspace.

The macOS 26.6.2 arm64 host already had Node 24.22.0, npm 11.6.2, Temurin Java 21.0.12.1 and an
emulator cache. Selecting those existing tools does not prove fresh Node/Java installation or an
empty-cache emulator download. Normal `npm ci --no-audit --no-fund` installed this clone's own
735 packages in five seconds; existing package cache reuse was possible. Deprecation notices were
observed, not resolved by unrequested dependency changes or treated as a current security audit.

| Exercise | Observed result and limit |
| --- | --- |
| Own pinned dependency installation and `npm ls --depth=0` | Passed; exact declared top-level versions, unchanged package manifest/lockfile. |
| `npm run local:init`, then repeat | Passed; created synthetic `config/local.json`, then preserved its exact bytes. The runtime trial selects the checked-in River Valley example instead. |
| Port diagnostic tests | Eight injected cases passed for successful sequential loopback probes, occupied ports, both permission codes, other/uncoded errors, synchronous refusal and close failure. No real ports are bound by these tests. |
| `npm run ci` in the fresh clone | Passed 526 unit/isolation tests, TypeScript, browser build, bundle budgets and source isolation. This is the DOC-03 source increment before other adoption-wave changes. |
| Actual sandbox startup | Failed on `EPERM` at `127.0.0.1:5173`, now correctly reported as a permission denial with the original cause. The elevated retry waited for tool approval and was cancelled; no successful worker runtime start is claimed. |
| Fresh River Valley startup/bootstrap | Coordinator ran the trial in this clone after taking over the reservation. Startup and bootstrap passed. Repeat bootstrap preserved every Firestore document, Auth record and generated account-file digest. |
| API sign-in/setup and role boundary | Administrator sign-in/setup/member reads passed; anonymous private-review access returned 401. A newly created unassigned identity received 403; viewer could read reviews but not memberships; staff could not read private reviews. |
| Native backup, graceful shutdown and fresh restore | Coordinator saved/verified archive `58dd5b0e-eb71-4c61-8187-ffffd7baf132` (six files), stopped the trial, and restored without bootstrap. Full Firestore digest matched; both original UIDs/passwords, admin/staff roles, staff denial and all three catalogue entries survived. Original archive verified again afterward; trial services stopped. |
| Browser and independent-person trial | No browser interaction by DOC-03. CLI/API evidence cannot establish an interactive onboarding pass, and implementation-team operation is not an outside-person trial. |

These are implementation-team CLI/API results, not interactive browser or outside-person acceptance.
The fix changes only the startup port probe and its diagnostic. Loopback addresses, port list,
fresh-session refusal, process shutdown, configuration and restore behavior remain the existing
contracts. Coordinator source review accepted the three source/test files. See
[DOC-03](parallel-work/reports/DOC-03.md) for operator attribution, private evidence locations and
remaining limits. The coordinator also verified a real occupied `127.0.0.1:8080` probe returned
`EADDRINUSE` with its original cause while the integrated test runtime retained ownership. The
worker observed real `EPERM`; coordinator startup then succeeded through the authorized tool route.

## Historical source-copy rehearsal — DOC-01

DOC-01 began on October 18, 2026 from accepted main commit
`cb5bb04cde8d900f0376d11f5676369636845eae`. All 136 implementation-manifest inputs matched before
work began. The coordinator supplied a disposable source-only copy of archive
`d611bf66d41a1e1aa90e0bb1093e78c6478cfa1c714883f3330242082ea08fd3` (SHA-256).
No local configuration, accounts, backup data, private source, Git history or dependencies were
copied into the rehearsal. Fresh local-only Git metadata with the independent origin allowed the
source-isolation check to inspect that copy. Its dependencies were installed in its own directory.

Host: macOS 26.6.2 (25G83), arm64; Node 24.22.0 and npm 11.6.2. The default shell initially selected
Node 25 and could not find Java. Verification explicitly selected an existing Node 24 toolchain;
it did not exercise installing Node on a new computer. A normal `npm ci` used the existing machine's
package cache where available, so this is not an empty-cache/offline-first download test.
An existing Temurin Java 21.0.12.1 runtime and emulator cache were selected for the attempted
runtime rehearsal; installing Java and downloading fresh emulator binaries were not exercised.

### Observed checks in the October 18 source copy

| Exercise | Result and limit |
| --- | --- |
| `npm ci` with Node 24 | Passed; 735 packages installed into the disposable copy's own `node_modules`. Deprecation notices were emitted. No dependency or lockfile changes were made. |
| `npm ls --depth=0` | Passed; exact declared top-level dependencies resolved, including `pdfjs-dist` 6.4.299. |
| `npm run ci` | Passed; TypeScript, all 386 unit/isolation tests, production browser build, bundle budgets and source isolation. This is the accepted application baseline plus onboarding edits, not the final integrated first wave. |
| `npm run local:init`, then repeat | Passed; created the synthetic local configuration, then left it unchanged. The attempted runtime explicitly selected the separate River Valley example. |
| Fresh local startup | Sandbox attempt failed with “Port 5173 is occupied” although coordinator checks found no listener. The launcher maps any bind error to that message, so it can also hide a permission error. An escalated retry waited for approval and was aborted; startup was not verified. |
| Bootstrap, operator account and backup/restore | Not exercised by DOC-01. Runtime reservation returned to the coordinator after the interrupted startup approval. No account or saved record creation is claimed. |
| Browser sign-in, role workflow and interactive review | Not exercised by DOC-01. Automated checks or prior milestones do not establish a new independent user trial. |

The unexercised runtime steps are validation gaps, not observed failures of bootstrap, accounts or
backup/restore. The coordinator accepted this explicit limitation for the first-wave documentation
increment and owns the remaining runtime validation.

Private command evidence is under `.local/validation/doc-01/` in the isolated rehearsal workspace.
The [DOC-01 report](parallel-work/reports/DOC-01.md) records exact locations, final results and
review disposition. Do not attach private account files, backup contents or raw sensitive logs to
feedback. Dependency notices are not an updated security audit; see [dependency review](dependencies.md).

## Findings resolved in the instructions

- The four-tab service detail, pasted document sets and manual agreement facts are implemented;
  older text calling them future work has been corrected.
- Public content is the explicit projection of samples and locally published reviews, not a fixed
  count of sample records. Private findings and district settings remain role-restricted.
- Eight measures describe the practice walkthrough, not every adopted district rubric. Archive
  compatibility points to the [backup runbook](backup-recovery.md) rather than an obsolete schema ceiling.
- First bootstrap, existing-session restoration and serial emulator testing are distinguished.
  A backup does not include browser drafts, plaintext account files or separate offline packets.
- Troubleshooting covers missing pinned dependencies, wrong runtimes, download failures, occupied
  ports, wrong configuration, old passwords and synced-filesystem stalls.
- DOC-01 exposed a diagnostic limitation: a bind-permission failure could be described as an
  occupied port. DOC-03 fixes that distinction with injected tests and an observed `EPERM` result;
  the cancelled elevated retry remains a separate tool-permission limitation.
- [Contributing](../CONTRIBUTING.md) and [security reporting](../SECURITY.md) provide concrete
  development boundaries without inventing a monitored security inbox or support commitment.

Historical workflow documents may describe the schema introduced by their own milestone. Consult
the current backup compatibility runbook for the combined installation's accepted formats, and
preserve compatible source with every archive.

## Decisions and work before adoption

| Area | Remaining work |
| --- | --- |
| Independent user trial | A person outside the implementation team follows the instructions and records setup, sign-in, roles, review, actual publication/removal and recovery friction. |
| Production provisioning | Design and validate separately owned infrastructure, hardened services, networking, verified authentication and operator authorization. Deployment is currently blocked. |
| Provider use and cost | Qualify a chosen provider and source-capture boundary, enforce tokenizer/spend limits and reconciliation, and measure hosting, storage, email and AI costs separately from the free license. No live calls were made here. |
| Recovery and operations | Establish encrypted off-device retention, restore drills, upgrade/rollback, administrator turnover, secret rotation, monitoring and incident ownership. Local archives are unencrypted. |
| Policy and accessibility | Obtain district rubric/jurisdiction approval, independent synthetic-label adjudication and broader assistive-technology review. Passing tests does not certify legal compliance or accessibility. |
| Support and reporting | Maintainers must verify a private vulnerability-reporting channel and define supported versions and ownership before a release. Repository visibility and releases remain separate decisions. |
