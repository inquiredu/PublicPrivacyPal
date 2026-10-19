# INT-01 — Segmented adoption proposal and offline evidence

> Final coordinator disposition, October 18: accepted and integrated into the uncommitted
> coordinated checkpoint. See [the coordinator report](coordinator-wave1.md) for non-author review,
> final 481-test CI, 164 integration tests, two recovery cycles and native browser evidence.
> The worker-specific evidence and limitations below are historical to its handoff; independent
> installation/runtime and broader assistive-technology limits remain open as documented.

- Task / worker: INT-01, `/root/intelligence_workflow`.
- Baseline: coordinator-accepted `cb5bb04cde8d900f0376d11f5676369636845eae`; source archive
  SHA-256 `d611bf66d41a1e1aa90e0bb1093e78c6478cfa1c714883f3330242082ea08fd3`.
- Workspace: `/private/tmp/privacypal-wave1-0amrk031/int`, isolated copy with its own installed
  dependencies; original implementation inventory still matches all 136 entries.
- Outcome: **non-author review completed; ready for coordinator integration as design/offline
  evidence only**. No application behavior changed.

## Result

The [versioned proposal](../../segmented-adoption.md) specifies the transition from saved long
source through immutable attempts and synthesis into inspectable suggestions and explicitly saved
human findings. It proposes an unresolved-first handoff because existing segmented output does
not establish per-target applicability. It separates human range acknowledgments from machine
examination and preserves original qualifications, candidate evidence and attribution.

Changed files, all within the assigned allowlist:

| File | Purpose |
| --- | --- |
| `docs/segmented-adoption.md` | INT-001 transition/ownership table, record identities and examples, finite bounds, receipts, cancellation/recovery, human handoff, migration and exact future recovery rehearsal. |
| `test/fixtures/segmented-adoption.ts` | Authored fictional policy inputs and wire-output builders; no model observations or real source material. |
| `test/unit/segmented-adoption.test.ts` | 17 runnable checks of existing segment/evidence boundaries, including deliberate structural-validity limitations. |
| `docs/parallel-work/reports/INT-01.md` | This report. |

The optional standalone lab script was unnecessary: the test runner supplies reproducible offline
evidence without introducing a second protocol or any persistence/API mock claimed as production.

## Contract and compatibility

The coordinator reviewed INT-001 for design/offline evidence acceptance; the contract log remains
coordinator-owned. The document recommends a separate `segmented-proposal-v1` envelope,
additive immutable application records and eventual schema 10 (number subject to coordinator
allocation). Historical packet/prompt/schema IDs remain unchanged. Existing private offline packets
gain no import authority. Proposed new finding/provenance versions cannot be implemented through
unchecked additions to existing human findings.

Application run/result/settlement status must be separate. Current ordinary jobs deliberately
reject bundles, discard stale result output and lack complete terminal settlement reconciliation;
the proposal does not portray those paths as sufficient for durable segmented adoption. Future
admission bounds include 16 MiB/800 documents per run, two retained runs per review, independent
page/detail caps and dispatch reservations. These are engineering proposals awaiting review and
maximum-admitted recovery testing, not observed capacity results.

No changes to authorization, scoring, human decisions, public projections, backup formats, provider
selection, production source or application APIs were made. Live/provider qualification and actual
schema-10 recovery remain outside this increment. Durable application work remains unassigned and
requires its own explicit coordinator delegation.

## Evidence

All commands below ran in the isolated workspace with Node `v24.22.0` from
`/private/tmp/privacypal-runtime/node_modules/node/bin` on PATH. That machine-local path is test
provenance, not an installation prerequisite.

