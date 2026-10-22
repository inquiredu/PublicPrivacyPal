# OPS-01 — Operation and recovery design

- Worker: `/root/independent_installation`; coordinator: `/root`.
- Baseline: `cb5bb04cde8d900f0376d11f5676369636845eae`, accepted 136-input implementation inventory.
- Workspace: `/private/tmp/privacypal-wave1-0amrk031/doc`, after accepted DOC-01 documentation work.
- Owned files: `docs/operations-readiness.md`, `docs/upgrade-rehearsal-plan.md`, this report only.
- Outcome: proposal ready for non-author review; no operational implementation or rehearsal executed.

## Result

Operations readiness distinguishes current emulator guarantees from proposed district provisioning,
verified authentication, succession/recovery, ordinary membership revocation and server-secret rotation.
It specifies artifact separation, encrypted off-device/key-recovery design, a provisional synthetic
retention/recovery target, agreement-expiry handling, availability ownership and measured cost categories.

The rehearsal plan uses the existing exact recovery fixture as its observable baseline, defines a
future selected A/B source pair and immutable A0 recovery point, lists failure injections and expected
outcomes, and rejects rollback that silently loses post-upgrade writes. It explicitly records the
lockfile/CLI compatibility gate and the difference between per-review legacy conversion and a general
production upgrade. An initial-admin transfer or generic release upgrade is not invented as an
existing command.

## Contracts and compatibility

No schema, API, authorization, scoring, publication, configuration, dependencies or runtime changed.
Future initial-admin succession, production provisioning, encrypted retention/key recovery, expiry
automation and release migration need separately reviewed implementations/authority. Existing command
receipts, immutable versions and publication semantics remain the required design boundary.

Source review confirmed that exact Firestore comparison excludes only `installation/maintenance`,
which is tested separately. Current restore verifies the existing initial admin before starting the
API/worker and refuses a different dependency lockfile; these limits are explicit in the plan.

## Evidence

| Exercise | Source/workspace | Result | Evidence |
| --- | --- | --- | --- |
| Read OPS brief, AGENTS, DOC findings, permissions, backup/recovery, open-source and service docs | Accepted baseline plus owned DOC-01 docs | Completed; historical schema wording cross-checked against code | Source references linked in both proposed runbooks |
| Inspect backup verification, save/finish-restore, local migration and recovery/integration/unit cases | Unchanged baseline application/test inputs | Completed; test-presence claims distinguished from executed OPS evidence | `scripts/backup-files.ts`, `scripts/backup-operations.ts`, `server/review-migration.ts`, linked tests |
| Local links, whitespace and implementation hash parity | Three OPS-owned files | Passed: 11 local links, no trailing whitespace, 136/136 implementation hashes unchanged | Private `.local/validation/ops-01/document-checks.json` |
| `npm run check:isolation` | Isolated doc workspace | Passed after OPS drafts | Private `.local/validation/ops-01/isolation.log` |
| Runtime, identity, backups, migrations, failure injection, production provisioning | None | Not run by OPS-01 | No runtime reservation or operational action |

The coordinator reported new integrated integration/recovery runs and restoration of the existing
preview during this session. Those are coordinator evidence, not an OPS-01 or independent-operator
rehearsal; the final handoff owns their exact tested snapshot and results. DOC-01's startup approval
interruption remains an explicit installation-validation gap. No private credentials, archives or
raw logs are included here.

## Review and integration

- Non-author reviewer: coordinator `/root`, pending.
- Integration: copy only the three OPS-owned documents after review; no runtime stop is needed.
- Maintainer/district decisions: provisioning/authentication, succession and recovery authority,
  reporting/support ownership, encrypted storage/key custodians, retention/holds/recovery objectives,
  expiry policy and availability response; actual supported A/B pair still unselected.
- Follow-up: implement/review the selected operations contracts and execute the proposed disposable
  rehearsal under a coordinator reservation. This plan does not authorize provisioning, deployment,
  secret rotation, releases or changes to the reference district.

Only the coordinator records integration or acceptance in the workboard.
