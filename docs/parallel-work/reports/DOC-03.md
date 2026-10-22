# DOC-03 — Fresh clone and truthful local startup

- Worker: `/root/independent_installation`; reviewer/integration owner: `/root`.
- Source: actual GitHub clone of `https://github.com/inquiredu/PublicPrivacyPal.git`, branch
  `codex/coordinated-milestone-2026-10-19`, commit `2f3709f37c601815bed653a468d062c15aff3067`.
- Workspace: `/private/tmp/privacypal-adoption-wave-IiILu6/installation`.
- Scope: narrow local port diagnostic, owned clean dependency install, River Valley installation
  instructions/trial and non-author OPS-02 review. No dependency, configuration, auth or rules change.
- Status: ready for integration; non-runtime checks and coordinator-operated CLI/API installation
  trial passed. Browser and outside-person trial remain unclaimed.

## Changes and ownership

The old launcher labeled every socket error as an occupied port. `scripts/local-ports.ts` preserves
the original cause and distinguishes `EADDRINUSE`, `EACCES`/`EPERM`, other bind errors and probe-close
failure. `scripts/local.ts` calls it with the unchanged seven loopback ports before restore staging
or service startup. Process lifecycle, environment handling and fresh-session refusal are unchanged.
Eight tests inject meaningful errors without acquiring shared ports.

Exact owned files:

- `README.md`, `CONTRIBUTING.md`.
- `docs/local-development.md`, `docs/independent-trial.md`, `docs/installation-readiness.md`.
- `scripts/local.ts`, `scripts/local-ports.ts`, `test/unit/local-ports.test.ts`.
- `docs/parallel-work/reports/DOC-03.md`.

The coordinator's contracts/workboard/adoption briefs were already changed and remain coordinator
owned. No other source files were edited by this worker. Local generated configuration and private
logs remain ignored; no private installation material or dependency directory was copied.

## Evidence

Host: macOS 26.6.2 (25G83), arm64; existing Node 24.22.0, npm 11.6.2, Temurin Java 21.0.12.1.
Node/Java installation and an empty package/emulator cache were not exercised. The normal package
install may reuse the existing package cache; existing Java/emulator binaries were selected for
the attempted startup. These are tool availability, not independent provisioning evidence.

| Check | Outcome |
| --- | --- |
| `npm ci --no-audit --no-fund` | Passed; own `node_modules`, 735 packages in five seconds. Deprecation notices observed; no dependency changes or new security-audit claim. |
| `npm ls --depth=0` | Passed; all exact declared top-level versions, including PDF.js. |
| `npm run local:init`, then repeat | Passed; created local example and preserved bytes on repeat. This file was not selected for runtime; River Valley example is the trial configuration. |
| Eight local-port injected tests | Passed. Success releases each probe before next; known/unknown errors stop startup and retain their cause. |
| `npm run ci` | Passed 526 tests, TypeScript, build, bundle budgets and source isolation. |
| Actual sandbox `npm run dev` with second-district config | Refused bind with observed `EPERM`, correctly diagnosed as permission denied instead of occupied. No services started. |
| Elevated retry | Tool awaited approval for 747.6 seconds, then returned `aborted by user` during coordinator interruption. No successful process/session or startup evidence resulted. |
| Coordinator-operated fresh runtime | Passed in this same clone, consistently selecting River Valley. Bootstrap completed; repeat bootstrap preserved every Firestore document, Auth record and account-file digest. |
| Coordinator-operated sign-in/setup/access | Administrator API sign-in/setup/member reads passed. Anonymous private review read returned 401; new unassigned identity 403; assigned viewer review read 200 and membership read 403; staff private review read 403. |
| Coordinator native backup/restore | Saved and verified six-file archive `58dd5b0e-eb71-4c61-8187-ffffd7baf132`; graceful stop, fresh restore without bootstrap and original archive re-verification passed. Full Firestore digest matched pre-save state; both original UIDs/passwords, admin/staff roles, staff denial and all three catalogue entries survived. |
| Browser sign-in/setup | Not exercised by this worker; browser reservation remains coordinator-owned. |

The runtime command consistently selects `config/second-district.example.json`, project
`demo-privacypal-river`. The coordinator preserved/verified the saved Maple preview before stopping
it and granting the first reservation. DOC-03 never accessed its accounts or changed its data.
Private evidence is under `.local/validation/doc-03/` in this clone, including coordinator-authored
`trial.ts` and `trial-restored.log`; do not publish private fixture snapshots or account material.
The archive is `.local/backups/2026-10-21T02-31-39-062Z-55d35f10-3438-45d3-a839-e54e453a153d`.
The coordinator gracefully stopped its owned trial process group 98809 before starting integrated
tests in a separate clone. No bootstrap, sign-in, role change, backup or restore was performed by
this worker; the successful runtime evidence above is explicitly coordinator-operated.

## Review and remaining work

The coordinator independently reviewed and accepted the port helper, launcher wiring and eight
tests, then copied them to integration. Actual normal startup/stop/restore passed in its runtime
trial. A coordinator probe of the occupied `127.0.0.1:8080` also passed with `EADDRINUSE` and its
original cause, without changing the integrated test runtime; evidence is in
`.local/validation/doc-03/occupied-port.log`. The worker separately observed real `EPERM`.
All 66 local documentation links resolve and `git diff --check` passes.

DOC-03 independently reviewed OPS-02's diagnostic, integration tests and operating/rehearsal docs.
No code blocker found: guarded fixed-loopback reads, static redacted output and bounded CLI failure
match the contract. The eleven damaged-state variants capture baseline after intentional corruption,
compare every fixture Firestore record including maintenance and complete Auth digests/counts before
sign-in, and repeat comparison after `finishRestore` refusal. The in-memory manifest is explicitly a
direct post-import gate fixture, not a valid native archive. Proposed succession has no mutation
authority. A minor requested documentation correction makes the schema-9 plus two schema-10 import
sequence explicit. OPS-02 execution remains the coordinator's separate gate.

The outside-person installation pilot, interactive browser onboarding, first-time runtime download,
production hosting/authentication, private reporting channel, encrypted off-device recovery and
protected-admin succession remain separate work. No main merge, deployment, publication, push or
commit was performed by this worker. Only the coordinator updates acceptance and returns the saved
preview to service.
