# Validation and integration gates

Coordinator-owned. Follow AGENTS.md and existing scripts; do not weaken a gate to accommodate a
patch. Record exact commands, checkout identity, result and private log location. Distinguish
source inspection, synthetic tests, browser checks and real independent pilot evidence.

| Change | Required verification before acceptance |
| --- | --- |
| Documentation/onboarding | Local links and command accuracy; clean dependency installation; flag steps not actually exercised. Runtime rehearsal uses the shared resource reservation. |
| Reviewer UI | TypeScript, relevant meaningful tests, build/bundle/isolation gates; keyboard/focus, narrow reflow, saved-versus-draft state, navigation and stale/error behavior in the browser. |
| Contract/rubric candidate | Historical fixtures/hashes, explicit omissions/contradictions/scope cases, malformed/duplicate/missing output, bounds and no silent adoption. Provisional labels stay labeled. |
| Authorization/API | `npm run ci` and `npm run test:integration`; all role boundaries, direct-storage denials, transaction-time revocation, maintenance and stale-command behavior. |
| Storage/jobs/migrations | CI and integration plus `npm run test:recovery`; immutable versions, lost acknowledgment/replay, late results, rollback compatibility and exact restored records. Version backup formats when required. |
| Final integrated wave | CI on the assembled baseline; integration/recovery if backend/storage changes occurred, with the exact tested revision recorded. Never relabel earlier results as new runs. |

## Synthetic acceptance cases

Cover clear commitments, silence after complete coverage, a promise with an exception, contradictory
documents, missing addenda, uncertain account/jurisdiction scope, incomplete final segments, invalid
citations, provider-shaped malformed output, interrupted/retried attempts and a human correction
while an attempt is in flight. Disabled measures must not become active, exclusions must not become
automatic approval, and unresolved measures retain their weights without invented failure credit.

Preserve drafts and their original revisions. Failed/uncertain saves retain work and cannot claim
success. A successful publication/unpublication must match actual public/staff state. New machine
output cannot erase corrections, change district decisions, or resurrect publication.

## Shared runtime procedure

1. Reserve the emulator ports, preview operator and browser resources in the workboard as needed.
2. Inspect the current runtime and verify the newest backup. Save another verified backup if saved
   data changed; preserve it durably before stopping anything.
3. Stop only the identified owned preview. Run one integration/recovery/install rehearsal at a time,
   with explicit `demo-` configurations. Do not change ports/targets as an ad hoc bypass.
4. Capture results and release resources only after the process state is known. Restore the saved
   installation with `--restore` if it was stopped; never bootstrap it. Verify existing account and
   publication state, save after further changes, and update HANDOFF.md.

Do not run tests against a running installation just because it is an emulator. Independent agents
may run unit checks in isolated copies, but they cannot claim exclusive access without reservation.

## Review gate

The non-author reviewer checks the diff, assumptions and evidence, not just test totals. Report
unverified claims explicitly. The coordinator confirms file ownership, rejects incidental scope
expansion, reviews public-field allowlists and versions when touched, and resolves integration
failures before accepting the increment. Human UX acceptance, rubric adjudication, assistive-
technology validation and the independent district pilot remain separately recorded outcomes.
