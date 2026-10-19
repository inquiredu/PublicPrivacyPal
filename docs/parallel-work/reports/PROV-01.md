# PROV-01 — Fake transport qualification

- Task / worker: PROV-01, `/root/intelligence_workflow`.
- Baseline: `cb5bb04cde8d900f0376d11f5676369636845eae`, plus coordinator-accepted INT-001
  design/offline evidence and its copied contract log. All 136 original implementation inputs
  still match the baseline manifest.
- Workspace: `/private/tmp/privacypal-wave1-0amrk031/int`, existing isolated copy with independent
  writable dependencies. No partial PROV-01 files existed when the owner resumed.
- Outcome: **non-author review complete; ready for coordinator integration**; offline qualification
  evidence and procedure only.

## Result and ownership

The [qualification document](../../provider-qualification.md) describes the harness, observed
boundaries, live-qualification blockers, bounded adapter/currency contract and a concrete future
trial procedure. The new fake transport executes the actual ordinary worker and production
validators/storage helpers. It does not duplicate the worker's lifecycle in a toy implementation.

Only these four assigned files were added:

| File | Purpose |
| --- | --- |
| `docs/provider-qualification.md` | Executable evidence, known gaps, token/context and cost requirements, separately authorized trial procedure. |
| `test/fixtures/provider-qualification.ts` | Authored envelopes, fake transport, narrow serial in-memory storage/identity double and synthetic versioned review seed. |
| `test/unit/provider-qualification.test.ts` | 26 production-helper tests, including deliberate current-gap probes. |
| `docs/parallel-work/reports/PROV-01.md` | This report. |

The fake adapter is marked `offline: false` only inside the test fixture to exercise the production
lookup-only recovery branch. It has no network code, credentials or real provider. The fixture
directly seeds a hypothetical job in memory; the shipped registration/start path remains unchanged
and cannot dispatch it. Its microdollar values are arbitrary synthetic test amounts, not estimates.

## Contract and compatibility

INT-001 remains accepted as design/offline evidence only. No new application envelope, provider
registration, persistent record, importer, migration or schema version was implemented. Historical
recordings and prompt keys are untouched. The original Gemini provenance and provider-neutral
qualification approach remain explicit.

Observed preserved boundaries: no accepted result on refusal/truncation/invalid output; current
version checks; known-charge settlement once; no second generation after uncertain dispatch;
bounded stalled work; revocation/cancellation/maintenance/late-result fences; preserved human
corrections; original segmented state distinct from server-derived readiness.

Observed gaps remain blockers for live qualification:

- Unknown-cost `succeeded`, `stale` and revoked/failed jobs retain reservations but are outside the
  current worker reconciliation query. A separate settlement index/operator path is required.
- Ordinary result storage retains parsed output instead of exact original response formatting;
  immutable original, invalid and stale wire retention needs the separately assigned INT-001 work.
- Actual token/context checks, bounded vendor transport, live currency admission and segmented
  application request/storage contracts remain unimplemented.
- Current source limits the queue window before checking provider compatibility; the report labels
  this as source inspection rather than a newly executed starvation probe.

The in-memory double is intentionally narrow: it does not emulate Firestore rules, optimistic
transaction retry, RPC acknowledgment uncertainty, persistent crashes, indexes or multi-process
concurrency. The fixture's `cancel()` calls `prepareAssistance` but omits `reviewAction`'s review
revision increment, history and receipt. These cases prove helper/worker fencing, not end-to-end
cancellation or reconciliation. Malformed provider-envelope checks call the schema directly and
are validation-only evidence, not worker settlement evidence for malformed envelopes.
No production asynchronous segmented lifecycle is claimed. Model accuracy, real latency, billing
correctness, semantic adjudication and legal conclusions are not established by synthetic passes.

## Evidence

Commands ran in the isolated workspace using Node `v24.22.0` with
`/private/tmp/privacypal-runtime/node_modules/node/bin` on PATH. This machine-local runtime path is
test provenance only. Existing independent dependencies were reused; no new installation occurred.

| Command / exercise | Observed result | Evidence |
| --- | --- | --- |
| `node --import tsx --test test/unit/provider-qualification.test.ts` | **26/26 passed**, no skipped or cancelled tests, first run. | Worker outputs `917d9f`, `1f2516`. |
| `npm run typecheck` | Passed, exit 0. | Worker output `c4979e`. |
| Read-only SHA-256 comparison of the baseline manifest | **136 matching, zero changed**. This confirms source parity, not a second main/origin acceptance. | Worker output `036f1c`. |
| Local Markdown-link and whitespace check | All four files passed. | Worker output `9be7e1`. |
| Post-review documentation links and whitespace | Both revised documents passed; fixture/test code unchanged, so focused tests were not rerun. | Worker output `03140f`. |

The cases cover completion, refusal, output-limit truncation, malformed JSON, schema/citation/set
failure, forbidden fields, output bound, usage/request-ID validation, slow/stalled transport,
stalled identity, queued/in-flight cancellation, external shutdown, repeated uncertain recovery,
revocation before/after dispatch, human correction before late output, maintenance, historical
wire negotiation, adapter identity, terminal unknown billing and original-versus-derived output.

Reviewed implementation identities:

```text
d460c75e1eeaa1ef72d9f69465a1e08489ae906a7c19b04eb340931bc1c0f79b  server/analysis/jobs.ts
1a5e31cbc5dd173647679bc994501d9e4773287542c2d8876a0433b89efaa291  server/analysis/provider.ts
```

Handoff artifact identities:

```text
500f91c5178becd5f914e1aae772eada6a72956ab8e557de08aae4b0ae8381ac  docs/provider-qualification.md
cd35c451a9b59a2025424e2b5b24e00257494314da9a3ec50df3eb91d4492b53  test/fixtures/provider-qualification.ts
ba2f043c31d9e91e2908d4a3fbe25efe9e6c298ea784df010dc0055c054e8147  test/unit/provider-qualification.test.ts
```

No emulator/browser/runtime operation, saved installation write, private account access, real
source fetch, provider call or backup occurred. All fake database and transport records existed
only in test memory. Full integrated CI/integration/recovery were not rerun by this worker; the
coordinator owns those gates. No independent human semantic adjudication was performed.

## Review and integration

- Non-author reviewer: `/root/independent_installation`; no blocking defect found, offline scope
  accepted. Requested evidence clarifications were added: the cancellation fixture omits the outer
  revision/history/receipt path, and malformed-envelope checks establish schema validation only.
- Integration: review/copy these four files sequentially, then coordinator validation. They depend
  on the accepted segmented-adoption fixture for one original-versus-derived offline test.
- No policy/provider decision is needed to accept this scoped evidence. A live trial still needs
  explicit provider/model/account/data scope, budget, retention/training review, adjudicated holdout
  and closure of the listed implementation gates.
- Durable provider/storage/settlement work remains unassigned. No review outcome here authorizes
  live calls, publication, deployment, main merge or real district changes.

Only the coordinator marks the workboard integrated or accepted.
