# Durable segmented review implementation — October 20, 2026

Coordinator: `/root`. This report describes the INT-002 application increment over
`cb89a66c200f7f26fec812a331743a9e54e0fd55`, on
`codex/coordinated-milestone-2026-10-19`. Origin and fresh GitHub tips were verified; local and
remote main remained `cb5bb04cde8d900f0376d11f5676369636845eae`. The checkout was clean before
implementation. The 219-file source archive has SHA-256
`04597aeca70c9bcaeeab18ac5eabfc52af62be3c7408770c7a8a7933618cd876`.

## Implemented behavior

The exact authored Lantern long-policy fixture now supports durable private run/attempt records,
immutable requests and original response bytes, bounded retries and inspectable synthesis history.
A completed proposal opens an explicit unresolved human draft. It never accepts citations,
acknowledges human review ranges, changes a score or makes a district decision automatically.
Human saves retain the original provenance; late results cannot replace corrections or drafts.

Every mutation uses the established actor-scoped receipt and current-review reconciliation.
Start/cancel advance review revision; attempt progress has a separate run revision. Requester
identity, membership, source/definition, generation, worker lease and maintenance fences apply.
Only this deterministic zero-network, zero-cost adapter may recover an unknown dispatch under
its original attempt. No paid adapter or live-provider reconciliation is registered.

Storage admission reserves future records before dispatch and never deletes retained history.
The first run requires schema 10, including empty cancelled runs. New attributed human evidence
uses findings-v7 / human-evidence-v6. Older formats remain intact. Restore validates original
bytes, complete historical prefixes, receipts, counts and all historical attributed findings;
independent scans reject orphan artifacts even when their parent markers were removed.

The user-facing walkthrough is [saved segmented reviews](../../segmented-reviews.md). Exact limits,
versioning and accepted decisions are in [INT-002](../contracts.md).

## Coordination and review

Assignments were recorded before implementation in the workboard. Workers used isolated source
copies with their own dependencies; the coordinator alone controlled runtime and browser resources.

- INT-02 owned durable storage, synthetic recording, worker lifecycle, readers and focused tests.
- UX-02 owned run/proposal inspection, explicit draft handoff and candidate attachment.
- DOC-02 owned schema-10 backup integration, historical restore and recovery fixtures.
- The coordinator owned shared evidence/draft/receipt/route wiring, parent screen integration,
  documentation and full regression checks.

Coordinator source review covered all increments. The UX worker independently reviewed INT core
and confirmed fixes for complete historical-prefix/generation validation, byte-aware pagination
and independently recomputed permanent reservations. DOC reviewed coordinator attribution and
receipt changes and reported the historical/orphan provenance gap, now covered by the independent
finding scan and real-emulator tests. No further blocker was found in those focused reviews.

## Observed validation

- Own dependency directory installed from the pinned lockfile under Node 24; no dependency changes.
- Full CI: 518 unit/isolation tests, TypeScript, production build, bundle budgets and source
  isolation passed. Initial JavaScript is 282.13 kB gzip across five chunks.
- Full emulator integration: 209 tests passed, including every reader/editor role, immutable
  original returns, unknown dispatch recovery, expired leases, maintenance, receipt replay,
  stale draft rejection, human corrections and orphan graph rejection. Existing atomic
  publication/removal tests passed in the disposable synthetic test installation.
- Recovery passed: the actual preserved schema-9 installation and a separate schema-9 fixture
  restored successfully, followed by two complete schema-10 shutdown/import cycles. The old
  archive remained byte-identical. Maximum admitted fixture: 473 records, 9,406,415 logical bytes
  and 13,672,169 native-export bytes; over-limit commands left state unchanged.
- Native Chrome completed the new synthetic flow: three range attempts and synthesis; conflicting
  quotes and the missing-annex question remained inspectable. An explicit unresolved draft retained
  exact rationale whitespace, two deliberately attached citations and only the selected human
  range acknowledgment across reload/navigation. Saving and correcting it preserved the immutable
  proposal identity. Score stayed withheld and district decision stayed unrecorded.
- At 320px the new flow had no horizontal overflow. Frozen requests, retained original responses,
  untouched-measure handoff and draft/revision retry guards were inspected. No application console
  error was observed; unrelated browser-extension errors were excluded. Keyboard activation was
  used when automation reported detached click targets; this is not a full mouse/assistive-technology
  certification. Temporary viewport settings and the unused QA draft were cleared.
- The walkthrough prompted plain-language failure labels and a disabled retry explanation after
  the review revision changes. The last UI guard passed TypeScript and the complete build/bundle
  check; it did not alter the previously tested server or recovery behavior.

Two initial recovery assertions exposed native Auth import behavior: the emulator assigns the
import time to the token-valid-after cutoff and clears the last-refresh timestamp. A focused
in-memory run of the bundled importer confirmed these exact fields. The corrected rehearsal
requires that narrow normalization and compares every other Auth field exactly, including password
hashes, salts, creation time and last sign-in. Failures report differing paths and digests, never
account values. This changes test expectations, not application authentication or restoration.

Private final logs and screenshots live under `.local/validation/segmented-app-final/`; the actual
source archive and hash inventory are under `.local/source-checkpoints/segmented-app-2026-10-20/`. The original
schema-9 preview archive was saved, copied with every file hash checked and independently verified
before stopping its owned runtime. Its backup id is `8d2768f9-c285-4db9-8104-351ecce66d4a`, at
`.local/backups/2026-10-21T00-53-22-131Z-689702e4-8d54-4ee5-ac7c-ff6f05201efa`.
The final preview remains at http://127.0.0.1:5173/ from the coordinator's isolated integration copy,
with ten synthetic reviews (the original nine plus the named Lantern browser-QA review) and five
unchanged public entries. No preview publication occurred. A new schema-10 installation archive was
saved, copied with every file hash compared and independently verified again:
`.local/backups/2026-10-21T01-40-29-576Z-9bc2bd80-9c1b-4784-8ef0-4138f7b1b6dd`, backup id
`d4b37fb9-b18c-494b-9891-1c4d499830bb`. Restore it with its exact private configuration and without
bootstrap. Older archives remain preserved. Private archives, account files, configuration and
original audit material remain excluded from Git.

## Remaining boundaries

This is a synthetic development increment. General provider admission, tokenizer/spend controls,
paid unknown-billing reconciliation, independent policy/rubric adjudication, an outside-user
installation trial and broader assistive-technology testing remain open. Structural quote
validation proves location, not semantic correctness. No live providers, real district data,
main merge, repository visibility change, release or deployment is part of this work.
