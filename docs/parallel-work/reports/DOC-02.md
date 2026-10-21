# DOC-02 — segmented backup and recovery

- Worker: `/root/independent_installation`.
- Baseline: `cb89a66c200f7f26fec812a331743a9e54e0fd55`; coordinator source archive
  SHA-256 `04597aeca70c9bcaeeab18ac5eabfc52af62be3c7408770c7a8a7933618cd876`.
- Workspace: `/private/tmp/privacypal-segmented-app-zhubduyq/recovery`.
- Contract: accepted INT-002. Outcome: implemented tests and operator workflow, ready for
  integration/review. Typecheck passes with coordinator-copied dependencies; runtime acceptance
  remains the coordinator's pending gate.

## Result

Schema 10 identifies the first durable segmented run, including empty and cancelled runs. Backup
and restoration consume INT-02's strict installation validator under the maintenance identity.
Every supported manifest version receives the independent artifact scan; schemas 1–9 containing
segmented records stop before migration rather than being promoted or relabeled. Validation failure
does not release maintenance. Existing archive format, exact configuration/lockfile matching,
inventory hashes and 32 MiB/file, 64 MiB/archive, 10,000-file limits remain unchanged.

The recovery runner now requires a genuine schema-9 shutdown/import before adding segmented data,
followed by two schema-10 shutdown/import cycles. Optional `--baseline PATH` first restores a private
copy of an existing historical schema-9 archive with its exact saved configuration, validates its
administrator and all current/historical evaluations without login/bootstrap/worker execution,
and re-verifies every original archive byte afterward. It compares imported state immediately before
and after application restore validation, rather than claiming a historical pre-export snapshot.
The coordinator supplies its preserved synthetic archive privately; no real installation data is
part of the test source.

The segmented fixture retains valid originals, invalid JSON with exact whitespace, a failed range,
historical synthesis against its recorded prefix, a current unavailable synthesis, unresolved human
attribution and partial range acknowledgments. A second retained run returns after a human correction
using the first run's original attribution. An empty cancelled run, maintenance-fenced completion,
interrupted authored dispatch and queued lost-ack command cover lifecycle/replay recovery. Full
Firestore records and Auth account fields are compared before sign-in or workers. Native emulator
import resets the token cutoff and discards the last token-refresh timestamp. The cutoff must be
monotonic and within the recorded import window, accounting for second-level precision;
`metadata.lastRefreshTime` must be exactly null. All other account fields, including password hashes,
salts, creation and last sign-in times, must match exactly. Digest comparisons and differing field
paths prevent assertion failures from printing account details. Later password
sign-in and audience/role checks preserve the existing rehearsal.

The final fixture fills installation admission through real authored-source commands and permanent
reservations, with distinct maximum-sized invalid raw responses. It requires the next attempted
reservation to fail without changing records, quota or receipts, then performs a real native export
and verification. This measures the admitted implementation, not a promise of 75 maximum-sized
responses per run. Its measured totals are written only to the private rehearsal directory.

Owned changes:

- `scripts/backup-files.ts`: additive schema-10 reader/writer support.
- `scripts/backup-operations.ts`: maintenance-bound graph detection and restore gates.
- `scripts/test-recovery.ts`: optional historical baseline and schema-9-to-10 import sequence.
- `test/unit/backup-files.test.ts`: schema-10 limits, old archive immutability and separate staging.
- `test/recovery/roundtrip.ts`: exact historical import and three fixture imports, Auth comparison.
- `test/recovery/segmented.ts`: durable lifecycle, replay and maximum-admission fixtures/assertions.
- `test/integration/segmented-backup.test.ts`: semantic restore failures and retained fences.
- `docs/backup-recovery.md`: current compatibility, operator failure handling and rehearsal commands.
- This report.

## Contract and compatibility

Shared validator/storage ownership remains INT-02. This worker did not duplicate its schema or
implement storage repair. Shared human attribution and API wiring remain coordinator-owned.
The installation adds a 1,600-record limit and 32 MiB logical-JSON limit for new run-owned records,
including their command receipts, lifecycle history and indexes. Per-run limits remain 800 records
and 16 MiB; reservations include future records. Historical human findings, evaluations and human
edit history remain outside this added admission cap, including when they carry segmented
attribution. Their existing per-record bounds and the whole 64 MiB archive limit still apply.
Original paid-provider gaps remain: only the authored, zero-network recording is supported. An unknown authored attempt tests
safe local recovery, not unknown billing or paid lookup settlement; unsupported provider records
must fail validation.

