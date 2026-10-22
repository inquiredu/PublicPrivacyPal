# Component parity and restoration checklist

Reviewed October 22, 2026. Public baseline: `f31c874d2c0e63539d53fd56c32b3f1d799d357c`
on `codex/coordinated-milestone-2026-10-19`. Original reference: archived source at
`adad00a05e67bf9ea88d145cf2e0a1100ec27889`, as pinned in [design continuity](design-continuity-plan.md).
This is a source-based inventory, not a claim about the original's current deployed revision.
The archived app/scripts were not run and no original system was changed.

## How to read and use this checklist

Every file in the archived `components/` directory is listed once, including supporting icons and
preview data. Original filenames link to the pinned repository source; current filenames refer to
this repository's `src/` directory unless stated otherwise. Component presence is functional,
not a requirement to preserve filenames or copy architecture. Related behaviors in contexts/services
were inspected for requests, publication and analysis. This is not an exhaustive backend API audit.

- **Present:** the primary component purpose has a working local equivalent; listed limitations still apply.
- **Simplified:** some purpose exists, but meaningful fields/actions or audience behavior are absent or changed.
- **Missing:** no equivalent workflow; a deferred module is still missing, not complete.
- **P1:** next dashboard/request restoration milestone. **P2:** subsequent product parity work.
  Deferred integrations need their own scope; a checklist row does not authorize a provider or deployment.

Inventory: **56 files — 10 present, 28 simplified, 18 missing**. These include utility files and
intentionally excluded DPA workflows; the totals are not a feature-completion percentage.

All rows are assessed; only unfinished restoration acceptance below uses unchecked boxes. Do not
use file counts as a completion percentage. Four tab names do not establish full product parity.
The previous browser walkthrough confirmed ten synthetic reviews, five public entries and the
complete-service tabs; this inventory adds source review, not a new full browser/test run.

## Dashboard and review intake

| Original component | Status | Current equivalent / observed scope | Remaining work / priority |
| --- | --- | --- | --- |
| [DashboardHub.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/DashboardHub.tsx) | Missing | No equivalent overview in `App.tsx` or `Reviews.tsx`. | P1: totals, actionable attention queue, tier distribution; score bands must not imply approval. |
| [InputDashboard.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/InputDashboard.tsx) | Simplified | `Reviews.tsx`: paste text/document sets or synthetic fixtures. | P2: guided intake and duplicate hints; URL discovery/live analysis and CSV batches remain gated. |
| [ResultsDashboard.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ResultsDashboard.tsx) | Simplified | `Reviews.tsx` / `ReviewCard.tsx`: paged cards and detail selection. | P1 search/filter navigation; P2 sorting, selection, reorder, CSV and batch commands. |
| [FilterSidebar.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/FilterSidebar.tsx) | Simplified | `LibraryView.tsx`: public name/category search and tier filter; no reviewer facet sidebar. | P1 reviewer attention filters; P2 grade/data/curriculum facets with audience-safe fields. |
| [ToolCard.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ToolCard.tsx) | Simplified | `ReviewCard.tsx`: publication, decision, coverage, score, tier and requirement warnings. | P2 restore review assignment, richer freshness/quality cues and safe batch entry points; no delete command. |
| [CsvReviewModal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/CsvReviewModal.tsx) | Missing | No CSV intake review/duplicate selection. | P2 after bounded batch contracts and failure reporting. |
| [ImportReviewModal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ImportReviewModal.tsx) | Missing | JSON draft import exists, but is not CSV field-diff approval/import. | P2 explicit change preview, per-row errors and conflict/retry semantics. |
| [RetryAnalysisModal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/RetryAnalysisModal.tsx) | Simplified | `ReviewDetail.tsx` / assistance panels offer synthetic retries; source replacement creates a new review. | P2 source-version/reanalysis workflow; do not silently overwrite immutable captures. |
| [ReanalyzeFieldsModal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ReanalyzeFieldsModal.tsx) | Missing | No selective-field preservation chooser. Human service facts already survive supported corrections. | P2 explicit preserve/adopt choices for new analyses; keep human authority. |
| [AnalysisProgress.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/AnalysisProgress.tsx) | Simplified | Review job status plus `AssistancePanel.tsx` and `SegmentedAssistancePanel.tsx`. | P2 richer stage progress only when backed by durable state; no live progress claim. |
| [ReanalysisNotification.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ReanalysisNotification.tsx) | Simplified | Current definitions/adoption and stale-decision messages in review screens. | P2 explain settings changes and affected work without bulk rescore. |
| [ClearLibraryModal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ClearLibraryModal.tsx) | Missing | No clear-library equivalent. | Deferred destructive lifecycle; design recovery/retention before adding. |

