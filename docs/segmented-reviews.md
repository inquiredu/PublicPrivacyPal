# Saved segmented review lab

The Lantern long-policy lab exercises saved analysis attempts using an authored fictional recording.
It makes no network model calls. The server accepts only the exact bundled source and its original
eight-measure practice definition. Other captured documents remain available for manual review and
instruction preview. This recording does not qualify a provider or adopt a district rubric.

## Try the workflow

1. In **Policy reviews**, start an empty new-review draft and select **Load Lantern long-policy lab**.
   Inspect the document dependencies and save the policy. The fixture includes a late contradictory
   statement and a missing retention annex. It does not adopt a service tier policy automatically.
2. Open **Compliance** and select **Start synthetic segmented run**. Run each recorded source range
   explicitly, then select **Synthesize retained evidence**. A synthesis can also demonstrate what
   remains unavailable when source ranges have not been examined.
3. Inspect a measure's original proposal, derived availability, complete questions, declared scope
   and retained candidates. Earlier supporting, limiting and opposing passages remain inspectable
   after a retry. Original returned bytes are retained even when a response is invalid.
4. Select **Create unresolved review draft**. No finding or quotation is accepted automatically,
   and human range acknowledgments start empty. Select passages deliberately, inspect their source
   context, and record your interpretation. A quotation proves location, not meaning.
5. Save unresolved work or explicitly resolve the applicability question after completing human
   source review. Missing captured dependencies cannot be resolved with a generic note. A score is
   withheld while any enabled measure remains unresolved; district decisions remain a separate step.

A draft already in progress blocks replacement. Reload keeps its original review revision, wording,
references and range acknowledgments. A background result cannot update the draft. If a save outcome
is uncertain, use **Check saved result** and retry the same save only after reconciliation. The
browser does not automatically resubmit it.

A completed proposal can open drafts for unchanged, unreviewed measures. Saving one measure does
not disable every other untouched measure. A retry immediately disables the previous proposal for
new handoffs, while historical inspection remains available. Correcting an already saved finding
retains its original reference, even after cancellation or a newer run. Human corrections withdraw
existing publications through the established atomic evidence-save operation.

## Retention and operation

Each review retains at most two runs. Cancel the open run before starting another. Each source
range and synthesis permits at most three explicit attempts, with one active attempt per run.
Storage admission can be exhausted before those count limits; the application rejects the new
attempt and keeps existing evidence. It never deletes history to admit another run.

Run processing, proposal eligibility and settlement are separate. Attempt progress has its own
revision and cannot change findings, scores, decisions or public records. Completion checks the
original review revision and current requester access. A late return can be retained privately
without gaining permission to change human work. A valid worker lease is required for retention;
installation maintenance blocks retention, eligibility and settlement writes alike.

Only the versioned authored recording may recover an interrupted dispatch by replaying its original
attempt. This is zero-cost deterministic local work. No paid adapter, provider status lookup,
spending policy or live-provider recovery is enabled by this implementation.

Reviewers and administrators may start, cancel and request attempts. Review readers may inspect
private runs through the API; all direct database access to run records is denied. Every mutation
uses an actor-scoped receipt. Its recorded effect identifies the original run and attempt, while
reconciliation returns the current authorized review state.

The first run sets a permanent storage marker, including an empty or cancelled run. Installation
backups containing it require schema 10. New attributed human findings use findings-v7 and
human-evidence-v6; later corrections preserve those versions. Earlier findings and schema-1–9
archives retain their original identities. Recovery verifies the graph before allowing workers or
writes. Keep original older archives and compatible source for rollback; never relabel an archive.

The exact bounds and implementation decisions are recorded in
[INT-002](parallel-work/contracts.md), [the protocol proposal](segmented-adoption.md) and
[backup recovery](backup-recovery.md). The historical offline packet remains an inspection archive
and cannot import actor authority, accepted findings or approval into the application.
