# INT-02 — Durable authored segmented runs

- Task / worker: INT-02, `/root/intelligence_workflow`.
- Baseline: coordinator-verified `cb89a66`, `codex/coordinated-milestone-2026-10-19`.
- Workspace: `/private/tmp/privacypal-segmented-app-zhubduyq/server`, a separate baseline archive
  with its own offline-installed dependencies. Coordinator-owned integration hooks were copied
  into this workspace for typechecking; this worker did not author those shared hooks.
- Outcome: implemented, reviewed and ready for final coordinator integration. The coordinator
  confirmed all 12 new emulator cases and assembled 518-test CI passed. Final installation,
  browser and integration disposition remain coordinator-owned.

## Result

The exact authored Lantern long-source example can create a durable private run. Each segment or
synthesis attempt requires an explicit receipt-bearing action. Original response bytes, including
whitespace, malformed JSON and invalid UTF-8, remain immutable and inspectable. An oversized return
records overflow and its byte length without representing a prefix as the complete response.

The worker preserves historical returns after human changes, cancellation or revocation without
granting them authority. Unknown dispatched work retains its identity and blocks another attempt;
recovery may replay only the explicitly deterministic, zero-network recording. No live adapter,
provider selection, uploaded result or real-source bypass is registered.

Validated synthesis opens an explicitly unresolved, server-verified human seed with no selected
citations or range acknowledgments. Original target states, questions, rationale, opposing evidence
and source scope remain inspectable through the immutable reference. Parent-owned evidence code
validates explicit human resolution, preserves attribution on corrections, and performs existing
deterministic scoring and publication withdrawal.

Files authored within the exclusive allowlist:

| File | Responsibility |
| --- | --- |
| `shared/segmented-assistance.ts` | Frozen action/DTO/reference schemas, byte/count limits, handoff qualification and public authored capture example. |
| `server/segmented-review-storage.ts` | Strict records, original-byte hashes, immutable reconstruction, reservations, complete historical prefix checks, outcome replay and full installation validation. |
| `server/segmented-reviews.ts` | Authorized commands and private reads, bounded pages, receipt effects, eligibility and verified human handoff. |
| `server/analysis/segmented-jobs.ts` | Leased dispatch, maintenance and late-result fences, synthetic recovery, bounded operation and shutdown. |
| `server/analysis/segmented-recording.ts` | Exact source/definition admission and authored zero-network transport. |
| `test/fixtures/segmented-application.ts` | Small pure authored fixtures and a deferred-promise helper; no database emulator substitute. |
| `test/unit/segmented-storage.test.ts` | Eight pure identity, raw-byte, bound, reservation, pagination and recording checks. |
| `test/integration/segmented-runs.test.ts` | Twelve real-emulator command, worker, integrity and access cases. |
| `docs/parallel-work/reports/INT-02.md` | This handoff. |

## Contract and compatibility

INT-002 freezes additive `segmented-run-v1`, `segmented-proposal-v1` and
`segmented-provenance-v1` records. Existing source parts, offline packet formats, prompts, schemas,
validators and their request keys are unchanged. The application retains both the historical v1
materialized-evidence digest and the ordered durable attempt/outcome digest.

Every queued attempt, including a synthesis retry, advances the eligibility generation and clears
the current proposal immediately. A result needs the original review revision at completion. Later
handoff is restricted to still-unreviewed measures whose baseline finding hash is unchanged; an
absent finding hashes exactly like its ordinary blank placeholder. Existing attributed corrections
retain the original reference even when its run is historical. Source-manifest incompleteness remains
a human resolution blocker; machine examination failure alone does not permanently bar an explicit
human resolution supported by complete source review.

Start/cancel use the existing review-revision rules. Attempts change only the run revision and
return the current Review shape. Optional receipt effects identify exact run, attempt and applied
run revision without changing ordinary replay semantics. The worker never writes Review, human
findings, district decisions or audience projections.

