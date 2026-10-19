# RUB-01 — Ownership and user-rights batch

- Worker: review_experience, reassigned after the first-wave implementation checkpoint.
- Baseline: original accepted `cb5bb04cde8d900f0376d11f5676369636845eae` source copy; prior UX changes
  remain in the isolated workspace. The frozen candidate canonical hash independently rechecked as
  `e8e01a94339fc4c5c8e44009cec4d7c9a878e95941374337691b01986dae3dc3`.
- Workspace: `/private/tmp/privacypal-wave1-0amrk031/ux`; its own installed dependencies.
- Outcome: non-author review complete; accepted as an offline proposal only and ready for sequential
  copy. No application adoption or human label adjudication.

## Result

Verified 36 remaining IDs and the requested `do_001`, `do_002`, `do_004` batch, with no inventory
mismatch. The proposal preserves their original question labels and IDs, defines seven clauses,
and supplies 31 authored provisional cases. The other 33 remaining IDs are outside this packet.
The new identity is `82d59137f2c498d6c623695c4c8b5502a6700cfe23a3a7d299ad327a29921110`.

Changed only the five assigned files:

- `docs/rubric-next.md`: mapping, semantic changes, ambiguous choices, independent challenge and
  human-adjudication packet, commands and limitations.
- `scripts/rubric-lab/next-candidate.ts`: separate versioned proposal, immutable input construction,
  bounded validation using unchanged shared requirement rules, and clause-by-clause grading.
- `scripts/rubric-lab/next-cases.ts`: 31 synthetic development examples, labeled reference outputs,
  label-free export and offline check/grade CLI. Export refuses overwrite.
- `test/unit/rubric-next.test.ts`: 38 focused inventory, boundary, mutation, preservation and export tests.
- `docs/parallel-work/reports/RUB-01.md`: this report.

## Contract and compatibility

No shared contract, source schema, scoring engine, setting, provider, authorization, storage or
publication behavior changes. Original weights and labels are untouched. The frozen candidate stays
unchanged; the new candidate is not registered for application adoption. No human finding or score is
written. No new dependency was installed for this assignment.

Silence is explicitly separate from opposition; missing source and unresolved scope withhold
assurance. Known adverse evidence survives another missing dependency. Exact quotation validation
does not establish entailment: the tests expose that limitation and grade the authored opposite-
polarity example separately. Public labeled cases are not a holdout, and agent review is not human
adjudication. Any future profile integration needs an explicit coordinator decision and broader tests.

## Evidence

All commands used Node 24 from the supplied runtime path in the isolated workspace. Tool output is
the evidence record. No runtime/browser/emulator/provider/account/backup operation occurred.

| Command or exercise | Result |
| --- | --- |
| Read remaining mapping and canonical hash probe | 36 remaining; assigned three present; frozen hash exact. |
| `node --import tsx scripts/rubric-lab/next-cases.ts check` | 31/31 authored reference cases consistent. No model run. |
| `node --import tsx --test test/unit/rubric-next.test.ts` | 38 passed. Tests include label-free temporary export and overwrite refusal. |
| `node --import tsx --test test/unit/rubric-next.test.ts test/unit/rubric-lab.test.ts test/unit/precision-adoption.test.ts` | 234 passed, including the frozen candidate and historical adoption/hash regressions. |
| `npm run typecheck` | Passed. |

The focused suite checks original ID/label preservation, fixed candidate identity, the six boundary
classes per measure, minimal pairs, missing-source/scope rejection, preserved known opposition,
fabricated/duplicate/omitted output, stale request identity, bounds, incorrect later clauses,
structurally valid false assurances, missing/repeated observations and unlabeled export fields.
Integration, build and source isolation for the assembled session remain coordinator checks.

## Review and integration

- Non-author reviewer: coordinator; reviewed all five files and found no blocking code defect.
  Accepted as an offline proposal only. Candidate identity and labels remain unchanged.
- Review critique retained for human adjudication: an explicit license end condition is a stricter
  normative choice than retained ownership, particularly for bounded exit/backup licenses;
  PDF/vendor-dependent format treatment as partial is a policy choice, not portability compliance;
  school-authorized scope does not answer direct parent/student rights or obstructive verification.
  The proposal already documents these limits; none was treated as resolved by agent agreement.
- Pending human decisions: adjudicate the seven clauses and all provisional labels, record exact
  version/hash, and construct a genuinely separate holdout. None are silently treated as approved.
- Suggested integration: review the five files, copy sequentially, run combined unit/TypeScript and
  source-isolation gates. No runtime change is needed.
- Follow-up: other 33 unrefined measures, independent labels, full-policy/provider trials, any future
  explicit application pilot. This report makes no claim about another wave or the browser gate.
