# Local development

This milestone is a standalone local application. It deliberately accepts only `demo-` project IDs,
loopback emulator endpoints, and synthetic `.example`/`.test` email domains. It has no deployment
configuration and makes no AI, mail, Drive, or production database calls.

## First run

Use a checkout of `inquiredu/PublicPrivacyPal`, with Git available, and run commands from its root.
Install Node 24 (use `.nvmrc` with your runtime manager) and Java 21 or later.
Check `node --version`, `npm --version` and `java -version` in every terminal used for the trial.
If Java is installed in a nonstandard location, set `JAVA_HOME` to its runtime directory.
No Firebase login or cloud credentials are needed. Package installation and the initial emulator
download require internet access; an existing package/emulator cache can avoid some downloads.
The repository does not install Node or Java for you.

1. Run `npm ci`, then `npm run local:init`.
2. Inspect `config/local.json`. It contains a synthetic district name, stable district ID,
   demo project ID, allowed synthetic domains, and bootstrap administrator email. It contains no secrets.
3. Run `npm run dev`. Keep this terminal open.
4. In another terminal run `npm run local:bootstrap` using the same Node version and configuration.
5. Open the generated file path printed by the operator command. Its random password works only in
   this local emulator. Open http://127.0.0.1:5173, click **Check again** if setup is still displayed,
   and sign in with the local credentials.

The command will not replace an initialized administrator. If the configured email already exists
before bootstrap, it refuses to adopt that account. This prevents a first visitor from preclaiming
the administrator email and inheriting authority. Restart empty emulators to recover a local trial.

The development launcher owns the browser server, API and emulators and shuts them down together
on Ctrl+C:

| Service | Address |
| --- | --- |
| Browser/Vite | `127.0.0.1:5173` |
| Local API | `127.0.0.1:8787` |
| Auth emulator | `127.0.0.1:9099` |
| Firestore emulator | `127.0.0.1:8080` |

The emulator hub also uses ports 4400/4500, and the Firestore websocket uses 9150. All installations
and emulator suites share these fixed ports on one computer, even with different demo project IDs.
An occupied port (`EADDRINUSE`) stops startup. Permission failures (`EACCES` or `EPERM`) identify
the loopback address and require checking local bind permissions or sandbox restrictions. Other
socket failures retain their original cause. Keep the documented endpoints for every case.

Save the whole sandbox with `npm run local:backup` while services are running, then restart with
`npm run dev -- --restore .local/backups/YOUR_COMPLETED_DIRECTORY`. There is no automatic save on
shutdown. Without `--restore`, a new session is empty and needs bootstrap again; old sign-in files
will not work in that empty session. A restored session keeps its accounts and passwords. See
[backup and recovery](backup-recovery.md) for checks, failure handling and the tested rehearsal.
Supported individual review imports are separate operations that create new unpublished drafts.
Some newer review export formats are inspection archives and must be explicitly recaptured;
see [review workflow](review-workflow.md) and [source bundles](source-bundles.md).
Browser tab drafts and offline qualification packet files are not installation-backup contents.
Keep important unsaved wording and separate offline artifacts privately before closing their tab
or moving the installation. Plaintext account files are also separate from the installation archive.

## Team access

Run `npm run local:user -- --email teacher@maple.example` (use your configured synthetic domain).
This creates an enabled, verified **emulator identity**, without a membership. It is a local stand-in
for future verified authentication, not a production email-verification mechanism.

An administrator then opens **People & access**, enters the email, and selects a role. Roles can be
changed or revoked there. The initial administrator is protected, and administrators cannot change
their own membership. Every successful membership change records an attributed server audit event.

Bootstrap creates three fictional public sample records. Later public visitors see those samples
and explicitly published review projections; unpublished/private review data is not public.
Signed-in members can submit requests.
Reviewers can edit internal sample notes. Read-only reviewers can inspect notes but cannot save
changes. Staff cannot read internal notes or district settings. Review decisions, analysis jobs,
and publication are available in **Policy reviews**; see [review workflow](review-workflow.md).
Manual agreement facts and pasted policy-document sets are implemented. DPA generation/signing,
mail, Drive, automatic website capture and live model dispatch remain deferred.

Administrators can open **Settings** for the original six-part district setup and **Customize
Library** for appearance, notices, footer sections and display preferences. PDF context import
works locally; live law discovery and external integrations remain unavailable. See
`district-setup.md` for the workflow. Pasted reviews may explicitly adopt the saved full rubric;
practice reviews keep their own definitions. See `review-storage.md` for versioning and local migration.

## Try another district

Save and verify the first installation, then stop its local server. Use the second synthetic
configuration consistently for development and every operator command. Run bootstrap in another
terminal only after the new, empty emulator session is ready:

```sh
PRIVACYPAL_CONFIG=config/second-district.example.json npm run dev
PRIVACYPAL_CONFIG=config/second-district.example.json npm run local:bootstrap
PRIVACYPAL_CONFIG=config/second-district.example.json npm run local:user -- --email teacher@river.example
PRIVACYPAL_CONFIG=config/second-district.example.json npm run local:backup
```

