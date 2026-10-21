# Synthetic recovery and upgrade rehearsal plan

This plan preserves the existing [local backup contract](backup-recovery.md) and separates its tested
legacy conversion from a future supported release upgrade. OPS-02 adds executable read-only
diagnostics and direct finish-restore refusal tests. It does not implement succession or select a
supported upgrade pair. OPS workers run no emulators, bootstrap, backup, import or publication;
the coordinator owns runtime reservations and records executed evidence in
[the OPS-02 report](parallel-work/reports/OPS-02.md).

## Entry gate and source identities

Use an isolated source checkout with its own dependencies, Node 24 and Java 21+. Inventory source
revision/tree, lockfile hash, backup manifest/schema, exact configuration, tool versions and output
directory. Use `config/test.example.json` for the automated suite; a separately authorized manual
River Valley rehearsal uses `config/second-district.example.json` consistently. Neither is the saved
Maple preview or a real district target. Do not import private records or reuse preview credentials.

Before any later runtime exercise, the coordinator must reserve the emulator ports and any browser
slot, verify/preserve the saved preview, stop its identified processes and confirm the ports are
free. A different demo project still uses the same ports. Return the slot only after the exercise
is stopped and listeners are checked; the coordinator restores the saved preview with its verified
archive and original accounts. Never bootstrap the saved installation.

For an actual version-pair rehearsal, call the exact old source/configuration/lockfile **A**, candidate
source **B**, and verified pre-change archive **A0**. Select A and B before running; no supported
release pair is selected by this document. `verifyBackup` currently requires the exact lockfile and
native Firebase CLI version as well as supported schema/configuration. If B changes those pins, the
existing restore is expected to refuse A0. Stop and design a reviewed compatibility/conversion path;
do not edit dependency hashes, CLI versions or schema labels in an archive to force acceptance.

## Executable baseline checks already present

With the runtime reservation and no development server running, the existing commands are:

```sh
npm run ci
npm run test:integration
npm run test:recovery
```

Run them serially where they share output/dependencies or ports. The recovery command optionally
imports a preserved schema-9 baseline first, then imports a synthetic schema-9 fixture and performs
two schema-10 shutdown/import cycles, checking exact restored state. It uses the
current reader against older record shapes and durable schema-10 segmented runs; it is not a test of arbitrary
historical binaries or dependency upgrades. Inspect the receipt privately for generated IDs and
comparison data. Its random passwords and exported accounts must never enter a report or commit.

The new `npm run local:check` can inspect an already running installation. It does not acquire a
maintenance lock or repair anything. Run `npm run --silent local:check -- --json` for structured
output and optionally supply `--backup PATH` to invoke the existing exact verifier. Preserve the
exit status and redacted check report; do not treat `backup: not_checked` as a verified recovery
point or a passing archive check as a completed restore. See [operator check semantics](operations-readiness.md).

The current suite's precise before/after contract in
[roundtrip.ts](../test/recovery/roundtrip.ts) includes:

| Synthetic record before save | Expected after each applicable restore |
| --- | --- |
| Initial admin plus reviewer, viewer, staff, revoked reviewer and disabled reviewer | Same UIDs/passwords and role/active states; disabled sign-in rejected; staff/revoked private review reads denied; viewer may read but not create. |
| Evaluation mission `Synthetic recovery mission`, security weight `1.5`; library title `Recovered practice library`, empty footer sections | Exact values, revisions and saved history survive; public projection does not expose private evaluation settings. |
| `Full rubric recovery`: 32,000 `測` characters, 50 partial findings, three exact citations per finding, adopted tier policy, service facts and conditional publication | Score 50, original source, service policy/revision, decision binding and publication retained; first evaluation still readable. |
| Published pasted practice review and a separate partly reviewed draft | Pasted score 64 and additional evidence/reviewer attribution preserved; partial review still awaits review and gains no approval. |
| `Recovered suggestions`: retained collection context, resolved human deletion correction, unresolved security | Original proposal provenance and human resolutions retained; aggregate score remains null. |
| `Precision recovery`: mixed clause states and question `Supply applicable security terms.` | Adopted precision definition and original proposal clauses survive; unresolved current finding remains distinct from original established proposal. |
| `Bounded source recovery`: missing security addendum | Document remains missing, coverage target not ready, aggregate score null. |
| `Segmented source recovery`: over 100,000 characters, late seven-year backup-retention exception, only `s1` human acknowledgment | Exact text/hash/parts and late quotation survive; acknowledgment remains partial and score null. |
| Durable segmented schema-10 runs, including empty/cancelled runs, original valid/invalid responses, stale synthesis and attributed unresolved human findings | Exact raw bytes, requests, attempts/outcomes, historical prefixes, dispatch/receipt identities, admission accounting and original human provenance survive; no new score, decision or publication is inferred. |
| Queued suggestion and fixture jobs; failed retry fixture | Queued jobs may resume once explicitly processed; failed job stays failed until reviewer retry. Existing outputs/corrections are not newly approved. |
| Original actor-scoped create-command receipt | Same command replays to the same review without changing any stored document or restoring an old publication. |
| Legacy inline review in a mixed archive | Exact expected bounded conversion, historical evaluation/decision evidence and public state survive; no silent rescoring. |

