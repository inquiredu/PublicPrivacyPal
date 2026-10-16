# Local policy review workflow

The local sandbox supports pasted policy text and three bundled synthetic policies. Pasted text is
reviewed by a human; the bundled examples use an explicit fixture adapter. Neither path fetches a
website or calls an AI provider. Use fictional policies for this milestone. The original district
instance and repository remain outside this application's configuration and commands.

## Paste and review

1. Sign in as an administrator or reviewer and open **Policy reviews**.
2. Choose **Paste policy text**, enter a fictional tool name and source label, and select a scoring
   profile. Paste up to 32,000 characters, then **Save policy for review**.
3. The saved source is fixed. Line endings become LF; other text and whitespace are preserved.
   The server records its SHA-256 hash, version 1, and capture time. A changed policy needs a new
   review, so earlier citations remain tied to their original source.
4. Under **Review and edit evidence**, select each of the eight criteria. Choose **Meets**,
   **Partial**, **Does not meet / contradicts**, or **Not addressed** after reading the policy.
5. For the first three findings, select an exact passage in the saved text and **Add selected
   passage**, or paste an exact quotation and **Add quotation**. Add up to three passages per
   criterion, including exceptions or conflicting statements. If a quotation occurs more than
   once, select the intended occurrence in the source. Each passage is limited to 2,000 characters.
6. Explain the interpretation in the required private rationale, then **Save criterion and
   recalculate**. “Not addressed” requires a rationale and no quotation. It is an explicit review
   finding; an untouched criterion does not count as reviewed.
7. Complete all eight criteria. Partial progress survives page/API restarts, but its score is
   provisional and cannot support a decision. Citation coverage and completed review count are
   separate: a missing statement can be fully reviewed without a citation.
8. Record a decision, internal rationale, public summary, category, and any conditions. Conditional
   approval requires conditions. Declined decisions cannot be published. No numerical threshold
   approves a tool.
9. **Publish to local library**, then verify the public view. This publishes only inside the local
   emulator. **Unpublish from local library** removes the public and staff entries together.

The authored example in `test/fixtures/pasted-policy.ts` includes a sale contradiction, deletion
exception, vague security promise, missing change-notice terms, and inert instruction/HTML text.
Its specified human findings yield 64 candidate / 69 inherited. These are reproducibility examples,
not legally authoritative classifications or proof of a vendor's actual practices.

## Evidence corrections and history

Reviewers/admins can edit a completed finding in either source mode. The server validates exact
quotes and offsets against the saved source, stamps the authenticated reviewer and server time,
and recalculates with the original scoring profile. Clients cannot submit scores, actor identities,
source replacements, arbitrary criteria, or profile changes through an evidence command.

Every saved evidence change creates a new analysis ID. In the same database transaction it removes
any publication and records before/after findings, rationales, score totals, analysis IDs, source
hash, profile version, actor, and time. Earlier decisions remain attributed but are stale. A new
human decision and a separate publish action are required, even if the correction leaves the score
unchanged. Source text, quotes, scores, private rationales, and reviewer identities are never copied
into the public projection. Only explicitly entered public wording, outcome, conditions, category,
review date, name, and the synthetic-fixture flag appear there.

Every command checks the current role and maintenance fence inside its transaction and requires
the revision seen by the caller. Concurrent edits yield one success and one 409 conflict. Failed
transactions leave private records, history and both public projections unchanged. The UI waits
for a successful response and prevents publishing with unsaved evidence or decision changes.
History is append-only through application APIs and browser rules; the privileged computer operator
can still change emulator data directly.

## Draft protection and save recovery

New policy text, evidence edits (including quotations), and decision wording are kept as private
drafts in the current browser tab. Switching reviews or workspace sections keeps them, and a reload
recovers them after the same account and role are verified. Drafts are not saved reviews, shared
with colleagues, or included in installation backups. Ordinary drafts expire after 12 hours when
the tab store is reopened. Closing the tab can lose them; save or copy important work first.
The app warns on leaving with drafts. Blocked/full tab storage produces an explicit warning and
keeps the current in-memory text. Sign-out, account changes, and observed loss/change of review
permissions erase these private drafts. Sign-out asks before erasing them.

Each evidence or decision draft retains the revision it was started against. An incoming update
does not overwrite its text or silently move it to the new revision. A conflict blocks submission;
copy any wording you need, then explicitly discard the stale draft and review the current record.
Publishing and rerunning analysis are blocked while the displayed review has unsaved edits.