Historical schema 1–9 verification does not rewrite source archives. Existing offline packet files,
password files and private browser drafts remain outside installation exports. Browser draft reload,
real provider qualification, production backup/rollback, publication and deployment are not claimed.

## Evidence

| Exercise | Workspace | Result |
| --- | --- | --- |
| Own Node 24 `npm ci --offline` | Isolated recovery workspace | Passed; 735 packages installed from the host cache; no dependency changes. |
| `node --import tsx --test test/unit/backup-files.test.ts` | Isolated recovery workspace | 27 passed, including schema-9/10 copy isolation and old archive byte preservation. |
| `npm run typecheck` | Isolated recovery workspace with coordinator-copied shared/server dependencies | Passed. |
| Isolated Auth assertion probe | Extracted pure helper, no services | Passed valid import and rejected changed hash/salt, missing identity/cutoff, backward/out-of-window cutoffs; failures omitted account values. |
| Bundled Auth import probe | In-memory `ProjectState` / `batchCreate` / SDK `UserRecord`, no services | On the exported synthetic accounts, differing fields were exactly `metadata.lastRefreshTime` and `tokensValidAfterTime`. Normalized comparison passed; altered password hash/salt and each metadata field failed with field-path diagnostics only. |
| Full assembled CI | Coordinator integration workspace | Coordinator reports 518 tests passed; not run by DOC-02. |
| Full integration | Coordinator-owned disposable runtime | Coordinator reports 209 passed, including 25 backup corruption, 8 handoff and 12 storage cases. |
| Preserved historical schema-9 archive | Coordinator-owned disposable runtime | Coordinator reports genuine import/validation passed and original archive bytes unchanged. |
| Fixture recovery and maximum native export | Coordinator-owned disposable runtime | Schema-9 fixture import and schema-10 export progressed; pending rerun with documented Auth import normalization; not run by DOC-02. |

The first fixture import failed because Auth advanced `tokensValidAfterTime`. Bundled
`firebase-tools/lib/emulator/auth/index.js` imports accounts through `accounts:batchCreate`;
`operations.js` preserves the supplied password hash/salt but unconditionally sets `validSince`
to the upload time. `firebase-admin/lib/auth/user-record.js` exposes it as the token cutoff.
The next cycle exposed the second normalization after fixture sign-ins: export retains
`lastRefreshAt`, but the bundled `batchCreate` handler omits it while copying `lastLoginAt`; the SDK maps its absence
to `metadata.lastRefreshTime=null`. Private schema-10 export and receipt both recorded refresh
metadata on five signed-in accounts, unlike the initial seed. The revised assertion requires that
exact null result, a bounded monotonic cutoff, and exact preservation of every other field. It does
not claim exact Auth session metadata restoration. Neither password/identity checks nor role checks
were relaxed.

No services, emulator instances, provider calls or browser sessions were started by this worker.
Unit tests created and removed their own synthetic file fixtures. No saved preview, private archive,
account or existing configuration was modified.

## Review and integration

- Non-author reviewer: coordinator; final review pending. Its early fixture review identified that
  attempts cannot start after their base review changes. Corrected the late-output fixture to queue
  a second run before an in-flight attributed human correction, within the two-run limit.
- Independent review of coordinator-owned attribution/receipt/draft changes found no blocker in
  those call sites. A cross-owner gap was reported: the installation validator must resolve current
  and historical attributed findings even if all run artifacts/markers were removed. INT-02 added
  independent historical evaluation traversal and exact graph/provenance resolution. Final read-only
  review also confirmed an independent, paginated finding scan rejects an attributed orphan even
  after all review/evaluation/run records disappear, checks complete finding hashes, and requires
  each attributed finding to belong to a verified evaluation and run. The 1,600-record admission cap
  does not truncate historical human traversal; the maintenance identity is checked again at exit.
  No blocker found in this final traversal. The coordinator reports its corruption suite passed.
- Integrate storage/shared/API dependencies first, then these nine files. Coordinator must register
  `test/integration/segmented-backup.test.ts` in the serialized integration runner.
- Coordinator runtime command: `npm run test:recovery -- --baseline PATH_TO_PRESERVED_SCHEMA_9_ARCHIVE`.
  Keep its private measured `segmented-maximum.json`, archive identities and logs as acceptance
  evidence. A failed gate remains outstanding; this report does not substitute for its result.
- Only the coordinator updates workboard acceptance and restores the preserved preview afterward.