| Command / exercise | Revision / workspace | Observed result | Evidence location |
| --- | --- | --- | --- |
| `npm ci --offline --no-audit --no-fund` | Accepted baseline, isolated `int` copy | Passed; 735 packages installed from cache, package/lock hashes unchanged. Dependency deprecation warnings retained in tool output. | Worker tool output `8f10ed`. |
| Initial `node --import tsx --test test/unit/segmented-adoption.test.ts` | First authored tests | 15/17 passed; two fixture IDs hit UUID syntax validation before intended server-provenance assertion. Replaced IDs with valid synthetic UUIDs. No application defect or source change. | Worker tool output `861073`. |
| `node --import tsx --test test/unit/segmented-adoption.test.ts test/unit/source-segments.test.ts` | Final authored fixtures/tests plus unchanged production helpers | **37/37 passed**: 17 new cases and 20 existing long-source cases, including original raw file round-trip and full-synthesis overflow rejection. | Worker tool outputs `a9867b`, `a0b1ff`. |
| `npm run typecheck` | Same copy | Passed, exit 0. | Worker tool outputs `bf651d`, `677fe7`. |
| `node docs/parallel-work/check-baseline.mjs --implementation-only` | Archive copy without Git metadata | Could not run: checker invokes Git even in implementation-only mode. No repository metadata was manufactured to claim kickoff acceptance. | Worker tool output `89a1c9`. |
| Read-only SHA-256 comparison against all manifest paths | Same copy after tests | **136 matching, zero changed**. This checks implementation parity only; coordinator owns main/origin acceptance. | Worker tool output `91aa4b`. |
| Relative-link check | Proposal before this report was added | All existing links resolved; only this then-pending report link remained. Final link check recorded below. | Worker tool output `91aa4b`. |
| Final relative-link and whitespace check | All four handoff files | All local Markdown links resolve; no trailing whitespace. | Worker tool output `c8f2d6`. |
| Post-review documentation link and whitespace check | Two revised documentation files | Passed. Fixtures/tests unchanged; focused tests were not unnecessarily rerun. | Worker tool output `b67b26`. |

The new suite exercises complete commitment/omission, late contradiction, four missing-final-range
states, a target-specific missing annex, three malformed-citation cases, retry retention/staleness,
forged fields/foreign identity, output/synthesis caps, wrong-account interpretation, human range
acknowledgments and unverified late offline provenance. It does not pretend that synchronous helper
checks prove an unimplemented asynchronous segmented worker or receipt API. The wrong-account
structural pass documents a known limitation and is not counted as semantic accuracy.

Artifact identities at review handoff:

```text
51025bfb746c5810e14e9a4003d870d3f7f624c5d7bb5441e54dea78c59cf633  docs/segmented-adoption.md
41d4329884e1e66edf5f97195dbaf0c3ab29315a6145e40f7b0517210280caad  test/fixtures/segmented-adoption.ts
615289fb3582a84e604f96529fc1e69d16cd6b64e9036f62975cec7f80d922f9  test/unit/segmented-adoption.test.ts
```

No emulator, browser, saved installation, accounts, real policy sources or live provider was used.
The unchanged long-source unit suite created synthetic temporary files for its existing CLI
round-trip test. No backup/runtime operation occurred. Full CI, integrated authorization checks and
recovery were not run by this worker; the coordinator owns integrated validation.

## Review and integration

- Non-author reviewer: coordinator `/root`; proposal and current-boundary tests found sound for
  design/offline evidence acceptance. Two documentation clarifications requested and completed:
  restore into a fresh runtime with the archive's exact synthetic project/district/configuration,
  and store the canonical request object rather than an escaped raw request string within the
  264 KiB record allowance. Any future provider wire representation needs separate bounds.
- Remaining implementation prerequisite: INT-001 acceptance and explicit file/contract delegation.
- Integration order: review this proposal and tests; integrate these four allowlisted files; run
  combined checks; keep all durable storage/API work deferred until separately assigned.
- No owner policy choice blocks this proposal. Actual semantic-label adjudication, provider/data
  scope, operating budget and expanded retention require later decisions.
- Future gates are listed in the proposal, including independent settlement, stale/raw retention,
  atomic failure/role checks, explicit human draft conversion and two-cycle schema-10 recovery.

Only the coordinator may mark the workboard integrated or accepted.
