# OPS-02 — Read-only local operator readiness

- Task / worker: OPS-02, `/root/intelligence_workflow` acting as operations owner.
- Baseline: `2f3709f37c601815bed653a468d062c15aff3067`, coordinator-verified source tree
  `a339f31b5b09e9b4c201b875e1d3cc73a61ff0d2`; the adoption-wave workboard records the matching
  archive inventory and preserved preview/backup. No branch switch, commit or push by this worker.
- Workspace: `/private/tmp/privacypal-adoption-wave-IiILu6/operations`, source-only fresh clone.
- Outcome: implemented, pure checks passed; independent review and coordinator emulator evidence
  pending. Succession is a concrete proposal only.

## Result

`local:check` inspects current synthetic configuration, fixed loopback availability, installed
identity fields, the protected administrator's Auth/membership agreement, maintenance presence and
another enabled/verified active administrator. Optional `--backup PATH` invokes the existing exact
configuration/toolchain archive verifier. No archive means `backup: not_checked`.

The check performs no Auth, Firestore, configuration or backup writes. It does not sign in, start
services, bootstrap, change accounts/memberships, acquire/release maintenance, save or restore.
Static messages and JSON check codes omit identifiers, paths, passwords, tokens, raw user records
and raw exception details. Invalid arguments or any failed check produce exit status 1. Absence
of a second administrator is advisory. No output grants succession or recovery authority.

Owned files:

| File | Change |
| --- | --- |
| `server/operations-readiness.ts` | Strict identity predicates, bounded read-only installation inspection, fixed report/check types. |
| `scripts/operations-check.ts` | Strict argument handling, local guards/probes, optional existing verifier, plain/JSON output, flushed stdout and bounded cleanup. |
| `test/unit/operations-readiness.test.ts` | Eleven focused configuration/argument/privacy/deadline/archive/pipe checks without services. |
| `test/integration/operations-readiness.test.ts` | Fifteen real-emulator cases for inspection, second-admin eligibility, maintenance, protected-identity restore refusals, actual probes and unchanged state. |
| `docs/operations-readiness.md` | Implemented operator command semantics and explicit versioned succession proposal with unresolved authority/compatibility choices. |
| `docs/upgrade-rehearsal-plan.md` | Precise post-import refusal scope, unchanged-state assertions and separation from native shutdown/import evidence. |
| `docs/parallel-work/reports/OPS-02.md` | This handoff and evidence record. |

Coordinator-provided contracts, workboard and new adoption briefs were already changed in this
workspace and are not worker-authored changes. Package-script and integration-runner registration
remain coordinator-owned. No existing backup/recovery hook changed.

## Contract and compatibility

Accepted contract: `OPS-002-read-only`. JSON format is `operations-readiness-v1` with a fixed scope,
`ok` and checks containing `code`, `status` and a static message. Statuses are `pass`, `warn`, `fail`
and `not_checked`. Each code occurs at most once; invalid invocation reports `arguments` alone.
Normal codes are `configuration`, `emulator_environment`, `emulators`, `installation`,
`protected_admin`, `maintenance`, `second_admin` and `backup`. Consumers use codes/statuses.

Existing `configSchema` and `emulatorEnvironment` guard all connections; credentials cannot be
discovered or sent to a cloud target. Loopback GET probes are bounded at two seconds, installation
inspection at ten seconds and cleanup at one second. At most 1,000 administrator membership
candidates are inspected in pages of 100. No qualifying candidate within that bound is an advisory.
The diagnostic takes no lock and cannot establish an atomic snapshot across Auth and Firestore.

No application, storage, configuration or backup version changes. `protected-admin-succession-proposal-v1`
is solely a design identifier, not an accepted payload/schema or an executable promotion path.
It proposes request/hash/generation/receipt binding, independent attestation, a distinction between
historical bootstrap and current protected custodian, fail-closed file/database reconciliation,
explicit archive compatibility and forward-only reverse-transfer decisions. Attestation authority,
configuration/backup conversion, retirement and rollback policy require decisions before any
mutating implementation. Total-admin-loss recovery is a separate unresolved authority contract.

