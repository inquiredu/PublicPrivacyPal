# Request dashboard restoration — October 22, 2026

Development checkpoint on `codex/coordinated-milestone-2026-10-19`, following `a3d85ac`.
Dashboard totals, reviewer attention and requester outcomes link into dedicated Requests / My Requests
queues and selected request details. Counts cover the complete bounded request inventory, filtering
before pagination and respecting each audience's archive. Errors show unavailable; no partial totals.
See [request workflow](docs/request-workflow.md#request-dashboard--october-22).
Review/publication summaries, review-specific attention and tier distributions remain pending.
DPA automation, original project changes, main changes and deployment remain excluded.

Validation: `npm run ci` passed in this checkout (550 tests, typecheck/build/isolation).
`npm run test:integration` passed (238 tests) in `/private/tmp/privacypal-request-validation`
after the synced-folder launcher stalled before emulator startup. All 185 executable/config/test
files compared identically with the working checkout. Final role-change queue fallback passed
fresh typecheck/build. Browser checks verified keyboard attention-row navigation and selected-detail
focus, matching Decided queue, and request draft retention across dashboard navigation. Independent
multi-role browser and assistive-technology acceptance remain pending. Screenshot `.local/request-dashboard.png`.

The synthetic preview is restored and running at port 5173 from the validation copy. No request
records were changed by the browser smoke check. Its pre-test backup was saved/verified and copied
to this checkout at `.local/backups/2026-10-22T19-57-33-169Z-0ae16a02-b23a-4562-b3cb-1d1a854c5624`.
Save/verify before stopping the owned preview. Logs are `.local/dashboard-ci.log` and
`.local/dashboard-integration.log`; private artifacts remain untracked.

---

# Explicit public policy links — October 22, 2026

The normal publication projection now allowlists a safe saved service `policyUrl`. Both the public
notice and reviewer audience preview display it with a new-tab label and `noopener noreferrer`.
Existing public records remain unchanged until explicit republishing. No private review lookup,
URL guessing, fetching or DPA automation is added. The service form explains publication visibility.
See [service detail](docs/service-detail.md#public-vendor-policy-link).

Validation passed in the matching local source copy: `npm run ci` (548 tests, typecheck, build and
isolation), `npm run test:integration` (236 tests), and focused missing-URL/no-private-fallback tests.
The anonymous browser notice shows the policy link after an explicit normal publish command for
the existing synthetic Cedar Browser QA review; all other public entries were verified unchanged.
No external URL was fetched. Screenshot: `.local/public-policy-link.png`.

The running preview remains `/private/tmp/privacypal-request-validation` at port 5173. Its latest
verified schema-11 backup is `.local/backups/2026-10-22T19-35-04-646Z-14c2fc1c-96b9-4af6-bcc2-2f5ea4f3f182`.
This checkpoint includes request workflows, public notice details, policy links and their updated
documentation on `codex/coordinated-milestone-2026-10-19`. No main merge or deployment is included.
Before this checkpoint, local main was `cb5bb04cde8d900f0376d11f5676369636845eae` and fresh remote
main was `6edf69cf7b36a40a54fa5b335ed38b67e611e375`; both are left untouched.


---

# Public library detail interaction — October 22, 2026

Cards now offer **View full notice**; Compact resource names open the same native modal dialog.
It displays only the existing public projection: summary, scope, data involvement, conditions,
parent permission, alternatives and district contact. Unknown fields remain explicitly unknown.
The selected entry is derived from current public data, so updates stay current and withdrawal
removes the dialog. Escape/Close returns focus; background interaction is blocked while open.
No private-review fetch, authorization, projection, saved-data or DPA automation change was made.
The subsequent policy-link increment above adds the explicit public projection contract; internal
URLs are not fetched to fill gaps. Preview source was synced to the running local validation copy. `npm run ci` passed there
(547 tests, typecheck, build and isolation). Browser checks passed for Cards and Compact opening,
Escape and focus return. Screenshot: `.local/public-notice-detail.png`.

---

# Request lifecycle implementation — October 22, 2026

Current branch remains `codex/coordinated-milestone-2026-10-19`; main remains
`cb5bb04cde8d900f0376d11f5676369636845eae`. This implementation is included in the development
checkpoint described above.

[Request workflow](docs/request-workflow.md) documents the new server-owned request states,
permissions, before/after history, actor receipts, revision checks, protected tab drafts and explicit
retry reconciliation. Existing pending requests are adopted honestly on first command. Schema 11
adds fenced request graph validation to backup/restore. DPA automation remains excluded.

Implemented UI is in My workspace. Dashboard totals/attention queues, dedicated queue destinations,
catalogue matching and a review picker/create-review handoff remain pending. Existing-review linking
never approves or publishes a service. The parity checklist and improvement register are updated.

Validation: `npm run ci` passed (545 tests plus typecheck/build/isolation); `npm run test:integration`
passed (235 tests). Primary-checkout file reads stalled, so checks used
`/private/tmp/privacypal-request-validation` with the matching installed dependencies. A Git-index
hash comparison verified unchanged executable source against HEAD; every changed/new executable
file was overlaid from this checkout. This is environment-specific validation, not a production trial.
`npm run test:recovery` passed: schema-9 import and two schema-11 shutdown/import cycles,
including exact document comparisons, preserved request receipts and maximum segmented storage.

Browser smoke check passed in the restored preview: draft survives navigation/reload; create,
claim and decline produce three ordered events. The fixture is named “Request lifecycle — synthetic
check”; the earlier pending request and five public entries were preserved. Screenshot/logs remain
private under `.local/request-workflow-validation-2026-10-22/`. The final spacing change passed
fresh typecheck/build. The full independent multi-role browser checklist remains pending.

Preview is running at `http://127.0.0.1:5173/` from
`/private/tmp/privacypal-request-validation` using Node 24 and Java 21. It is a validated source copy,
so later edits in this repository need to be synced before they appear there. The newest schema-11
preview backup, including the synthetic request, is
`.local/backups/2026-10-22T17-23-36-408Z-a1ea0494-3f97-4d1e-b2bd-a372f96f62e6`.
Save and verify before stopping its owned emulator processes. Original local account passwords apply.

The prior preview was saved and verified before stopping. Its unchanged schema-10 archive is
`.local/backups/2026-10-22T17-10-58-850Z-2c4bb69b-6c4d-4e96-9130-898a96eca1c8`, backup identity
`df00a8a6-cbb5-44e2-a291-dc77b755dbfd`. Keep it private. No original project or live provider was used.

---

# Component parity and next restoration — October 22, 2026

The owner requested a component-by-component comparison after inspecting the local preview.
[Component parity](docs/component-parity.md) inventories all 56 original component/support files
against public commit `f31c874` and the pinned original archive. Dashboard and request lifecycle
restoration now precede broader adoption acceptance; the older consolidation priority below is
superseded. Core service tabs alone do not imply full product parity.

[Public-version improvements](docs/public-improvements.md) records inherited strengths, stronger
local contracts, evidence limits and possible original-project backports. No original change is
authorized. Owner decision: exclude DPA generation, signing, vendor upload and delivery; legal
documents will use other methods. Existing manual agreement facts remain separate.

This increment changes documentation only. No implementation, suite rerun, saved data, runtime,
branch/main, commit or push change is part of this inventory. Use the P1 acceptance checklist to
scope the next implementation; no agents or historical workboard reservations have been activated.

---

# Baseline consolidation — October 22, 2026

Documentation now uses [the current status index](docs/open-source-plan.md#current-implementation-and-remaining-work)
and [the independent local trial checklist](docs/independent-trial.md). At this checkpoint, next work was an outside-person
synthetic local trial, with accessibility and human rubric acceptance alongside it; operational
continuity and any hosted/provider pilot follow separate gates.

The clean source baseline before these documentation edits was `186c48d505fa275e0e6eff769c4ceb6a11dbfb9f`
on `codex/coordinated-milestone-2026-10-19`, matching GitHub. Local/fresh remote main remained
`cb5bb04cde8d900f0376d11f5676369636845eae`. The adoption-wave source is already checkpointed on
the development branch; older “being checkpointed” and “uncommitted” notes below are historical.
No branch switch, merge, commit, push, runtime change or test-suite rerun was part of consolidation.
The October 20 evidence below remains the latest recorded validation, not a new result.

The saved-preview/backup information below is the latest recorded handoff, not a current liveness
or integrity check. Inspect ownership and save/verify before any future runtime shutdown. Do not
bootstrap over a saved installation. Fresh trial participants use their own synthetic installation.

---

# Adoption wave checkpoint — October 20, 2026

This checkpoint supersedes historical runtime/backup/next-work statements below. The owner's
next-wave instruction is implemented on `codex/coordinated-milestone-2026-10-19` over
`2f3709f37c601815bed653a468d062c15aff3067`; source is being checkpointed on that GitHub branch.
`main` remains `cb5bb04cde8d900f0376d11f5676369636845eae`, with a separate merge decision.

- Three agents delivered fresh-installation/startup guidance, actionable accessible validation,
  and a read-only local operator check. Shared contracts and file ownership were recorded first,
  and non-author review completed. Protected-admin succession remains a proposal.
- Passed 544 unit/isolation tests, TypeScript/build/bundle/isolation, 224 emulator tests, a schema-9
  fixture import and two schema-10 recovery cycles. Fresh River Valley bootstrap/API access and
  native backup/restore passed. Native Chrome passed keyboard/draft/320px/200% acceptance.
- Saved preview: http://127.0.0.1:5173/ from
  `/private/tmp/privacypal-adoption-wave-IiILu6/integration`, project `demo-privacypal-local`.
  Ten reviews and five public entries remain. Only the named unsaved QA draft was discarded.
- Latest verified saved-preview archive:
  `.local/backups/2026-10-21T02-14-43-293Z-06886d3c-568c-4299-92c4-d5d90bedc670`, id
  `1ef70c3f-8ac4-4123-bc68-d5deda429fa3`, schema 10. Saved/copied/hash-compared/verified, then
  restored with exact configuration without bootstrap. The new operator check and supplied
  archive verification passed; no second administrator is an explicit advisory.
- Private source snapshots: `.local/source-checkpoints/adoption-wave-2026-10-20/`. Private
  evidence/trial archives/accounts/screenshots: `.local/validation/adoption-wave/`. Preserve
  these and older private artifacts. Save and verify again before future shutdown after edits.

Continue with [the workstation guide](docs/workstation-handoff.md),
[the coordinator report](docs/parallel-work/reports/coordinator-adoption.md),
[contracts](docs/parallel-work/contracts.md) and [workboard](docs/parallel-work/workboard.json).
An outside-person adoption pilot, screen-reader coverage, human rubric decisions, live providers,
protected-admin succession and production operations remain open. No main merge, deployment,
release, repository-visibility change or new saved-preview publication occurred.

---

# Durable segmented review checkpoint — October 20, 2026

The INT-002 application increment is implemented on `codex/coordinated-milestone-2026-10-19`
over `cb89a66c200f7f26fec812a331743a9e54e0fd55`. This section supersedes the historical next-work,
preview and backup statements below. The owner authorized the source checkpoint on GitHub;
`main` remains `cb5bb04cde8d900f0376d11f5676369636845eae` and requires a separate merge decision.

- Durable synthetic segmented runs retain frozen requests, original responses and attempt history.
  Explicit human handoff starts unresolved; citations, acknowledgments, corrections, deterministic
  scoring and district decisions retain their separate responsibilities.
- Assembled validation passed 518 unit/isolation tests, TypeScript, build/bundle gates and 209
  emulator integration tests. Recovery passed the original schema-9 archive, a schema-9 fixture
  and two schema-10 shutdown/import cycles. Native Chrome passed the focused draft, correction,
  evidence-inspection and 320px walkthrough. See the report for the final UI check and test limits.
- The saved preview runs at http://127.0.0.1:5173/ from
  `/private/tmp/privacypal-segmented-app-zhubduyq/integration`, using `demo-privacypal-local`.
  Ten synthetic reviews include the original nine and one named Lantern browser-QA review.
  The five public entries remain unchanged. Existing accounts remain private.
- Latest verified schema-10 backup:
  `.local/backups/2026-10-21T01-40-29-576Z-9bc2bd80-9c1b-4784-8ef0-4138f7b1b6dd`, id
  `d4b37fb9-b18c-494b-9891-1c4d499830bb`. It was saved, hash-compared after copying and verified
  again. Restore that exact configuration without bootstrap. Preserve older archives and save
  another verified backup before stopping after any future saved changes.
- Private source archive and inventory: `.local/source-checkpoints/segmented-app-2026-10-20/`.
  Private final validation evidence: `.local/validation/segmented-app-final/`.

Continue with [the workstation guide](docs/workstation-handoff.md),
[the coordinator report](docs/parallel-work/reports/coordinator-segmented.md),
[the walkthrough](docs/segmented-reviews.md), [contracts](docs/parallel-work/contracts.md) and
[the workboard](docs/parallel-work/workboard.json). A Git clone contains source and synthetic
fixtures, not private installation backups or credentials. Live providers, general model-output
adoption, independent installation, human rubric adjudication and broader accessibility remain open.

---

# GitHub continuation checkpoint — October 19, 2026

The owner authorized committing and pushing all releasable work to
`codex/coordinated-milestone-2026-10-19` in `inquiredu/PublicPrivacyPal` for use from another
workstation. Start with [the workstation guide](docs/workstation-handoff.md), which provides clone,
installation, verification and fresh synthetic-preview steps. The branch's Git commit identifies
the source checkpoint; `main` remains a separate merge decision.

All 218 source files matched the verified milestone before this continuation documentation was
added. Private accounts, installation backups, tab drafts and audit material remain on the original
Mac and are not available from a Git clone. The historical paths and “uncommitted” statements below
describe the October 18 checkpoint, not the branch's eventual GitHub commit status.

## Coordinated milestone complete — October 18, 2026

The owner resumed after unlocking the Mac. This checkpoint supersedes the earlier pause and all
historical branch, runtime and next-work statements below.

- Work is uncommitted on `main` over `cb5bb04cde8d900f0376d11f5676369636845eae`. Local, cached and
  fresh remote main matched at kickoff; all 136 baseline implementation inputs matched. PR #2 was
  already merged before this session. No branch switch, commit, push or main merge occurred here.
- The dependency/exclusion editor and bounded definition/draft/API wiring are implemented and
  accepted. First-wave intelligence design and installation guidance are accepted within their
  documented limits. Rubric, provider, operations and accessibility follow-ups are reviewed.
- Final assembled CI passed **481 tests**, TypeScript, build, bundle budgets and source isolation.
  Fresh integration passed **164 tests** and recovery passed **two complete shutdown/import cycles**.
  Native Chrome passed the focused draft, validation, keyboard, 320px and 200% zoom walkthrough.
- The restored synthetic preview remains at http://127.0.0.1:5173/ from
  `/private/tmp/privacypal-wave1-0amrk031/integration`. Nine reviews, five public entries and the
  existing verified administrator remain. Only the temporary validation draft was discarded.
- Latest verified schema-9 archive:
  `.local/backups/2026-10-18T19-46-20-790Z-a067cfd3-50dc-4a1a-846c-9f41bcdfa1f0`.
  Restore that exact configuration without bootstrap. Save and verify another backup before
  stopping a preview after any future saved changes. Accounts and older archives remain private.
- Private final source inventory/archive and logs are under `.local/validation/coordinated-wave1/`.
  A source archive is separate from the installation backup and contains no private accounts/data.

Read [the coordinator report](docs/parallel-work/reports/coordinator-wave1.md),
[the workboard](docs/parallel-work/workboard.json) and [contracts](docs/parallel-work/contracts.md).
Remaining work includes durable segmented application storage, provider reconciliation/original
output retention, independent runtime installation, human rubric adjudication and full accessibility
coverage. These are explicitly deferred; reviewed proposals are not implemented operational authority.

The in-app browser still has a local streaming issue; native Chrome passed with unchanged transport
code. No live provider call, original/district change, publication, deployment, release or repository
visibility change occurred. No automatic continuation is scheduled.

---

## Historical checkpoints

# PrivacyPal local handoff — reviewer overview refined

## Main-readiness audit

The October 17 readiness check corrected the cached Git state: GitHub main is `a0e94ca`, the
already-merged PR #1, and its tree matches pushed development checkpoint `5de75d3`. Local main
has been fast-forwarded from `91ce51f` to `a0e94ca`. The later implementation and coordination
packet are being collected into a development checkpoint for a new pull request to main.
Read [main readiness](docs/parallel-work/main-readiness.md) before updating branches or starting
parallel implementation. A verified private source snapshot preserves all 186 tracked/unignored
files as they stood at audit start, including 73 new files, plus a verified Git history bundle.
The current schema-9 installation backup was verified again. A fresh dependency directory in an
isolated source copy passed installation from the lockfile and CI (386 tests, TypeScript, build,
bundle and source isolation). Runtime and private accounts remain in place. The checkpoint and
pull request follow this audit; inspect their actual Git identity and checks before integrating.
No branch switch, new main merge, visibility change, release or deployment is part of preparation.

The older branch statements below are historical local observations, not current GitHub state.

Updated October 17, 2026. This checkpoint supersedes the runtime/backup references below. Work
remains in PublicPrivacyPal, with the existing uncommitted intelligence and source-coverage work
preserved. No commit, push, merge, deployment, provider call or district-system change occurred.

## Latest UI checkpoint

Reviewer cards separate publication, district decision, saved evidence score and analysis status.
Overview leads with the next task, saved district wording/use scope, evidence progress and current
open questions. Editing service facts is grouped in a disclosure; the four tabs, draft store and
server commands retain their existing responsibilities. See [service detail](docs/service-detail.md).
The pinned original card/detail/prompt paths were read again before this refinement. Owner review
of the resulting interface is still pending; no new intelligence or provider authority was added.

Validation: **386 unit/isolation tests**, TypeScript and production build/bundle/isolation gates
passed in `/private/tmp/privacypal-segments-6dw8kzqf`, with workspace Git metadata used read-only for
source inventory. Direct workspace TypeScript checking encountered a missing `pdfjs-dist` dependency;
it is not recorded as a passing workspace run. Application/test/build inputs match the temporary
checkout. Browser checks passed for next-step focus, keyboard tabs, service draft retention across
review navigation, and 320px reflow. No warnings/errors were returned. The temporary draft was
explicitly discarded; no settings, reviews or publications were saved. The earlier **163 integration
tests and two recovery cycles** remain backend evidence, not new runs. Private logs, screenshots,
source parity and before-edit copies are in `.local/validation/reviewer-ux/`.

## Preview and backup

The existing preview is **still running** at http://127.0.0.1:5173/ from
`/private/tmp/privacypal-segments-6dw8kzqf`, with the `demo-privacypal-local` emulators. It was neither
restarted nor bootstrapped. All nine saved review cards and five public entries remain present.
Existing local account files stay private in `.local/accounts/`.

A fresh schema-9 whole-installation backup was saved and verified, copied into this workspace, and
verified again:

`.local/backups/2026-10-17T22-53-59-091Z-432478de-83e6-497f-a4e0-18d975bb9a00`

Use this archive for the next restoration. Preserve older backups and offline qualification files.
Save another verified backup before stopping a session after further saved changes.

## Next work

The owner plans a fresh coordinated session on `main`. The reusable packet starts at
[START_PARALLEL_WORK.md](START_PARALLEL_WORK.md): coordinator runbook, seven scoped briefs,
file/resource ownership board, contract log, validation gates and a read-only implementation
manifest checker. **Main was still `91ce51f` when this packet was written.** Preserve and deliberately
integrate the dirty development baseline before launching implementation agents; a branch switch
or fresh worktree does not include it. No branch switch, commit, merge or agent launch was performed
when preparing the packet. Carry the packet itself into any fresh clone/worktree explicitly.

Review the card/Overview hierarchy with the owner. The document dependency/exclusion editor,
application adoption of segmented outputs, remaining precision measures and independent provider
qualification remain as described below. No live AI, public-preview packaging or publication is
part of this UI checkpoint.

---

## Historical checkpoint — long-policy coverage integrated

The previous implementation and validation details follow; its backup reference is superseded above.

# PrivacyPal local handoff — long-policy coverage integrated

Updated October 17, 2026. Work only in PublicPrivacyPal; the district instance and original repository
remain untouched. Branch `codex/open-source-audit` remains at `5de75d3` with uncommitted changes from
several milestones. No live inference, website fetching, deployment, commit or push occurred. No
dependencies were added.

## Latest implementation checkpoint

Step 4 now includes versioned long-policy capture, accountable **offline** segment extraction and
complete-source synthesis. Read [source segments](docs/source-segments.md) and [source bundles](docs/source-bundles.md).
The default rubric, precision pilot labels, historical outputs and weights remain unchanged.

- New bundle captures explicitly select **Long policy set — up to 128,000 characters**. The v2
  manifest retains the existing declared scope, applicability, dependencies, missing material and
  exact text/hash rules. Up to 24 document ranges have nonoverlapping cores, exact boundary context
  and explicit Markdown heading context. No source is silently truncated.
- `sourceVersion: 3` stores a small manifest/frozen plan and immutable hashed `sourceParts`; each
  stays within the existing 128 KiB record bound. Reads reconstruct and validate every part, range,
  order and hash. Any long review requires **backup schema 9**, before its first finding.
- Manual reviews retain per-range `human-source-review-v1` acknowledgments in drafts and findings.
  Resolved findings and confirmed silence require every required range plus complete applicable
  captures. Unfinished reviews keep available/opposing evidence, acknowledgments and open questions
  with no aggregate score. New saves use `human-evidence-v5` / `findings-v6`, heads `evidenceVersion: 6`.
- `evidence-segment-v1` / `segment-candidates-v1` produces candidates and target acknowledgments,
  not global findings. `evidence-synthesis-v1` / `segment-synthesis-v1` requires all retained
  candidates and required segments. Pending/failed/invalid/unavailable material withholds affected
  conclusions; contradictory candidates remain visible. Retried returns append without erasing
  evidence. New attempts make earlier synthesis stale. Original wire output remains separate from
  server-derived readiness and interpretation.
- `npm run analysis:segments -- ...` exports requests, preserves local returns/failures, builds
  synthesis and inspects a versioned offline packet. The browser downloads that packet from prompt
  preview. No provider runs and offline outputs have no application suggestion/import authority.
  **Offline packet/raw files are separate private operator artifacts, outside installation backups.**
- Request limits are 256 KiB each, original returns 128 KiB, three attempts per segment and three
  synthesis returns per 16 MiB packet. Overflow fails rather than dropping evidence. Long capture
  HTTP requests allow 512 KiB; older capture requests retain their actual 128 KiB raw-byte limit,
  including whitespace. Provider-specific tokenizer and spending checks remain future work.

Validation: **380 unit/isolation tests**, TypeScript, production build/bundle checks,
**163 emulator integration tests**, and **two full recovery cycles** comparing every stored document.
Recovery includes long Unicode source, a late exception, missing addendum and partial human coverage.
The final HTTP whitespace fix passed the full integration suite; the unchanged storage/recovery path
passed the earlier two-cycle rehearsal. Historical v1/v2/v3 hashes remain pinned in tests; an explicit
before/after probe also confirmed identical v1-bundle/v4 request hashes.

`npm run ci` passed in the verified temporary copy, using read-only workspace Git metadata for its
source inventory. The direct Documents-folder CI process was killed during TypeScript checking;
this is not claimed as a successful workspace CI run. Separate workspace isolation and whitespace
checks passed. Isolation covered **165 tracked/unignored files**; parity verifies **132 application,
test, script, configuration and build inputs**. Logs, private before-edit copies, parity, browser
packet, notes and screenshots are under `.local/validation/source-segments/`.

## Current local service and data

The preview runs at **http://127.0.0.1:5173/** from
`/private/tmp/privacypal-segments-6dw8kzqf`, using Node 24, Java 21 and the named
`demo-privacypal-local` emulators. This temporary source copy avoids Documents filesystem stalls.
Keep it running until another verified backup has been saved if further data changes are made.

Before stopping the previous preview, a fresh schema-8 whole-installation archive was saved,
verified, copied into the workspace and verified again:
`.local/backups/2026-10-17T20-46-55-967Z-f7fda9f9-a6b5-49a1-b2db-620e66d75d9d`.
The updated preview restored it. All eight earlier cards, five public entries and settings revision 3
remain intact. Browser QA changed no settings or publications.

**Cedar Long Policy — Browser QA** (`ff31a9f9-d458-40b4-bb94-6e6abc4d8637`) is a private
eight-measure practice review with 66,434 characters, nine ranges and a required unavailable backup
addendum. The late backup exception, last-range acknowledgment (`s9`) and explicit missing-source
question are saved as unresolved. One measure has saved unfinished work, seven are unreviewed, the
aggregate score is withheld and decision/publication are blocked. An actual page reload retained
the saved source, quote, range and question. Capture/evidence drafts survived navigation; serialized
unfinished drafts are covered by unit tests, not claimed as a completed browser draft-reload test.

Browser QA verified the 1280px default and a 390px viewport, keyboard focus and no horizontal overflow.
Console diagnostics after reload and interaction returned no warnings/errors. This is focused QA,
not general accessibility certification. The downloaded nine-request packet revalidated with all
segments pending; it is preserved privately as `browser-packet.json`. No inference was performed.

A fresh whole-installation **schema-9** archive was saved, verified, copied into this workspace and
verified again:

`.local/backups/2026-10-17T21-37-46-525Z-e7a560d6-922f-4cf5-ae67-0030b9e0fa87`

**Use this archive for the next continuation.** The final preview restores this same archive after
its final integration run. Preserve all older archives and the orphan Firestore preservation.
No automatic shutdown backup exists. Existing account files remain private in `.local/accounts/`.

## Next work

A visible per-measure/per-clause dependency and exclusion editor remains needed. The initial form
still conservatively requires every listed document for every enabled measure; API declarations
are human assertions, not document discovery or semantic verification.

Application adoption of segmented model outputs needs its own reviewable UI, durable authorized
attempt/result storage, provenance, retry/receipt and backup contracts before enabling it. The
offline protocol intentionally has no live dispatch or automatic finding adoption. It must not be
wired directly to a paid provider. Evidence sets exceeding the final synthesis budget fail explicitly;
a bounded hierarchical strategy would require a new version and its own tests.

The remaining 36 precision measures, independent label adjudication, whole-policy cross-provider
trials, provider-specific token budgets, and transport/billing reconciliation remain separate work.
Preserve historical output, drafts, receipts, weights and actual publication invariants. Gemini
provenance and vendor-neutral qualification instructions remain in [provider adoption](docs/ai-provider-adoption.md).

---

## Historical checkpoint — bounded source bundles integrated

The following checkpoint is preserved as history. Its runtime, backup and next-work references are
superseded by the long-policy checkpoint above.

Updated October 17, 2026. Work only in PublicPrivacyPal; the district instance and original repository
remain untouched. Branch `codex/open-source-audit` remains at `5de75d3` with uncommitted changes from
several milestones. No live inference, source fetching, deployment, commit or push occurred. No
dependencies were added.

## Latest implementation checkpoint

The first bounded source-coverage increment in step 4 of [analysis refinement](docs/ai-analysis-refinement.md)
is implemented. Read [source bundles](docs/source-bundles.md) for contracts, scope assertions and limits.
The application default and frozen historical rubric/prompt identities remain unchanged.

- New reviews offer **Paste a set of policy documents**. Captures retain document identity, scope,
  applicability, full/excerpt/unavailable status and effective-date statements. The server hashes
  the full immutable manifest and canonical texts, validates dependencies and resolves exact quotes
  to individual documents. Required missing material remains visible alongside available evidence.
- The first form conservatively requires every listed document for every enabled measure. The strict
  API additionally supports declared included/excluded links and per-measure/per-clause dependencies;
  a richer dependency editor remains future work. Scope and completeness are explicit human capture
  assertions, not automatic discovery or semantic verification.
- Server-owned `source-coverage-v1` prevents a model flag or human resolution note from filling a
  capture gap. Unavailable required material withholds affected results and the aggregate score;
  available supporting/opposing evidence and unfinished human work remain intact. Confirmed silence
  requires complete applicable coverage. Existing decision and actual publication gates still apply.
- Offline `evidence-extraction-v4` / `policy-suggestions-v4` requires every bounded passage to be
  acknowledged and revalidates document/hash/passage citations. Original wire output and derived
  coverage stay separate. Prompt preview and manual review work; bundle inference is explicitly
  disabled. The existing exact Cedar recordings keep their historical contracts.
- Limits remain 32,000 UTF-16 units of joined text, with at most eight documents, 24 passages and
  a 256 KiB extraction request. No source is silently truncated. Source records use version 2;
  bundle human saves use `human-evidence-v4` / `findings-v5` and heads use `evidenceVersion: 5`.
  Any bundle review requires installation backup schema 8, including before the first finding.

Validation: **359 unit/isolation tests**, TypeScript and production build/bundle checks,
**159 emulator integration tests**, and **two complete recovery cycles**. Recovery compares every
document, including a precision bundle with a missing addendum and retained clause evidence.
Final quotation-selection and wording changes passed TypeScript/build again. Workspace isolation
passed for **158 tracked/unignored files**. Application/test/configuration/build parity was verified
for **126 files** against the running temporary copy. Logs, parity, browser notes and a screenshot
are under `.local/validation/source-bundles/`. Browser checks covered saved-state reload and the
default 1280px viewport; broader accessibility and narrow-viewport checks were not repeated.

## Current local service and data state

The preview runs at http://127.0.0.1:5173/ from
`/private/tmp/privacypal-bundle-check-o8c5q09e` using Node 24, Java 21 and the named
`demo-privacypal-local` emulators. This completed temporary source copy avoids Documents filesystem
stalls. Its application, tests and configuration/build inputs match the workspace. Keep this process
running until another verified backup has been saved if further data changes are made.

Before stopping the prior preview, a fresh schema-7 whole-installation archive was saved, verified
and copied into the workspace:
`.local/backups/2026-10-17T18-25-19-283Z-2b2ccf52-3efa-47e8-86ec-460aa63cc63d`.
The new preview restored that archive. All seven prior review cards, five public entries and settings
revision 3 remain intact; browser QA made no settings or publication changes.

**Cedar Source Bundle — Browser QA** (`ffb65cf9-50b8-4b2a-8dc5-30e0156e0f7f`) is a private
eight-measure practice review with a complete synthetic school policy and a required unavailable
backup addendum. One collection quotation and an explicit missing-source question are saved as
unresolved. Reload retained the capture, evidence and question. There is **one saved unresolved
measure, seven unreviewed measures, no aggregate score**, and blocked decision/publication.
Capture drafts survived navigation; unit checks cover serialized unfinished drafts. The attempted
browser reload of an unfinished draft exercised unload protection and is not claimed as a completed
draft-reload test. Saved records were checked after an actual reload.

A fresh whole-installation **schema-8 backup** was saved, verified, copied into this workspace and
verified again:
`.local/backups/2026-10-17T20-09-18-197Z-efaf809c-43d2-4d57-90e1-f07b49cfeca6`.
Use this archive for the next continuation. Preserve older archives and the orphan Firestore
preservation. No automatic shutdown backup exists. Existing account files remain private in
`.local/accounts/`.

## Next milestone

Continue step 4 with longer policies across multiple bounded requests: explicit segment coverage,
boundary context, contradictions and complete-source synthesis before confirmed silence. The current
single-request bundle is deliberately bounded and does not establish that every relevant vendor
document was discovered. A visible dependency/exclusion editor is also still needed beyond the
initial conservative all-documents form. Version any new request/storage/recovery contracts before
adoption and preserve existing drafts, receipts, historical output, weights and publication invariants.

The remaining 36 precision measures, independent label adjudication, whole-policy cross-provider
trials, provider-specific token budgets and transport/billing reconciliation remain separate work.
Do not add automatic fetching, credentials or paid dispatch incidentally. Gemini provenance and
vendor-neutral adoption instructions remain in [provider adoption](docs/ai-provider-adoption.md).

---

# Historical checkpoint — precision pilot integrated

The following checkpoint is preserved as history. Its runtime, backup and next-work references are
superseded by the current source-bundle checkpoint above.

Updated October 17, 2026. Work only in PublicPrivacyPal; the district instance and original repository
remain untouched. Branch `codex/open-source-audit` remains at `5de75d3` with uncommitted changes from
several milestones. No live inference, deployment, commit or push occurred. No dependencies were added.

## Latest implementation checkpoint

The owner's continuation authorized integration of the frozen rubric candidate as an explicitly
selectable pilot. Read [precision adoption](docs/rubric-adoption.md) for behavior and compatibility.
The candidate hash and provisional labels remain frozen; this is not independent human adjudication
or a live model-quality benchmark. The application default remains the original PEF 2.0 profile.

- Settings offers **PEF precision pilot v1 — 14 refined measures**. New pasted reviews explicitly
  adopt it; 50 IDs/weights remain, 14 definitions gain 26 clauses, and 36 definitions are unchanged.
- New version-2 contracts use `pef-precision-snapshot-v1`, prompt `evidence-extraction-v3` and output
  `policy-suggestions-v3`. Models supply clause states and evidence roles; the server derives the
  aggregate. All clauses/quotes are validated. Stored wire output revalidates on read/cache reuse.
- Human review uses the same aggregation, shows the adopted boundaries and retains unfinished
  drafts. Saved human clauses and immutable original proposal clauses remain separate. Unresolved
  clauses/scope/source readiness withhold score and approval while retaining measure weights.
- Human precision saves use `human-evidence-v3` / `findings-v4`. Heads mark `evidenceVersion: 4`.
  Settings adoption/history or precision reviews require schema-7 installation backups. Existing
  finding/history/detail byte limits remain unchanged. Older reviews and prompt identities are fixed.
- The exact Cedar example has a new recorded clause output. Arbitrary/live model dispatch remains
  disabled; provider adoption instructions cover the new mixed v3 contract and historical support.

Validation: **325 unit/isolation tests**, TypeScript and production build/bundle checks,
**155 emulator integration tests**, and **two complete recovery cycles**. All 91 provisional cases
pass through application v3 validation, wire round trip and human-save derivation. Old definition
and request hashes are pinned. Recovery compares every document, including current/original clauses.
The workspace isolation check passed for **150 tracked/unignored files**. Browser QA and source parity
are under `.local/validation/precision-adoption/`. Final UI wording passed TypeScript/build again.

## Current local service and data state

The preview runs at http://127.0.0.1:5173/ from
`/private/tmp/privacypal-precision-test-7ib235_5` using Node 24, Java 21 and the named
`demo-privacypal-local` emulators. This temporary source copy avoids filesystem stalls in Documents.
Its application, tests, scripts and configuration/build inputs match the workspace; parity is saved
in the private validation directory. Keep this process running until another backup has been saved.

It restored the fresh verified schema-6 backup
`.local/backups/2026-10-17T15-13-59-380Z-9f357917-540f-4c0e-98c2-09db5ea32f36`.
Browser QA saved the pilot as settings revision 3, preserving all other settings and priorities.
**Cedar Precision Pilot — Browser QA** (`20964df8-d6bb-4954-a1ac-c6faf952c4a2`) is a private
50-measure complete-service review. Its recorded v3 proposals have 7 supported, 16 partial and
27 not-addressed states. These are fixed demonstration outputs, not a new inference run.

The deletion draft survived navigation/reload with an empty clause rationale. A partial human save
was followed by an unresolved backup clause and explicit question. Reload preserved the human
question and original limited proposal. The current review has one saved unresolved measure,
49 unreviewed measures, **no aggregate score**, and blocked decision/publication. Earlier partial
history remains. The six older review cards and five public entries remain intact.

A fresh whole-installation **schema-7 backup** was saved and verified, then copied into the workspace:
`.local/backups/2026-10-17T16-14-48-411Z-a900e4b9-3686-4328-bc56-2276770297c0`.
Use this archive for the next continuation and preserve older archives/orphan Firestore preservation.
No automatic shutdown backup exists. Existing private account files remain in `.local/accounts/`.

## Next milestone

Step 4 of the [five-agent refinement](docs/ai-analysis-refinement.md): bounded source bundles and
server-owned coverage. One saved text plus a model/human source-readiness flag cannot establish
that all relevant linked policies, school/consumer terms or addenda were supplied.

Design explicit captured-document identity, required-document/segment coverage and scope; preserve
contradictions while distinguishing confirmed silence from unavailable material. Bound passage and
request budgets, hash the full source bundle into requests, and version storage/backups before UI
adoption. Use pasted synthetic documents first. Do not add automatic website fetching, provider
credentials or paid dispatch as an incidental part of this milestone. Preserve current source,
rubric, historical output, draft/retry and publication invariants.

The remaining 36 measures, independent label adjudication, whole-policy cross-provider trials and
transport/billing reconciliation remain separate work. Gemini provenance and vendor-neutral
adoption instructions remain in [provider adoption](docs/ai-provider-adoption.md).

---

# Historical handoff — superseded by the checkpoint above

The following records describe earlier milestones. Their next-work, runtime and backup references
are historical; use the current service and next milestone above.

# PrivacyPal local handoff — rubric precision candidate prepared

Updated October 17, 2026. Branch `codex/open-source-audit` remains at `5de75d3`; this implementation
is an uncommitted local change. The owner authorized modernization and requested explicit Gemini
provenance plus instructions for adopting any AI system. The original district instance and original
repository remain untouched. No live inference, deployment or push occurred.

## Latest implementation checkpoint

Step 3 now has a concrete [rubric precision candidate and adjudication packet](docs/rubric-precision.md).
The laboratory defines 14 proposed measures and 26 subrequirements, with 91 authored synthetic cases.
`npm run rubric:lab -- check|export|grade` verifies reference consistency, exports provider-neutral
inputs without labels, and grades every returned subrequirement. It never calls a provider or adopts
definitions. The older 40-case benchmark rejects multi-measure inputs instead of grading only the first.
The application rubric, scoring contracts and historical evaluations remain unchanged. The remaining
36 measures are inventoried for later review. Owner adjudication of the concrete boundaries/examples
precedes application adoption; this is not a completed human-label or model-quality benchmark.

Validation: **226 unit/isolation tests**, TypeScript, production build/bundle checks, 144-file
workspace isolation scan and whitespace check. Export/grade smoke checks cover 91 authored reference
outputs and refuse export overwrite. Source parity and logs are in `.local/validation/rubric-precision/`.
This increment is offline tooling/documentation only; no emulator data, preview, authorization,
provider dispatch or backup changes were made. Integration/recovery/browser tests were not rerun.

## Previous implementation checkpoint: review context

Step 2 of the approved five-agent refinement is implemented. Read
[durable review context](docs/review-context.md) and the updated
[walkthrough](docs/policy-suggestions.md) before continuing.

- Drafts and human findings retain scope, uncertainty, follow-up questions and immutable suggestion
  references. The evidence command resolves provenance from the saved job/result inside its authorized
  transaction; cross-review references, changed qualifications and client-forged attribution fail.
- The editor shows meets/partial/failure definitions together. Reviewers can save unresolved work;
  explicit resolutions retain original qualifications and record exact evidence, a note, actor and time.
- New human saves use `human-evidence-v2` / `findings-v3` / `review-coverage-v1`. Unresolved measures
  retain their full denominator, have null points and withhold the aggregate score and district decision.
  Historical scores remain fixed; old inline history uses frozen findings-v2 reconstruction.
- Proposal overviews use structured state/readiness/question counts. Unrestricted model summary prose
  is no longer displayed as an overview. District summaries and publication remain separate human actions.
- Schema-6 backups identify the new evidence. Bounds are 64 KiB/finding, 160 KiB/history, 4 MiB/detail;
  other request, paging and installation-backup limits remain unchanged.

Validation: **128 unit/isolation tests**, strict TypeScript, production build/bundle checks,
**154 emulator integration tests**, and **two complete recovery cycles**. Recovery compares every
stored document, including retained/resolved/unresolved context, queued jobs, accounts, history and
projections. Final presentation edits also passed TypeScript and the production build. Local logs,
source parity, browser notes and a screenshot are under `.local/validation/review-context/`.
The prior step-1 evidence remains in `.local/validation/analysis-invariants/`; the independent five-agent
observations remain in `.local/validation/five-agent-prompt-review/`. These private directories are not
release artifacts. No live inference, district changes, deployment, commit or push occurred.

## Current local service and data state

The updated preview runs at http://127.0.0.1:5173/ from
`/private/var/folders/yr/bs49r8_16cq42qrv4xf4tg0r0000gn/T/privacypal-context-fxnxaogs`.
It restored the previously verified complete schema-5 backup
`.local/backups/2026-10-16T15-30-49-170Z-015b3f68-be06-49a1-93fc-9a8e585e440d`.
The original archive and `.local/validation/analysis-invariants/orphan-firestore/` remain intact;
the latter is Firestore-only preservation from the prior orphan process, not a full installation.

Browser QA used **Cedar Intelligence Lab — Browser QA**
(`92ef1adb-bc9c-4fb9-9d77-2976ad98ddac`). Its historical v1 deletion suggestion now survives a draft
reload, an unresolved save and an explicitly attributed partial resolution. The original school-only
scope and backup-retention question remain visible. It has **1/8 resolved measures**, seven unresolved
measures and **no aggregate score**. Decision/publication controls remain blocked after reload. The
old 7/100 evaluation stays in history. The five existing public entries remain intact.

A new whole-installation **schema-6 backup** was saved and verified, then copied into this workspace:
`.local/backups/2026-10-17T02-31-41-866Z-023e84f7-648f-4069-8238-8965dd561c1a`.
Use this archive for subsequent continuation; preserve the older archives and orphan export too.
No automatic shutdown backup exists. Save again before stopping if additional edits are made.

## Next milestone

Step 3's candidate is ready for owner adjudication in `docs/rubric-precision.md`. Review its concrete
policy boundaries and synthetic labels, record accepted/amended choices against the candidate hash,
then integrate a new explicitly adopted immutable definition/profile and request/schema version.
Do not overwrite the existing PEF snapshot or reinterpret old scores. The candidate is a 14-measure
precision pilot; the remaining 36 measures still need review. Later source bundles, transport/billing qualification and an
adjudicated cross-provider benchmark remain separate work. Gemini provenance and any-system adoption
instructions remain in [provider adoption](docs/ai-provider-adoption.md).

## Current implementation

- `docs/ai-provider-adoption.md` explains the vendor-independent server contract and how to qualify
  another hosted/local system. Gemini is acknowledged as the original design, not a requirement.
- `server/analysis/` and `shared/assistance.ts` implement versioned extraction requests, source
  passages, strict output/coverage/quote validation, private result caching and a recorded provider.
- Suggestion jobs use receipts, renewable leases, deadlines, cancellation/reconciliation states,
  membership/maintenance checks and stale-result fencing. The shipped provider is an exact Cedar
  recording with a zero-dollar limit. Paid registration/budget settlement is deliberately disabled.
- Compliance shows suggested evidence, source scope, questions and a structured state overview. A proposal opens an
  editable draft; only saving the human finding recalculates scores. District decisions and actual
  publication still use the existing workflow. `docs/policy-suggestions.md` is the walkthrough.
- Forty authored development cases and `npm run analysis:eval -- export|grade FILE` support offline
  evaluation. Labels need independent human review and a broader district-rubric holdout before
  making any model-quality claims. No live-model benchmark has been run.
- Schema-5 archives identify jobs/results/usage keys; schema 6 identifies the new human evidence
  context. Portable review exports include saved finding context/provenance but exclude full suggestion
  jobs/results. Earlier compatible archives remain readable.

## Prior modernization verification and working session

`npm run ci` passes: 110 unit/isolation tests, TypeScript, production build and bundle/source guards.
`npm run test:integration` passes 144 emulator tests, including all roles, 50-measure suggestions,
request replay/cache, failures, concurrent workers, unknown outcome, cancellation and stale/access
fencing. `npm run test:recovery` passes two full shutdown/import cycles with exact Firestore
comparisons, queued/completed suggestions, mixed legacy/schema-5 data and preserved accounts.

The updated preview runs at http://127.0.0.1:5173/ from `/private/tmp/privacypal-setup-deps` with
the existing demo accounts. It restored the verified pre-modernization backup
`.local/backups/2026-10-16T14-48-19-833Z-23d73087-2381-428b-87b6-4a261c53b9d1`.
The browser walkthrough created **Cedar Intelligence Lab — Browser QA**
(`92ef1adb-bc9c-4fb9-9d77-2976ad98ddac`) as a private complete-service draft. It generated eight
recorded suggestions, previewed the exact prompt and saved a human-edited deletion finding.
The draft survived tab navigation; reload retained 1/8 reviewed and the provisional 7/100 score.
The existing five public entries remain intact.

Runtime source parity and browser evidence are under `.local/validation/analysis-modernization/`.
The fresh schema-5 backup was saved, verified and copied into this workspace:
`.local/backups/2026-10-16T15-30-49-170Z-015b3f68-be06-49a1-93fc-9a8e585e440d`.
Restore this latest snapshot to keep the Cedar walkthrough; retain earlier archives for rollback.
Save another verified backup before stopping after further changes. Existing account files under `.local/accounts/` stay private.

## Historical next work — superseded by the checkpoint above

Step 2 of `docs/ai-analysis-refinement.md`: preserve suggestion scope, uncertainty, questions and
provenance through draft creation, navigation, reload and human save; show all adopted rubric
outcome definitions; record unresolved review dispositions; and constrain suggested summaries.
Keep score changes, human decisions and publication separate. This requires versioned storage,
backup/recovery coverage and the existing draft/retry guarantees.

Then adjudicate rubric subrequirements, add bounded complete source bundles, qualify transport and
settlement/upgrade behavior, and benchmark every measure. Live calls still require a selected
provider/account, permissible data and explicit spending cap. Five-agent review remains an evaluation
method, not a requirement for every policy. The whole-policy grader, input passage/request budgets,
source-readiness ownership and terminal billing reconciliation remain future work.

The prior handoff is preserved below as history; its “next milestone” and stopped-session statements
describe the earlier checkpoint, not the active session above.

## Previous parking record

Parked at the owner’s request on October 15, 2026 (October 16 UTC).
Resume with card/detail UX and the original prompt-driven intelligence, before public-release preparation.
No further work is scheduled.

## Boundaries and checkpoint

Work only in PublicPrivacyPal. The district instance and original `inquiredu/privacypal` repository
remain untouched. All records, accounts and agreement facts are synthetic and use the named local
demo emulators. The owner authorized pushing the development branch to the separate PublicPrivacyPal GitHub
repository. No deployment, vendor fetching or AI calls are part of that push.
Read `AGENTS.md` before continuing.

Local commit **fae8d20** (`Checkpoint local setup, reliable reviews, and versioned storage`) preserves
the preceding setup, draft/receipt reliability and bounded 50-measure storage milestones. Branch:
`codex/open-source-audit`. The complete-service implementation was committed locally as **edc75f7**
(`Restore complete service review cards and four-tab workflow`). The subsequent accessibility and
bundle improvements are included in the development checkpoint prepared for GitHub. Preserve
existing files. No dependencies were added.

## Restored experience

Reviewer cards show tier, grades, data involvement, reviewed coverage, independent score/decision
and publication state. Detail restores **Overview**, **Compliance**, **Classification**, and
**Publish & Documents**. The original pinned implementation was read as reference; see
`docs/service-detail.md` for the field map and intentional refinements/deferred features.

The optional administrator-configured tier policy is explicitly adopted and versioned. Service
facts, DPA dates/reference/scope, rostering, conditions and classification persist in bounded,
immutable service versions. Service drafts survive navigation. Corrections atomically withdraw
both audience projections and require a decision bound to the new service/evaluation revision.
The same allowlist renders publication previews and actual staff/family notices.

Existing reviews keep their original rubric/arithmetic and do not silently adopt new settings.
A new source or changed adopted policy requires a new review. Staff see permitted use first with
score as supporting context; families do not receive scores, evidence or private document fields.

## Verification

Final validation: 90 unit/isolation tests, 125 emulator integration tests, TypeScript/build and
source/bundle isolation. Two full backup/restore cycles preserve service facts, adopted policy,
current decision, earlier evaluation, roles and accounts, including mixed legacy/schema-4 data.
Tests cover authorization, stale settings, DPA boundaries, write failure/concurrency, command replay,
maintenance, byte limits, drafts and explicit audience projections.

Browser acceptance used **Cedar Complete Service — Browser QA** (review
`f0b519e0-d6e2-489d-963c-7d8080a825c2`). Settings revision 2 explicitly adopts the example tier policy.
The service has all 50 measures reviewed, Tier 2, grades 6–8, fictional agreement/rostering facts,
and a synthetic conditional decision. The initial evidence was populated through the local API
(one partial quote and 49 omissions); the browser performed the human correction and decisions.
The correction changed 1/100 to 0/100, removed the actual family listing, and required a fresh
decision before republication. Reload retained the final published state and service facts.
This is interaction test data, not a vendor assessment.

The earlier Orchard QA publication remains 57/100; the earlier Cedar partial review remains intact.
Anonymous and dedicated synthetic staff views were checked. Arrow/Home/End tabs and a 390px layout
were checked; no horizontal overflow or console warnings/errors were observed after reload.
Evidence is under `.local/validation/service-detail/`. Broader accessibility is not certified.

## Saved installation and restart

The final schema-4 whole-installation backup was saved, verified, copied into this workspace and
verified again:

`.local/backups/2026-10-16T04-05-01-448Z-57cfb6d6-e2f8-4faa-b52d-4855e8e4cd3d`

It includes synthetic accounts, settings, complete service, evidence versions, decisions and public
projections. Keep older backups. The checkpoint's older backup reader must reject schema 4; never
relabel a manifest. Rollback uses the preserved pre-service schema-3 backup with compatible source.

With Node 24, Java 21+ and dependencies available, from this repository:

```sh
npm run dev -- --restore .local/backups/2026-10-16T04-05-01-448Z-57cfb6d6-e2f8-4faa-b52d-4855e8e4cd3d
```

Starting without `--restore` creates an empty session. Do not bootstrap over the saved installation.
Use the existing admin or dedicated `service-staff` account file under `.local/accounts/`; never
publish credentials. Save a verified backup before stopping a future session.

The preview and demo emulators are stopped. The preview previously ran at http://127.0.0.1:5173/ from `/private/tmp/privacypal-setup-deps`, avoiding
occasional synced Documents filesystem stalls. Source/tests match this workspace. Node 24 is at
`/private/tmp/privacypal-runtime/node_modules/node/bin`; Java is at
`/private/tmp/privacypal-audit.aXzT2k/jdk/jdk-21.0.12.1+1/Contents/Home`; emulator cache is at
`/private/tmp/privacypal-audit.aXzT2k/emulators`. These paths are conveniences, not requirements.
This workspace holds the durable backup and validation evidence even if temporary files disappear.

## Next milestone when the owner resumes

The owner wants further UX/UI work on reviewer cards and detailed service information, alongside
restoring the intelligence supplied by PrivacyPal’s original prompt system. Prioritize this before
public-preview packaging. The local version currently supports manual evidence review and synthetic
analysis; deterministic scoring is implemented, but the original prompt-driven intelligence is not.

1. Read the pinned original cards, service-detail views and prompt system together, without starting
   the archived application or calling production services. Trace prompt assembly, district context,
   model output and the UI insights they support. Record what is useful and what needs correction.
2. Map each displayed insight to policy evidence, AI interpretation, deterministic scoring or a human
   district decision. Preserve these distinctions in the card and four-tab detail design.
3. Refine one complete service experience with the owner: useful card summaries, clear detail
   hierarchy, evidence coverage, unresolved questions, requirements and next actions.
4. Design versioned server-side prompts and output contracts with citation validation, explicit
   uncertainty, bounded jobs/costs and preserved human corrections. Do not enable live AI merely to
   inspect the original system; any provider setup and calls need deliberate scope.
5. Validate using synthetic clear commitments, omissions, contradictions and failure/retry cases.
   Preserve current drafts, immutable versions, separate decisions and atomic publication semantics.

Later work remains: full assistive-technology validation, agreement-expiry monitoring, production
provisioning, encrypted retention, admin turnover, upgrades/rollback and an independent pilot.
Public-preview preparation (PR/merge, documentation cleanup, contribution/security guidance and
publication review) follows the owner’s UX/intelligence priority. Do not change visibility, merge,
release or deploy as part of resuming this design work.

References: `docs/service-detail.md`, `docs/review-storage.md`, `docs/review-workflow.md`,
`docs/backup-recovery.md`, `docs/design-continuity-plan.md`, and `docs/provenance.md`.

## Accessibility and bundle follow-up

The current build passes all 90 unit/isolation checks, TypeScript and bundle/isolation gates.
Production-build browser checks cover keyboard navigation, dialog Escape/focus return,
settings/service draft retention and 320px reflow. The 125 integration tests and two recovery
cycles above remain the service-milestone evidence; no server, authorization or storage behavior
was changed in this follow-up. No synthetic records/settings were saved during its browser checks.
A fresh whole-installation backup was saved for parking. The development preview is stopped;
the temporary production-build preview on port 5174 was used for validation only.

## GitHub development checkpoint

Destination verified as `https://github.com/inquiredu/PublicPrivacyPal`, currently private.
Publish branch `codex/open-source-audit`; do not change repository visibility, merge into main,
create a release or deploy as part of this checkpoint. GitHub Actions runs verification only.
Local accounts, backups and private reference material stay ignored and are not included.

## Confirmed remote state at parking

Development branch `codex/open-source-audit` was pushed through **5de75d3**. GitHub run
[38847275162](https://github.com/inquiredu/PublicPrivacyPal/actions/runs/38847275162) passed CI,
emulator authorization tests and full backup/recovery rehearsal. `main` remains at `91ce51f`.
The repository remains private. This parking handoff is a local documentation update after that
pushed checkpoint; no additional push is part of parking. The district instance remains untouched.
