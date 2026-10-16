# Refine the existing PrivacyPal experience

Proposed 2026-10-15 following a read-only review of the original project.

**Current direction:** the draft/retry and versioned storage gates below are implemented locally.
Continue restoring the original service cards/four tabs on that foundation. The owner requested this review after the setup milestone.
Familiar workflows remain the baseline; neither old implementation choices nor new prototype
choices are exempt from challenge. The recommendations below are not claims that the remaining
work has already been implemented.

## Direction

The existing PrivacyPal is the product baseline. Preserve its setup, service cards, detailed
review, staff guidance, and family notice experience while making the implementation portable
and reliable. The community application currently proves underlying permissions, evidence,
scoring, publication, and recovery mechanics; its simplified screens are not the intended
replacement design. The eight-criterion local exercise is not a replacement for the original
evaluation framework.

The original repository's `main` was compared with the archived reference on 2026-10-15 and is
identical at `adad00a05e67bf9ea88d145cf2e0a1100ec27889`. The local district checkout also has
that HEAD. Its setup, detail, reviewer card, library designer, freshness, override resolution,
public projection, scoring, rubric and type-definition files were compared byte-for-byte with
the reference and all match. The findings below describe that source, not a newly exercised
production deployment. The supplied service-detail screenshot is also a visual reference.
No original application, maintenance script, production login, or live analysis was run.
Uncommitted changes outside those compared files and the exact deployed revision have not
been verified.

## What the original already provides

| Surface | Existing behavior to preserve | Community refinement |
| --- | --- | --- |
| Setup / Settings | Sector and state; evaluation standards; custom district guidelines; selected laws and law discovery; optional mission/strategic-plan text and PDF input; evaluation-area priorities from Disabled through Critical. | Retain the sequence and terminology. Explain which choices guide analysis and which change arithmetic. Save an adopted, versioned configuration with clear failure feedback. Local tests use authored examples without discovery calls. |
| Customize Library | Title, logo, accent color, introduction/disclaimer, contact information, editable/reorderable footer sections, card/compact view, sort and opening tier filter. | Preserve the controls and preview; remove district defaults and separate optional Drive configuration from appearance settings. Offer only sort choices supported by the intended audience's data. |
| Reviewer tool card | Tool name, review/publication state, score, tier, stale-score and tier-mismatch warnings, grade/data indicators, analysis quality, retry and bulk-selection actions. | Preserve the compact summary and route into the same detailed review. Keep score, district approval and publication visibly distinct. |
| Overview tab | Tier and its requirements; DPA/rostering confirmations; support level; age; communication-tool flag; policy URL and correction/reanalysis; quality and source warnings; paste-in remedy; plain-language summary; education-version notes. | Restore these fields and their relationships. Integrate the tested pasted-source capture and evidence correction into this existing workflow. |
| Compliance tab | Critical factors, unresolved questions, grouped rubric detail, quotations versus findings, evidence gaps, and selected-law assessments. | Keep the grouped, expandable review. Add exact-source evidence editing and history here, with the adopted profile and explanation of the score. |
| Classification tab | Conditions for permitted use and for parent permission; suggested grades; curriculum connections; collected-data tags and filters. | Preserve district-authored conditions separately from vendor-policy findings. Reanalysis must not erase these decisions. |
| Publish & Documents tab | Publication controls, blockers, advisory review signals, family-facing preview, ClassLink information and DPA workflow. | Make preview and publication use the same validated projection. Retain manual DPA/rostering facts in the core; external document generation, signing, mail and Drive remain separate modules. |
| Staff catalogue | Usage guidance led by tier, conditions and student-data involvement; supporting score with source-quality caveat and review date. | Restore this distinct audience view; a high score must not read as permission to use a tool. |
| Public notice | Narrow family-facing fields, grade scope, summary, tier, data involvement and conditions; search, card/compact display and notice footer. | Preserve the deliberately limited notice and accessible card structure. Internal evidence, scoring and reviewer information stay private. |

Source references, pinned to the examined revision:

- [SetupWizard](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/SetupWizard.tsx), [LibraryDesignWizard](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/LibraryDesignWizard.tsx).
- [ToolCard](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ToolCard.tsx), [ToolDetailView](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ToolDetailView.tsx), [StandardsComplianceView](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/StandardsComplianceView.tsx).
- [StaffToolCard](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/StaffToolCard.tsx), [PublicNoticeLibrary](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/PublicNoticeLibrary.tsx), [public projection](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/services/publicProjection.ts).