## Evidence

| Command or exercise | Workspace | Result | Evidence location |
| --- | --- | --- | --- |
| Node 24 `npm ci --offline --no-audit --no-fund` | OPS clone above | Passed; 735 packages, unchanged lockfile. Existing deprecation warnings were reported. | Worker tool transcript. |
| `npm run typecheck` | OPS clone above | Passed after correcting two test-only type issues. | Worker tool transcript. |
| `node --import tsx --test test/unit/operations-readiness.test.ts` | OPS clone above | Passed 11/11. | Worker tool transcript. |
| Piped CLI with deliberately missing configuration | Spawned by pure test, no service connection | Complete parseable JSON, exit 1, no stderr or private path/error marker. | Pure test above. |
| Existing verifier with synthetic file-only fixture | Temporary owned unit fixture | Exact configuration accepted; changed configuration/bytes rejected; verification left bytes unchanged and omitted path. Fixture is not native-import evidence. | Pure test above. |
| `git diff --check` | OPS clone above | Passed. | Worker tool transcript. |
| Combined `npm run ci` | Coordinator integrated adoption-wave source | Coordinator-confirmed pass: 544 tests, TypeScript, build and source isolation. This is integrated evidence, not a worker runtime action. | Coordinator message / adoption-wave validation evidence. |
| Fifteen readiness/restore-refusal emulator cases | Coordinator reservation required | Authored, not executed by this worker; coordinator result pending. | `test/integration/operations-readiness.test.ts`. |

The worker did not run emulators, a development server, browser, live provider, sign-in, backup or
restore. No installation/account/configuration files were copied. Unit fixtures contain synthetic
placeholder export files and are deleted by their owning tests; their verifier pass does not prove
native import. The direct `finishRestore` tests deliberately use an in-memory schema-3 manifest
fixture to isolate the post-import gate, not a relabeled or verified native archive.

The integration fixture captures every fixture Firestore document plus a canonical digest/count of
every Auth user field after intentional damage and before inspection. It compares the snapshots
after diagnostic reads and after expected restore rejection; the original maintenance ID remains.
No sign-in occurs between comparisons. Auth values are never included in assertion diagnostics.

## Review and integration

- Non-author reviewer: `/root/independent_installation` (DOC-03), review requested after its trial.
- Coordinator early review requested actual emulator-root probes, complete piped JSON output,
  unique status codes and secret-safe Auth comparisons. The code/tests implement all four.
- Coordinator documentation review removed the stale DOC-01-only installation claim and added
  schema-10 retained-run behavior plus the two exact native Auth import normalizations to the
  rehearsal plan; historical OPS-01 proposal scope remains distinct.
- Independent review and coordinator emulator outcomes remain pending; do not treat authored tests
  as a runtime pass. The coordinator owns final integrated CI/recovery/browser disposition.
- Suggested order: copy the seven owned files, register `local:check` and the integration test,
  run assembled typecheck/unit checks, then the fifteen cases under the reserved emulators.
- Remaining policy decisions: independent succession attestation, versioned installation/config
  mapping, archive compatibility/old-authority restoration, durable reconciliation and retirement.
- Follow-up beyond this increment: actual supported A/B upgrade pairs, off-device encrypted backup
  and key recovery, production authentication/hosting, total-admin-loss recovery and mutating
  protected-admin succession. No release/deployment/publication authority added.

Only the coordinator changes workboard acceptance or integration status.

## Coordinator acceptance after worker handoff

Accepted after non-author review and assembled validation: 544 unit/isolation tests, TypeScript,
build/bundle/isolation, 224 emulator integration tests and full schema-9/schema-10 recovery passed.
The saved preview was restored and the read-only operator check plus backup verification passed.
Native Chrome passed the focused keyboard/draft/320px/200% checks. See
[the final coordinator report](coordinator-adoption.md) for precise evidence, review assignments and
limits; earlier pending statements above describe the worker's handoff, not final acceptance.