Admission permanently reserves complete future envelopes, indexes, quota metadata and parent-owned
history/receipts: two runs per review, 16 MiB/800 records per run and 32 MiB/1600 run-owned records
per installation. The nominal 75-attempt ceiling does not promise capacity. Each actual attempt
also consumes the existing daily assistance ceiling. Record hashes, counts and fixed reservations
are independently checked before reuse. Pages preserve complete items and shrink below 20 when
the byte bound requires it.

The installation validator requires exact start/attempt/cancel receipt and history bindings;
rebuilds all immutable requests and historical synthesis prefixes; replays every output
classification; checks source parts, output hashes, indexes and counters; and resolves attributed
current/historical findings. It separately streams all finding documents to catch orphaned
provenance even after all run records, markers, evaluations and counters have disappeared. Existing
human history is read in pages of 20 and is not subjected to the new run-owned record ceiling.
The existing native backup file cap remains the final bound on the whole installation.

The coordinator owns schema-10 detection/restore integration, sticky `findings-v7` /
`human-evidence-v6`, routes, receipt extensions, evidence editing and UI mounting. The DOC worker
consumes `validateSegmentedInstallation(s, { maintenanceId })`, which is read-only and returns
`{ hasArtifacts, runCount, recordCount, logicalBytes }`.

## Evidence

| Check | Snapshot / executor | Observed result |
| --- | --- | --- |
| `npm ci --offline --no-audit --no-fund` | This isolated workspace, Node 24 | Passed; 735 packages installed from cache. Lockfile was not changed. |
| `npm run typecheck` | Final worker source, with copied parent integration hooks | Passed. Initial missing modules and two TypeScript annotations were corrected before handoff. |
| `node --import tsx --test test/unit/segmented-storage.test.ts` | Final worker source | 8/8 passed. |
| New `test/integration/segmented-runs.test.ts` | Coordinator's assembled disposable emulator runtime | Coordinator confirmed 12/12 passed on October 20. |
| Assembled CI | Coordinator's final assembled source snapshot | Coordinator confirmed 518 tests, typecheck, build, bundle and 240-file isolation checks passed. |

The new emulator tests cover exact receipt replay without duplicate dispatch/review changes;
invalid retry retention; queued synthesis invalidation; invalid UTF-8, maximum raw return and
overflow; late human/revoked results; queued and dispatched cancellation; unknown same-attempt
recovery; expired-lease callbacks; maintenance; corrupted historical prefixes, generations and
reservations; browser-role denial; and orphan attribution after deletion of its entire graph.
The coordinator and DOC suites separately exercise HTTP handoff and backup/recovery corruption.

This worker did not start an emulator, browser, provider, server or installation backup, and did not
create accounts or saved installation records. Real-emulator execution and synthetic persistence
were performed only by the coordinator in the designated test environment. No live provider,
private account, real district data, deployment, merge or publication was used.

## Review and integration

- Non-author reviewers: coordinator `/root`, `/root/review_experience` and
  `/root/independent_installation`.
- Review corrections completed: exact historical prefix and generation checks; fixed reservation
  recomputation; byte-aware candidate pagination; required receipt/history presence and identity;
  every output classification replayed; expired-lease cleanup fenced; historical and independently
  orphaned finding graph validation; exact placeholder hashing; all retries invalidate current
  handoff; previously reviewed measures do not receive replacement provenance.
- UX's final independent static review confirmed its three findings closed and reported no further
  blocker in the reviewed changes. Coordinator-confirmed runtime cases passed after integration.
- Integration order: shared schema, server storage/recording/commands/worker, parent hooks and UI,
  DOC backup integration, then combined validation. The coordinator copied increments sequentially.
- Remaining boundaries: the shipped recording supports only the exact authored example and its
  practice definition. Future definitions/recordings need explicit versioned bindings. Live
  provider settlement, paid dispatch, arbitrary source support, production semantic qualification,
  deployment and publication remain outside this increment.

Only the coordinator may mark the workboard integrated or accepted.
