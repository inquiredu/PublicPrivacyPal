# Long policies and accountable segment coverage

October 17, 2026. Step 4 now has a versioned long-policy capture and an **offline** multi-request
qualification path. Select **Long policy set** within **Paste a set of policy documents**. This
explicitly adopts `pasted-source-bundle-v2`; existing v1 bundles and single-text reviews keep their
limits, request identities and historical scores. The form starts with every listed document
required for every enabled measure. The [dependency editor](source-bundles.md) supports explicit
measure/clause choices and explained exclusions while preserving immutable saved captures.

This path accepts pasted synthetic documents only. No automatic fetching, provider dispatch,
credentials, spending, default-rubric change or automatic evidence adoption is included. The
Gemini provenance and vendor-independent qualification requirements in [provider adoption](ai-provider-adoption.md)
still apply. Passing these deterministic tests is not a model-quality benchmark.

## Source, scope and segmentation

The immutable manifest preserves document identity, raw/canonical hashes, human-declared scope,
applicability, complete/excerpt/unavailable status, dates, dependencies and link exclusions as in
[source bundles](source-bundles.md). Completeness is an assertion about the selected source set,
not evidence that every relevant vendor document was discovered. Only line endings are normalized.

`source-segments-v1` partitions each available document into contiguous, nonoverlapping cores of
at most 8,000 UTF-16 units. It prefers a paragraph or line boundary within the last 1,000 units,
advances on every iteration and never splits a surrogate pair. Every canonical character belongs
to exactly one core. Up to 400 units of exact surrounding text on each side provide boundary
context without counting as additional examined coverage. Each request retains the full manifest
without document text, its required targets, applicable adopted definitions, and the three most
recent explicit Markdown headings (with exact ranges). Unstructured headings are not inferred;
boundary context remains available. Source separators are not document evidence.

The plan binds the bundle, adopted rubric, all core/context ranges and every request key. Storage
reconstructs the full text and verifies the plan, part order, exact ranges and hashes before use.
A missing, reordered, changed or substituted part fails the entire read. No part can silently become
an excerpt. Existing 128 KiB source-record limits remain in force; the long source uses a small
version-3 manifest record and immutable `sourceParts` rather than enlarging one Firestore document.

## Two distinct review paths

**Manual review:** the evidence editor records `human-source-review-v1` acknowledgments for each
required range. A resolved measure, including confirmed silence, requires all of its required
ranges to be acknowledged and all required captures to be complete/applicable. An unresolved save
can retain partial acknowledgments, exact evidence, opposing clauses and open questions. A generic
resolution note cannot replace a missing range or document. These acknowledgments are explicit
human assertions, not automated proof that the source was understood. Human judgment still
controls interpretation; scores, district decisions and actual publication remain separate.

**Offline extraction and synthesis:** the prompt preview returns a `privacypal-segment-review-v1`
packet containing the full immutable source, adopted rubric, frozen requests and initially pending
ledger. Download it with **Save offline review packet**. The operator CLI below preserves original
returns, reconstructs coverage and prepares bounded synthesis. Its results are qualification
artifacts; they are not imported into the application as findings or suggestion provenance.

`evidence-segment-v1` / `segment-candidates-v1` permits only candidate quotations and roles for
each requested target, plus examined/unavailable acknowledgments. It cannot output a global
finding or policy silence. Quotes must exactly and unambiguously match the supplied core/context
and overlap the core. A candidate records its document, text hash, exact range, target and role.
Identical overlapping candidates share one identity while retaining every segment sighting and
rationale. Supporting, limiting and opposing roles remain distinct.

Each segment is pending, returned (not validated), validated, or failed. An invalid response is
preserved as returned with a validation error. An unavailable target still blocks that target,
even when the rest of the response validates. Retries append; they never erase earlier returns or
validated candidates. The latest attempt controls processing readiness. Earlier valid evidence
remains visible even if a later retry fails or omits it. At most three attempts per segment are
accepted; no retry is dispatched by this tool.

`evidence-synthesis-v1` / `segment-synthesis-v1` binds the exact attempt history and consumes all
retained candidates plus the entire range/dependency ledger. Every enabled measure or adopted
clause must acknowledge every required segment and candidate. Omitted candidates or ranges reject
the response. Missing captures, unresolved applicability, pending/failed/invalid segments and
unavailable required targets withhold the affected global result. Available evidence and the
original wire assessment remain separate from the server-derived unavailable result.