## Requests and staff workflow

| Original component | Status | Current equivalent / observed scope | Remaining work / priority |
| --- | --- | --- | --- |
| [RequestPortal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/RequestPortal.tsx) | Simplified | `App.tsx` DistrictWork: tool name/purpose form, direct pending request creation. | P1 URL/context capture, library-match hints, protected draft and acknowledged submission. Quick AI is deferred. |
| [RequestQueue.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/RequestQueue.tsx) | Simplified | DistrictWork lists district requests without workflow tabs or actions. | P1 Active / Decided / Archived queues, bounded paging and reviewer assignment. |
| [RequestDetailModal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/RequestDetailModal.tsx) | Missing | No detail, claim/release/takeover, rejection rationale or request-to-review handoff. | P1 server-owned lifecycle and accessible detail with explicit outcomes; no automatic publication. |
| [MyRequests.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/MyRequests.tsx) | Simplified | DistrictWork lists own name/purpose/status only. | P1 requester detail/outcome, archive/restore and live status; preserve separate archive visibility. |
| [StaffCatalogue.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/StaffCatalogue.tsx) | Simplified | DistrictWork + `ServiceNotice.tsx`: search and use guidance cards. | P1 link request matches to catalogue; P2 tier/consent filters, sort and detail dialog. |
| [StaffToolCard.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/StaffToolCard.tsx) | Simplified | Staff service notice in cards; scope/conditions visible inline. | P2 restore dedicated detail interaction and review-context hierarchy. |
| [StaffScoreBadge.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/StaffScoreBadge.tsx) | Simplified | `ServiceNotice.tsx` renders score and evidence context without the original confidence badge system. | P2 compare provenance/confidence semantics; retain score-is-not-permission wording. |
| [TierGuide.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/TierGuide.tsx) | Missing | Tier labels and configured requirements exist; no staff guide dialog/print guide. | P1 concise configured tier help in request outcomes; P2 printable guide. Do not hardcode original district policy. |
| [PermissionSlipModal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/PermissionSlipModal.tsx) | Missing | Permission conditions/alternative are manual service facts; no generated document. | Deferred document-generation module; do not block request lifecycle on it. |

## Service detail and evidence

| Original component | Status | Current equivalent / observed scope | Remaining work / priority |
| --- | --- | --- | --- |
| [ToolDetailView.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ToolDetailView.tsx) | Simplified | `ReviewDetail.tsx`, `ReviewOverview.tsx`, `ServiceFields.tsx`: all four tabs and core facts. | P2 broader original field/interaction parity; live discovery, export PDF and DPA automation absent. |
| [Tabs.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/Tabs.tsx) | Present | ReviewDetail implements named tabs/panels and Arrow/Home/End navigation inline. | Retain keyboard behavior; a same-named module is unnecessary. |
| [StandardsComplianceView.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/StandardsComplianceView.tsx) | Simplified | Grouped rubric findings, evidence and context in Compliance. | Generated law-specific assessments are absent; separate rubric evidence from legal conclusions. |
| [CriticalFactorsView.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/CriticalFactorsView.tsx) | Simplified | Overview questions/coverage and Compliance findings expose gaps, without original positives/concerns presentation. | P2 explicit derived critical-factor summary with evidence and missing-source distinctions. |
| [UnresolvedCriteriaPanel.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/UnresolvedCriteriaPanel.tsx) | Present | `ReviewOverview.tsx`, `FindingContext.tsx`, `EvidenceEditor.tsx`: unresolved work and criterion-level editing. | Retain stronger source-coverage gates; assess a compact cross-measure worklist in P2. |
| [ScoreBreakdownModal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ScoreBreakdownModal.tsx) | Present | Compliance exposes measures/points and adopted rubric; no separate score dialog required. | Keep exact saved arithmetic and coverage; do not silently substitute candidate policy for historical scores. |
| [PromptPreviewPanel.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/PromptPreviewPanel.tsx) | Present | `AssistancePanel.tsx` AnalysisInstructions and capture previews expose versioned instructions. | Retain frozen request context and clear synthetic/offline scope. |
| [ClassLinkPanel.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ClassLinkPanel.tsx) | Simplified | `ServiceFields.tsx`: manual rostering, SSO and private notes. | P2 compare original structured support fields; no external ClassLink integration implied. |
| [ShareModal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ShareModal.tsx) | Simplified | Review/history JSON export and explicit audience previews; no PDF/email/web-share UI. | P2 safe report export; optional delivery requires separate authorization. |

