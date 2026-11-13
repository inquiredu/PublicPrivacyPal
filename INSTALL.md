# Install your copy of PublicPrivacyPal

The deployment wizard is included in this repository. Everyone who copies or clones this version
runs their own wizard, creates their own local configuration and receives their own administrator
account. No separate handoff ZIP, author's account or Firebase login is needed.

**Current supported target: this computer, using synthetic demo data.** This installs the local
preview. Hosted production deployment is not yet supported; the wizard does not expose emulators
on a network or turn them into production services.

## Get the source

Until the wizard change is merged into the default branch, clone the wizard branch:

```sh
git clone --branch codex/repository-installation-wizard https://github.com/inquiredu/PublicPrivacyPal.git
cd PublicPrivacyPal
```

After merge, a normal clone of the default branch includes the same installer. A fork or a
source-only copy works for the local wizard too. Keep the complete source tree and lockfile;
do not copy `.local/`, `.private/`, `config/local.json`, accounts, backups or dependencies from
another installation. Use your own authorized repository access if the repository is private.

## Run the wizard

Install/select **Node 24** (with npm) and a **Java 21 or later JDK** first. Check them in the terminal
you will use: `node --version` and `java -version`. The wizard explains a missing/wrong runtime;
it does not change system software or install a global Firebase tool.

From the copied repository folder, use the launcher for your computer:

| Computer | Start |
| --- | --- |
| macOS | Double-click **Install PrivacyPal.command**, or run `sh ./install.sh` in Terminal. |
| Linux | Run `sh ./install.sh`. |
| Windows | In PowerShell, run `powershell -File .\install.ps1`. If local policy blocks scripts, use `npm run deploy:wizard` directly. |
| Any supported system with Node/npm | Run `npm run deploy:wizard`. `npm run setup` remains an equivalent entry point. |

The launchers work from paths containing spaces and use this repository's pinned dependencies.
Java/Node must also be available in the environment of a double-clicked macOS Terminal window;
if your runtime manager is configured only in another shell, use the Terminal command instead.
Windows interactive installation still needs independent workstation acceptance.

The wizard:

1. Checks Node, Java and dependency presence.
2. Offers **New** or **Restore**. A new session requires typing `NEW`; restore asks for a backup path.
3. Asks to install/refresh this copy's pinned dependencies. Accept the recommended choice.
4. Preserves existing configuration, or creates the fictional defaults for a first installation.
5. Validates configuration, cloud-credential refusal and loopback ports. Restore additionally verifies
   the exact archive/configuration/dependency match before starting anything.
6. Starts the local services. A new session runs protected administrator setup automatically;
   restore preserves the original accounts and passwords without bootstrapping.

Open **http://127.0.0.1:5173** once the browser server is ready. The terminal prints the private
local sign-in file's location. Open that file privately and sign in under **For your district team**.
Passwords never go into a browser link. Keep the wizard terminal open while using the app.
The first dependency/emulator downloads need internet access. App data and model work remain local;
live AI and automatic policy fetching are not enabled.

For a prerequisite check without starting services:

```sh
npm run deploy:wizard -- --check
```

## Keep your work

Before closing the wizard, open another terminal in the same copy and run:

```sh
npm run local:backup
```

Wait for **saved and verified**, then stop the wizard with Ctrl+C. There is **no automatic save**.
Next time run the installer again and choose **Restore**, using that exact backup directory and
the matching source/configuration/lockfile. Browser drafts and separate plaintext account files
are not part of an installation backup; keep important drafts and original passwords privately.

Advanced terminal use is also available:

```sh
npm run deploy:wizard -- --new --install
npm run deploy:wizard -- --restore "/path/to/completed-backup"
```

Use one startup command at a time. An explicit `--new` starts an empty session. The wizard never
guesses which backup to restore or changes an old archive to bypass verification. Dependency
updates can make an older archive require its previous source; see [dependency review](docs/dependencies.md).

Follow the [short product tour](docs/colleague-preview.md),
[manual setup and troubleshooting](docs/local-development.md),
[backup runbook](docs/backup-recovery.md), and [independent trial](docs/independent-trial.md).
For real district hosting, the [production work plan](docs/open-source-plan.md) remains the gate.
