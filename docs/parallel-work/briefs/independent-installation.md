# DOC-01 — Independent installation and contributor experience

You are the installation/documentation worker. Read AGENTS.md, README.md, HANDOFF.md,
`docs/local-development.md`, `docs/independent-trial.md`, `docs/permissions.md`,
`docs/backup-recovery.md`, `docs/dependencies.md` and the coordinator's baseline procedure.

Owned files: README.md, `docs/local-development.md`, `docs/independent-trial.md`, new
CONTRIBUTING.md, SECURITY.md, `docs/installation-readiness.md`, and `reports/DOC-01.md`.
Other policy/runtime/backup documents, scripts, dependencies and CI remain coordinator-owned.

## Deliverable

Give a new developer a truthful local setup path without private temporary directories or the
author's accounts. Prepare contribution and vulnerability-reporting guidance without publishing
the repository or claiming district adoption readiness.

## Work

1. Inspect the exact accepted baseline and commands. Inventory outdated statements and reconcile
   implemented versus planned features within your owned docs. Link to authoritative current
   schema/workflow docs rather than duplicating obsolete historical limits.
2. Use a disposable source-only copy with its own writable dependencies. Run `npm ci` on Node 24
   and verify package resolution and relevant non-runtime checks. Do not repair the saved preview
   by copying its private configuration or accounts. Record OS/runtime/prerequisites honestly.
3. Request the coordinator's emulator reservation before startup/bootstrap/restore tests. A fresh
   named demo installation may be bootstrapped; the existing saved installation must be restored.
   Record steps that could not be exercised instead of claiming a completed independent pilot.
4. Document startup, sign-in, roles, saved-session restoration, safe test sequencing, and common
   failures, including missing dependencies, port conflicts and synced-filesystem stalls.
5. Write contribution guidance covering small changes, synthetic fixtures, required checks, source
   provenance, publication boundaries, and secret/private-data exclusions.
6. Draft SECURITY.md with scope, supported-status limitations and what a report should contain.
   Do not invent a monitored address, enable repository security features or promise response times.
   Mark an unverified private reporting channel as a maintainer decision required before release;
   never direct sensitive vulnerability details into a public issue by default.
7. Record production provisioning, operating cost, authentication and support gaps as future work.
   Do not provision services, change settings/visibility, push, merge or create a release.

## Acceptance

Commands match the accepted source; clean-install results and untested steps are explicit. The
owner can review concrete CONTRIBUTING/SECURITY drafts and installation friction findings. License
and attribution remain intact. Reports contain no credentials, private logs or backup data.
