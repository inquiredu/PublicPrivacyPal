# Contributing to PublicPrivacyPal

PublicPrivacyPal is an emulator-only development checkpoint for independently controlled district
installations. It is not a supported production release. Begin with [AGENTS.md](AGENTS.md), the
[open-source plan](docs/open-source-plan.md), [local setup](docs/local-development.md) and
[source provenance](docs/provenance.md).

## Prepare a small change

Use `inquiredu/PublicPrivacyPal` as the source and destination. Preserve existing work, identify the
base revision and keep each change small enough for another contributor to review. Explain the
problem, resulting behavior, compatibility impact, checks run and any steps not exercised.
Avoid unrelated formatting or dependency updates. Read the original implementation when changing
the established setup, reviewer cards, four-tab detail, staff catalogue or public notice.

The original repository and existing district instance are reference material only. Never start
the archived upstream app, execute its maintenance scripts, or connect this work to that district.
New local work uses synthetic fixtures and named `demo-` emulator projects. Do not use production
logins, exports or live analysis to reproduce a development issue.

Do not commit `.private/`, `.local/`, `config/local.json`, credentials, account files, backups,
offline policy packets, environment files, deployment bindings or real district/vendor fixtures.
Inspect the exact proposed diff and newly added files; ignore rules and the isolation check are
accidental-add safeguards. Preserve AGPL license notices and attribution for reviewed imported
code, and record its source in the provenance documentation. Do not copy upstream Git history or
operational documents into releasable source.

## Preserve the workflow contracts

Use [design continuity](docs/design-continuity-plan.md) to understand the existing experience and
reliability gates. Protect drafts, immutable historical versions and command receipts. Keep human
corrections, policy findings, deterministic scores, district decisions and explicit audience
projections separate. A reported successful publish or unpublish must match the actual public
state. New source, rubric, prompt or storage semantics require explicit version compatibility.

Add focused synthetic regressions for meaningful behavior and failure cases: omissions, exceptions,
contradictions, unresolved scope, incomplete sources, stale writes and ambiguous retries. Do not
change frozen historical hashes or expected outputs solely to make a test pass. Synthetic rubric
labels are development expectations, not independent policy adjudication.

Configuration, bootstrap and authorization work must follow [permissions](docs/permissions.md).
Model calls belong on the server; provider secrets must never reach a browser. Live providers,
automatic website fetching, production authentication/hosting, visibility changes, merges and
releases are separately scoped work, not incidental setup steps.

## Verify and hand off

Install Node 24, Java 21+ and Git, then use this checkout's pinned dependencies:

```sh
npm ci
npm run ci
```

`ci` checks TypeScript, unit tests, browser build and bundle/source isolation. It needs a Git
checkout with the independent origin. For authorization/API changes, also run
`npm run test:integration`. Storage, jobs, migrations and recovery changes additionally require
`npm run test:recovery`. The repository's GitHub workflow runs all three gates. Documentation
changes need local-link and command verification and explicit setup-test limitations; see the
[validation matrix](docs/parallel-work/validation.md).

Before either emulator suite, save and verify any running installation, stop its owned development
process and confirm its ports are free. Run integration and recovery serially. Afterward restore
the saved installation with its matching configuration and backup; do not bootstrap it. Never
stop an unknown process merely to free a port.

Report the exact source revision/workspace, commands, outcomes and unresolved limitations. Keep
private logs and credentials out of issues and patches. Request non-author review before treating
the increment as accepted. In an invoked parallel session, the coordinator controls the
[workboard](docs/parallel-work/workboard.json), shared contracts, resource queue and integration;
workers change only assigned files.

Startup diagnostic tests inject occupied-port, permission and other socket failures without binding
real ports. A passing injected-error test is distinct from starting the application. Record actual
startup and shutdown evidence under the shared runtime reservation; keep tool-permission delays
separate from application failures. A fresh clone operated by the implementation team is useful
setup evidence, but does not complete an independent person's adoption trial.

For potential vulnerabilities, follow [SECURITY.md](SECURITY.md) before sharing details.
