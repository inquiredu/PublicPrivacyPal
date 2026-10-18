# Establish the baseline before parallel implementation

## Recorded starting point

**Readiness correction:** the subsequent live GitHub check found remote `main` at `a0e94ca`,
the merge of PR #1 containing the `5de75d3` tree. Only local main remained at the initial commit.
The newer uncommitted implementation still needs integration. Use
[main readiness](main-readiness.md) for the current evidence and sequence; the preparation-time
observations below describe local refs and must not be treated as current remote state.

At packet preparation on October 17, 2026:

- Intended next-session branch: `main`; observed main: `91ce51f`, the initial commit.
- Working branch: `codex/open-source-audit`; observed HEAD: `5de75d3` plus substantial uncommitted
  source, tests and documentation. The latest intelligence, long-source and reviewer UX work is
  not represented by HEAD alone.
- Latest recorded checks: 386 unit/isolation tests and TypeScript/build gates in a matching
  temporary checkout; earlier 163 integration tests and two recovery cycles. Reverify the future
  integrated baseline rather than treating these as a clean-main result.
- Runtime location, latest backup and account-file guidance are in the current HANDOFF.md. Inspect
  actual processes before acting; a handoff is not a live process listing.

## Preserve before switching

1. Inspect branch, origin, fresh remote refs, tracked changes and untracked source. Compare actual
   trees and ancestry, not only branch names or cached tracking refs. Preserve the existing checkout.
   Do not reset, clean, stash-and-forget, delete untracked files, or force a branch switch.
2. Preserve a recoverable source checkpoint containing both tracked changes and new source files.
   A database backup and a `git diff` alone do not preserve the untracked implementation. A private
   full working-copy snapshot is an alternative while a reviewed source-only commit is being
   prepared. Keep accounts, backups, private evidence and offline packets separately and privately.
3. Carry `START_PARALLEL_WORK.md` and the entire `docs/parallel-work/` directory into the new
   session. If using a fresh clone or worktree, uncommitted packet files will not appear there
   automatically. Include the packet in the reviewed source checkpoint or copy it explicitly.
4. Establish the main baseline through a separately authorized, reviewed Git integration. The
   request to write this packet did not authorize that merge. Prepare the exact integration plan
   and preserve its source before seeking any missing final approval. Do not manufacture a fresh
   implementation from the old main while the existing implementation is available.

## Read-only startup check

From the repository root with Node available:

```sh
node docs/parallel-work/check-baseline.mjs
```

The checker reads Git identity and hashes the files in `baseline-manifest.json`. It refuses a
different origin, a non-main branch, or missing/changed implementation files. It performs no checkout,
write, merge, network call, application start, bootstrap or credential read. To inspect implementation
parity in the preserved development checkout during preparation only:

```sh
node docs/parallel-work/check-baseline.mjs --implementation-only
```

That option does not establish main readiness. The manifest identifies the application/test/build
inputs at packet creation; it is not a Git/source archive, secret scan, documentation inventory,
dependency installation check or complete test result. Additional files and differences need normal
review. If main intentionally contains reviewed later changes, record and inspect the exact delta
and create a new accepted baseline; never rewrite hashes solely to silence a mismatch. This is a
one-time kickoff comparison, not a permanent CI gate on future edits.

Record actual commit, working-tree status, any snapshot identity, manifest result, input deltas,
runtime ownership and evidence location in the workboard. Require a reproducible accepted baseline
before giving implementation assignments; read-only planning can continue while integration waits.

## Runtime and clean-install separation

Use existing private account files for the saved installation. Restore its newest verified archive;
never bootstrap over it. Save and verify a fresh archive before stopping it after further saved
changes. The coordinator alone controls this runtime.

The installation worker uses a separately named disposable checkout and synthetic demo configuration.
Bootstrap there is appropriate only after proving the test emulators are fresh and exclusively owned.
Do not copy `config/local.json`, `.local/`, `.private/`, `.git/`, dependencies or deployment bindings
into that clean-install exercise. Its scripts still share ports with the preview, so obtain the
coordinator's runtime reservation before starting services.

The workspace previously lacked an installed `pdfjs-dist` dependency, while the validated temporary
copy had the pinned dependencies. A new install must use `npm ci` with Node 24 and Java 21+ and prove
that the documentation works without private temporary runtime paths.
