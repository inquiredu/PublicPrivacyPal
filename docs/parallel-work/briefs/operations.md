# OPS-01 — District operation and recovery design

Follow-up assignment; start with the coordinator's baseline and resource ownership. Read AGENTS.md,
`docs/permissions.md`, `docs/backup-recovery.md`, `docs/open-source-plan.md`,
`docs/service-detail.md`, and DOC-01 findings.

Initial ownership: `docs/operations-readiness.md`, `docs/upgrade-rehearsal-plan.md`, and
`reports/OPS-01.md`. Runtime scripts, auth, CI, deployment targets, backups and provider settings
remain coordinator-owned.

Prepare operator workflows for district provisioning, verified authentication, initial admin setup,
administrator succession/recovery, membership revocation and secret rotation. Keep control of
district records independent of an employee's account.

Design encrypted/off-device backup retention, key recovery, expiry review, migration and failed-
upgrade rollback. Separate Firestore/Auth installation archives from private offline qualification
packets and account files. Never relabel a backup manifest to bypass compatibility checks.

Specify a synthetic disposable rehearsal with exact before/after records, rollback criteria and
failure injection. Distinguish existing tested local legacy conversions from a general production
upgrade strategy. Reserve shared emulators before any authorized rehearsal; preserve and restore
the existing preview through the coordinator.

Identify agreement-expiry monitoring and public-library availability needs, including what happens
when an agreement expires after publication. Describe required operator decisions and operating
cost categories without promising free hosting or a specific cost unsupported by measurements.

Acceptance: concrete runbooks/designs, testable rehearsal steps, ownership and outstanding pilot
decisions. Do not provision cloud services, configure production identity, rotate credentials,
enable monitoring jobs, deploy or modify the district instance.