## Setup, library and audiences

| Original component | Status | Current equivalent / observed scope | Remaining work / priority |
| --- | --- | --- | --- |
| [SetupWizard.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/SetupWizard.tsx) | Simplified | `Settings.tsx`: six-part setup, context/PDF, priorities and versioned rubric adoption. | Live law search/discovery absent; preserve configurable choices and historical scores. |
| [LawRefreshModal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/LawRefreshModal.tsx) | Missing | No live state-law refresh/search workflow; adopted references are saved context. | Deferred retrieval and qualified legal-content review; never silently change historical evaluations. |
| [LibraryDesignWizard.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/LibraryDesignWizard.tsx) | Present | Settings Customize Library: branding, statements, footer order, display defaults and preview. | Appearance workflow present; Drive setup is separately missing, not an appearance prerequisite. |
| [LibraryFooter.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/LibraryFooter.tsx) | Present | `LibraryView.tsx` renders configured footer sections/contact. | Retain accessible headings and district-neutral text. |
| [PublicLibrary.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/PublicLibrary.tsx) | Simplified | LibraryView uses narrow audience projections rather than the old full-tool library view. | P2 safe facets; never restore full internal records to anonymous users. |
| [PublicToolCard.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/PublicToolCard.tsx) | Simplified | LibraryView + ServiceNotice render public cards/compact rows. | P2 details/tag browsing; tier editing remains private. |
| [PublicNoticeLibrary.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/PublicNoticeLibrary.tsx) | Simplified | Search, tier filter, sort, cards/compact and footer exist. | P2 disclosure-basis filtering, detail dialogs and independently available public entry point. |
| [PublicNoticeCard.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/PublicNoticeCard.tsx) | Simplified | Explicit disclosure fields shown inline. | P2 dedicated detail interaction and compare original disclosure/usage-mode distinctions. |
| [EmbedWizard.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/EmbedWizard.tsx) | Missing | No embed generator or supported separately hosted public entry. | P2 after independent public delivery and embedding policy/accessibility checks. |
| [previewData.ts](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/previewData.ts) | Present | Authored synthetic fixtures and local bootstrap samples replace original preview examples. | Preserve synthetic-only public fixtures; do not import original preview records wholesale. |

## Accounts and shared UI

| Original component | Status | Current equivalent / observed scope | Remaining work / priority |
| --- | --- | --- | --- |
| [Header.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/Header.tsx) | Simplified | App shell: Public library / My workspace / Policy reviews / People & access / Settings. | P1 recognizable Dashboard / Requests / My Requests navigation; P2 remaining destinations. |
| [LoginView.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/LoginView.tsx) | Simplified | Local email/password sign-in and operator-created synthetic accounts. | Hosted identity/Google sign-in is a separate production gate. |
| [ContributorManagementModal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ContributorManagementModal.tsx) | Simplified | People & access manages explicit roles, revocation and protected initial admin. | Invitation/organization registration workflows absent; do not reintroduce self-claimed ownership. |
| [AcceptInvitePage.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/AcceptInvitePage.tsx) | Missing | No invitation route or acceptance protocol. | Separate hosted identity/invitation design and tests. |
| [SessionTimeoutModal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/SessionTimeoutModal.tsx) | Missing | Sign-out draft handling exists, but no inactivity countdown/extend workflow. | Operational session policy plus draft preservation before hosted use. |
| [ErrorBoundary.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/ErrorBoundary.tsx) | Present | `DeferredScreen.tsx` catches deferred screen failures and retains shell navigation. | Scope differs from a whole-app error boundary; assess global failures separately. |
| [LoadingSpinner.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/LoadingSpinner.tsx) | Present | Inline loading/status announcements and deferred-screen fallback. | Functional replacement; spinner artwork is not a parity requirement. |
| [Modal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/Modal.tsx) | Present | Native dialog implementations for library customization/sign-out; no generic module. | Existing dialogs only; future request dialogs require focus/Escape/return-focus acceptance. |
| [Icons.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/Icons.tsx) | Simplified | Text/native controls and limited symbols replace the original shared icon set. | Visual continuity backlog, not a reason to copy unused components. |

## Agreement and integration modules — DPA restoration excluded