Every review creation, import and action has a random command ID and immutable request payload.
The server atomically saves a private receipt with the review, history and publication changes.
Repeating that same request returns the current review without repeating its effects, consuming
another quota slot, or restoring an old publication. Reusing an ID for different content is rejected.
Receipt lookup and replay both require the caller's current permission; other accounts cannot
inspect the receipt. Receipts survive whole-installation backup/restore and currently have no TTL.

Requests have a 12-second deadline. A timeout, lost response or server error can leave the outcome
unknown even though a write committed. The UI keeps the pending request and draft, blocks further
review changes, and offers **Check saved result**. If no completed receipt exists yet, **Retry same
save** resends exactly the same command ID and payload. A missing receipt is not proof that the
original request failed. Reload never automatically sends a pending mutation. Pending command IDs
do not expire with ordinary drafts. Only confirmed success clears the corresponding draft; a
definite rejection keeps the draft for correction. Signing out erases the tab's pending request too;
an already submitted request may still complete, so check review history before starting over.

This protection covers the policy review workflow. Settings, library customization, tool requests
and internal notes do not yet use this command-receipt and tab-draft mechanism.

Exact matching proves that a quotation exists in the saved text. It does not prove that it is
relevant, complete, or correctly interpreted. Reviewing omissions and conflicting passages remains
the human reviewer's responsibility. Pasted instruction-like text is stored/displayed as text;
it is not executed, fetched, or passed to a model.

## Bundled analysis and scoring

Choose **Bundled synthetic policy** for the original workflow. The temporary-failure example fails
once and supports retry. Jobs use a 30-second lease and recover queued/expired work across API
restarts. Cancellation or replacement blocks old workers from committing. Actor/account membership
is checked at completion. A running analysis cannot be edited. Rerunning a fixture replaces current
manual findings with fixture output, removes publication, and preserves earlier evidence in history.
Pasted reviews never enter this worker and cannot use retry/reanalyze commands.

New reviews default to `community-evidence-v1`: missing evidence receives zero credit, partial 50%,
meets 100%, and contradictions zero. The inherited `community-demo-v1` retains 60% silence credit.
Scores use the pinned profile and round once after summing weighted points. Neither profile is
approved for district use. See `scoring-rubric.md` for the exact criteria and version guidance.

The sandbox allows 1,000 reviews with a transactional creation counter. Fixture analysis submissions/retries have a transactional limit of
100 per UTC day; manual captures/corrections do not consume that analysis quota. No network or model
work is triggered by manual review. Emulator shutdown discards unsaved state: use installation
backup/restore as described in `backup-recovery.md`.

## Export and import

Private readers can export source, adopted rubric, current analysis, decision and one bounded
page of up to 20 history events. The export includes a continuation cursor when more history exists. Only editors
can import. JSON imports are bounded to 2 MiB. Pasted archives (`privacypal-pasted-v1`) preserve source,
label and profile as a new unpublished, entirely unreviewed draft. Bundled archives
(`privacypal-synthetic-v1`) still require an exact known fixture and rerun its analysis. Archived
scores, findings, approvals, timestamps and identities never confer authority in the new review.
The archive retains historical information for inspection; that history is not adopted into the new
review. Full-rubric archives (`privacypal-district-v1`) cannot be imported automatically: paste their
source and explicitly select current saved settings for a new review. Whole-installation operator
backups, by contrast, preserve existing local authorities.

## Validation

Synthetic tests cover source limits and normalization, Unicode offsets, ambiguous/invalid/fabricated
quotations, contradictory passages, explicit missing-evidence review, deterministic recalculation,
all roles and direct-write denials, concurrent revisions, revoked/disabled users, maintenance,
transaction rollback, private/public separation, stale decisions, untrusted imports, fixture worker
compatibility and API restart. Recovery rehearsal includes partially reviewed and published pasted
policies, multiple quotations, reviewer attribution and audit history across two complete restarts.
An interactive browser walkthrough passed on 2026-10-15: capture, source selection and quote
validation, partial-review reload, all eight findings, publication, evidence correction, withdrawal,
fresh decision and republication were exercised through the UI. See `provenance.md` for the result.
An independent adopter trial and broader accessibility testing remain ahead.

## Full rubric and versioned records

The walkthrough above remains the eight-measure practice exercise. New pasted reviews can also
explicitly select the saved district framework and must complete every enabled measure. Settings
changes never rescore existing reviews. Review lists and history are paged; current detail is
loaded on selection. Immutable versions preserve earlier evidence and decisions. See
[review storage](review-storage.md) for adoption, byte limits, API endpoints and migration.
