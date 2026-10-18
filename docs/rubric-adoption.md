# Precision rubric pilot

October 17, 2026. The owner's continuation authorizes a separately selectable implementation of
the [precision candidate](rubric-precision.md). It does not establish independent human labels
or model accuracy. The default remains PEF 2.0. Existing reviews retain their original definitions,
scores, suggestions and history; there is no bulk adoption or rescoring.

## Select and review

1. In **Settings**, select **PEF precision pilot v1 — 14 refined measures** and save the rubric.
   Review the displayed boundaries and district priorities. The pilot retains all 50 measure IDs
   and weights; 14 measures use 26 explicit subrequirements, and 36 keep their existing definitions.
2. Create a new pasted-policy review and choose **Saved district rubric (50 measures) — precision
   pilot v1**. This explicitly adopts the current settings revision. A stale revision is rejected.
   The eight-measure practice profile and previously saved reviews remain separate.
3. Inspect a suggestion or open the manual evidence editor. For a refined measure, review the
   school-use scope, source readiness, and every clause's assessment and rationale. Assign exact
   passages as support, limitation, opposition or conflict. An unanswered clause or scope question
   keeps the finding unresolved. The aggregate finding is calculated and cannot be overridden.
4. Save the human finding. Drafts retain empty or unfinished fields across navigation/reload in the
   same tab. Validation errors retain the draft. Original suggested clauses remain visible beside
   the human correction; they cannot be supplied or replaced by the browser.

The bundled fictional Cedar policy has a dedicated recording for this profile. It illustrates
partial deletion, unspecified termination commitments and restricted school-use scope. It is a
deterministic demonstration, not a fresh model assessment of that policy. General model dispatch
remains disabled, and no provider credentials are required.

## Shared decision rules

Each clause is `established`, `limited`, `opposed`, `not_stated`, `ambiguous` or `unavailable`.
Established, limited and opposed clauses require evidence with the corresponding role. Ambiguity
requires quoted text and a question; unavailable evidence requires a question. Confirmed silence
has no quotation and is only resolved when the supplied source and applicable scope are usable.

The server and laboratory use the same aggregation function:

- Missing required evidence, ambiguous/unavailable clauses or unresolved scope withhold the result.
  Known adverse clauses remain recorded even when another clause is unavailable.
- A decisive opposed clause, or an entirely opposed/silent set with at least one opposition,
  contradicts the measure.
- All established clauses support it; all silent clauses produce not addressed; other resolved
  combinations produce partial.

Subrequirements do not add score weight. An unresolved measure retains its full denominator,
has null awarded points, and withholds the aggregate score, decision and publication. Resolved
measures continue to use their adopted scoring engine. Editing published evidence withdraws the
audience projections atomically. Prior evaluation versions remain unchanged.

## Versioned contract and compatibility

The profile is `pef-precision-v1`; its version-2 evaluation contract contains the immutable
`pef-precision-snapshot-v1` definition. Settings history, full adopted clauses, priorities and
source determine the definition/request hashes. The frozen candidate's historical metadata remains
`proposed-not-adopted`; application adoption is recorded by this separate profile and each review's
contract, not by rewriting the laboratory artifact.

Precision requests use `evidence-extraction-v3` / `policy-suggestions-v3`. The model supplies clause
interpretations and evidence roles for the 14 refined measures, with no aggregate-state field.
The other 36 retain the ordinary finding shape. Runtime validation requires every enabled measure
and every adopted clause exactly once, exact quotations, valid role/state combinations, and
questions for unresolved work. A citation pool is shared across measures. Stored results preserve
the wire schema and are revalidated on read; server-derived aggregate states cannot masquerade as
model-authored output. There is no free-form model summary in v3.

Old profiles continue to use prompt/schema v2, and historical v1/v2 results remain readable with
their original identities. Explicitly requesting an older prompt for the precision profile fails.
Adapter authors must support the requested version or reject before dispatch. See
[adapting any AI system](ai-provider-adoption.md).

Human precision saves use `human-evidence-v3` / `findings-v4` and `requirements-v1`. The review head
uses `evidenceVersion: 4`. Findings store the human clauses and a separately verified original
proposal when one exists. Settings adoption, including adoption later reverted in settings history,
requires whole-installation backup **schema 7**. Current readers accept earlier compatible archives;
older builds must not read schema-7 data. Portable district exports include the clauses as archives
and cannot import an approval or adopted rubric into a fresh review.

Bounds remain 64 KiB per finding, 160 KiB per history event, 4 MiB per assembled detail and 64 MiB
per installation backup. Each clause allows three quotations; the editor's shared passage pool
allows nine. The ordinary finding's top-level citations remain capped at three. Nested clause
evidence preserves all assigned passages. Existing text and request byte limits still apply.

## Verification and remaining work

The candidate hash remains
`e8e01a94339fc4c5c8e44009cec4d7c9a878e95941374337691b01986dae3dc3`.
All 91 authored cases now pass through the application v3 validator, persisted-output round trip,
human-save validation and deterministic outcome derivation. Frozen legacy definition/request hashes
guard historical identity. These checks establish implementation consistency against provisional
labels, not independent semantic accuracy.

The full check includes 325 unit/isolation tests, TypeScript and production bundle checks,
155 emulator integration tests, and two full backup/restore cycles. Integration covers mixed
old/new reviews, forged aggregates/proposals, replay/cache, role boundaries and withdrawal of
publication after an unresolved correction. Recovery compares every stored document, including
clause questions and original proposals. No live inference or district changes were used.

The next milestone is bounded source bundles and a server-owned coverage ledger. Today source
readiness is still an interpretation of one saved text; it cannot prove that all applicable linked
policies, addenda or account terms were supplied. The remaining 36 measures, independently
adjudicated labels, whole-policy provider trials and transport/billing qualification remain open.
