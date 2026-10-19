# DOC-01 — Independent installation and contributor experience

> Final coordinator disposition, October 18: accepted and integrated into the uncommitted
> coordinated checkpoint. See [the coordinator report](coordinator-wave1.md) for non-author review,
> final 481-test CI, 164 integration tests, two recovery cycles and native browser evidence.
> The worker-specific evidence and limitations below are historical to its handoff; independent
> installation/runtime and broader assistive-technology limits remain open as documented.

- Assigned worker: `/root/independent_installation`; coordinator: `/root`.
- Baseline: accepted main `cb5bb04cde8d900f0376d11f5676369636845eae`; 136/136 manifest inputs matched.
- Source archive SHA-256: `d611bf66d41a1e1aa90e0bb1093e78c6478cfa1c714883f3330242082ea08fd3`.
- Workspace: `/private/tmp/privacypal-wave1-0amrk031/doc`, with its own writable dependencies.
- Outcome: ready for integration. Documentation implemented and reviewed; clean dependency/non-runtime
  checks passed. Runtime rehearsal incomplete after interrupted startup approval; coordinator accepts
  the documented first-wave validation limitation.

## Result

Owned files only: README.md, docs/local-development.md, docs/independent-trial.md,
CONTRIBUTING.md, SECURITY.md, docs/installation-readiness.md and this report.
The onboarding corrections distinguish fresh bootstrap from saved restoration, practice rubrics
from adopted full rubrics, current source/document workflows from deferred integrations, and
installation backups from drafts and offline packets. Contribution guidance preserves source
provenance, synthetic fixtures, role/publication contracts and validation gates. SECURITY.md
requires a verified private reporting channel before release; no contact address or SLA was invented.

## Contract and compatibility

No application schema, scoring, authorization, publication, backup, dependency or API change.
No COV-001 or INT-001 implementation dependency. Documentation links to current contracts instead
of repeating obsolete storage limits. Coordinator-owned service-detail.md and source-bundles.md
still contain historical “current reader” ceilings (1–4 and 1–8); a narrow wording correction can
identify those as milestone versions and point to the current backup runbook.

## Evidence

| Command or exercise | Exact revision/workspace | Result | Evidence location |
| --- | --- | --- | --- |
| `npm ci` on Node 24.22.0/npm 11.6.2 | Accepted baseline, isolated doc workspace | Passed, 735 packages in 7s; existing host package cache may be used | `.local/validation/doc-01/npm-ci.log` |
| `npm ls --depth=0` | Same source/dependencies | Passed, exact declared top-level pins including PDF.js | `.local/validation/doc-01/dependency-resolution.log` |
| `npm run ci` | Same application inputs plus owned doc edits | Passed: TypeScript, 386 unit/isolation tests, browser build/bundle budgets and source isolation | `.local/validation/doc-01/ci.log` |
| `npm run local:init`, then repeat | Isolated doc workspace | Passed creation and unchanged repeat | `.local/validation/doc-01/local-init.log` |
| Fresh startup using River Valley config | Reserved fixed ports; same doc workspace | Sandbox run exited 1 with occupied5173; no listener observed by coordinator. Escalated retry waited for approval and was aborted before a session/PID was returned | `.local/validation/doc-01/startup.log`; tool event |
| Bootstrap/account/backup/restore | Same planned River Valley rehearsal | Not run; coordinator reclaimed runtime slot | No completion claimed |
| Local Markdown links and command accuracy | Seven owned files | Local links/anchors resolved; commands inspected against package/scripts | `.local/validation/doc-01/document-checks.json` |
| Direct SHA-256 implementation-manifest comparison | Accepted application inputs | 136/136 match; no dependency/runtime source changes | `.local/validation/doc-01/document-checks.json` |

Host is macOS 26.6.2 (25G83) arm64. Default shell Node 25.1.0 and missing system Java were identified
before verification. Node 24 was reused from the existing local toolchain, not installed anew.
Fresh local-only Git metadata and the verified independent origin were created with coordinator
authorization for the isolation check; no source history or private configuration was copied.
The packet's `check-baseline.mjs --implementation-only` could not run in that intentionally
history-free copy because it still requires a HEAD commit. The direct manifest comparison above
checks the same 136 input hashes without manufacturing a source commit; coordinator main acceptance
remains the baseline authority.
The sandbox startup error is consistent with a bind-permission failure being collapsed into the
launcher's occupied-port message, not proof of a port collision. The required escalated retry waited
549.4 seconds for approval before interruption; no started process/session was returned. Runtime
attempts stopped and the reservation returned to the coordinator for port verification. No bootstrap,
account creation, saved-record mutation or backup occurred in DOC-01. No browser checks occurred.
Prior integration/recovery results are not counted as new evidence. The separately generated local
configuration stays ignored; runtime attempts consistently selected the River Valley example.

## Review and integration

- Non-author reviewer: coordinator `/root` reviewed the seven drafts and found no blocking issue;
  final evidence wording remains available for review.
- Corrections and remaining issues: setup failure and unexercised CLI/browser steps now recorded.
  Coordinator owns remaining runtime validation and restoration of the saved preview.
  Unexercised bootstrap/account/backup/restore steps are validation gaps, not observed product failures.
- Suggested integration: copy only the seven owned documents after review; retain private evidence
  separately and never copy the disposable `.git`, `node_modules`, accounts or backups as source.
- Maintainer decision: verify private vulnerability reporting and supported-version scope before
  release. This is not required to continue reversible local implementation.
- Follow-up: independent person/district trial, production provisioning/authentication, provider
  qualification/costs, encrypted retention/upgrade operations and broad accessibility review.

Only the coordinator changes workboard acceptance or integration status.
