# Ownership and user-rights precision proposal

October 18, 2026. **Provisional proposal; no application adoption or independently adjudicated labels.**
This batch covers only `do_001`, `do_002` and `do_004`. It preserves their original IDs and question
labels from [the reviewed starter mapping](../shared/settings/pef-example.json). It introduces no
weights, scores, settings option, provider call, migration or saved-record change.

The [frozen 14-measure candidate](../shared/rubrics/precision-candidate.ts) remains exactly
`e8e01a94339fc4c5c8e44009cec4d7c9a878e95941374337691b01986dae3dc3`. The remaining-measure inventory in
[rubric precision](rubric-precision.md) contains 36 IDs and includes this exact three-ID batch.
The other 33 are outside this proposal. None of those 36 becomes adopted through this packet.

The new laboratory definition is [next-candidate.ts](../scripts/rubric-lab/next-candidate.ts), version
`ownership-precision-proposal-v1`, identity
`82d59137f2c498d6c623695c4c8b5502a6700cfe23a3a7d299ad327a29921110`.
Its seven clauses and 31 authored examples are separate from the existing 91-case frozen packet.
[next-cases.ts](../scripts/rubric-lab/next-cases.ts) contains the provisional labels and reference
outputs. Those outputs demonstrate deterministic consistency; they are not model responses.

## Mapping and proposed boundaries

The scope is policy assertions for school-managed accounts, identifiable student records and student
work, with requests by authorized school staff. Provider software/IP and clearly separate adult
accounts are different scopes. Claimed de-identification alone cannot establish that data is outside
scope; uncertain identifiability remains unresolved. Ownership language does not establish actual
legal title, and a policy process does not demonstrate that the vendor operates it successfully.

| Existing measure and inherited ambiguity | Proposed clauses | Proposed resolved boundary |
| --- | --- | --- |
| `do_001` — “Does the policy clearly state that users/schools retain ownership of their data?” Inherited text mixes ownership with broad/perpetual license rights. | `ownership`: retained school/user ownership; `license`: service-operation purpose and end condition. Both have decisive opposition. | Support requires both. An ownership assertion without licensing terms is partial. A stated service license with unspecified duration is partial. Provider ownership or a perpetual/irrevocable license over in-scope data contradicts the measure. Uncertain analytics scope or unresolved conflicting ownership text withholds the result. |
| `do_002` — “Can users access and export their data?” Inherited negative wording includes absent rights and does not define portability. | `access`: usable inspection route; `export`: usable route to an external copy; `format`: disclosed structured format usable independently. Access/export refusal is decisive; format opposition is not. | Support requires all three. PDF-only, an unspecified format, or an expressly vendor-dependent format is partial when inspection and an external copy are otherwise established. Explicit refusal of access or any external copy contradicts the measure. A viewing right alone does not establish export. |
| `do_004` — “Can users correct or amend inaccurate data?” Inherited wording mixes a right with a route and treats missing amendment wording as negative. | `amendment`: ability to seek correction of factual inaccuracies across the in-scope records; `route`: a usable control or specific contact. Both have decisive opposition. | Support requires both. Profile-only edits or generic “contact support” without a route is partial. An express refusal of correction requests is opposition. Verification of an authorized requester does not itself negate the route. Deletion rights supply no correction evidence. |

Every clause has executable proposition, limitation, opposition and decisive-flag fields. A school
may route a parent's request through authorized staff within this scope; this does not assess direct
parent access, eligibility under a law, an executed agreement or district permission. Existing source
tags such as FERPA in the inherited mapping are provenance, not a legal finding from this proposal.

## Silence, dependencies and aggregation

This laboratory reuses the existing `deriveRequirements` and requirement-review validation without
changing them. Missing required source, unresolved scope or ambiguous meaning yields unresolved.
Known opposing clauses remain in `establishedFailures` even when another source is missing. Otherwise,
decisive opposition contradicts; all established supports; all silent in the complete declared set
is not addressed; other resolved combinations are partial. Subrequirements never add measure weight.

The shift from inherited “no rights mentioned” negative wording to explicit silence is a **proposed
semantic change**, not a change to an old review. This packet does not calculate points or select
between existing scoring engines. Any future adoption needs a new explicit definition and its own
historical-read, source-coverage and scoring review.

The coverage manifest is authored for each tiny synthetic example. It is not automatic document
discovery or real-world completeness verification. A model cannot turn a missing dependency into
silence or invent a missing dependency. Complete applicable source is necessary for silence, but
even a complete declared set does not prove that the reviewer found every relevant vendor document.

## Cases and executable checks

