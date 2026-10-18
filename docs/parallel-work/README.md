# Coordinated work toward district adoption

The owner requested a reusable parallel-work structure for a fresh session on `main`. This packet
prepares that session; it does not start agents or change the Git baseline. Start at
[the kickoff](../../START_PARALLEL_WORK.md) and satisfy [baseline preparation](baseline.md).

## Roles and first wave

Use one coordinator plus up to three workers, adapting to available capacity. The coordinator owns
integration, shared contracts, the workboard, runtime lifecycle and final verification. Workers
implement or investigate only their assigned scope. They may request help; they do not spawn extra
workers or expand their scope independently.

| Worker | Deliverable | Initial scope |
| --- | --- | --- |
| Review experience | Document dependency/exclusion editor and a reviewable source-coverage flow | UI, focused fixtures/tests; existing source semantics |
| Intelligence workflow | Versioned segmented-result adoption design and executable offline failure cases | Contract proposal and isolated tests; no application persistence writes yet |
| Independent installation | Clean-install findings, corrected onboarding and contributor/security guidance | Documentation and disposable-install verification |

UX and intelligence remain the milestone priority. Parallel documentation does not authorize a
release. Follow-up briefs cover rubric precision, accessibility, provider qualification and operations.
Do not launch all seven assignments at once. First-wave completion is a reporting checkpoint;
follow-up work can proceed when its dependencies and available capacity are recorded.

## Assignment lifecycle

1. Coordinator records verified baseline identity, actor/workspace ownership and private evidence
   location in `workboard.json`. Initial entries are planned, not evidence of completion.
2. Give each worker AGENTS.md, its brief, the shared boundary documents and report template. Require
   it to restate its file ownership and identify any interface prerequisite before editing.
3. Use verified isolated copies/worktrees when available. A new worktree does not contain dirty
   working-tree changes: first establish the agreed baseline. If sharing a checkout, enforce the
   file allowlists strictly and never run concurrent formatting, installation or build commands.
4. Worker implements a small increment, runs focused checks in its assigned workspace and delivers
   a patch/diff plus a report. It cannot commit to main, push or alter another worker's files.
5. A non-author reviews correctness and failure cases. Coordinator may review initially. For risky
   backend changes, use a fresh reviewer when a slot opens; avoid a reviewer rewriting the patch
   while also treating its review as independent.
6. Coordinator accepts or returns the increment, integrates it without overwriting other work,
   and runs the relevant [validation gates](validation.md). An agent's passing checks are not an
   integrated result. Update the board only from observed evidence.
7. On completion, record changed behavior, accepted limitations, pending human decisions, source
   identity, commands and results. Update HANDOFF.md and save a verified installation backup before
   any runtime stop after saved data changes.

## Shared contracts and file ownership

The coordinator moves tasks through `planned`, `assigned`, `in_progress`, `ready_for_review`,
`changes_requested` when needed, `integrated`, and `accepted`. Use `needs_dependency` with a concrete
reason when progress requires another assignment. Never mark an unrun check or proposed feature as
accepted. The report template lives in this packet; task reports go in `reports/`.

The workboard is the assignment ledger; only the coordinator edits it. Path prefixes with `/**`
denote ownership scopes, not existing directories. All unassigned files remain coordinator-owned.
Even inside an allowlist, changes must serve the brief. Tests and reports cannot introduce new
authority. Workers never run blanket formatters or use `git add .`.

Shared domain schemas, scoring, authorization, API routes, immutable storage, migrations, worker
lifecycle, backup formats, dependencies and CI are coordinator-owned. A worker needing a change
submits a proposal in its report. The coordinator records the decision in [contracts](contracts.md),
names a single implementation owner and updates the allowlist before implementation. This is an
engineering review, not a routine user-permission request. Existing user authorization governs;
ask the owner only for a genuinely missing product/policy choice or separately scoped action.

Freeze interfaces before two workers depend on them. Proposals identify version compatibility,
failure behavior, byte limits, actor authority, recovery impact and examples. Do not invent an API
on one side and silently adapt the other side afterward. Preserve old request hashes and historical
outputs where their contracts require it.

## Shared resources

The coordinator alone grants and releases the resource reservations in the workboard. Reservations
are a human-readable protocol, not an OS lock: an unconfirmed holder must be inspected before reuse.
Separate copies still share this computer's ports and browser; they are not separate environments.

- Only one emulator/integration/recovery run may own the fixed local ports at a time.
- Only one operator may control the saved preview or perform backup/restore/account operations.
- Only one tester may mutate the shared browser's synthetic records at a time. Use separate tabs
  for read-only inspections and identify any temporary draft before discarding it.
- Install/build/unit commands may run concurrently only in separate verified workspaces with their
  own writable dependencies/output. Do not install through a shared `node_modules` symlink.
- Never stop a process just because it uses a desired port. Identify its owner and preserve its data.

## Completion boundaries

The first wave is complete when the editor increment is reviewed and integrated, the intelligence
adoption contract/failure evidence is reviewed, and installation/documentation findings are resolved
or explicitly recorded. Owner UX acceptance remains a separate result. Provisional rubric labels
are not independently adjudicated merely because several agents agree.

No agent enables provider dispatch, automatic website fetching, production authentication or hosting
as a side effect. Production provisioning, real data, paid calls, visibility changes, main merges and
releases need their separately scoped decisions. The district instance and original repository remain
read-only references. This packet does not broaden AGENTS.md's boundaries.

## Packet verification at preparation

The checker parsed successfully and its implementation-only comparison matched all 136 recorded
inputs. Its default invocation correctly refused the development branch as a main kickoff.
A separate read-only main-tree comparison found all 136 inputs absent from the initial main commit.
All 14 Markdown files in the packet had resolving local links, all seven task briefs were present,
and worker file ownership had no duplicate paths. Repository source isolation and whitespace checks
passed. These are packet checks, not new application/integration/recovery results. Evidence is
private under `.local/validation/parallel-work-packet/`; no workers or runtime operations were started.
