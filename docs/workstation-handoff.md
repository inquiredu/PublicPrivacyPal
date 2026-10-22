# Continue from another workstation

Checkpoint updated October 20, 2026 for `inquiredu/PublicPrivacyPal` on
`codex/coordinated-milestone-2026-10-19`. The owner authorized committing and pushing this work.
This is a development checkpoint; it does not merge the branch into `main` or authorize deployment.

## Get the complete source

Use a GitHub account with access to this repository. In a local disk directory outside a synced
Documents/Desktop folder:

```sh
git clone --branch codex/coordinated-milestone-2026-10-19 https://github.com/inquiredu/PublicPrivacyPal.git
cd PublicPrivacyPal
git status --short
git rev-parse HEAD
```

Record the returned commit as the starting revision. The clone includes the implementation, pinned
dependencies, synthetic fixtures, tests, accepted contract decisions, scoped follow-up proposals and
the first-wave, follow-up, segmented-implementation and adoption-wave reports. A new session does not inherit the previous session's running agents
or resource reservations. Preserve any local edits before changing an existing checkout.

Start with [AGENTS.md](../AGENTS.md), [HANDOFF.md](../HANDOFF.md),
[the current coordinator report](parallel-work/reports/coordinator-adoption.md),
[the contract log](parallel-work/contracts.md) and [the workboard](parallel-work/workboard.json).
The original kickoff manifest describes the pre-milestone baseline at `cb5bb04`; it is intentionally
unchanged and is not a hash inventory for this completed checkpoint. Record the current Git revision
and a new source baseline before assigning the next increment. Historical local paths and agent
names in the workboard are evidence references, not dependencies available on the new computer.

## Install and verify

Install/select Node 24 and Java 21 or later, then check their versions in the terminal. With those
prerequisites available:

```sh
npm ci
npm run ci
npm run test:integration
npm run test:recovery
```

Run integration and recovery sequentially while no development emulator session owns the ports.
They use disposable synthetic data. The first package/emulator downloads need network access;
no Firebase login, district credentials or AI keys are required. If the session cannot run Java,
bind local ports or download dependencies, record the unrun checks instead of claiming a runtime
pass. Do not weaken the emulator guards or substitute a live project.

The October 20 assembled implementation passed 544 unit/isolation tests, TypeScript, build and
bundle limits, and 224 emulator integration tests. The current coordinator report records recovery
and browser evidence separately. These are observed checks on the original workstation, not a
claim that a new workstation has already passed. GitHub's existing workflow also runs the
unit/build/isolation, integration and recovery gates on pushes.

## Start a fresh synthetic preview

After verification, follow [local development](local-development.md) or
[the independent trial](independent-trial.md). In the first terminal:

```sh
npm run local:init
npm run dev
```

Once the services are ready, in a second terminal in the same checkout:

```sh
npm run local:bootstrap
```

Use the newly generated local credentials and http://127.0.0.1:5173/. This is a fresh synthetic
installation with its own sample records and accounts. It does not contain the previous Mac's ten
saved reviews, five public entries or administrator password. Keep emulator services on loopback.
Source work and CI can continue without that saved installation.

## What remains private on the original Mac

GitHub deliberately excludes `.private/`, `.local/`, `config/local.json`, account/password files,
installation backups, browser drafts, private audit evidence and local evaluation packets. It also
excludes dependencies and generated builds. The previous Mac's temporary runtime paths are not
portable installation instructions. The committed reports preserve the conclusions and limitations;
do not claim to have read private evidence that is unavailable in the new session.

The last verified installation archive and source checkpoint are referenced in the current local
handoff. Continuing that exact saved installation requires a separate private transfer of its trusted
backup, matching synthetic configuration and required sign-in information. Do not commit those
artifacts to GitHub. Follow [backup and recovery](backup-recovery.md), verify the archive against the
matching source/lockfile/configuration, and restore without bootstrapping. No private transfer is
performed by this source checkpoint.

## Remaining implementation boundaries

The dependency/exclusion editor, definition freshness checks and durable synthetic segmented lab
are implemented. The lab retains original responses and opens explicit unresolved human drafts;
see [its walkthrough](segmented-reviews.md). Only the exact authored Lantern source is eligible.
Live provider admission, billing reconciliation, general model-output adoption and provider
qualification remain open. A fresh-clone synthetic installation/API/backup/restore trial and focused keyboard/draft/320px/200%
checks passed. Human rubric adjudication, an outside-person adoption pilot, screen-reader coverage
and broader accessibility verification remain open. The read-only `npm run local:check` is
implemented; protected-administrator succession remains a proposal.
Use the coordinator report to choose and assign the next bounded increment. Keep human corrections,
historical versions, drafts, receipt replay, deterministic scoring and district decisions intact.
The existing district instance and original repository remain untouched; live calls, deployment,
publication, releases, repository visibility changes and main merges need separate authorization.
