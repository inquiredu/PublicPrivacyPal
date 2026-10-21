# OPS-02 — Read-only operator readiness and restore failure evidence

Read AGENTS.md, HANDOFF.md, original operations brief, local-development, permissions,
backup-recovery, operations-readiness, upgrade-rehearsal-plan and OPS-002-read-only in contracts.
The exact exclusive allowlist is in adoptionWave.assignments. Do not delegate, commit or own runtime.

Implement a read-only local operator check, exposed by scripts/operations-check.ts. The coordinator
will register npm run local:check. Use existing demo/config/emulator guards. Inspect installation
configuration, protected administrator Auth/membership consistency, active maintenance, and the
presence of another enabled verified active administrator. Optionally verify an explicitly supplied
backup using the existing verifier and exact current configuration. It must not create accounts,
promote/revoke memberships, change configuration, release maintenance, bootstrap or restore.

Provide plain output and --json with stable check codes/statuses; never output passwords, tokens,
Auth exports, raw user records or account identifiers. Missing/invalid installation or protected admin,
active maintenance, unavailable emulators or supplied invalid backup must fail clearly; absent second
admin is an advisory, not proof that succession is safe. No supplied archive means backup not checked.
No result may claim production readiness, recoverability from total admin loss, or retirement of the
protected initial admin. All mutating succession authority remains unimplemented.

Add focused pure checks and emulator tests for read-only behavior and malformed/disabled/unverified/
mismatched protected admin states; exercise current finish-restore refusals where possible without
modifying backup hooks. Request registration/runtime from coordinator; do not start test emulators.
Update the operations/rehearsal documents with actual behavior and a concrete versioned succession
proposal identifying attestation, configuration/backup compatibility, replay and rollback decisions.
The proposal must not silently become a new promotion path. Deliver OPS-02.md for non-author review.
