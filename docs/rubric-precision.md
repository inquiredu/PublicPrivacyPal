# Rubric precision candidate and adjudication packet

October 17, 2026. **Frozen proposal and provisional labels.** The subsequent
[precision pilot implementation](rubric-adoption.md) provides a separate explicit adoption path;
this packet and its labels remain the original proposal, not independently adjudicated gold data.
The original packet implements the offline portion
of step 3 in the [five-agent refinement](ai-analysis-refinement.md). It proposes explicit boundaries
for the 14 measures implicated by the semantic review, with 26 subrequirements and 91 authored
synthetic cases. It does not replace the installed PEF starter, recalculate reviews, or enable a
provider. The other 36 measures retain their existing definitions and have not been adjudicated.

The frozen executable definition is [precision-candidate.ts](../shared/rubrics/precision-candidate.ts),
re-exported by the laboratory [candidate.ts](../scripts/rubric-lab/candidate.ts); the concrete source
excerpts and provisional interpretations are [cases.ts](../scripts/rubric-lab/cases.ts). These labels
are proposals from this implementation, not human-approved gold labels or independent model results.
The original Gemini design remains acknowledged in [provider adoption](ai-provider-adoption.md).
The laboratory uses no Gemini-specific interface and can export inputs for any hosted or local system.

## Decisions proposed for adoption

The table records proposed district policy choices, not universal legal or technical requirements.
Each row preserves one existing measure ID and its eventual single measure weight. Subrequirements
explain a result; they do not create additional score weight.

| Measure | Proposed boundary | Concrete counterexample and candidate result |
| --- | --- | --- |
| `mon_001` sale | Permit corporate transfer only when equivalent protections continue. Evaluate notice and deletion separately under `gov_001`. Commercial sale is decisive opposition. | “No sale for money or other consideration; transfer only with equivalent protections” supports the sale prohibition. A prohibition on monetary sale alone is partial. |
| `gov_001` transfer governance | Separate continuity, advance notice and pre-transfer deletion choice. Explicit loss of protections defeats the measure; deficiencies in the other two clauses produce partial when continuity is established. | Protections continue, but notice and deletion occur only after transfer: **partial**, with both shortcomings retained. |
| `do_003` complete deletion | Separate active records from identifiable backups/copies. Finite retained copies are partial under the strict all-copy goal; indefinite identifiable retention is a decisive failure. | Active records deleted, backups kept 18 months: **partial**. Indefinite identifiable backups: **contradicted**. This candidate does not declare 18 months an acceptable retention period. |
| `do_005` deletion authority | In school-managed scope, require school authority plus a usable route. Parent requests routed through schools do not defeat this measure. Independent accounts need their own scope. | School administrator can use a deletion control; parents must contact the school: **supported** for the school route only. This deliberately narrows the old “school OR parent” wording. |
| `dr_003` termination | Separate automatic trigger, a numeric deadline from termination, and all-copy disposition. A required later request explicitly fails the automatic trigger. | “Delete within 30 days after the school requests it following termination”: **contradicted**, even though request-based deletion may satisfy another measure. |
| `sec_002` transit | Candidate accepted protocol set is TLS 1.2/1.3. Unspecified encryption/SSL terminology is partial; explicitly permitting SSLv2/v3 or TLS 1.0/1.1 fails. Future equivalents need a versioned decision. | “SSL encryption” is **partial**, not proof of an obsolete implementation. “Connections may use TLS 1.0” is **contradicted**. This is a candidate disclosure rule, not an implementation audit. |
| `sec_003` storage | Separate all-data/backup encryption coverage from a named algorithm. Remove the unverifiable “industry-standard” conclusion from extraction. | All stored data encrypted, algorithm unnamed: **partial**. A TLS-only statement supplies no at-rest evidence. Naming an algorithm does not certify its security. |
| `mon_002` advertising | Prohibit behavior/profile/personal-data-based ads. Allow context-only ads without those inputs under this particular criterion. | Lesson-context ads with no student data/profiles: **supported**. Student browsing-based ads: **contradicted**. This changes the old contextual-ads partial label. |
| `mon_004` tracking | Prohibition supports; explicitly bounded school-authorized educational tracking is partial; commercial/unrestricted cross-context tracking fails. | Cross-site lesson synchronization with commercial use prohibited: **partial**. An advertising prohibition alone establishes no tracking restriction. |
| `tp_001` recipients | Separate complete named recipients from their individual purposes. | Categories alone are **partial**. A referenced list absent from the supplied corpus makes the affected requirement **unresolved**, not silent. |
| `tp_006` governance | Separate names, equivalent contractual protection, and prior change notice. Explicit permission to omit equivalent contracts is decisive opposition. | Names and equivalent contracts established, notice timing unspecified: **partial**. Missing linked list leaves overall readiness unresolved while known protections remain visible. |
| `child_002` consent assertions | Extract the described prior parent verification or school authorization mechanism, educational-use boundary, and parent information/review route. Do not determine legal sufficiency. | A bare COPPA compliance claim is **partial** for the mechanism. “School official” alone is not a COPPA consent mechanism. |
| `ed_002` FERPA assertions | Separate stated FERPA commitment and asserted school-directed role. A policy assertion cannot establish an executed agreement or legal eligibility. | Both assertions present: **supported as policy assertions**, even when the text says it is not a signed district agreement. Agreement confirmation remains a separate human fact. |
| `ed_003` educational purpose | Permit providing/improving the contracted educational service. A broad improvement clause is partial; unrelated commercial reuse fails. | “May improve our products” without limits: **partial**. Development of unrelated commercial products using student personal information: **contradicted**. |

