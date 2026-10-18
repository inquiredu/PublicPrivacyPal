# Analysis invariants: first refinement milestone

October 16, 2026. Implements step 1 of the approved [five-reviewer refinement](ai-analysis-refinement.md).
The shipped provider remains the exact offline Cedar recording. This milestone changes source,
validation and worker behavior; it does not enable inference, change district scoring, expand the
source-size limit or implement the later editor/storage redesign.

## Canonical source and bounded segmentation

`shared/policy-source.ts` owns ingestion and canonical-text validation. Raw pasted input retains
the 32,000 UTF-16-unit cap, normalizes CRLF/CR to LF once, then validates the canonical form.
Malformed surrogate sequences and prohibited controls are rejected. Tabs, valid surrogate pairs,
spacing and Unicode composition are preserved. Normalization does not silently replace malformed
characters or rewrite quotations.

The request builder and validator require this exact canonical text. Hashing also rejects malformed
Unicode before UTF-8 encoding, closing the replacement-character identity ambiguity. Hashes of valid
existing sources are unchanged. Segmentation only moves a boundary across an actual surrogate pair
and checks that every iteration advances. Passage IDs and offsets for valid v1 sources are unchanged.

Tests cover the previously hanging surrogate-before-newline case in a timeout-controlled child,
valid pairs around the 4,000-unit boundary, malformed combinations, CRLF/CR normalization, exact
offsets, composed/decomposed text, controls and the existing length bounds. Passage-count/request
byte limits and long-document coverage remain step 4 work; the current cap is not a complete
provider token or spending bound.

## State compatibility and historical versions

New requests use `evidence-extraction-v2` and `policy-suggestions-v2`. One shared table generates
instruction guidance and conditional JSON Schema, enforces runtime compatibility and prevents
incompatible findings from preparing human evidence drafts.

| Assessment | Allowed reasons |
| --- | --- |
| Supported | None; a known exception permitted by the adopted definition |
| Partial | None; exception; unresolved scope, missing statement or ambiguous wording |
| Contradicted | None; known exception |
| Not addressed | Missing statement, in a usable source |
| Ambiguous | Conflicting statements, unresolved scope or ambiguous wording |
| Unavailable | Missing source |

A known shortfall can be certain. `none` and a known `exception` do not require an invented
clarification question; an optional remediation question is allowed. Conflict, unresolved scope,
missing source/statement and ambiguous wording require a nonblank question. Whether a quoted
exception is actually permitted by the adopted definition remains a semantic review question.
Exact citation, measure coverage, output-size and source-status checks still apply.

Historical v1 outputs retain their original validator and prompt. Reads reconstruct that version's
request and verify its complete provider/settings key against the saved result/job. A frozen
pre-change Cedar request hash proves v1 identity is unchanged. Old queued recordings can finish
under v1; new requests receive a distinct v2 cache key. Regardless of version, unresolved positive
findings cannot prepare a yes draft. No existing source, saved human finding, score or decision is
rewritten.

The output's source-readiness label is still model-owned, and exact quotations do not prove semantic
support. Those limitations remain explicit. Scope and questions still need the separate persistence
work in step 2; they are not silently folded into a short rationale by this milestone.

## Whole-worker deadline and recovery

The 60-second operation deadline begins before the queue read and covers claiming, identity lookup,
preflight, provider work, post-response identity and the result transaction. A deadline guard checks
elapsed time as well as the abort signal. Every transaction callback checks at entry and before
return, including SDK retries, so a callback resumed after expiry throws instead of committing its
buffered writes. Provider dispatch occurs only inside a guarded continuation. Heartbeats remain
active through normal commit and lose authority on expiry, cancellation or operation completion.

After expiry, only a separate status-only cleanup attempt is allowed, bounded to five seconds.
It cannot accept findings, repeat identity lookup, dispatch inference or renew the lease. It records
failure before dispatch or an unknown outcome after dispatch when storage is available. If a stuck
transaction holds the job lock or storage remains unavailable, cleanup stops too; the durable lease
and dispatch marker remain recoverable. An offline recording may be replayed. A dispatched live
attempt must use lookup rather than blind resend.

This bounds application waiting; it does not cancel every underlying SDK RPC. A transaction already
submitted to Firestore can have an unknown acknowledgement, so the application cannot promise that
every timeout means no write occurred. Transaction conflicts, durable lease tokens and reads during
recovery fence and identify that outcome. Unknown provider cost is never assumed to be zero.

Actual emulator tests stall the claim, preflight and commit callbacks, as well as identity before
dispatch and after the response. They release the stalls after the operation ends and check for no
late dispatch or accepted findings. A commit holding a Firestore lock also blocks cleanup: the test
expects a recoverable running lease, then verifies that late cleanup cannot overwrite recovery.
The normal cancellation, revocation, maintenance, stale-result and concurrent-worker tests remain.

## Verification and remaining work

Evidence and exact runtime/source hashes are retained privately under
`.local/validation/analysis-invariants/`. Verification uses Node 24, pinned dependencies, and a
separate source copy; the dependency symlink is explicitly ignored only in that temporary runtime.
The repository isolation scan is also run on the actual workspace. Test results and recovery
status are recorded in the current [handoff](../HANDOFF.md).

The next milestone preserves suggestion scope, uncertainty, questions and provenance through
draft creation, navigation, reload and human save, shows the full adopted rubric definitions, and
records unresolved review dispositions. Rubric adjudication, source bundles, queue upgrade handling,
priced settlement and a complete per-measure provider benchmark follow in the approved order.
