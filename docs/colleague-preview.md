# Try PrivacyPal on your computer

This preview lets you explore a district-owned tool-review workspace using fictional records.
You can inspect policy evidence, record a human decision, and see what staff and families receive.
It runs on your computer and uses no real district account, cloud project or AI key.

## Start with the repository's deployment wizard

Install **Node 24** and a **Java 21 or later JDK**. Open a terminal in your copy of PublicPrivacyPal.
Use a local disk folder rather than a cloud-synced Documents or Desktop folder.
Get the development branch through your own authorized GitHub access:

```sh
git clone --branch codex/repository-installation-wizard https://github.com/inquiredu/PublicPrivacyPal.git
cd PublicPrivacyPal
npm run deploy:wizard
```

The wizard and platform launchers are included in this branch; a separate preview archive is
not needed. After this change is merged, a default-branch clone includes the same wizard.
Follow [INSTALL.md](../INSTALL.md) for macOS/Linux/Windows entry points. Do not copy another
person's configuration, accounts, saved installation or dependencies into your own installation.

The wizard checks Node and Java, offers **Restore** or **New**, and asks before installing or
refreshing the pinned dependencies (recommended). For a first visit choose **New** and type `NEW`.
It creates the synthetic configuration
only if none exists, starts the local services, and creates the first administrator through the
existing protected operator command. No second terminal is needed for administrator setup.
The first package and emulator downloads need internet access.

When the browser server is ready, open **http://127.0.0.1:5173**. The terminal prints the path to a
local account file under `.local/accounts/`. Open that file privately, then use its email and password
under **For your district team** in the public library. The wizard does not print passwords or put
them in a browser link. Each new account file has a unique name; creating another empty sandbox
keeps older sign-in files for their matching backups. Keep the wizard terminal open while exploring.

Check prerequisites without starting anything:

```sh
npm run setup -- --check
```

This checks installed runtimes and dependency presence only. Starting also validates configuration,
cloud-credential refusal, fixed loopback ports and any selected backup. It does not install Node or
Java for you. See [setup troubleshooting](local-development.md#common-setup-failures) for failures.

## A short first visit

1. Browse the **Public library** before signing in. These are fictional examples of family notices.
2. Sign in, then open **Policy reviews**. Create a **Bundled synthetic policy** review with a fictional
   name and **Missing and conflicting commitments**. Inspect its evidence and score. A score alone
   does not approve a tool.
3. Record an explicit decision and public wording. Publish locally, then verify the entry in a
   signed-out browser. Unpublish and refresh that browser to confirm removal.
4. Open **My workspace** for the staff catalogue and **Settings** for district setup and library
   appearance. The detailed review preserves four tabs; manual agreement facts remain separate
   from policy findings. Live policy fetching and live AI are unavailable in this preview.
5. Note where you needed help. For a full trial, follow the
   [independent acceptance checklist](independent-trial.md); this short visit does not complete it.

## Save before closing

In another terminal, in the same folder and with the same synthetic configuration:

```sh
npm run local:backup
```

Wait for the saved-and-verified result and keep the printed backup directory. Then stop the wizard
with Ctrl+C. **There is no automatic save on shutdown.** Browser drafts, separate offline files and
plaintext account files are not installation-backup contents; preserve important drafts separately
and keep your sign-in file private.

Next time run `npm run setup`, choose **Restore**, and paste the exact backup directory path without
surrounding quotes. Restore verifies the archive against its matching configuration and lockfile.
It retains existing accounts/passwords and never bootstraps or resets the administrator. If your
matching configuration is missing, restore stops rather than creating different defaults.
See [backup and recovery](backup-recovery.md) for compatibility and verification details.
This preview includes a [dependency refresh](dependencies.md). Backups made with an earlier
lockfile must use their matching earlier source; the wizard will reject a different dependency
hash. Starting your own first preview avoids importing another installation's accounts or data.

For repeatable terminal use after dependencies are installed:

```sh
npm run setup -- --new
npm run setup -- --restore "/path/to/your completed backup"
```

Run one of those commands at a time. `--new` explicitly requests an empty emulator session.
Add `--install` to either command to run the pinned `npm ci` first. Unknown/conflicting options are
rejected. Existing configuration and backup files are never overwritten by the wizard.

## What to share

Share this guide and a reviewed source checkout or source-only preview archive. The colleague
needs their own repository access if it is private; do not share GitHub credentials. A source ZIP
can run this local preview, but contributor isolation checks require a normal Git checkout with
the independent origin. Keep `.local/`, `.private/`, local configuration, account files, backup
contents and browser drafts out of the shared copy. See [license and provenance](provenance.md).

This is a development preview for feedback. Hosted deployment, production authentication, live
provider qualification, encrypted operational backups, administrator succession and independent
accessibility/policy acceptance remain separate work. The existing district instance is untouched.