The comparison includes every Firestore document and timestamp except the transient
`installation/maintenance` document; maintenance is verified separately. Auth comparison covers
every field, including password hash/salt and last-login time, except two proven native-import
normalizations: the token-valid-after cutoff becomes the import time, and last-refresh time becomes
null. The test bounds the new cutoff and compares every other field exactly through private digests;
see [the segmented recovery evidence](parallel-work/reports/coordinator-segmented.md). After permitted
queued-job work, the second archive establishes a new exact comparison baseline. The first archive
must remain byte-identical. Long-source records require schema 9; any durable segmented run requires
schema 10, including an empty or cancelled run. Use the actual format
required by the records rather than forcing a chosen version.

## Proposed A-to-B rehearsal and acceptance sequence

1. In isolated A, seed only the reviewed synthetic inventory above through an owned test harness.
   Record generated IDs and expected source/evaluation/service hashes privately. Include an unchanged
   published review and a review whose human correction already removed publication. Save A0 and
   run `npm run local:backup:verify -- A0_DIRECTORY` with A's configuration. Preserve A0 and A's
   source/lockfile separately. A0 is never the target of failure injection.
2. Stop A gracefully. In B, verify A0 before import. A compatibility refusal is a valid boundary,
   not permission to relabel it. Restore only into fresh empty emulators with B's explicitly reviewed
   reader/migration. Record each conversion version and expected data delta before permitting writes.
3. While inspection is isolated, compare all records to the expected A-to-B mapping, including
   history, source parts, frozen hashes, receipts, role denials, null unresolved scores and actual
   audience projections. Test ambiguous replay and a stale command. Historical scores and human
   decisions must be identical unless an explicitly approved migration specifies otherwise.
4. Save B0, verify it, stop B, and restore B0 with B. Repeat comparison and authorization checks.
   Measure backup, import, validation and total outage duration separately. A checksum pass alone
   does not establish usable accounts, valid citations or correct publication.
5. Before any acceptance, prove rollback separately: stop B and use preserved A plus untouched A0
   in fresh emulators. Confirm the original identities, source/history and projections. Do not feed
   B0 to an older reader unless backward compatibility was explicitly designed and tested.
6. Deliver source identities, archive IDs/schema/lock hashes, permitted deltas, commands, timing,
   failures and limitations for non-author review. The coordinator restores the user's saved preview
   and verifies its accounts/private/public state. No main merge or deployment follows automatically.

The fixture seeds a published entry only within the authorized disposable test harness. This plan
does not authorize a worker to publish a new entry in the saved preview or any external system.

## Failure injection matrix

Run each injection on a disposable synthetic copy or controlled test double. Preserve the original
archive and never alter a manifest to make damaged data acceptable. “Existing” below means a case
is present in the named source tests; it does not claim OPS-01 executed it.

