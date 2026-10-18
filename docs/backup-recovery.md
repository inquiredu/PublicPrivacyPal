# Local backup and recovery

This procedure saves the **whole synthetic installation**: emulator accounts and their password
state, membership roles and revocations, settings, requests, reviews, findings, decisions, history,
usage counters and public/staff library projections. It is separate from **Export review**, which
is a portable draft and deliberately cannot restore approval or authority.

## Save before stopping

Keep `npm run dev` running. In a second terminal in the same repository, with the same Node version
and `PRIVACYPAL_CONFIG` selection, run:

```sh
npm run local:backup
```

The operator command briefly blocks application writes and worker commits, exports Auth and
Firestore through the pinned local emulator hub, verifies the files, and prints a unique completed
directory under `.local/backups/`. Reads remain available. Wait for **saved and verified** before
stopping the services. There is no automatic save on exit. An earlier backup will not contain work
done after that backup.

Do not run privileged emulator tools or account-editing tools during the export. The maintenance
fence covers the application, browser database writes and bundled account operator commands; it
does not prevent the computer's operator from bypassing the application. Ordinary sign-in may update
Auth login timestamps and does not change membership authority.

Each backup contains a schema version, exact synthetic configuration, dependency-lockfile hash,
timestamp, and a SHA-256 inventory of every exported file. Partial saves stay in `.pending-*` and
are never accepted as completed backups. Completed backups receive unique names and are never
overwritten. The folder and its files are restricted to the operating-system user.
The runner also applies a private file-creation mask to the emulator's temporary export files;
those paths are excluded from Git and denied by the browser server even if an export is interrupted.

Backups contain private review material and emulator password data. They are **not encrypted**.
Keep them in private storage; do not commit or distribute them as sample data. A copy on the same
computer is useful for local restart but does not protect against loss of that computer. Checksum
validation detects accidental changes, not a malicious archive whose manifest was also rewritten.
Restore only your own trusted backups. Preserve the whole directory and the matching source and
lockfile. The plaintext sign-in files in `.local/accounts/` are not included; keep the local password
you used to sign in separately if you need it again.

To check a saved directory without starting or changing services:

```sh
npm run local:backup:verify -- .local/backups/YOUR_COMPLETED_DIRECTORY
```

## Recover into a fresh session

1. Save any work in the current session that you want to retain. Stop `npm run dev` with Ctrl+C and
   wait for the emulators to finish shutting down. Close old browser tabs or refresh after recovery.
2. Use the same source/lockfile and the exact `config/local.json` (or same selected example config).
   The backup manifest includes the synthetic configuration for comparison. A different project,
   district, admin, domain list or name is rejected; this command cannot migrate to another district.
3. Start with the completed backup directory:

   ```sh
   npm run dev -- --restore .local/backups/YOUR_COMPLETED_DIRECTORY
   ```

4. Wait for **Restored local backup** and the Vite address. Sign in with the existing account and
   password. Do **not** bootstrap a new administrator. The old UID, roles and disabled/revoked states
   are preserved. Verify one private review/history, one public entry, and a restricted user's access.
5. Save another backup after your next meaningful changes.

The launcher checks that all local ports are free, verifies the archive, imports a separate private
copy, and verifies the restored administrator identity/membership before starting the API and worker.
It does not merge into a running installation or modify the source backup. A queued job resumes;
an interrupted running job becomes claimable after its lease expires. A failed job still needs a
reviewer's retry. Publication and history are restored as recorded, without new approval events.

## Failure and interrupted maintenance

- A checksum, configuration, dependency or schema mismatch stops recovery. Keep the last verified
  copy and use its matching source/configuration. Editing the manifest to force a restore defeats
  the check. Schema migrations and rollback between releases are not implemented yet.
- An export error or uncertain timeout does **not** report success. It leaves writes paused and
  prints a maintenance lock ID. Read the emulator log and wait until the export has finished or
  failed before releasing the lock. A partial directory is not a backup.
