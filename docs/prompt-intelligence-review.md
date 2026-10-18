# Prompt intelligence and service UX — initial source review

Reviewed October 16, 2026 when resuming the parked development session. This records source
findings and a proposed next increment, not implemented AI behavior or a legal assessment.
The application remains emulator-only. No provider calls or vendor fetching were enabled.

## Examined path

The reference is the local archived original at
`adad00a05e67bf9ea88d145cf2e0a1100ec27889`. It was read without running the app or its scripts.
The relevant original files are `services/geminiService.ts`, `services/toolResolution.ts`,
`components/ToolCard.tsx`, and `components/ToolDetailView.tsx`.

`buildAnalysisPrompt` combines immutable-input candidates: policy text and URL, tool/agreement
context, sector, selected law descriptions, evaluation standards, custom guidelines, mission,
and strategic plan. The original model response includes 50 policy characteristics, quotations,
summary, education context, data categories, age/grade/curriculum suggestions, tier/support
suggestions, law assessments and an approximate score. Post-processing evaluates characteristics
against the rubric and replaces that score when deterministic calculation succeeds. Cards show
the resulting tier/score and source-quality warnings; detail exposes the summary, classifications,
rubric findings and law assessments. Human overrides are stored separately and reapplied.

Current PublicPrivacyPal has adopted, versioned evaluation context, exact citations, deterministic
scoring, immutable service facts and independent decisions. `server/synthetic-analysis.ts` only
recognizes bundled fixtures; pasted sources require manual evidence review. The original generated
insights are not implemented by the restored four-tab interface.

## Insight ownership and proposed presentation

| Displayed information | Origin and authority | Proposed destination |
| --- | --- | --- |
| Policy wording and source scope | Immutable captured source; exact quotation verifies location, not interpretation | Overview source section and linked Compliance quotations |
| Characteristic findings, contradictions and omissions | AI suggestions when enabled; human confirmation/correction remains explicit | Compliance, with separate suggested, reviewed and unresolved states |
| Plain-language explanation and unresolved questions | Cited interpretation; absence of a model result is an extraction problem | Overview summary and next actions, with links to supporting findings |
| Evidence score and coverage | Versioned deterministic engine and explicit counts | Card and detail header, separate from approval |
| Education version, age, data categories and curriculum | Source-backed suggestions or explicit unknowns; attributed district corrections | Overview / Classification with provenance and supporting evidence |
| Tier, support, grades and conditions for use | District choices, informed by evidence and adopted requirements | Card summary / Classification; model suggestions cannot set approval |
| DPA, rostering and requirement confirmations | Attributed district facts and versioned policy checks | Overview blockers and Publish & Documents controls |
| Decision and public wording | Human decision bound to current evaluation and service version | Publish & Documents with the existing exact audience previews |
| Publication | Acknowledged atomic saved state | One consistent badge and actual audience listing |
| Law references | Adopted district context; generated interpretation requires a separately reviewed contract | Compliance context; no score-derived legal certification |

## Useful behavior to retain and issues to correct

- Retain the shared prompt builder and inspectable context, conservative source-only extraction,
  separate machine suggestions/human overrides, and visible source limitations. Generate the
  prompt from the adopted contract rather than a second hardcoded list of 50 measures.
- Original missing characteristic IDs are backfilled as `not_specified` with a note saying the
  policy was silent (`geminiService.ts`, characteristic conversion after response validation).
  Keep incomplete model output distinct from a reviewed omission. Reject invalid sets or retain
  them as incomplete suggestions; never count them as completed human review.
- The original deterministic calculation catch sets `rubricFallback` and leaves an AI score.
  A scoring failure should leave the evaluation incomplete with an actionable error. It must not
  substitute a model estimate for the established scoring contract.
- Original law cross-validation upgrades `non-compliant` to `compliant` when at least 70% of mapped
  rubric results meet their criteria. Remove this inference from the proposed contract. A rubric
  percentage is not a legal determination. Match adopted references by stable ID, not name tokens.
- The prompt demands source-only analysis but also asks it to search for an education policy and
  assign district tier/support. Limit suggestions to supplied source scope, represent unknowns,
  and keep district adoption/support facts human-owned. A newly found source needs explicit capture.
- Preserve distinct unknown states. The original response requires binary education-version and
  copyright signals and a narrow age enum; these cannot faithfully represent every missing-source
  case. Missing information must not become an affirmative permission claim.
- Preserve corrections across future suggestions, including the prior and new machine values.
  A new analysis must not overwrite district conditions or revive an earlier publication.

## Next concrete increment

The owner's subsequent request prioritizes the prompt infrastructure. The implementation sequence
is now proposed in [AI analysis modernization](ai-analysis-plan.md): evaluation cases and output
contract first, then reliable jobs, provider comparison and the service UX below.

Refine the existing Cedar complete-service experience with synthetic data. The card should answer
which service this is, the district decision and publication state, who may use it, evidence review
progress, and the most useful next action. Overview should lead with a concise explanation,
requirements and unresolved questions; the other three tabs retain their established responsibilities.
Distinguish source evidence, AI suggestions, calculation and district decisions in wording and layout.

Before enabling any provider, define a server-owned, versioned prompt/output envelope bound to source
hash, adopted context, rubric, prompt/schema/model version and job attempt. Validate known unique
measure IDs, exact citation offsets, sizes and uncertainty. Store suggestions separately from human
corrections. Specify job deadlines, leases, cancellation, retry classification and cost limits before
connecting inference. No provider or operating budget has been selected in this session.

Synthetic acceptance should include explicit commitments, silence, exceptions/contradictions,
unreadable/incomplete source, injected source instructions, duplicate/missing measure IDs, invented
quotes, malformed/truncated responses, scoring failure, interrupted retries and a late result after a
human correction. Existing draft, version, authorization and atomic-publication guarantees remain
acceptance requirements. These are proposed cases, not new test results.
