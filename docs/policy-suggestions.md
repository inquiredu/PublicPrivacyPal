# Local policy suggestions

This is the offline implementation of the [analysis modernization plan](ai-analysis-plan.md).
It uses an authored recording for one fictional source, not an AI model or a general extractor.
Gemini provenance and instructions for another hosted/local system are in
[provider adoption](ai-provider-adoption.md).

## Try the workflow

1. Sign into the restored demo installation as a reviewer or administrator. In **Policy reviews**,
   open **New policy review** and choose **Load Cedar Intelligence Lab example**. The button only
   fills a blank draft. Save/discard an existing capture draft first so it cannot be overwritten.
2. Choose the eight practice measures or explicitly adopt the saved 50-measure district rubric.
   Keep the complete-service option if you want to record the district tier and agreement facts.
   Save the new policy review.
3. In **Compliance**, choose **Prepare offline suggestions**. Status shows queued/running/completed
   work separately from the human evidence-review status. Saved scores and decisions do not change.
4. Expand a suggestion to inspect its exact quote, interpretation, account scope, uncertainty and
   question. Deletion includes the indefinite-backup exception. The overview counts validated states and open questions without displaying model-authored assurances. Review the full source before confirming omissions or interpretations.
5. Choose **Review this suggestion in editor**. The editable evidence draft appears below; review
   or revise it, then save the criterion. Scope, uncertainty, questions and provenance survive reload
   and save. Ambiguous/unavailable proposals and open questions start as **Unresolved**; incompatible
   assessment/uncertainty combinations cannot prepare a draft, including older suggestions.
   Existing drafts block this action. Existing human findings are identified; applying a suggestion
   to one is an explicit correction, never an automatic overwrite.
6. Resolve open questions with a note and exact evidence (or a source-coverage explanation for
   confirmed absence). Original qualifications remain visible. Unresolved measures retain their
   weight and withhold the aggregate score. See [durable review context](review-context.md).
7. Finish each enabled finding, complete the service facts, record a district decision, and publish
   through the existing four-tab workflow. Saving a correction withdraws both actual audience
   projections until a fresh decision/publication. Model summary prose is not shown as an overview or copied into the district's public wording automatically.

**Review the analysis instructions → Load prompt preview** shows the exact canonical request:
versioned instructions, adopted enabled definitions, permitted district guidance, saved passages
and output schema. Provider credentials, identities and district decisions are absent. This is
private review data, accessible only to admin/reviewer/viewer roles.

Other pasted policies continue through manual review. The exact-source gate prevents the recording
from masquerading as analysis of arbitrary text. Reusing a completed recording uses a private
per-review result cache; it neither runs inference nor restores human approval.

## Jobs and limits

Start/cancel commands use the existing revision and command-receipt system. A lost HTTP response
can be checked/replayed with the same command ID without creating a second job. Status polling is
read-only; it never retries a start command. Suggestion completion does not change the review head
revision, so it does not invalidate an open draft. A human change during a run makes that completion
stale. A completed suggestion remains available alongside later human corrections.

The worker processes one job at a time and renews a 30-second lease. A 60-second operation
deadline covers the queue, claims, identity, preflight, provider and result commit. Expiry/cancellation
permits only a separate status-only cleanup attempt bounded to five seconds. Cleanup never accepts
findings or renews the lease. If the database is unavailable or a transaction holds its lock, the
job stays recoverable through its durable lease/dispatch marker. A running status in that case is
not proof that the original worker is still waiting.
Authorization is checked before dispatch and commit; maintenance fences claims and commits.
Crashes leave an expiring lease. The deterministic recording may be replayed safely. A dispatched
live request must instead be reconciled through provider status lookup and never blindly resent.
Unknown remote charges retain reservations; full paid-provider settlement is not enabled locally.

Bounds: 32,000 UTF-16 source units; 50 enabled measures; 150 shared quotations of at most 2,000
characters each; three citations per finding; 256 KiB total output; 1,000-character rationales;
five short summary items; 20 suggestion requests per review; three uncached attempts per exact
request; 100 requests per UTC day. These are development bounds, not a production capacity claim.
The shipped provider has a zero-dollar ceiling and no credentials. No cleanup erases history.

Input normalizes CRLF/CR to LF once and rejects malformed UTF-16 and prohibited controls. The
builder requires that exact canonical text; valid Unicode, spacing and citation offsets are
preserved. Both raw and canonical text retain the existing 32,000-unit limit.

New requests use `evidence-extraction-v2` and `policy-suggestions-v2`. A clear contradiction or
partial commitment can have no uncertainty and no question. Unresolved evidence, conflicting
statements or unknown scope cannot accompany a supported finding. A known exception permitted
by the adopted definition is different from unresolved evidence and must be explained in scope
and rationale. See [the implemented invariants](analysis-invariants.md).

The result key binds the saved source, adopted contract/context, prompt/schema, provider/model,
adapter version and generation settings. Results are content-addressed and validated on read
against their recorded prompt version and reconstructed request identity. Existing v1 recordings
and queued work retain v1 semantics; new requests use a separate cache key. Unsafe v1 state
combinations remain visible for inspection but cannot prepare an editable finding.
Job metadata records timestamps, provider request ID, elapsed time and available usage; unknown
usage is not reported as zero. Private results remain outside human evaluations and public/staff
projections. Whole-installation backup schema 5 preserves them, including queued work; archives containing
findings-v3 review context use schema 6. Older archives remain readable; never relabel an archive
to make an older build accept it.

## Validation scope

Automated tests cover malformed/truncated responses, invented/ambiguous quotes, Unicode offsets,
missing/duplicate measures, uncertainty, cached requests, write rollback, slow/concurrent workers,
unknown outcomes, stale completion, cancellation, authorization and recovery. The 40 development
cases can be exported and externally produced outputs graded without network calls. Labels need
human adjudication and a broader district-rubric holdout before choosing a live model. Passing
software tests establishes workflow invariants, not model accuracy or legal compliance.