- After confirming no export or account command is still running, the local operator can resume:

  ```sh
  npm run local:resume -- LOCK_ID_FROM_THE_ERROR
  ```

  A mismatched ID is rejected. Resuming is not evidence of a successful backup; run a new backup.
  If export status remains uncertain, stop the emulators and recover the last completed backup
  instead. Work since that backup cannot be promised recoverable.

The local archive limits are 64 MiB total, 32 MiB per file and 10,000 files. Unsupported versions,
extra/missing/changed files, symlinks and unsafe relative paths are rejected. No retention or deletion
job runs automatically. Production encrypted backups, off-device retention, disaster recovery,
account turnover and schema upgrades still need a separately provisioned pilot.

## Rehearsal

With development services stopped, run `npm run test:recovery`. It uses only the dedicated test demo
project and random synthetic accounts. It saves state, fully stops Auth/Firestore, imports into a
fresh session, compares every Firestore document and timestamp, verifies original passwords and UIDs,
disabled/revoked accounts, role denials, and public projections, resumes a queued analysis, then
saves and restores again. The permission suite additionally tests the maintenance boundary, an
already-running worker, concurrent locks and a failed export. Unit tests reject damaged archives.

## Review storage schema compatibility

Bounded reviews without service records continue to use schema 3; legacy/mixed archives without
services use schema 2. **Any archive containing the new service records uses schema 4**, including
mixed legacy/service archives. This prevents the prior checkpoint build from restoring data whose
tier requirements it cannot enforce. **Archives containing suggestion jobs use schema 5**, so
older readers cannot silently discard their semantics. The current reader accepts schemas 1–7 with
matching configuration and dependency lockfile. Restores of schemas 1/2 and 4–7 run the idempotent legacy
conversion under maintenance before releasing the lock. Existing bounded records remain unchanged.

Never relabel an archive to force a rollback. Preserve the original archive and compatible source.
The recovery rehearsal now includes a mixed legacy/schema-7 archive, exact migrated-document
comparison, 50 maximum-length Unicode findings, service facts and tier policy, an earlier evaluation,
and publication, recorded suggestions and a queued suggestion job, then a second full schema-7 restore. This is a specific local upgrade, not a general
migration system. See [service detail](service-detail.md) and [review storage](review-storage.md).

New human evidence saves mark the head `evidenceVersion: 3`; installation archives containing them
use **schema 6**, including if a later fixture run replaces the current evaluation. They preserve
scope, open questions, immutable suggestion references, reviewer resolutions and null unresolved
scores. Older readers reject schema 6; keep an earlier archive with its matching code for rollback.
The recovery rehearsal compares every document across two cycles, including retained, resolved and
unresolved finding context. See [review context](review-context.md).

Precision-profile reviews mark `evidenceVersion: 4` and require **schema 7**. The writer also
checks current and historical settings, so selecting the pilot then reverting still preserves its
version requirement. Schema 7 retains adopted clauses, human assessments, original proposal clauses
and unresolved questions. The two-cycle rehearsal compares these records exactly alongside older
review formats. Earlier archives remain readable; never relabel a new archive for an old reader.
See [precision adoption](rubric-adoption.md).

Source-bundle reviews require **schema 8** from initial capture, including before the first finding.
They preserve document identity, declared scope/dependencies, missing documents and server-derived
human coverage. The current reader accepts schemas 1–8. Two-cycle recovery includes a precision
bundle alongside previous formats. See [source bundles](source-bundles.md).

Long v2 bundles require **schema 9** as soon as they are captured (`sourceVersion: 3` /
`evidenceVersion: 6`). It preserves bounded immutable source parts, frozen segment plans and human
range acknowledgments. The reader accepts schemas 1–9. The two-cycle rehearsal reconstructs a
long Unicode source with a late exception and missing addendum and compares every stored document.
Offline qualification packets saved as local files are separate operator artifacts, not part of
Firestore/Auth installation archives; preserve them separately. See [source segments](source-segments.md).
