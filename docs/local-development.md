# Local development

This milestone is a standalone local application. It deliberately accepts only `demo-` project IDs,
loopback emulator endpoints, and synthetic `.example`/`.test` email domains. It has no deployment
configuration and makes no AI, mail, Drive, or production database calls.

## First run

Install Node 24 (use the `.nvmrc`) and Java 21 or later. Check `node --version` and `java -version`.
If Java is installed in a nonstandard location, set `JAVA_HOME` to its runtime directory.

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

The development process starts three services and shuts them down together on Ctrl+C:

| Service | Address |
| --- | --- |
| Browser/Vite | `127.0.0.1:5173` |
| Local API | `127.0.0.1:8787` |
| Auth emulator | `127.0.0.1:9099` |
| Firestore emulator | `127.0.0.1:8080` |

The emulator hub also uses ports 4400/4500, and the Firestore websocket uses 9150. Port conflicts
stop startup; do not connect the app to a different endpoint as a workaround.

Save the whole sandbox with `npm run local:backup` while services are running, then restart with
`npm run dev -- --restore .local/backups/YOUR_COMPLETED_DIRECTORY`. There is no automatic save on
shutdown. Without `--restore`, a new session is empty and needs bootstrap again; old sign-in files
will not work in that empty session. A restored session keeps its accounts and passwords. See
[backup and recovery](backup-recovery.md) for checks, failure handling and the tested rehearsal.
Individual review export/import remains a separate operation that creates a new unpublished draft.

## Team access

Run `npm run local:user -- --email teacher@maple.example` (use your configured synthetic domain).
This creates an enabled, verified **emulator identity**, without a membership. It is a local stand-in
for future verified authentication, not a production email-verification mechanism.

An administrator then opens **People & access**, enters the email, and selects a role. Roles can be
changed or revoked there. The initial administrator is protected, and administrators cannot change
their own membership. Every successful membership change records an attributed server audit event.

Public visitors see only three fictional sample records. Signed-in members can submit requests.
Reviewers can edit internal sample notes. Read-only reviewers can inspect notes but cannot save
changes. Staff cannot read internal notes or district settings. Review decisions, analysis jobs,
and publication are available in **Policy reviews**; see `review-workflow.md`. Document workflows remain deferred.

Administrators can open **Settings** for the original six-part district setup and **Customize
Library** for appearance, notices, footer sections and display preferences. PDF context import
works locally; live law discovery and external integrations remain unavailable. See
`district-setup.md` for the workflow. Pasted reviews may explicitly adopt the saved full rubric;
practice reviews keep their own definitions. See `review-storage.md` for versioning and local migration.

## Try another district

Stop the first local server. Use the second synthetic configuration for both the development and
operator commands:

```sh
PRIVACYPAL_CONFIG=config/second-district.example.json npm run dev
PRIVACYPAL_CONFIG=config/second-district.example.json npm run local:bootstrap
```

It has a different demo project, district ID, name, domain, administrator, and identity/data store.
No files containing actual district settings need to be edited. Integration tests initialize this
second configuration and verify separation. Existing installation identity fields cannot be changed
in place; use a separate demo project for a different installation.

## Verification

`npm run ci` runs strict TypeScript checks, unit/isolation tests, the browser build, and source/bundle
isolation checks. `npm run test:integration` starts fresh Auth/Firestore emulators, checks actual
security rules with synthetic identities, and calls the HTTP API using emulator-issued ID tokens.
No Firebase login is required. `npm run test:recovery` additionally runs two complete emulator
shutdown/import cycles and checks accounts, permissions and exact data recovery. Save your sandbox
and stop the development server first to free its ports.

Dependencies are pinned in `package-lock.json`. See [dependency review](dependencies.md) for the
targeted override and remaining development-tool advisories. Runtime secrets, credentials, reference
material, and local configuration are excluded from Git; Vite denies access to those paths as well.

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
Service backups require this service-aware build (schema 4); preserve pre-service archives for
rollback. The staff catalogue is in My workspace and uses its separate audience projection.