The consent/role separation is supported by the FTC's distinction between educational school
authorization and other commercial purposes, and by the Department of Education's description of
conditions for the FERPA school-official exception. The latter includes school control and restrictions
on use/redisclosure; a vendor's role statement cannot establish those conditions by itself.
Sources checked October 17, 2026: [FTC COPPA FAQs, section N](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions)
and [Department of Education online-tool guidance](https://studentprivacy.ed.gov/faq/i-want-use-online-tool-or-application-part-my-course-however-i-am-worried-it-violation-ferpa).
The FTC FAQ flags the 2025 amendment; current requirements must be reviewed from the
[rule materials](https://www.ftc.gov/legal-library/browse/rules/childrens-online-privacy-protection-rule-coppa)
for an actual legal review. This packet defines observable assertions, not a legal checklist.

## Deterministic interpretation rules

Every requirement has an explicit proposition, a defined limitation, an opposing condition and a
flag indicating whether explicit opposition defeats the whole measure. Evidence availability is a
separate experiment-owned manifest; the model cannot certify source completeness. The manifest in
this laboratory is authored for tiny synthetic cases. Production source-bundle coverage is step 4,
not implemented by this packet.

The model returns requirement facts: `established`, `limited`, `opposed`, `not_stated`, `ambiguous`
or `unavailable`, exact quotations with roles, brief rationales and unresolved questions. The runner
derives the measure state in this order:

1. Any missing required dependency, ambiguous requirement or unresolved scope yields **unresolved**.
   Known decisive failures remain in `establishedFailures`; they are not erased by missing evidence.
2. Explicit opposition to a decisive requirement yields **contradicted**. If every requirement is
   opposed or silent and at least one is opposed, the result is also contradicted.
3. All requirements established yields **supported**.
4. All requirements silent in a complete declared corpus yields **not_addressed**.
5. Remaining resolved combinations yield **partial**, including defined limitations and established
   protections with missing ancillary statements.

Thus silence is not automatically a contradiction, and a known failure need not carry artificial
uncertainty. Unavailable evidence cannot become silence. School/adult or jurisdiction distinctions
must be preserved; unresolved applicability blocks an overall assurance. The runner does not infer
scope from words or prove quote relevance. It enforces structure and computes from supplied facts.

The schema rejects extra authority fields, invented or duplicate requirements, wrong request identity,
inexact/ambiguous quotations and incompatible manifest claims. Clear support/limitation/opposition
requires a matching evidence role. Deliberately wrong-polarity and irrelevant exact quotes can still
pass structural validation; semantic fixture grading catches the authored examples. This limitation
is explicitly tested and must not be described as general semantic validation.

## What is tested and how to use another system

There are six boundary cases for every candidate measure: positive, limited, adverse, silent,
missing dependency and unresolved scope (84 cases). Seven contrasts cover post-transfer notice,
transit versus storage, ads versus tracking, separate adult accounts, parent requests through schools,
legal assertions versus signed agreements, and contradictory tracking clauses.

With Node 24 and the installed repository dependencies:

```sh
npm run rubric:lab -- check
npm run rubric:lab -- export new-rubric-inputs.jsonl
npm run rubric:lab -- grade first-attempt-observations.jsonl
```

`check` verifies authored reference outputs against the rules. It is not a model evaluation.
`export` writes a new file only, without expected labels or outcome-revealing case IDs. Every input
contains instructions, scope, candidate definition, coverage manifest, source, JSON Schema and an
immutable request hash covering those fields. It does not call a provider. Use the instructions as
the system/developer instruction your system supports, and the input as untrusted reference data.
Use native structured output when available; otherwise require JSON and validate it here. Do not
weaken the evidence contract to accommodate an unsupported provider feature.

Save each returned object unchanged in one JSONL line:

```json
{"caseId":"rubric-001","output":{"requestId":"<copy from input>","scopeStatus":"matched","scopeQuestion":"","requirements":[{"id":"sale","status":"established","rationale":"Brief policy interpretation.","question":"","quotes":[{"quote":"<exact source text>","role":"support"}]}]}}
```

Preserve first attempts separately from corrections and repeated runs. Record provider/model/settings
and usage outside these observations. The current runner does not measure latency, price or model
quality. Its report checks **every** requirement's state and required evidence, as well as aggregate
state and scope. Missing/invalid cases remain failures; unknown/duplicate case IDs are rejected.
The pre-existing 40-case `analysis:eval` grader now explicitly rejects multi-measure cases rather than
silently grading their first finding. Its existing single-measure cases retain their behavior.

## Adoption and the remaining rubric

The candidate has a distinct version and content hash and is imported only by laboratory scripts and
tests. No application settings, evaluation contracts, saved findings, provider requests, scoring engines,
review UI or stored records adopt it. No migration or emulator restart is needed for this increment.

For the next implementation, the owner must adjudicate the choices in the decision table and the
91 provisional examples. Record accepted/amended boundaries, reviewer, date and the exact candidate
hash. Changes produce a new candidate version and revised cases; retain the old packet/results.
Implementation then adds an explicitly selectable immutable definition/profile version, request/schema
version and compatible historical reader. Do not overwrite `pef-2.0-snapshot-v1` or silently map its
old output onto new subrequirements. Old reviews retain their exact definitions and arithmetic.

Adoption must continue to count each existing measure once at its selected area weight. A proposed
mapping is supported → yes, partial → partial, contradicted → no, confirmed silence → not_specified,
and unresolved → unresolved with aggregate score withheld. The selected scoring engine continues to
control numeric credit, including silence credit. Subrequirement counts do not change the denominator.
There is no new numeric score in this laboratory. Before integration, verify mixed old/new snapshots,
new human review/provenance, changed-definition cache fencing and backup/restore with synthetic data.

The remaining 36 measures are **not precision-reviewed** by this increment:

| Area | Measures retained for later definition review | Known boundary to address |
| --- | --- | --- |
| Collection | `dc_001`–`dc_006` | Exhaustiveness, sensitive-category scope and minimization standards. |
| Ownership | `do_001`, `do_002`, `do_004` | Ownership versus license, export formats, amendment routes. |
| Retention | `dr_001`, `dr_002` | Exact district-adopted retention thresholds versus vague necessity. |
| Security | `sec_001`, `sec_004`–`sec_006` | Disclosure versus operation, password policy, SSO/MFA availability versus enforcement. |
| Third parties | `tp_002`–`tp_005` | Per-recipient data, essential sharing, contract coverage and change notice. |
| Monetization | `mon_003`, `mon_005`, `mon_006` | Third-party ad tracking, commercial profiles and tracker-list completeness. |
| Children | `child_001`, `child_003`–`child_005` | Age enforcement, bundled child protections, audience and re-identification. |
| Breach | `breach_001`, `breach_002` | Recipients, confirmation trigger and a district-selected deadline; no universal 72-hour assumption. |
| Transparency | `trans_001`–`trans_004` | Readability judgments, actionable contact and advance change/opt-out rules. |
| Education | `ed_001`, `ed_004` | Education-specific terms and policy evidence versus actual product/marketing design. |
| Governance | `gov_002`, `gov_003` | Direct audit rights versus certification, and mining versus general commercial-use terms. |

After owner adjudication and integration, continue with bounded source bundles and per-requirement
coverage. A full 50-measure benchmark, independent human labels, provider qualification and measured
costs remain later gates. Passing this synthetic consistency pack does not establish any of them.

## Verification of this increment

`npm run ci` passed on the isolated Node 24 validation copy: **226 unit/isolation tests**, TypeScript,
production build and bundle checks. That count includes the 91 provisional boundary fixtures; it is
not 226 independent policy judgments. The actual workspace isolation scan passed for 144 source files,
and `git diff --check` passed. The CLI exported 91 unlabeled inputs, refused to overwrite the export,
and graded all 91 authored reference outputs consistently. All relative links in this packet
resolve. Local logs, exported inputs, reference observations and source hashes are retained under
`.local/validation/rubric-precision/` and are not release artifacts.

This increment changes offline laboratory/benchmark tooling and documentation only. Authorization,
stored records, backup format, review UI and provider dispatch are unchanged; emulator integration,
recovery and browser tests were not repeated. No new model inference or vendor-policy assessment
was run. Existing application verification remains documented in [review context](review-context.md).
