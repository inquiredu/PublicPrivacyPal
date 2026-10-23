# Independent local trial

Audience: someone trying the community edition on their own computer, without the author's accounts.
This is a synthetic local rehearsal, not a public hosting guide. It uses no district Firebase
project, cloud credential, AI key, mail service or real vendor policy. The software is AGPL-3.0;
a future hosted installation may incur infrastructure and provider costs.

## Trial record and completion rule

Checklist prepared October 22, 2026; **not yet executed by an independent participant**.
This checklist tests the current local slice, not full original-product parity. The next implementation
milestone is [dashboard/request restoration](component-parity.md#next-milestone-restore-dashboard-and-request-lifecycle).
Add its P1-3 walkthrough after implementation before claiming restored-workflow acceptance.
DPA generation, signing, vendor upload and delivery are excluded; existing manual agreement facts
in the optional full-service exercise remain independent of any legal-document system.
Use a person outside the implementation team on a separate computer. A maintainer may observe,
but record every hint, command intervention and workaround. If the maintainer takes over a task,
mark it assisted and repeat it independently after the instructions or product are fixed.

Keep a private copy of this checklist with one result per ID: **pass / fail / blocked / not run**,
plus independent or assisted, elapsed time, expected versus observed behavior and an issue reference.
Unchecked boxes are pending, never implied passes. Share only a redacted outcome report.

| Trial identity | Record before starting |
| --- | --- |
| Participant / observer | Names or agreed identifiers; confirm participant is outside implementation team |
| Date and machine | OS/version, architecture, browser/version; any assistive technology |
| Source | Repository, branch, exact commit and clean/modified state; documentation revision if different |
| Toolchain | Node, npm and Java versions; whether newly installed or preexisting |
| Downloads | Package/emulator cache present or absent; first-download failures and assistance |
| Installation | Selected synthetic configuration, demo project ID and district ID; no passwords |
| Evidence | Private notes location; sanitized issue references; backup ID/schema and verification result |

The implementation baseline is `186c48d505fa275e0e6eff769c4ceb6a11dbfb9f` on
`codex/coordinated-milestone-2026-10-19`; main does not yet contain these increments. Use the reviewed
trial candidate and record its actual commit, including any later fixes. Obtain source through the
participant's own authorized repository access; never share another person's GitHub credentials.
See [workstation handoff](workstation-handoff.md#get-the-complete-source) for cloning the branch.

### Core acceptance checklist

Complete every core row. Use the procedures below and linked walkthroughs; the checkboxes record
outcomes, not permission to change real systems. Start with practice reviews before adopting an
optional full rubric, so the first exercise does not require fifty manual findings.

- [ ] **T01 — Fresh installation.** Clone the correct branch on local disk, record `git rev-parse HEAD`
  and `git status --short`, select Node 24/Java 21+, install this checkout's dependencies and initialize
  configuration. Pass: no borrowed config/accounts/dependencies and only an explicit `demo-` project.
- [ ] **T02 — Startup/bootstrap.** Start services, bootstrap once, sign in through **For your district
  team**, then repeat bootstrap. Pass: the same account still works and the repeat preserves existing
  setup; it does not reset credentials. Record downloads, setup messages and any help needed.
- [ ] **T03 — Role boundaries.** Create reviewer, viewer and teacher identities using the commands
  below. Before assigning membership, confirm an identity cannot enter private reviews. Assign the
  three roles and sign in as each. Pass: reviewer can edit reviews; viewer can inspect but not mutate;
  staff can see staff guidance and submit their own tool request but cannot inspect private reviews
  or settings; anonymous visitors see only the public library. Check against [permissions](permissions.md).
- [ ] **T04 — Revocation with an existing session.** Keep the reviewer signed in in a separate browser
  profile, revoke that membership as admin, then revisit private review data and attempt an edit.
  Pass: further private access/saves are denied. Previously displayed text is not proof of continued
  access. Restore membership as admin for later steps; record any unexpected successful request.
- [ ] **T05 — Synthetic analysis/retry.** Create a uniquely named bundled review using **Missing and
  conflicting commitments** and inspect score/evidence. In a separate practice review use the
  temporary-failure fixture and its explicit retry. Pass: failure is visible, retry completes and
  neither analysis automatically approves or publishes a service. Use [review workflow](review-workflow.md).
- [ ] **T06 — Pasted evidence and draft protection.** Follow [Orchard Practice](synthetic-paste-walkthrough.md).
  Before saving an evidence draft, record its exact text privately, navigate away/back and reload
  the same tab. Pass: wording survives; a fabricated quote is rejected; literal script-like policy
  text does not execute. Complete the eight authored findings and confirm the expected 64/100.
  These labels are synthetic test inputs, not district rubric approval.
- [ ] **T07 — Actual publication/removal.** Record an explicit conditional decision with public
  summary/category/conditions and distinct private rationale. Publish locally. In a signed-out
  browser verify the actual entry and allowed wording, with no private source/rationale/reviewer
  details. Unpublish, refresh the anonymous library and confirm removal. A success badge alone
  does not pass. Record a fresh decision if required and republish for the next step.
- [ ] **T08 — Correction and fresh decision.** Change Orchard Collection to Partial as the walkthrough
  specifies. Pass: score becomes 57, actual public entry disappears, earlier decision becomes stale
  and republication requires a fresh decision. Confirm old/new evidence in private history, then
  explicitly decide and republish. Preserve this review as the recovery sample.
- [ ] **T09 — Setup and audience workflow.** As admin inspect the six-part Settings and save a uniquely
  named synthetic library title. Verify reload and anonymous appearance. Inspect all four service
  tabs and staff guidance/conditions. Pass: score, district decision and publication are distinguishable;
  changing settings does not silently rescore the existing Orchard review. Record confusing wording
  and any missing destination. Do not treat this as owner acceptance of every restored feature.
- [ ] **T10 — Segmented example and unresolved handoff.** Follow [the Lantern lab](segmented-reviews.md):
  save its exact example, run source ranges, synthesize, inspect original responses and create an
  unresolved human draft. Save unfinished evidence. Pass: missing annex/contradiction stays visible,
  no automatic finding acceptance, no aggregate approval/publication, and reload retains saved work.
- [ ] **T11 — Keyboard and validation.** Without a mouse, reach main navigation, review tabs and
  source controls. Create an empty linked-material label, activate its validation-summary link and
  verify focus reaches the corresponding field without losing text. Correct it. Check 320 CSS-pixel
  reflow and 200% zoom. Pass: controls remain reachable and readable; record browser/method. This
  does not close spoken screen-reader, full contrast or 400% acceptance gaps.
- [ ] **T12 — Save and verify.** Inventory the trial's review names, scores/decisions/publication,
  one history event, saved settings, role assignments and Lantern attempts. Run backup, wait for
  saved/verified, then independently verify the printed directory. Pass: both commands succeed;
  record backup ID/schema and preserve the original account passwords privately. An archive
  containing Lantern runs requires schema 10. Browser drafts are not part of this inventory.
- [ ] **T13 — Restore.** Stop only this trial's services, restore the exact verified archive with the
  same configuration/source/lockfile and do not bootstrap. Pass: original credentials work, the T12
  inventory matches, public wording remains correct and viewer/staff restrictions still hold.
  Verify saved evidence/history and Lantern original responses, not just review counts.
- [ ] **T14 — Automated checks and final preservation.** Save/verify any new changes, stop services,
  then run CI, integration and recovery sequentially as below. Record each exit result and failures,
  then restore the trial archive again and sign in. Pass: all checks and restored access succeed.
  Do not compare only the historical test totals or discard failure logs.
- [ ] **T15 — Debrief and disposition.** Participant explains evidence versus score versus district
  decision, where staff find conditions, what families see, and how to restore. Record confusion,
  assistance and unresolved issues. Assign each failure an owner and retest; observer and participant
  date the outcome. Mark the trial accepted only when all core rows pass independently after retests.

Stop dependent steps on unexpected private-data exposure, unauthorized mutation, lost saved work,
wrong configuration or failed backup verification. Preserve private evidence and report the failed
row; do not force a restore, edit an archive or weaken guards to complete the checklist. A blocked
trial is a useful result and must remain blocked until its cause is resolved.

### Additional acceptance tracks — report separately

- [ ] **E01 — Full service requirements.** Follow [service detail](service-detail.md#repeatable-synthetic-acceptance)
  with an explicitly adopted tier policy and all enabled measures. Verify an unknown required DPA
  blocks approval, then use fictional agreement facts and repeat correction/withdrawal. The documented
  API-populated 50-measure fixture was team QA; do not report it as this participant's manual review.
- [ ] **E02 — Second configuration.** Save/verify/stop the first installation, then follow the River
  Valley procedure below. Verify independent accounts/data and restore each with its own configuration.
- [ ] **E03 — Assistive technology.** Execute the spoken VoiceOver/NVDA and visual-mode checks in
  [accessibility review](accessibility-review.md). Record actual announcements and ratios separately.
- [ ] **E04 — Policy adjudication.** Independent qualified reviewers follow [rubric next](rubric-next.md)
  and [precision](rubric-precision.md); record normative decisions and disagreements. Completing
  this user trial does not approve a rubric.

Core acceptance demonstrates the scoped local workflow only. Unrun additional tracks remain open;
none of these results establishes production hosting, provider quality or release readiness.

### Redacted issue / outcome template

```text
Trial ID / source commit / documentation revision:
Checklist ID / result / independent or assisted / elapsed time:
Expected behavior:
Observed behavior and minimal synthetic reproduction:
Exact error message (remove tokens, passwords and private paths):
Assistance or workaround used:
Impact: blocks setup / access boundary / lost work / usability / documentation
Issue owner / reference / next action:
Retest commit / date / result:
Final trial disposition / participant / observer / date:
Open additional tracks:
```

Do not attach account files, backups, tokens or raw logs containing secrets. Retain original logs
privately and provide a sanitized excerpt. A clean-install failure and an assisted completion must
remain visible in the final outcome, even when a later retest succeeds.

## Prepare a copy

Use the independent `inquiredu/PublicPrivacyPal` repository, then open a terminal in its directory.
Keep a Git/source revision with your eventual backups. Install Node 24 and Java 21 or newer.
If you use nvm, `nvm use` selects the repository's Node version. Verify with `node --version` and
`java -version`. The first install/download requires internet access to dependency and emulator
distributors; the application itself runs locally.
Start from a fresh checkout with its own `node_modules`. Do not copy another installation's local
configuration, accounts, backups, `.private` directory, deployment bindings or dependencies.
The commands below use the default synthetic configuration. If choosing the second example,
set `PRIVACYPAL_CONFIG=config/second-district.example.json` for every dev/operator command and use
its `river.example` accounts instead of the Maple examples.

```sh
npm ci
npm run local:init
```

Inspect `config/local.json`. For this trial, keep the synthetic Maple Grove defaults, or use the
provided `config/second-district.example.json`. Project IDs must begin `demo-`; allowed email domains
must end `.example` or `.test`. The application rejects production project IDs and real email
domains in this local mode.
Do not substitute your district's real project IDs or accounts. The config contains no passwords.

## Start and enter the staff workspace

In the first terminal:

```sh
npm run dev
```

Wait for the local browser address. In a second terminal, in the same directory and Node version:

```sh
npm run local:bootstrap
```

Open the credential file printed by that command. It contains the administrator email and a random
local password. Open http://127.0.0.1:5173 and refresh/check again if the setup screen remains.
The default page is the **public library**. Scroll to **For your district team**, sign in there, then
choose **Policy reviews** or **People & access** in the sidebar. The public view alone does not mean
the administrative workspace is missing.

The bootstrap command refuses to replace an existing administrator or adopt a preclaimed account.
If you have an uninitialized disposable trial with a conflicting sign-up, stop and start an empty
session, then bootstrap before creating any other accounts.

## Rehearse a colleague's access

```sh
npm run local:user -- --email reviewer@maple.example
npm run local:user -- --email viewer@maple.example
npm run local:user -- --email teacher@maple.example
```

Use **People & access** as admin to assign reviewer, read-only reviewer and staff respectively.
Creating an identity alone grants no private access. Sign out and use each generated local password
to check what that role sees. Reviewers can analyze/decide/publish; viewers can inspect; staff can
request tools but cannot inspect private reviews. Revoke a test membership and confirm access ends.
Return to the admin account for the rest of the rehearsal.

## Complete a review and recover it

1. For T05, open **Policy reviews**, choose **Bundled synthetic policy**, a fictional name, and **Missing and conflicting commitments**.
   Keep **Evidence-first candidate** selected. Analyze, then inspect the score and exact quotations.
2. Expand **Review the scoring rubric**. Compare a separate practice review using the inherited profile.
   The [scoring rubric](scoring-rubric.md) records the expected fixture scores and their meaning.
   Record unresolved policy questions there; neither version has district sign-off.
3. Record a conditional decision, internal rationale, public summary, category and conditions.
   Publish locally. Sign out and verify only the intended public wording appears. Sign back in
   and unpublish; verify the entry disappears. Try the temporary-failure fixture and retry it.
4. Follow [backup and recovery](backup-recovery.md) to save the complete installation, stop the
   services, restore it, and sign in with the same credentials. Do not bootstrap the restored session.
   Check private history and role limits. The archive preserves saved accounts and records, but does
   not include browser drafts, plaintext sign-in files or separate offline qualification packets.

To use the second example, save and verify the first session, stop it, and consistently set
`PRIVACYPAL_CONFIG=config/second-district.example.json` for dev, bootstrap, user and backup commands.
Its sample accounts use `river.example`. Each installation's backup is bound to its own configuration.

## Run the checks and record the outcome

Save your sandbox first and stop development services. Run:

```sh
npm run ci
npm run test:integration
npm run test:recovery
```

Then restart your sandbox using its backup. An `EADDRINUSE` port conflict means another local
process owns a required port; identify its owner and preserve its data before deliberately stopping
it. `EACCES` or `EPERM` instead identifies a bind-permission failure; check the local terminal or
tool permission boundary and retry the same documented command once authorized.
Run integration and recovery one at a time, even when using different demo project names.
If local source files repeatedly stall in a cloud-synced folder, keep a working copy on local disk
and rerun the pinned install there. Never copy an old app's deployment settings into this project.

For an independent trial, record the source revision, OS, Node/Java versions, setup friction, rubric
questions, and whether sign-in, role checks, publication/removal and recovery matched expectations.
Do not include passwords or backup files in feedback. One successful automated rehearsal does not
replace this independent user trial. Live hosting, real-policy extraction, a district-approved profile,
accessibility review, encrypted operational backups and upgrade recovery remain release work.
Use [installation readiness](installation-readiness.md) to distinguish the current automated
and implementation-team installation rehearsals from an independent person's completed trial. See
[setup troubleshooting](local-development.md#common-setup-failures) for common failures.

## Try pasted text and corrections

Use **Paste policy text** with an authored fictional policy and the eight-measure practice profile.
A copyable example and suggested findings are in
[the synthetic paste walkthrough](synthetic-paste-walkthrough.md). Confirm that:

- The new review begins with zero completed criteria and cannot be approved or published.
- Exact source selection and pasted quotations both work; ambiguous quotes require selection.
- Multiple passages can capture a promise and its exception. A fabricated quotation is rejected.
- Completing all eight practice findings enables a decision, subject to any explicitly adopted
  service requirements. Full-rubric reviews require all their enabled measures instead.
  Saving an evidence correction after publication
  removes the public entry and requires a fresh decision before publishing again.
- History records the old and new findings and authenticated reviewer. Source text and rationales
  do not appear in the anonymous library.
- A supported practice export/import creates a new unreviewed draft; backup/restore preserves the
  original review. Full-rubric/bundle inspection archives require explicit recapture rather than
  automatic import; see [review storage](review-storage.md) and [source bundles](source-bundles.md).

These interactions passed the local browser walkthrough recorded in `provenance.md` on 2026-10-15.
Repeat them during an independent adopter trial; that broader acceptance remains outstanding.

## Explore the complete workflow separately

Follow [service detail](service-detail.md) to explicitly adopt a synthetic district tier policy and
use the four review tabs, staff catalogue and family notice. Keep policy findings, calculated score,
district decision and publication status separate when recording the outcome. Settings and rubric
changes do not rescore historical reviews.

[Pasted document sets](source-bundles.md) and [long-policy coverage](source-segments.md) add explicit
scope, dependencies and missing-material review. A missing required document or unreviewed range
cannot be resolved by a generic note. Available evidence can be saved as unfinished work without
an aggregate score or approval. Source and dependency changes require a new review.

The recorded Cedar suggestions, saved Lantern lab and offline segment tools demonstrate contracts and failure handling.
They do not enable a live provider, automatic fetching or automatic acceptance of model findings.
No production credentials or real policies are required for any step in this trial.

## Request workflow increment

Run the [request lifecycle acceptance checklist](request-workflow.md#independent-local-acceptance)
with separate synthetic staff/reviewer/admin accounts. This adds states, permissions, private history,
archive separation, draft continuity and response-loss reconciliation. Dashboard totals and dedicated
queues are still pending; do not mark the whole restoration milestone accepted from these tests.
DPA automation remains excluded.

### Request dashboard follow-up

- [ ] With more than 20 synthetic requests, compare dashboard totals with all pages of each queue.
- [ ] Open a total and an attention row using keyboard only; verify correct queue/detail and focus.
- [ ] Verify staff/read-only reviewers see only their own totals; reviewers/admins see district work.
- [ ] Archive independently in each audience; verify counts change in only the relevant view.
- [ ] Claim/release/decide a request; return to Dashboard and verify refreshed totals/attention.
- [ ] Interrupt API access: totals must say unavailable, never zero. Restore access and refresh.
- [ ] Revoke membership and verify dashboard/detail access disappears. Navigate away from a partial
      request/review draft and return; confirm text and unresolved command identity are preserved.

Review/publication dashboard follow-up: complete the [dashboard acceptance checklist](review-dashboard.md#independent-acceptance), including publication totals, queue navigation and draft continuity.

Tier/search follow-up: compare tier totals with queues, combine name/tier/attention filters across pages, test no matches and clear filters, then verify filter retention after opening review details.
