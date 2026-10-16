# PrivacyPal local handoff — parked

Parked at the owner's request on October 15, 2026 (final backup timestamps are October 16 UTC).
No further feature work is scheduled. The local preview and demo emulators were stopped cleanly.

## Boundaries

Work only in PublicPrivacyPal. Keep the existing district instance and original
`inquiredu/privacypal` repository untouched. Use synthetic data, local demo emulators and local
accounts. Do not start the archived upstream app or its maintenance scripts. Nothing was pushed,
deployed, authenticated against production, fetched from a vendor, or sent to an AI service.
Read `AGENTS.md` before resuming.

## Completed checkpoint

- District-neutral administration and tested role permissions.
- Original setup and library customization adapted to local persistence.
- Manual pasted-policy review, exact quotations, editable evidence, deterministic scoring,
  human decisions, atomic publication/withdrawal and fresh-decision republication.
- Tab-scoped draft protection and command receipts for reliable save/retry reconciliation.
- Versioned, bounded review storage supporting the optional original 50-measure framework.
  Each new full-rubric review explicitly adopts saved settings and a scoring engine. Existing
  reviews retain their source, rubric and arithmetic. Lists/history are paged and detail loads
  on selection. Legacy local records migrate under maintenance with resumable failure handling.

The original reviewer cards and four-tab service detail have **not** yet been restored. The owner
wants refinement of that existing design, preserving its useful detail and workflow. The current
simplified review screen is a development surface.

## Verified state

Latest checks passed: 83 unit/isolation tests, 113 emulator integration tests, TypeScript/build,
source/bundle isolation, and two complete backup/restore cycles. These include maximum-length
Unicode evidence across 50 measures, prior evaluation retrieval, 1,000-summary pagination,
permission denials, stale settings, concurrent/failed writes and legacy migration/recovery.

Browser checks confirmed the earlier published Orchard QA review remains 57/100. A new private
`Cedar Full Rubric — Browser QA` uses settings revision 1, has one of 50 measures reviewed and a
provisional score of 1/100, and retains the evidence/rationale correction after reload. The public
library still has four synthetic resources. Full review publication/correction/republication is
covered by automated tests. Console inspection returned no warnings/errors.

Evidence and the machine-readable receipt are under `.local/validation/review-storage/`.
The existing browser bundle size warning remains open; no production performance or capacity
claim is made. No dependency changes were introduced during the storage milestone.

## Saved state and restart

A fresh final backup was verified, copied into this workspace, and verified again before parking:

`.local/backups/2026-10-16T01-39-15-960Z-78e01fbc-8b37-4cdb-a5f2-6aa07c4088f1`

It is a schema-3 whole-installation backup containing synthetic accounts, settings, reviews,
versions, decisions and projections. Existing local passwords still apply. Earlier backups,
including the pre-migration schema-2 archive, remain preserved. Never relabel manifests.

With Node 24, Java 21+ and dependencies available, from this repository:

```sh
npm run dev -- --restore .local/backups/2026-10-16T01-39-15-960Z-78e01fbc-8b37-4cdb-a5f2-6aa07c4088f1
```

Starting without `--restore` creates an empty emulator session. Do not bootstrap over the saved
installation. Use the existing local account file under `.local/accounts/`; do not copy passwords
into this handoff or source control. Save a verified backup before stopping a future session.

Validation and the preview ran from `/private/tmp/privacypal-setup-deps` to avoid occasional synced
Documents filesystem stalls. Source, tests, rules, manifests and documentation matched the original
workspace at the storage checkpoint. The original workspace holds the final backup and logs, so
preserve those even if the temporary directory disappears. Its toolchain was Node 24 from
`/private/tmp/privacypal-runtime/node_modules/node/bin`, Java from
`/private/tmp/privacypal-audit.aXzT2k/jdk/jdk-21.0.12.1+1/Contents/Home`, and emulator cache from
`/private/tmp/privacypal-audit.aXzT2k/emulators`. Temporary paths are conveniences, not installation
requirements.

## Git state

Branch: `codex/open-source-audit`. Last committed baseline: `9523fbd`. Subsequent milestones remain
uncommitted, including this storage work and handoff. Preserve all existing edits and untracked
source/tests; do not reset or clean the checkout. No commit or push was made while parking.

## Next authorized direction when the owner resumes

Resume at `docs/design-continuity-plan.md`: restore one complete service through the original
reviewer card and four tabs, using this tested storage contract. Read the pinned original source
before adapting each surface. Preserve tier requirements, DPA/rostering facts, conditions,
classification, human corrections, evidence coverage and audience-specific publication preview.
Use a synthetic example with an unresolved DPA, missing policy statements, an evidence correction,
and a fresh decision before republication. Keep district approval separate from score.

Do not start that milestone until the owner resumes work. Main references:

- `docs/review-storage.md` — architecture, byte/page limits, API and migration.
- `docs/review-workflow.md` — evidence, drafts, retry and publication semantics.
- `docs/backup-recovery.md` — restore, maintenance and failure procedures.
- `docs/design-continuity-plan.md` — original feature map and reliability decisions.
- `docs/provenance.md` — implementation and validation evidence.

Remaining release work includes the original service experience, broader accessibility and
performance verification, production provisioning, account turnover, encrypted retention and
production upgrade/rollback. Live AI, fetching, Drive, mail and signing remain deferred.