| Injection | Observable expectation and safe recovery | Evidence / status |
| --- | --- | --- |
| Change one exported byte; remove/add a file; replace an export with a symlink; unsafe relative path or unknown schema | Verification rejects before import; original source archive remains unchanged. Retest its untouched copy. | Existing [backup unit cases](../test/unit/backup-files.test.ts). |
| Different demo configuration or dependency hash | Reject before starting the application. Recover using matching source/configuration, not patched metadata. | Existing backup verification/unit checks; actual A/B pair still to select. |
| Export request throws or its outcome is uncertain | No completed-success claim; maintenance remains active; writes fail while reads remain available. Confirm exporter state before matching-lock resume or restore last completed point. | Existing [maintenance/export tests](../test/integration/reviews.test.ts). |
| Wrong maintenance lock ID or second concurrent lock | Refuse release/acquisition; unrelated actor cannot reopen writes. Matching owner acts only after the first operation's status is known. | Existing maintenance tests. |
| Throw during one legacy review transaction | No partial versions for that review; fence remains. Resume once cause is fixed; already converted reviews are skipped. | Existing [migration tests](../test/integration/review-storage.test.ts). |
| Interrupt between legacy review batches | Earlier transactions may be converted; later ones remain legacy. Hold the same fence, resume idempotently and compare the complete expected state. | Proposed extension; per-review atomicity is not whole-installation rollback. |
| Legacy history exceeds the supported bound, or cannot reproduce its historical score | Refuse conversion and keep maintenance. Preserve evidence for a separately reviewed migration; do not truncate history or rescore it. | Current migration rejects these states; explicit adversarial rehearsal remains planned. |
| Missing/drifting installation, malformed protected UID, missing/disabled/unverified/wrong-email Auth, missing/non-admin/inactive/wrong-email membership | Both the diagnostic and current finish-restore gate fail; compare all Auth and Firestore records before/after and retain the exact maintenance fence. Never bootstrap around the refusal. | Added [OPS-02 emulator cases](../test/integration/operations-readiness.test.ts); execution status in the OPS-02 report. |
| Lost save response followed by original command replay | One effect and one review identity; old receipt must not republish a corrected review or bypass revoked membership. | Existing receipt/integration/recovery cases. |
| Candidate starts but record/projection comparison fails | Reject B, preserve failure evidence privately, stop B and restore A/A0. No user writes may be admitted while accepting the candidate. | Proposed A/B acceptance gate. |
| Off-device copy unreadable, decryption key unavailable or retrieval corrupted | Restore fails explicitly; use an independently verified retained copy/key recovery path. No successful recovery declaration based only on object existence. | Future encrypted/off-device design; no such service selected. |
| DPA expiry crosses its inclusive UTC date after publication | Current system remains published until reviewer action. Confirm current requirement warning; authorized test unpublish removes both projections. No automatic expiry job is assumed. | Existing date/publication semantics; time-controlled end-to-end extension proposed. |

The existing local legacy command, for a separately authorized compatible exercise, is
`npm run local:migrate-reviews`. It saves a pre-migration backup and retains a fence on failure.
Its documented recovery form is `npm run local:migrate-reviews -- --resume-lock LOCK_ID` after the
cause is understood. This narrow command is not a general schema-upgrade engine, and a migration
failure is not fixed by `local:resume` merely to reopen partially converted state.

## Scope of the new refusal evidence

`test/integration/operations-readiness.test.ts` uses the normal synthetic test configuration and
real Auth/Firestore emulators. It exercises the fixed-root availability probes, healthy/maintenance
diagnostics, second-admin eligibility and eleven protected-installation failure variants. Each
variant captures every fixture Firestore document and Auth user record after the intentional damage
and before inspection, then compares them after inspection and after `finishRestore` rejects. The
same maintenance ID must remain. It performs no sign-in between comparisons, avoiding Auth login
timestamp changes being mistaken for restore writes. Generated identities/passwords stay private.

These are direct tests of the existing **post-import gate**, with an in-memory schema-3 manifest
fixture. That fixture is deliberately not a sealed archive. No native export is edited or relabeled,
and the tests do not claim a new shutdown/import rehearsal. Actual native archive validity and
two-cycle recovery remain the separate backup/recovery suites. The pure readiness suite additionally
checks argument/environment refusals, fixed redacted output, piped JSON completion, bounded reads,
and unchanged bytes during optional exact-configuration archive verification. A synthetic checksum
fixture is not evidence that its placeholder Firestore files could be imported.

For the proposed versioned protected-admin succession contract, extend this matrix only after its
attestation and configuration/backup choices are accepted. A prepared request must survive restart
without authority changes; a committed request must reconcile to exactly one generation and receipt;
an old archive must never be relabeled to hide a transfer. Require explicit evidence for an intended
rollback that would restore former authority. The current read-only check cannot perform any stage.

## Rollback and decision rules

Stop acceptance for any unexplained data/hash/role/projection delta, missing history or source,
secret exposure, unreconciled job outcome, failure to restore A0, or inability to identify the
running owner/backup. Record the exact condition rather than treating a retry as proof of safety.
While B is under validation, keep it isolated from ordinary users so rollback to A0 loses no new
accepted writes. If a future deployed B has already accepted writes, A0 no longer contains all
work: preserve B's state, stop admission and obtain a reviewed repair/reverse-migration or explicit
loss decision. Automatic rollback to A0 is not safe or implemented in that situation.

Future release qualification still needs an actual supported A/B compatibility matrix, schema and
dependency migration tooling, measured data-size limits/outage targets, key recovery, off-device
restoration and an independent operator exercise. [Operations readiness](operations-readiness.md)
assigns the proposed owners and decisions. Passing the current two-cycle synthetic suite cannot
establish those unimplemented production guarantees.
