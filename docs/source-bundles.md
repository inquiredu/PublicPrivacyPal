# Bounded pasted source bundles

October 17, 2026. This is the first source-coverage increment in step 4 of
[analysis refinement](ai-analysis-refinement.md). It keeps the existing 32,000 UTF-16-unit total
text limit, supports one bounded request containing the entire declared bundle, and adds no
fetcher, credentials, dependencies or live provider. Longer captures now use the separate [versioned segment path](source-segments.md); the single-request
v1 contract described here stays frozen. Older single-text reviews, prompts and scores remain fixed.

## Capture and scope

Choose **Paste a set of policy documents** in New policy review. Supply the intended product,
account types and jurisdiction, then list each required policy, school/consumer term or addendum.
Mark each document as full, excerpted or unavailable and explicitly confirm or leave unresolved
its applicability to the intended scope. At least one document must contain text. Unavailable
documents have no saved text. Changing to unavailable retains draft text until the reviewer clears
it or chooses excerpt; drafts survive navigation and reload under the existing tab/account rules.

The form starts with **every listed document required for every enabled measure**.
The dependency editor can narrow this to explicit measures or clauses and record explained
exclusions. Adopt the current measure definitions before editing; a refresh never replaces an
existing draft snapshot or silently removes obsolete selections. Changes to review scope retain
each document’s declaration until explicitly reconciled and reassessed.
It does not discover links or decide that an annex is irrelevant. Include required linked material
as another document, even when unavailable. “Full” is the reviewer's capture declaration for the
selected source set, not an independent verification that every vendor statement was discovered.
Scope confirmation is also a human assertion, not a semantic classification performed by the server.

The strict API accepts `sourceKind: "bundle"` and `sourceBundle` instead of `sourceText`. Its
`pasted-source-bundle-v1` manifest additionally supports declared links (included document IDs or
an exclusion reason) and per-document dependencies: `*`, a measure ID, or `measureId/requirementId`.
Every enabled requirement must have at least one declared dependency. Unknown targets, duplicate
IDs, nonexistent link references, unexplained exclusions and missing documents containing text fail.
Excluded documents remain visible but their quotations cannot establish a finding outside their
declared dependencies. Revising dependencies, scope or source material requires a new review.

Each captured document retains its label, reference URL/upload label, declared scope/applicability,
effective-date statements, capture outcome, required targets and exclusion explanation. The server
adds a capture timestamp, SHA-256 of the exact pasted input, canonical-text hash and exact ranges.
Only line endings are normalized (`lf-v1`); malformed Unicode and disallowed controls are rejected.
The raw input itself is not retained separately. Its digest records the input identity; this is a
plain-text capture, not a preserved PDF/web artifact. Multiple effective-date statements stay visible.

The bundle hash binds **all** manifest fields, canonical documents, raw hashes, order, scope, links,
dependencies and capture time. It is distinct from the joined-text hash. Two captures with identical
words but different account scopes or missing annexes therefore have different identities and
request keys. Citations use document ID, canonical-text hash and passage ID; human citations retain
exact joined-text offsets which the server resolves to a single document. Cross-document ranges
and citations outside a requirement's declared dependencies fail.

## Coverage and interpretation

`source-coverage-v1` derives readiness independently for every enabled measure or adopted clause.
A requirement is ready only when all its declared documents are full and their applicability is
confirmed. Required missing/excerpted/unresolved-scope documents block that requirement. Other
requirements can retain useful evidence. Supporting, limiting and opposing clauses stay visible
when a sibling requirement is unresolved; the measure's aggregate remains unresolved with its full
weight and null points. No aggregate score or district decision is available until review completes.

Human evidence saves use the same immutable dependencies. A reviewer cannot resolve a capture gap
with a generic resolution note, a model readiness label or a forged coverage field. The server stores
its own per-measure coverage in the finding. Confirmed silence is rejected for a requirement with
missing coverage. Available evidence and unfinished interpretations can be saved as unresolved.
Exact quotes prove location, not entailment; interpretation and district decisions remain human work.