Confirmed silence requires complete applicable capture and validated examination of **all**
required ranges, with no retained candidate for that target. Supporting and opposing candidates
for the same target conservatively require an ambiguous/unavailable result and an actionable
human question; limiting evidence prevents an established result. This intentionally defers a
cross-segment contradiction to human interpretation instead of selecting one statement. Scope
and entailment errors can still pass structural checks: “validated” does not prove semantic
completeness, truthful role assignment or correct interpretation.

A synthesis becomes stale when another attempt is added. Historical synthesis bytes and their
original attempt count remain available and revalidate against that historical evidence snapshot.
They do not become current again through cache reuse or a model readiness claim. If all evidence
cannot fit the synthesis budget, preparation fails explicitly; no candidate is trimmed. A future
hierarchical synthesis strategy needs its own contract and acceptance tests.

## Offline operator workflow

Keep packets and outputs private, under `.local/` or another private directory. Save the current
packet and raw output before adding a return. Every output path is new; overwriting fails.

```sh
# Start from the packet downloaded from a long review's instruction preview.
npm run analysis:segments -- inspect .local/packet.json
npm run analysis:segments -- requests .local/packet.json .local/requests-new

# Record a returned local test output, preserving its exact original string.
npm run analysis:segments -- returned .local/packet.json s1 .local/s1-output.json .local/packet-1.json
# Or record an explicit failure; it cannot establish zero cost or remote cancellation.
npm run analysis:segments -- failed .local/packet-1.json s2 'Synthetic failed request' .local/packet-2.json

# Repeat with new packet names for every segment. Then prepare whole-set synthesis.
npm run analysis:segments -- synthesis-request .local/packet-final.json .local/synthesis-request.json
npm run analysis:segments -- synthesis-returned .local/packet-final.json .local/synthesis-output.json .local/packet-synthesized.json
npm run analysis:segments -- inspect .local/packet-synthesized.json
```

`capture INPUT OUT` also creates a packet from a local JSON object containing an explicitly adopted
`contract` and a v2 `sourceBundle` input. No CLI command calls a model or fetches a URL. Inspection
reports coverage, retained-candidate count, validation state and whether each synthesis is current.
A returned invalid output remains preserved; repair requires a new attempt. Paid-provider transport,
tokenizer checks, billing, refusal/cancellation handling and settlement are separate work.

## Bounds and version compatibility

| Boundary | Limit |
| --- | --- |
| Available documents / declared links | 8 / 16, including unavailable documents in the manifest |
| Total raw input | 128,000 UTF-16 units and 384 KiB UTF-8 |
| Canonical joined text | 128,000 UTF-16 units including inter-document separators |
| Core / boundary context / segment count | 8,000 / up to 400 each side / 24 |
| Serialized segment or synthesis request | 256 KiB; bytes also bound input for byte-tokenized adapters, which must additionally enforce actual provider context limits |
| Original output per attempt | 128 KiB; at most six candidates per target per segment |
| Attempts / syntheses per packet | 3 per segment / 3 synthesis returns |
| Capture HTTP request / captured bundle | 512 KiB / 480 KiB |
| Immutable source part / source manifest | Existing 128 KiB record cap each |
| Offline packet | 16 MiB; output files refuse overwrite |
| Finding / history / review detail | Unchanged: 64 KiB / 160 KiB / 4 MiB |

A maximum text length does not guarantee every metadata/rubric/evidence combination fits. Metadata,
JSON escaping, segmentation and synthesis can reach their own bounds first. Failures identify the
boundary; no text, target or evidence is silently dropped. Historical single-text and v1 bundle
capture requests retain their 128 KiB HTTP cap and 32,000-unit text limit.

Long reviews mark `sourceVersion: 3`, `evidenceVersion: 6`, and human saves use
`human-evidence-v5` / `findings-v6`. Installation archives require **schema 9**, even before the first
finding. Readers accept schemas 1–9; never relabel an archive for an older reader. Portable review
exports use `privacypal-source-bundle-v2` and remain archives rather than approval-restoring imports.
Direct browser reads/writes of source parts are denied for every role; staff/family projections
exclude source text, range acknowledgments and coverage.

Whole-installation backups preserve source parts, frozen plans, human acknowledgments, earlier
versions, receipts and ordinary suggestion jobs. **Offline packets and raw files saved outside
Firestore are separate operator artifacts and are not included in installation backups.** Preserve
them together separately; they contain source material. The two-cycle recovery rehearsal compares
every Firestore document and also checks the reconstructed long Unicode source, late exception,
partial acknowledgments, unavailable addendum and withheld score. File-round-trip tests separately
verify original offline responses and derived ledger reconstruction.

Provider qualification, direct application adoption of segmented model output, the remaining
36 precision definitions, independently
adjudicated labels and whole-policy cross-provider trials remain future work.
