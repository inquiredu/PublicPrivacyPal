# Local scoring and review workflow

This milestone is an offline practice workflow. It accepts three bundled synthetic policies, uses
an explicit fixture adapter on the server, and never fetches a vendor website or calls an AI provider.
The original district deployment and repository are not targets of any command in this application.

## Try the workflow

1. Start the local services, bootstrap, and sign in as described in `local-development.md`.
2. Open **Policy reviews** as an administrator or reviewer. Name a fictional tool and choose a policy.
3. Start analysis. You can leave the tab and return: the job is stored in the emulator database.
4. Inspect its score, source text, quotations, and missing criteria. The temporary-failure example
   fails on its first attempt; **Retry analysis** succeeds on the second.
5. Record a decision, internal rationale, conditions, public summary, and category. Conditional
   approval requires conditions. A declined decision cannot be published.
6. Choose **Publish to local library**, then check **Public library**. Sign out to verify anonymous
   access. Only the name, category, public summary, decision label, conditions, review date, and
   synthetic marker are published. Scores do not imply approval and are not part of this projection.
7. Sign back in and **Unpublish from local library**. The public and staff projections are removed
   in the same transaction that updates the private review and appends its history event.

This is local publication inside the emulator, not publication to a website or GitHub.

## Scoring and evidence

`shared/scoring/engine.ts` preserves the original weighted formula: meets earns 100%, partial earns
50%, silence earns 60%, and an explicit failure earns zero. Inapplicable criteria are excluded. The
sum is rounded once at the end. Critical criteria carry weight 2, important 1, and the pure engine
also accepts positive supporting weights. Engine version: `upstream-weighted-v1`.

The newer `community-evidence-v1` candidate uses `evidence-weighted-v1`, giving missing evidence
zero credit while preserving the other weights and credits. New reviews default to this candidate;
existing records remain on the inherited formula. Select the inherited profile explicitly to compare.
Citation coverage and missing findings remain visible, and no score automatically approves or
publishes a tool. See `scoring-rubric.md` for the review rationale, criterion definitions and tests.

`community-demo-v1` is a newly authored, eight-criterion demonstration profile. It is deliberately
smaller than the upstream rubric and contains no district tiers or jurisdiction-specific legal claims.
The original full rubric has not been adopted as a universally applicable policy. A pilot needs a
district-approved policy profile before real vendor evaluation. The new candidate has technical
regression coverage and written evidence guidance; district policy sign-off is still pending.

Findings have a criterion ID, constrained finding value, exact quote, and source offsets. The server
rejects missing/duplicate/unknown criteria, extra fields, fabricated quotes, invalid offsets, and
unsupported source text. Each analysis records a source hash and engine, profile, schema, and adapter
versions. Structural citation validation does not establish semantic accuracy for a future AI adapter.

## Jobs, decisions, and consistency

The API accepts only a fictional tool name and a known fixture ID. There are no outbound fetches;
SSRF protections and bounded network retrieval must be implemented before adding real URL input.
There are no model credentials, model-selected scores, or browser analysis calls.

A server worker claims jobs with a 30-second lease, completes one at a time, and recovers expired
leases. Cancellation or replacement prevents an old worker from committing a result. The requesting
account and current reviewer membership are checked before completion. Failures are stored with an
actionable message. Up to three attempts per analysis are allowed, with a district quota of 100
analysis submissions/retries per UTC day and 100 review records per local sandbox. Explicit new
analyses count against the same daily quota. Lease recovery is not a new submitted attempt.

Jobs survive browser closure and API process restarts while the emulators stay running. Emulator
shutdown discards unsaved state. Whole-installation local backups can now recover that state across
shutdown; see `backup-recovery.md`. This is separate from production durability.

Every command checks the current role inside its Firestore transaction and requires the revision
seen by the caller. A stale command returns 409, prompting the user to inspect the updated record.
Computed scores and actor identities cannot be submitted as command fields. Decisions retain their
analysis ID. New analysis preserves earlier findings and decisions, removes publication atomically,
and requires a new decision before publishing the new result. Editing a decision also removes the
old publication until the reviewer publishes again.

Review history is append-only through application APIs and browser rules. Events use server time
and authenticated actor UID; completion events retain the analysis and decision events retain
before/after decisions. The privileged local operator can still change emulator data directly.

A failed publication transaction returns an error, with no success message or partial public state.
The UI shows errors and does not optimistically mark a record published/unpublished. An integration
test injects a failure during unpublication and verifies that the prior private and public state both
remain intact, followed by a successful retry.

## Export and import

Reviewers and read-only reviewers can download a JSON export containing the synthetic source,
analysis, decision, and attributed history. Only reviewers/admins can import. Imports are bounded to
128 KiB and require a bundled synthetic source. They create a new unpublished review, recompute
analysis, and require a new human decision. Archived scores, decisions, and identities are never
accepted as authority in the receiving installation; the original archive remains in the file.

This is portable draft import. Operator installation backups now preserve accounts, approval, history
and publication together; see `backup-recovery.md`. Encryption, schema migrations and production
operational recovery remain pilot work.

## Validation

The new synthetic golden cases pin weighted score arithmetic, silence/partial behavior, exclusions,
and rounding. Unit tests also reject fabricated citations and malformed findings. Emulator tests
exercise every role, direct-write denial, cross-district reads, API restart and lease recovery,
failure/retry, cancellation, stale concurrent edits, missing/declined decisions, projections,
transaction rollback, revocation, disabled accounts, untrusted import, and quota enforcement.
