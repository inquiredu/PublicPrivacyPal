# Installation readiness

PublicPrivacyPal currently supports a synthetic local development rehearsal. This is not evidence
of production provisioning, a supported release or a completed independent district pilot.
The adopter instructions are [local setup](local-development.md) and
[independent trial](independent-trial.md); they require no author's account or temporary path.

## Rehearsal identity

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

## Observed checks

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
- The runtime attempt exposed a diagnostic limitation: a bind-permission failure can be described
  as an occupied port. The launcher itself was not changed in this documentation increment.
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