It has a different demo project, district ID, name, domain, administrator, and identity/data store.
No files containing actual district settings need to be edited. Integration tests initialize this
second configuration and verify separation. Existing installation identity fields cannot be changed
in place; use a separate demo project for a different installation.
To return to a saved second installation, set the same `PRIVACYPAL_CONFIG` when verifying its backup
and running `npm run dev -- --restore BACKUP_DIRECTORY`. Do not bootstrap after restoration.

## Verification

`npm run ci` runs strict TypeScript checks, unit/isolation tests, the browser build, and source/bundle
isolation checks. `npm run test:integration` starts fresh Auth/Firestore emulators, checks actual
security rules with synthetic identities, and calls the HTTP API using emulator-issued ID tokens.
No Firebase login is required. `npm run test:recovery` imports a schema-9 fixture, then runs two
schema-10 shutdown/import cycles and checks accounts, permissions and saved data recovery. Run integration
and recovery serially. Save and verify your sandbox, then stop the development server first to free
its ports. Restore your saved installation after the tests; the test emulators are disposable.

Dependencies are pinned in `package-lock.json`. See [dependency review](dependencies.md) for the
targeted override and remaining development-tool advisories. Runtime secrets, credentials, reference
material, and local configuration are excluded from Git; Vite denies access to those paths as well.

## Common setup failures

| Symptom | Next step |
| --- | --- |
| Wrong Node version or no Java runtime | Select Node 24 and install/select Java 21+, then check versions in both terminals. Do not rely on another developer's temporary runtime path. |
| Missing `tsx`, `pdfjs-dist`, Firebase CLI or another pinned dependency | Run `npm ci` in this checkout with Node 24. Do not borrow a different checkout's `node_modules` or replace the lockfile. |
| Package or emulator download fails | Check access to the dependency/emulator distributor and retry the same pinned command. A cached install does not prove a first download works on a new computer. |
| Port is occupied (`EADDRINUSE`) | Identify the process and its owner. Save/verify its installation before deliberately stopping it. Do not kill an unknown process or run two emulator sessions together. |
| Permission denied binding a loopback port (`EACCES` / `EPERM`) | Check local bind permissions and the terminal/tool sandbox. Use the environment's authorized permission mechanism to retry the same local command; do not change ports or disable the fresh-session check. |
| Another socket failure | Read the retained error code/cause and investigate that failure before retrying. The launcher does not label every socket error as an occupied port. |
| Cloud-credential or emulator-endpoint refusal | Use a clean development shell with the documented loopback endpoints. Leave existing district credentials and services untouched. |
| Old password fails after a restart | Check whether the launcher used the matching verified backup. An empty session has no previous accounts. Restore the saved installation rather than treating bootstrap as password recovery. |
| Bootstrap says already initialized | Existing accounts, roles and passwords were preserved. Use the original local account file; bootstrap does not reset it. |
| Restore rejects configuration, schema or lockfile | Keep the archive intact and use its matching source/configuration. Follow [backup recovery](backup-recovery.md); never relabel the manifest. |
| File reads or checks stall in a synced folder | Preserve the original source and private artifacts. Use a separate source-only checkout on local disk, install its own dependencies, and compare its revision before retrying. Do not copy `.private`, `.local`, local config, deployment bindings or another checkout's dependencies into a fresh trial. |

`npm run check:isolation` inventories Git-tracked and unignored source and verifies the independent
origin. A source ZIP without Git metadata is insufficient for that check; use a normal checkout for
contributor verification. Passing the guard is not a complete secret scan. Observed results and
unexercised setup steps are recorded in [installation readiness](installation-readiness.md).

## Isolation limits and future deployment

Firebase emulators intentionally simulate authentication and permit privileged local testing. They
are not production security services. Bind them to loopback and never expose them to a public
network. Anyone controlling this computer can alter emulator state directly. The tested guarantees
are the application's authorization policy and its production-target refusal, not protection from
a malicious operator of the development computer. See Firebase's
[Auth emulator documentation](https://firebase.google.com/docs/emulator-suite/connect_auth).

The app uses explicit emulator-only credentials rather than discovering machine or cloud credentials.
It refuses cloud credential environment variables. If it tells you to remove one, use a clean
shell; do not alter credentials or settings for an existing district service. `npm run deploy` always
refuses. A future production installer needs real verified authentication, operator authorization,
domain ownership decisions, service hardening, encrypted operational backups, schema upgrades, and a
separately reviewed target. Use `independent-trial.md` for the current local rehearsal.

## Complete service workflow

See [service detail](service-detail.md) for the restored reviewer cards and four tabs. To enable the
complete workflow, explicitly adopt the optional tier policy in Settings, then create a service
review using its saved revision. Practice reviews remain usable without changing their scores.
Use the [backup compatibility runbook](backup-recovery.md) for the archive version required by all
records in the installation; long-source formats require newer versions than service records alone.
Preserve compatible source and archives for rollback. The staff catalogue is in My workspace and
uses its separate audience projection.

## Saved segmented review lab

Use **Load Lantern long-policy lab** in a new empty review draft to try durable source-range
attempts and unresolved human handoff with authored synthetic recordings. The exact saved example
and practice definition are required; arbitrary sources have no enabled model transport. Follow
[the segmented review guide](segmented-reviews.md). Run/receipt/output records require schema-10
backup support even when a run is empty or cancelled. Preserve older archives for rollback.
