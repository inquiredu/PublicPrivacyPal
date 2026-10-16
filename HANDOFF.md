# PrivacyPal local handoff — complete service milestone

Updated October 15, 2026 (backup timestamps are October 16 UTC). The requested local checkpoint
and one complete service workflow are finished. No further work is scheduled.

## Boundaries and checkpoint

Work only in PublicPrivacyPal. The district instance and original `inquiredu/privacypal` repository
remain untouched. All records, accounts and agreement facts are synthetic and use the named local
demo emulators. Nothing was pushed, deployed, fetched from a vendor or sent to an AI service.
Read `AGENTS.md` before continuing.

Local commit **fae8d20** (`Checkpoint local setup, reliable reviews, and versioned storage`) preserves
the preceding setup, draft/receipt reliability and bounded 50-measure storage milestones. Branch:
`codex/open-source-audit`. The complete-service implementation is subsequent, uncommitted work;
preserve it and all existing files. No dependency changes were needed.

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

`.local/backups/2026-10-16T03-22-58-046Z-f00809dd-dfe1-49fb-93de-51e09a23a0e6`

It includes synthetic accounts, settings, complete service, evidence versions, decisions and public
projections. Keep older backups. The checkpoint's older backup reader must reject schema 4; never
relabel a manifest. Rollback uses the preserved pre-service schema-3 backup with compatible source.

With Node 24, Java 21+ and dependencies available, from this repository:

```sh
npm run dev -- --restore .local/backups/2026-10-16T03-22-58-046Z-f00809dd-dfe1-49fb-93de-51e09a23a0e6
```

Starting without `--restore` creates an empty session. Do not bootstrap over the saved installation.
Use the existing admin or dedicated `service-staff` account file under `.local/accounts/`; never
publish credentials. Save a verified backup before stopping a future session.

The final preview runs at http://127.0.0.1:5173/ from `/private/tmp/privacypal-setup-deps`, avoiding
occasional synced Documents filesystem stalls. Source/tests match this workspace. Node 24 is at
`/private/tmp/privacypal-runtime/node_modules/node/bin`; Java is at
`/private/tmp/privacypal-audit.aXzT2k/jdk/jdk-21.0.12.1+1/Contents/Home`; emulator cache is at
`/private/tmp/privacypal-audit.aXzT2k/emulators`. These paths are conveniences, not requirements.
This workspace holds the durable backup and validation evidence even if temporary files disappear.

## Next suggested work

1. Review the restored local service with the owner, especially configurable tier requirements and
   staff/family wording. Keep legal policy content district-owned.
2. Expand accessibility checks and reduce the approximately 1 MB main browser bundle. The existing
   build-size warning remains; no production performance/capacity claim is made.
3. Design expiry monitoring before real agreements: dates are rechecked at approval/publication,
   but there is no automatic time-triggered withdrawal. Card warnings summarize the last write.
4. Plan production provisioning, account turnover, encrypted retention and upgrade/rollback before
   deployment. Bulk/assignment workflows, tag browsing/dialogs, live AI/fetching, Drive, email and
   signing remain deferred. The repository remains emulator-only and is not release-ready.

References: `docs/service-detail.md`, `docs/review-storage.md`, `docs/review-workflow.md`,
`docs/backup-recovery.md`, `docs/design-continuity-plan.md`, and `docs/provenance.md`.
