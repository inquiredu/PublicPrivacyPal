# Repository deployment wizard

November 12, 2026 (America/Chicago). This source increment makes the supported local installation
available to someone who clones, forks or copies the repository. It is separate from the previous
source-ZIP handoff and does not enable production hosting.

## Source and entry points

Feature branch: `codex/repository-installation-wizard`, based directly on fresh remote main
`5d028eb91bf285f7efcffa8bdca3873210e25b04`. The default branch is not changed by creating or
publishing this feature branch. The original development checkout and its catalogue-suggestion
commit remain intact.

The original working checkout's separate tier-help edits are preserved and excluded from this
isolated wizard candidate. Tests and source publication must use this actual candidate, rather
than claim the earlier combined-working-tree results describe it.

`INSTALL.md` is the first-run guide. `install.sh`, `install.ps1` and `Install PrivacyPal.command`
run `npm run deploy:wizard` in the repository containing the launcher. The Node-only wizard can
diagnose prerequisites before installing project dependencies. `npm run setup` remains supported.
The underlying runner still permits only demo projects and fixed loopback emulators. New setup
reuses protected operator bootstrap; restore verifies its archive and never bootstraps.

## Validation boundary

The candidate was checked with its own newly installed pinned dependencies, Node 24.22.3,
Temurin Java 21.0.13 and synthetic emulators on macOS arm64. Existing package/emulator caches may
have been reused. No author's local settings/accounts/dependency folder was borrowed.

| Check | Result |
| --- | --- |
| Own dependency install | Passed with the candidate's pinned lockfile; direct package versions and Firebase CLI are unchanged. |
| TypeScript, unit, build, bundle and source checks | Passed before publication: 562 unit/isolation checks, TypeScript, browser build, bundle limits and source scan. |
| Emulator integration | Passed 241 cases against this main-based candidate, including current-role checks and negative authorization cases. |
| Recovery | Passed a schema-9 import and two schema-11 shutdown/import cycles, preserving exact records, passwords, permissions, decisions, history and publication. Maximum segmented admission and atomic overflow also passed. |
| Launcher regression checks | Passed missing Node, unsupported Node 16, missing npm, another starting directory, copied paths with spaces and literal backup arguments through both Unix/macOS entry points. |
| GitHub platform smoke jobs | All three passed on the initial published source: dependency-free copies in paths with spaces on Linux, macOS and Windows PowerShell Desktop. These check prerequisites/startup, not an interactive installation. See [the source-checkpoint run](https://github.com/inquiredu/PublicPrivacyPal/actions/runs/43365066484). |
| Fresh published clone | Actual GitHub clone of `172359665f744c1b59915af71437b22b5261e4c3` in a folder with spaces had no dependencies, local config, accounts or private reference material. Starting its launcher from another directory, choosing New/NEW and accepting the pinned install created its own administrator. Original password sign-in, administrator access, browser entry and anonymous private-read denial passed; tracked source remained clean. The installation backup saved and verified. |
| Fresh-clone restore | Stopped and restored through the copied launcher using the backup path with spaces. Original UID/password and administrator authority passed; configuration and credential-file hashes were unchanged and no bootstrap ran. Owned services stopped with exit 0. |

Launcher regression cases cover missing/unsupported Node, missing npm, paths with spaces,
starting from another directory and literal backup-argument forwarding through both Unix/macOS entry points. Windows
PowerShell syntax targets Windows PowerShell 5+, but actual Windows interaction remains an
independent-workstation acceptance task. No execution-policy changes are made.

Credential files have unique, exclusive names so later empty sessions preserve sign-in files for
older backups. The dependency refresh is documented in [dependencies](dependencies.md), including
remaining moderate advisories and the exact-lockfile backup boundary. Local archives are unencrypted.

Hosted deployment, real identity provisioning, live provider dispatch, independent accessibility
and policy acceptance, encrypted off-device operations and administrator succession remain open.
No original district resource, original repository setting, main merge, release or cloud deployment
is part of this increment.
