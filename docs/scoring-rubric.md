# Scoring rubric review

This is a technical review and a candidate rubric for a **synthetic local trial**. No district has
approved this profile for real vendor evaluations. The eight criteria cover selected policy
statements; they do not cover every contractual, accessibility, instructional, security or legal
question a district may need to answer. Source text is not proof of a vendor's actual practices.

## Review finding and version choice

The inherited formula gives an absent statement 60% credit and a partial statement 50%. A policy
can therefore improve its score by removing a partial commitment. That is an undesirable incentive
for an evidence-based comparison. Existing results are preserved under `community-demo-v1` and
`upstream-weighted-v1`; the new candidate is separately versioned as `community-evidence-v1` and
`evidence-weighted-v1`. New reviews default to the candidate and may explicitly select the inherited
profile for comparison. Neither score authorizes publication.

| Finding | Candidate credit | Inherited credit | Evidence requirement |
| --- | ---: | ---: | --- |
| Meets | 100% | 100% | Exact cited statement meets the criterion's scope. |
| Partial | 50% | 50% | Exact cited statement supports only part of that scope. |
| Not addressed | 0% | 60% | No statement; no invented quote or offsets. |
| Does not meet | 0% | 0% | Exact cited statement contradicts the criterion. |
| Not applicable | Excluded | Excluded | Engine support only; the local adapter cannot select this. |

Missing evidence and an explicit contradiction remain different findings even when they earn the
same points. Reviewers must inspect both. The calculation is `round(100 × earned / possible)` once
after summing all criteria, with maximum points `3 × weight` per applicable criterion. Invalid,
duplicate, non-finite or overflowing inputs fail. An empty applicable set returns zero, not approval.

The same fictional policy with four cited statements scores **66 inherited / 36 candidate**. Its
statements, source hash and citation coverage are identical. The complete fixture scores 100 in both.
This difference is a policy choice, not an improvement in extraction accuracy.

## Criteria for district review

The exact evidence, partial-credit and contradiction guidance is defined in
`shared/scoring/profiles.ts` and displayed under **Policy reviews → Review the scoring rubric**.

| Criterion | Weight | Full-credit statement |
| --- | ---: | --- |
| Collection | 2 | Identifies categories of student information collected. |
| Purpose | 2 | Limits use to delivering the learning service. |
| Sale | 2 | Prohibits selling student information. |
| Deletion | 2 | Lets a school request deletion of student information. |
| Security | 2 | Describes concrete safeguards for storage, transmission and access. |
| Sharing | 2 | Restricts service-provider access to delivering the service. |
| Contact | 1 | Provides an actionable privacy contact. |
| Changes | 1 | Gives schools notice before material privacy changes take effect. |

Weights express this candidate's priorities, not legal severity. All positive commitments must
have quotations matching the source exactly. The bundled adapter recognizes only authored fixtures;
it does not resolve contradictory clauses, judge vague real policies or perform legal analysis.

## Version and decision guarantees

- The server validates and pins the selected profile when creating a review. Retries and new
  analyses of that review keep the same profile. Start a separate review to compare profiles.
- Records predating the profile field use the inherited profile. No background rescore occurs.
- Exports include the profile; imports recompute a new draft using the declared supported profile.
  Older draft exports without a profile use the current default and still require a new decision.
- The stored analysis keeps its profile and engine versions. Unknown versions are rejected.
- A human decision, rationale and any conditions remain separate. No score threshold approves,
  declines, publishes or waives a missing criterion.
- A future change to criterion meaning, weights, finding mapping, credits or exclusions needs a
  new version and regression cases; do not edit the meaning of a published profile in place.

## Remaining human review before a real pilot

An adopting district needs to name the owner and reviewers of its policy profile, decide which
criteria require mandatory follow-up regardless of total score, review the weights and evidence
definitions, add jurisdiction/contract requirements, and record the adopted version and date.
Test those decisions on new synthetic edge cases, including conflicting statements and exceptions.
There is no recorded district sign-off yet. The software tests validate arithmetic, provenance and
workflow boundaries; they cannot supply that approval.