**Owner decision, October 22:** skip restoration of the DPA document workflow; the original does
not work as intended and legal documents will use other methods. Rows remain in the inventory
for completeness, but DPA generation, signing, vendor uploads and delivery are intentionally
excluded, not future restoration commitments. Existing manual agreement status/reference/dates/
scope remains a separate review fact; no new legal-document workflow is proposed here.

| Original component | Status | Current equivalent / observed scope | Remaining work / priority |
| --- | --- | --- | --- |
| [DPADashboard.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/DPADashboard.tsx) | Missing | No cross-service DPA dashboard. | Excluded from restoration; existing per-service manual facts remain. |
| [DPAPanel.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/DPAPanel.tsx) | Simplified | Publish & Documents retains manual DPA status/reference/dates/scope. | Manual facts retained; document/template/signature lifecycle intentionally excluded. |
| [DPADetailModal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/DPADetailModal.tsx) | Missing | No document-detail/signature/vendor-activity workflow. | Excluded: use the district’s external legal-document process. |
| [DPAGenerationModal.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/DPAGenerationModal.tsx) | Missing | No template generation/vendor-contact extraction/signing wizard. | Excluded: no DPA generation restoration planned. |
| [DPAUploadPage.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/DPAUploadPage.tsx) | Missing | No token-based vendor upload endpoint/page. | Excluded: no vendor DPA upload restoration planned. |
| [SignaturePad.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/SignaturePad.tsx) | Missing | No captured/reused signature UI. | Excluded from the DPA restoration scope. |
| [DriveSetupPanel.tsx](https://github.com/inquiredu/privacypal/blob/adad00a05e67bf9ea88d145cf2e0a1100ec27889/components/DriveSetupPanel.tsx) | Missing | No Drive OAuth or folder setup. | DPA folder setup excluded; any unrelated Drive integration needs separate scope. |

## Current implementation entry points

- [App shell, membership and basic requests](../src/App.tsx), [review listing/intake](../src/Reviews.tsx),
  [review cards](../src/ReviewCard.tsx), [detail/tabs](../src/ReviewDetail.tsx).
- [Overview](../src/ReviewOverview.tsx), [service facts](../src/ServiceFields.tsx),
  [evidence editor](../src/EvidenceEditor.tsx), [source dependencies](../src/SourceDependencyEditor.tsx).
- [Settings/designer](../src/Settings.tsx), [library](../src/LibraryView.tsx),
  [audience notice](../src/ServiceNotice.tsx), [projection contract](../shared/service.ts).
- [Permissions](permissions.md), [request rules](../firestore.rules),
  [review command receipts](../server/commands.ts), [bounded review summaries](../shared/evaluation.ts).

The four-tab mapping is functional, not field-complete. The original also exposes dedicated copyright/
policy-characteristic summaries, structured legal assessments and public disclosure-basis/use-scope
controls. Current generic conditions, data categories and rubric findings do not establish equivalents
for every one of those distinctions. Include a field-level pass in P2; do not infer parity from tab names.

## Next milestone: restore dashboard and request lifecycle

This milestone takes priority over treating the current slice as a complete independent adoption
candidate. The existing [trial checklist](independent-trial.md) can still assess the current slice,
but it must gain the request/dashboard acceptance below before broader workflow acceptance.
Keep live analysis, mail, signatures and automatic discovery disabled; pasted evidence and authored
synthetic jobs are sufficient to prove the complete local request lifecycle.

### P1-0 — Agree the shared contract before UI writes

- [ ] Define request identity, revision, requester scope, assignee, timestamps, outcome/reason,
  linked review ID and independent requester/admin archive fields. Preserve original attribution.
- [ ] Define and test allowed transitions: pending → in review → decided; release returns to the
  unassigned queue; reassignment/takeover has explicit authority and an audit reason. Decide reopen
  semantics explicitly instead of silently recycling an old outcome.
- [ ] Distinguish request outcome, review finding, district use decision and publication. Linking
  a request to a review must not grant approval or publish it. Several requests may link to one
  review without copying its private findings into requester-visible records.
- [ ] Define a narrow requester outcome projection: status, appropriate reason, reviewer contact
  if configured, and allowed use guidance/link. Private evidence/rationale/other requesters stay private.
- [ ] Move lifecycle writes behind authorized versioned commands with request-specific receipts,
  bounded history and draft protection. Existing `server/commands.ts` receipts assume a review ID;
  do not reuse them unchanged for request records. Recheck membership and maintenance in transactions.
- [ ] Specify migration of today's pending requests and single `archived` flag. Preserve its
  requester meaning, do not manufacture historic decisions/assignees, and initialize admin archive
  separately. Add backup-reader/schema compatibility and recovery tests before new writes ship.

### P1-1 — Dashboard and find-work navigation

- [ ] Restore Dashboard, reviewer Requests and staff My Requests destinations, keeping role-based
  access and draft retention. Cards/queue rows open the existing authoritative review or request detail.
- [ ] Add total reviews, actual publications, unassigned/in-review requests and actionable attention
  categories (failed jobs, unfinished evidence, stale decisions, unmet service requirements).
- [ ] Add tier distribution and optional descriptive score distribution. Unknown scores stay unknown;
  no score band means approved. Label request counts separately from service/review counts.
- [ ] Implement bounded summary queries/aggregates and matching filters. `Reviews.tsx` currently reads
  pages of 20: never label the loaded page's count as an installation total or fetch all source/evidence
  documents to draw a dashboard. Define freshness/as-of semantics and prevent duplicate counts.
- [ ] Verify empty/loading/error/revoked-access states and keyboard navigation. An unavailable query
  must show unavailable, not zero work. Dashboard failures must not block an existing review draft.

### P1-2 — Request submission and reviewer handling

- [ ] Restore URL/context fields, existing-library suggestions and explicit continue-anyway behavior.
  Suggestions use only the staff projection; similar names must not silently merge distinct tools.
- [ ] Protect unsent drafts across navigation/reload and reconcile response loss after creation;
  retrying the same submission creates one request, not duplicates.
- [ ] Restore Active / Decided / Archived queues with paging, status/priority filters and detail view.
  Priority is an explicitly attributed workflow field, not an AI risk or approval decision.
- [ ] Implement claim, release and authorized takeover with revisions. Two reviewers racing to claim
  must see one winner and an actionable conflict; no last-write-wins ownership change.
- [ ] Support explicit decline with reason and link/create review for further evidence work. Preserve
  a stable link and attribution without cloning a new review on every retry. Define how a later
  changed/withdrawn service decision affects the request's historical versus current use guidance.
- [ ] Restore separate requester/admin archive and unarchive actions. Neither deletes the request,
  changes its outcome nor hides it for the other audience. Email notification stays optional/deferred.

### P1-3 — Requester outcomes and integrated acceptance

- [ ] Staff can follow their request from submission through assignment to outcome, inspect permitted
  wording and find the related published staff guidance. One staff user cannot read another's request.
- [ ] Restore outcome detail and configured tier help; distinguish a decline, pending review,
  conditional use and withdrawn publication. Do not imply a request decision is family publication.
- [ ] Synthetic walkthrough: staff submits → reviewer claims → second reviewer loses a claim race →
  reviewer links a pasted review → records conditional district decision → explicitly publishes →
  staff sees permitted conditions → evidence correction withdraws publication → fresh decision and
  explicit republication → each audience archives independently → restore retains exact history.
- [ ] Also exercise declined, released, revoked-member, failed-save and lost-ack paths. Maintain
  exact unsaved text, accessible feedback/focus, 320px/200% behavior and no private-field exposure.
- [ ] Run `npm run ci`, `npm run test:integration` and serialized recovery checks for the new contracts;
  preserve the existing preview before reserving emulator ports. Perform browser acceptance on the
  assembled candidate, then append request/dashboard checks to the independent trial.

P1-1 may begin with the existing read-only review summaries after P1-0 defines count semantics;
request totals/actions depend on the new lifecycle. Do not make the dashboard depend on live AI.
Owner walkthrough of navigation, queues and outcomes is the milestone's product acceptance gate.

## Subsequent restoration and deliberate exclusions

P2 order: richer staff/family details and configured tier guide; reviewer facets/freshness;
CSV preview/import and bounded batch operations; safe analysis/report export; independent public
entry and embed workflow. Reassess exact field parity in the four tabs, especially source quality,
classification/disclosure distinctions and structured rostering information. Existing manual agreement facts remain; the DPA document module is excluded by owner decision.

Hosted identity/invitations, session policy, unrelated Drive/mail, live discovery
and model adapters remain separately qualified modules. DPA generation/signature/vendor-upload/delivery
restoration is intentionally excluded. Deletion/clear-library needs explicit
recovery semantics. Preserve useful behavior, but do not restore client secrets, unbounded jobs,
weak write validation or publication success disconnected from actual audience records.

## Improvements to preserve and consider for the original

See [the improvement and backport register](public-improvements.md). It records what is new or
stronger, which strengths were inherited, local evidence and limitations, and the dependencies of
a possible original-project patch. No row authorizes editing, migrating or deploying the original.