`evidence-extraction-v4` / `policy-suggestions-v4` is the offline qualification contract for bundles.
It supports the original measures and the precision pilot's mixed clause/ordinary shapes. There is
no model-owned `sourceStatus`. Every passage must be returned exactly once as examined or unavailable.
The server derives a segment ledger with document identity, exact range and pending/validated/
unavailable state, then intersects it with the immutable required-document coverage. Missing or
duplicate acknowledgments reject the whole response. An unavailable final segment cannot be hidden
by successful earlier segments, and its citations cannot be used. Confirmed silence requires complete
applicable document and segment coverage. All passages travel together so exceptions across document
or passage boundaries are available for synthesis; no retrieved subset establishes absence.

“Validated” means the complete response passed structural, coverage and exact-quote checks. It does
not prove the model understood every passage or found every exception. The model can downgrade
availability or flag a question; it cannot upgrade the capture manifest. Original wire output stays
distinct from server-derived states and is revalidated to reconstruct the ledger. The shipped job
endpoint deliberately refuses bundle inference: prompt preview and manual review work, and pure
offline tests qualify the v4 contract. The exact existing Cedar recordings remain on v1/v2/v3.

## Bounds, versions and recovery

| Boundary | Limit |
| --- | --- |
| Documents / declared links | 8 / 16 |
| Raw text | 32,000 UTF-16 units and 96 KiB UTF-8 across documents |
| Canonical joined text | 32,000 UTF-16 units including two LF separators between captured documents |
| Passage partition | 4,000 UTF-16 units per passage, at most 24; all characters included exactly once |
| Serialized extraction request | 256 KiB, including source, metadata, rubric, instructions and schema |
| Conservative input token ceiling | 262,144 UTF-8 bytes as a ceiling for byte-tokenized adapters; a provider must additionally enforce its actual tokenizer/context budget |
| Structured output | 256 KiB |
| Stored bundle / source record | 124 KiB / existing 128 KiB limit |

Many tiny physical lines become a few coherent contiguous ranges instead of thousands of objects.
Whitespace and surrogate pairs are preserved. Request/storage overflow fails explicitly; no source
or requirement is silently dropped and no original limit was increased. A full-text maximum is not
a promise that every metadata/rubric combination fits the request budget. Larger policies require a
separately designed multi-request ledger, boundary context and final complete-source synthesis.

Source records use version 2 and store the bundle once; combined text is reconstructed on reads.
The small review head keeps `sourceKind: "bundle"`, `sourceVersion: 2`, and `evidenceVersion: 5`.
New bundle saves use `human-evidence-v4` / `findings-v5`; the existing unresolved scoring arithmetic,
weights and private detail/history/finding limits are unchanged. The server revalidates the manifest,
hashes, document ranges and dependencies on every versioned source read. Old source records stay at
version 1. Existing command receipts, authorization, maintenance fencing and atomic publication
withdrawal apply to captures and edits.

Bounded v1 bundle reviews introduced **backup schema 8**, even before a human finding
is saved. Long v2 bundles require schema 9; see the current [backup compatibility runbook](backup-recovery.md).
Earlier archives remain intact. Never relabel a new archive for
an older build. Portable exports use `privacypal-source-bundle-v1`, preserve the full captured manifest
and saved findings, and are archives rather than imports that could lose coverage or restore approval.
Recapture explicitly for a new review. Staff/family projections exclude documents, scope, quotations,
dependency maps and coverage metadata.

The recovery rehearsal includes a precision bundle with a missing addendum and retained human clause
evidence, alongside legacy records, earlier findings, suggestion jobs, accounts and public entries.
Both restore cycles compare every Firestore document. Test logs, source parity and browser acceptance
belong in the private `.local/validation/source-bundles/` directory; current results are recorded in
the [handoff](../HANDOFF.md).

## Remaining work

Long-policy capture and offline multi-request coverage are implemented in [source segments](source-segments.md).
Application adoption of segmented model results, independently adjudicated labels, whole-policy provider comparisons, provider-specific
token budgeting and transport/billing reconciliation remain separate milestones. Website fetching
requires its own reviewed network/capture boundary. No live provider or automatic publication is
enabled by this source format.