## How setup and scoring actually connect

The original offers six named evaluation standards. Those selections and custom guidelines
enter the analysis prompt, while selected laws determine the requested law assessments.
The deterministic calculation separately evaluates the bundled PEF 2.0 rubric: 50 criteria in
11 areas. Area priorities supply weight multipliers; disabling an area removes its weight.
Selecting a named standard does not select a separate scoring rubric or remove its criteria
from the common rubric. See [prompt and scoring integration](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/services/geminiService.ts#L805)
and the [rubric definition](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/rubrics/unified-privacy-rubric.json).

Preserve the selection experience, but make that distinction explicit. Package the existing
framework as an optional starter profile, with attribution and review of included third-party
material before release. A district can adopt and version its chosen measures and priorities;
the repository can supply examples without requiring one universal rubric. Start with the
existing area controls and an explicit preview of included measures. A new general-purpose
rubric builder is not required for the next milestone.

The current eight-criterion local profiles remain synthetic regression fixtures. Their
`upstream-weighted-v1` engine name describes inherited arithmetic, not implementation of the
complete original rubric. The candidate's zero credit for silence differs from the original's
60% credit; this is a separately versioned policy choice, not an automatic upgrade. Do not
silently replace the original formula or reinterpret old results. No numerical score alone
constitutes a district approval.

## Targeted improvements supported by the source

1. **Make settings persistence trustworthy.** `SetupWizard.handleFinish` catches a failed save
   and still calls `onSetupComplete`. Preserve the page, but keep the user there with their edits
   and an actionable error until persistence succeeds. Test reload and interrupted/failed saves.

2. **Show the complete evaluation context and its version.** The original freshness logic
   compares policy URL, rubric, engine, model and weights, but does not fingerprint the selected
   laws, standards or custom context. The setup change detector checks law/standard IDs and
   weights, also omitting custom context. Record the adopted definitions and context with each
   result. Preserve the useful distinction between recalculating stored facts after a weight
   change and needing a new analysis after a source or analysis-context change. Historic results
   keep their original context; updates require an explicit new evaluation/decision.

3. **Use one truthful publication status.** The detail view can show publication blockers and
   also display “This tool is live in the public library” based on `isPublic`, while actual public
   eligibility checks `isPublished` and other fields. Preserve the Publish & Documents tab, but
   derive its status and preview from the same acknowledged publication state. The local atomic
   publish/unpublish implementation is useful infrastructure for this refinement.

4. **Keep analysis completion separate from human review.** The existing detail view suppresses
   some review actions once `standardsCompliance` exists. A completed rubric should not stand in
   for a recorded human decision. Keep the familiar review controls and make approval, changes
   requested, and publication explicit. Missing evidence should be visible and acknowledged;
   the workflow must not require inventing a positive finding to proceed.

5. **Preserve the original protection for human corrections.** The original override layer
   already keeps tier, summary, grade, data categories and other corrections across reanalysis,
   with attribution and the prior machine suggestion. Carry that behavior forward and connect
   it to server-attributed history. New model output can flag a disagreement without overwriting
   the district's judgment. Preserve district conditions of use for the same reason.

Relevant source: [settings completion](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/SetupWizard.tsx#L242),
[freshness](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/services/analysisFreshness.ts),
[review controls](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ToolDetailView.tsx#L910),
[publication controls](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ToolDetailView.tsx#L1940),
[override resolution](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/services/toolResolution.ts).
These are source-level findings and proposals, not new production test results.

## Proposed next milestone: existing setup through a complete service review

**Progress, 2026-10-15:** increment 1 is implemented locally. The original six-part setup and
Library Design dialog now save administrator-only, versioned settings. Local PDF text import,
the optional original 50-measure framework, area priorities, library branding/notice/footer,
preview and display defaults are available. Synthetic unit, permission, recovery and browser
checks passed; see [district setup](district-setup.md) and [provenance](provenance.md).
Live law discovery and Drive are deliberately deferred. The public library consumes its saved
appearance settings, but full reviewer/staff/service-detail cards are still increments 2 and 3.
New pasted reviews can now explicitly adopt a versioned snapshot of the saved district rubric.
Existing eight-measure practice scores remain unchanged. See `review-storage.md` for the bounded
records, migration and full-rubric tests; the original four-tab detail still needs restoration.

Implement one recognizable end-to-end local experience in three increments:

1. **Adapt the existing Setup / Settings screen.** Retain its structure and Library Design
   controls, connect them to administrator-only local persistence, and save a versioned profile.
   Use synthetic district settings and the existing framework as a selectable starter example.
   Make selection effects visible before saving. Reject invalid or entirely disabled scoring
   configurations. Preserve existing results instead of bulk-changing their meaning.
2. **Adapt the existing reviewer card and four-tab detail.** Restore the field set above and its
   familiar arrangement using the tested local API. Integrate the evidence editor under
   Compliance and the paste-in source remedy under Overview. Preserve tier requirements,
   conditions, overrides, DPA status and publication preview. Use reviewed source components
   and extracted reusable pieces, retaining license and attribution; do not start the archived
   application or import production bindings.
3. **Connect the corresponding staff and family views.** Use the original audience-specific
   cards and detail patterns, neutral district branding, search and display settings. Verify
   each audience receives only its allowed fields. Keep external integrations unavailable
   during local acceptance; manual document/status facts remain usable.

The initial synthetic walkthrough should include a source with omissions, an education version,
a manually assigned tier with an unconfirmed DPA, conditional use, a correction to a quoted
finding, and a fresh decision before republication. It should exercise setup and card behavior
together rather than treat them as unrelated new screens.

Acceptance requires:

- A field-by-field comparison against the existing setup and four tabs; each retained feature
  has a working destination. Any deferred feature has an explicit reason and scope.
- The owner recognizes the existing PrivacyPal workflow and can complete it with synthetic data.
- Settings, profile version, details, overrides and history survive reload and backup/restore.
- Changing priorities has an explainable score effect; existing evaluations are reproducible.
- Failed saves and publication operations never report success; evidence corrections require
  a fresh decision and cannot leave a stale public record.
- Admin, reviewer, read-only reviewer, staff and anonymous access remain tested, including
  attempts to read or modify fields outside each role.
- Keyboard use, focus, narrow screens and tab navigation are verified as components return.
- No changes to the original repository, district configuration, data, users or deployment.

This proposal changes the next local milestone. It does not authorize production changes or
claim feature parity has already been implemented. Preserve the tested local foundation and
bring the existing product experience onto it incrementally.

## Reliability review before further restoration

Reviewed 2026-10-15 against the pinned original source and current local application. This is a
focused architecture and workflow review, with an offline synthetic size/score experiment. It
does not establish production security, complete accessibility, or typical performance. No live
district data, authentication, deployment or changes were involved. No application behavior was
changed in this review.

### Decisions for each approach

| Approach | Decision and reasoning | Evidence required before expansion/release |
| --- | --- | --- |
| React/TypeScript and a separate Firebase project per district | Retain provisionally. A backend replacement adds migration and operating complexity without current pilot evidence that it helps. Separate domain operations from UI and storage adapters; avoid introducing microservices. | Independent installation, restore and cost/read-volume measurements before promising an operating cost or scale. |
| Original setup and four-tab detail | Preserve recognizable tasks and navigation; simplify repetition and clarify next actions. Existing controls are candidates to refine, not mandatory implementation choices. | Keyboard/focus/zoom checks and a synthetic task walkthrough: identify permitted use, find supporting evidence, resolve a blocker, publish, correct and recover. |
| Standards, law references and rubric selection | Make the distinction explicit: context guides interpretation; criteria, applicability and weights determine arithmetic. Keep examples optional and district policy configurable. Do not imply a selected standard is a certification. | Preview adopted measures and exclusions; save definition/context snapshots; compare the effect of a new profile without changing historical results. |
| Scoring and coverage | Retain deterministic versioned arithmetic. Show evidence coverage and material contradictions separately from the number and district decision. No automatic approval threshold. Preserve historical arithmetic; do not silently adopt a replacement. | Golden and boundary tests for missing, partial, conflicting, excluded and not-applicable findings; district review of meaning before release. |
| Source evidence and AI | Retain immutable source snapshots, exact citation matching and human corrections. Exact matching proves the quote exists, not that it supports the conclusion. Keep live AI and fetching disabled for now. | Human-labeled interpretation cases; omission/exception/contradiction tests; provider output validation and prompt-injection cases; fetch redirect/address/body limits before enablement. |
| Identity and authorization | Retain explicit memberships, private role checks and server-attributed commands. Unify security-relevant writes behind domain commands; direct notes writes currently have weaker conflict/history semantics. | Test the same role matrix across HTTP and direct database access, including existing sessions after membership revocation and Auth disable. Test operator/admin turnover separately. |
| Publication | Retain atomic private/public/staff updates and fresh decisions after corrections. One publication record/state should drive the badge, preview and actual public entry. Warn clearly when an action withdraws an existing entry. | Inject failed commits, lost acknowledgements, concurrent decisions and late results; no stale result may republish. Public projection is an explicit field allowlist. |
| Tier, DPA, age and permitted-use facts | Restore as attributed district decisions with supporting facts and configured requirements. Preserve overrides across new analysis. Unknown, absent, recorded and expired document states must not collapse into one checkbox. | A required but unconfirmed/expired DPA blocks the relevant district approval/publication path on the server; AI output cannot set confirmation or consent facts. Dates and applicability remain explainable. |
| Staff and family views | Staff should first answer “Can I use this, with whom, and under what conditions?” Families should see the selected disclosure fields. Keep technical evidence and review actions in the reviewer view. | Field-leak tests; no blank critical conditions, inconsistent status or misleading score badge; accessible empty/error/loading states. |
| Storage and public delivery | Separate lightweight service summaries from sources, evaluation findings and history. Page list/history reads; load detail when opened. Give the public view a small independent entry point rather than requiring private review code and API health. | Maximum-size Unicode cases, a 1,000-summary fixture, bounded page sizes and subscriptions, and a public-page test with the private API unavailable. Set measured transfer/render budgets rather than treating the build warning as a benchmark. |
| Jobs and integrations | Keep durable server-owned work. The current instant fixture worker is not a production AI queue. Keep mail, Drive and signing separate and disabled until their own review. | Slow provider, lease renewal, duplicate delivery, cancellation, crash/restart, revocation and bounded cost/retry tests. Use an event-driven/bounded queue before a hosted rollout. |
| Recovery and upgrades | Keep verified backups, maintenance fencing and whole-installation restore. Strict lockfile matching is a current guardrail, not an upgrade solution. | Rehearse an old-backup-to-new-schema migration and failed-upgrade rollback; operator handoff, retention and encryption before real district data. |

### Concrete gaps in the current local implementation

1. **Draft loss can occur during navigation.** `src/Reviews.tsx` keeps evidence/decision dirtiness
   inside the selected detail, while selecting another review replaces that keyed component.
   `src/App.tsx` unmounts Reviews when changing sections. The navigation does not consult those
   dirty flags, and review drafts lack an unload guard. `src/EvidenceEditor.tsx` protects a criterion
   switch but not leaving the review. Incoming analysis/decision changes can also remount the
   decision form. This is source-confirmed; no new browser loss reproduction is claimed here.
   Keep drafts with their base revision across navigation, offer explicit discard, and preserve
   text during a concurrent update. Recovery must remain private and must not retain another
   user's draft after sign-out. Never automatically publish or approve an autosaved draft.

2. **A lost response can leave an ambiguous result.** `src/api.ts` has no deadline or operation
   identity. Each invocation of `createReview` in `server/reviews.ts` creates a fresh UUID; retrying
   after a committed create whose response was lost can create a second review. Revision checks
   protect updates from overwrites but do not tell the client whether its prior command succeeded.
   Introduce bounded requests and actor-scoped command IDs with payload hashes and durable results.
   Reusing an ID with another payload must fail. A timeout means “outcome unknown” until reconciled,
   not “nothing saved”; do not add blind automatic retries to mutating requests.

3. **The current review document is too broad for straightforward expansion.** `shared/review.ts`
   stores policy text, findings, decision and job in one document; `src/Reviews.tsx` subscribes to
   every review and the selected review's entire history. Authorized access does not make that
   efficient. The current 100-review sandbox cap hides later scale requirements. Keep one stable
   service identity with immutable source/evaluation versions, bounded findings and paged history;
   summary/projection updates still need transactional consistency. Avoid maintaining divergent
   `tools` and `reviews` records as independent sources of truth in the restored experience.

4. **Settings are versioned but not yet an evaluation contract.** `server/settings.ts` saves a
   definition version and context hash; the existing review still selects one of two eight-measure
   fixtures. Before full evaluation, record the actual adopted definition, criterion IDs, weights,
   selected context and source hash with each evaluation. Bind the human decision to that exact
   evaluation. A new setup version affects an explicitly new evaluation, never old arithmetic.

5. **Authentication paths need a single operational revocation procedure.** The API checks token
   revocation with `verifyIdToken(..., true)`; direct Firestore reads use membership checks, without
   a token-revocation timestamp. Disabling an Auth account alone is not a substitute for revoking
   district membership for already-issued credentials. Firebase documents separate token lifetime
   and revocation enforcement in its [session guidance](https://firebase.google.com/docs/auth/admin/manage-sessions).
   Test stale-token access through both paths and define disable/revoke/admin-transfer procedures.
   This is a release-gate finding, not evidence of unauthorized access to the district service.

6. **The public experience inherits private-app overhead and availability.** `src/App.tsx` eagerly
   imports review/settings code and waits for private API configuration/health before rendering the
   library. The last build's main chunk is about 976 kB minified (291 kB gzip); this is an asset size,
   not a user latency measurement. Restore the original separation of public and private delivery,
   with explicit loading/error behavior; split code based on the user's task.

7. **The worker is adequate only for its current fixture adapter.** `server/reviews.ts` polls every
   500 ms and grants a fixed 30-second lease without renewal. Its final transaction fences stale
   completions, but a future slow external call could still be duplicated after lease expiry.
   Queue quota is not a bound on duplicate provider execution. Resolve this before live AI or
   hosted workers, not by merely increasing the timeout.

### Synthetic experiment and verification

An offline probe used the current schemas and evidence editor's server logic with a 32,000-character
fictional Unicode policy, three 2,000-character exact citations and a 1,000-character rationale per
criterion. Current create/edit request sizes remained within their limits. Results:

- The eight-criterion source/analysis JSON was 267,013 bytes; 100 such objects were 26,701,401 bytes.
  This is a valid-size stress case, not a typical district dataset or network benchmark.
- Extending the same allowances to 50 criteria gives 1,146,000 bytes of string content alone,
  before document metadata. That exceeds Firestore's documented
  [1 MiB document limit](https://firebase.google.com/docs/firestore/quotas). It demonstrates why
  storage must change before expansion, not a failure of the currently implemented eight-measure record.
- The inherited formula returns 60 for entirely missing evidence and 50 for entirely partial
  evidence. The candidate returns 0 and 50 respectively. The arithmetic is functioning as written;
  the policy meaning needs an explicit choice. Coverage and contradiction remain distinct signals.
- All 36 focused scoring/profile/evidence/settings tests passed. The previous 166-test and recovery
  results remain baseline evidence; they were not rerun or relabeled as a comprehensive audit.

The probe, output and focused test log are private in `.local/validation/approach-review/`.
It made no database writes. Several findings above are source-level control-flow observations;
their failure-injection/browser cases are acceptance work below, not claimed completed tests.

### Immediate reliability gate and order of work

1. **Protect reviewers' work and clarify save outcomes.** Reproduce navigation/reload/concurrent-edit
   loss with synthetic drafts. Add draft lifecycle protection, bounded request handling, and
   idempotent create/import/action receipts. Test response loss after commit, duplicate submission,
   stale edits, sign-out, access revocation and maintenance. Keep unsaved, saving, saved, failed and
   outcome-unknown visibly distinct. Implemented for the local policy review workflow; see
   `review-workflow.md` and the draft/retry validation in `provenance.md`. Extending these guarantees
   to settings, requests and internal notes remains separate work.
2. **Establish the full evaluation contract and bounded storage.** Add versioned source/evaluation/
   findings records, lightweight summaries and paged history, with byte limits and a migration from
   current synthetic records. Test 50-measure maximum inputs, concurrency, projection consistency,
   historical reproducibility and full backup/restore. Confirm settings effects without choosing
   district policy on the owner's behalf. Implemented locally; see `review-storage.md` and
   `provenance.md`. Public entry-point separation and measured performance budgets remain ahead.
3. **Restore one complete service through the familiar screens.** Use the original card and four
   tabs on that contract. Show use decision/conditions, evidence coverage, blockers and next action
   clearly. Include an unresolved DPA, omitted policy statements, a human correction and fresh
   publication. Prove reviewer, staff and family views independently. Expand only after this
   walkthrough passes the failure cases above.

Before an external pilot, separately complete session/admin turnover, production queue/fetch/AI
boundaries if enabled, public delivery/performance budgets, accessibility and upgrade/rollback
rehearsals. A test count, dependency audit, or familiar screen alone is not evidence for those claims.
