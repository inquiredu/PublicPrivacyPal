# Durable review context and unresolved evidence

Implementation step 2 of the approved [five-agent refinement](ai-analysis-refinement.md).
The existing service cards and four detail tabs remain the workflow. This change repairs the
handoff from a validated proposal to a human finding; it does not enable live inference.

## Review workflow

In Compliance, each proposal retains its scope, uncertainty, question and exact citations when
opened in the evidence editor. The draft also carries the suggestion job reference and original
review revision. Tab navigation and reload use the existing private draft store; pending commands,
stale revisions, sign-out cleanup and explicit one-criterion saves retain their existing rules.

The editor displays the adopted meets, partial and failure definitions together. A proposal with
an open question, ambiguous evidence or an unavailable source opens as **Unresolved / defer for
follow-up**. Reviewers can also select that state manually, with a rationale and optional citations.
Saving it preserves work and creates attributed immutable history without completing the criterion.

Scope and qualifications remain attached to every saved interpretation. A qualification with no
open question can be retained. To resolve a question or correct a qualification, choose a concrete
finding, record a resolution note and select the exact saved-source passages that support it.
Confirmed absence permits a source-coverage explanation without an invented quotation. The server
records the resolving actor and time; client-supplied attribution is rejected. Exact quotations
prove location, not whether a human interpretation is correct.

The original scope, uncertainty and question cannot be silently removed on later edits, including
direct API calls. Corrections use the resolution record; the original wording remains visible.
A finding linked to a suggestion keeps that original reference. Reused jobs do not replace it.
An incomplete/unreadable source proposal can be saved only as unresolved; a complete replacement
source requires a new review. Source bundles and independently assessed source completeness are a
later milestone. An author can still make a mistaken manual interpretation; this is not automated
semantic certification.

## Source and proposal identity

The browser submits only `proposalId`. Inside the authorized evidence transaction, the server checks
that the job completed for this review, verifies the immutable result hash and request key, rebuilds
the recorded prompt version against the adopted source/rubric, and resolves the selected measure.
The finding stores the job/result IDs, source/rubric hashes, provider/model, prompt/output versions,
original proposal state and source readiness. Scope, uncertainty and question must match that record.
Later edits must also retain any previously saved qualification. Provider output never supplies a
reviewer identity or a district decision.

The suggestion overview is generated from validated state counts, source readiness and open-question
counts. Unrestricted model summary prose is not displayed as an overview. Per-measure rationale and
scope remain clearly labeled unreviewed proposals; the district's public summary is still a separate
human-authored decision field. Suggestions and human context never enter public/staff projections.

## Versioned scoring and history

New human saves use `human-evidence-v2`, `findings-v3` and score coverage version
`review-coverage-v1`. Unresolved measures have **null points**, retain their full weighted maximum,
and withhold aggregate points and total (**null**, displayed as “Score awaits evidence resolution”).
They receive neither failure points nor policy-silence credit and never shrink the denominator.
Open follow-up questions also keep their measures unresolved for scoring and completion, even if a
reviewer has selected a tentative concrete finding. Decisions and publication require all enabled
measures resolved, plus the existing service and district-decision checks.

Previously unreviewed placeholders in a pasted review become explicit unresolved measures on the
next human save. Existing saved evaluations remain byte-for-byte historical records, including their
old provisional arithmetic. Once all enabled findings are resolved, the adopted scoring engine's
existing credit rules apply unchanged. Fixture-only analyses retain their original demonstration
semantics. Legacy inline archive migration uses the frozen findings-v2 reconstruction helper rather
than replaying old corrections through the new coverage rules.

## Storage and recovery

The review head remembers `evidenceVersion: 3`, including after a later fixture reanalysis. Whole
installation backups containing these records use **data schema 6**. Readers accept schemas 1–6;
older builds reject schema 6. Keep old archives with their matching source for rollback. The original
schema-5 preview backup and separate orphan Firestore preservation are not modified.

Per-finding bounds are 64 KiB; history events are 160 KiB; assembled details are 4 MiB. This covers
three assessment citations plus three resolution citations, 400-character scope, 500-character
question and 1,000-character rationale/resolution. Other storage, request, pagination and 64 MiB
installation-backup limits remain unchanged. Private review exports carry saved finding context and
provenance, but still omit full suggestion job/result records and can reduce history to fit 2 MiB.
Importing a portable practice export creates a fresh unpublished review; it cannot adopt archived
reviewer authority or a prior approval. Use whole-installation recovery to preserve authority/history.

## Verification

The focused regressions cover draft reload with original revisions, qualification removal, forged
references/actors, exact resolution evidence, incomplete-source deferral, immutable prior versions,
all editor/reader boundaries, null scoring with fixed denominators, legacy reconstruction, schema-6
backup identification and maximum-length 50-measure storage. Full CI, emulator integration and
recovery results are recorded in the current handoff and local validation directory. These checks
establish local workflow behavior, not model accuracy or API cost.