Each measure has positive, limited, adverse, silent, missing-dependency and unresolved-scope cases
(18 total). Thirteen contrasts cover ownership without licensing, provider IP, uncertain analytics,
conflicting ownership, known opposition with missing terms, viewing without export, an export promise
without a usable route, vendor-dependent formats, explicit export refusal, a school route for parents,
deletion without correction, requester verification and profile-only edits.

The main minimal pairs retain scope and every unaffected clause while changing the license end
condition, CSV to PDF, or a supplied correction contact to an unspecified support route. Every clause
and expected quote is graded, including wrong interpretations that leave the aggregate partial.
Missing/invalid observations remain visible; repeated observations must be stored as separate runs.

With Node 24 and repository dependencies installed:

```sh
node --import tsx --test test/unit/rubric-next.test.ts
node --import tsx scripts/rubric-lab/next-cases.ts check
# Use a new filename in an existing private directory; export refuses overwrite.
node --import tsx scripts/rubric-lab/next-cases.ts export .local/ownership-inputs.jsonl
node --import tsx scripts/rubric-lab/next-cases.ts grade .local/ownership-observations.jsonl
```

An observation is `{ "caseId": "<opaque exported ID>", "output": { ...returned JSON... } }` on one
JSONL line. Preserve first outputs separately from corrections. Export includes instructions,
definition, declared scope, source, coverage, schema and immutable request ID. It excludes category,
expected labels and reference output. Only send that export to an evaluation system; supplying this
document or the labeled case source would expose the proposed answers. There is no dispatch code.

Requests retain the existing 32,000-character source bound. An output is capped at 64 KiB, each clause
at three exact unique quotations, and CLI observations at 4 MiB. The definition and request identities
change with semantic inputs; the frozen candidate is checked before each request. Exact quotation
checks enforce location, not entailment. A test deliberately flips an opposing quote to a support
claim: structural validation accepts it, while the authored semantic expectation flags a false
assurance. This is a demonstrated limit, not a claim of semantic validation.

## Independent challenge and human adjudication packet

The coordinator completed a non-author review of all five RUB-01 files and accepted them as an
offline proposal only, with no blocking code defect found. The review retained the license end
condition as a stricter normative choice, the PDF/vendor-dependent format treatment as a policy
choice rather than portability compliance, and school-authorized scope as insufficient to answer
direct parent/student rights or obstructive verification. These remain unresolved human decisions.
The adjudication questions are:

1. Should the license need an explicit end condition, or should a purpose-limited service license
   with unspecified duration be supported? The proposal chooses partial. Clarify bounded backups,
   exit assistance and narrow irrevocability language without importing deletion requirements.
2. Should vendor-dependent export be a decisive failure rather than partial? The proposal retains
   inspection and external-copy rights as useful facts. CSV/JSON are examples, not a required format
   whitelist; challenge equivalent formats, binary attachments, fees, timelines and data exclusions.
3. Is school-authorized scope appropriate for these broadly worded measures? Evaluate direct parent
   and student rights separately. Challenge inaccessible verification, indefinite discretion, grade
   disputes versus factual errors, and whether every record category needs the same amendment route.
4. Challenge whether the seven clauses miss a relevant distinction or double-count neighboring
   deletion/retention measures. The three IDs retain one weight each in any future adoption.

For qualified human adjudication, retain candidate and request hashes; give two reviewers the
unlabeled exported source/scope/coverage packet first. Record each reviewer's clause status, exact
evidence, scope judgment, missing-source question, confidence, rationale and date independently.
Then compare the provisional labels and reconcile disagreements in a dated decision record. Record
accepted/amended/rejected boundaries separately from per-case interpretations. The chosen district
policy owner must approve the normative choices; technical agent agreement is insufficient.

These public development examples are **not a holdout**. A separate reviewer must create new challenge
cases without viewing the proposed labels, then keep their labels outside the inputs given to the
system being evaluated. Preserve failures, refusals, revisions and first-attempt outputs. Broader
policy examples, independent labels and provider trials remain future work. No human adjudication,
model-quality result or district policy acceptance has occurred here.

## Compatibility and evidence

No application module imports this proposal. Default Settings, the 14-measure pilot, all previous
labels, weights, prompt identities and scoring rules remain unchanged. No runtime, browser, emulator,
provider, backup or stored-record operation was used for this assignment. The current UX/browser
follow-up is separate and is not claimed complete by this packet.

Observed worker checks: 38 focused tests, 31 authored reference cases and TypeScript passed in the
isolated RUB-01 workspace. Non-author acceptance is limited to this offline proposal; sequential
copy and assembled-session validation remain coordinator work. The disposition is recorded in
[RUB-01 report](parallel-work/reports/RUB-01.md). These are bounded consistency results, not release,
full-rubric precision, production safety or legal-compliance evidence.
