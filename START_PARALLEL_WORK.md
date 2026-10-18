# Start the coordinated implementation session

Use this entry point in the fresh session intended to run on `main`. The coordinator and up to
three subagents share one implementation plan; they do not independently redesign its contracts.

**Baseline prerequisite:** the readiness audit found that GitHub `main` is already at `a0e94ca`
(merged PR #1), with the same files as development checkpoint `5de75d3`. Local `main` was still
at `91ce51f` and has now been fast-forwarded. The newer application and this packet are being
checkpointed on `codex/open-source-audit` for review; updating local main alone will not integrate them. Read the current
[main-readiness report](docs/parallel-work/main-readiness.md) before proceeding. This packet does
not authorize merging, resetting, discarding, publishing, or deploying the application.

Start by reading [baseline preparation](docs/parallel-work/baseline.md). The packet includes an
implementation hash inventory and a read-only checker; the inventory is not a source backup.
Carry this entire packet into the new session along with the preserved implementation baseline.

## Paste into the new session

> Use START_PARALLEL_WORK.md and docs/parallel-work/README.md to coordinate the next milestone.
> Read AGENTS.md, HANDOFF.md and the baseline procedure before changing anything. Verify origin,
> both local and remote main, the actual checkout, the implementation manifest, the current preview, and the newest
> verified installation backup. Preserve all existing uncommitted work and private artifacts.
>
> Once the baseline is ready, use up to three subagents for the first wave: review experience,
> intelligence workflow, and independent installation/contributor experience. Follow their briefs
> and exclusive file ownership in docs/parallel-work/workboard.json. Stay in this task; do not
> create or message separate app tasks. You are the coordinator and integration owner.
>
> Record the baseline and assignments before implementation. If main lacks the application,
> report the exact mismatch and prepare a concrete preservation/integration proposal; do not
> silently switch branches, merge, or reconstruct the application. Independent read-only planning
> may continue while that prerequisite is resolved.
>
> Let the agents work independently within their assigned files. Resolve interface questions in
> the contract log, arrange review by a non-author, and integrate small increments sequentially.
> Serialize emulator, recovery, and shared-browser validation through the coordinator. Keep human
> corrections, historical versions, drafts, receipt semantics, deterministic scoring, separate
> district decisions, and atomic publication intact.
>
> Finish the first wave, report its evidence and remaining decisions, then use the follow-up
> briefs as capacity and dependencies permit. Live providers, real district data, deployment,
> repository visibility changes, main merges, releases, and publication remain outside this
> instruction. Do not ask again for routine reversible implementation within these boundaries.

## Packet contents

- [Coordinator runbook](docs/parallel-work/README.md)
- [Baseline preparation](docs/parallel-work/baseline.md) and [checker](docs/parallel-work/check-baseline.mjs)
- [Assignments and resource queue](docs/parallel-work/workboard.json)
- [Contract decisions](docs/parallel-work/contracts.md)
- [Validation gates](docs/parallel-work/validation.md)
- [Agent report template](docs/parallel-work/report-template.md)
- First wave: [review experience](docs/parallel-work/briefs/review-experience.md),
  [intelligence workflow](docs/parallel-work/briefs/intelligence-workflow.md),
  [independent installation](docs/parallel-work/briefs/independent-installation.md)
- Follow-up: [rubric refinement](docs/parallel-work/briefs/rubric-refinement.md),
  [accessibility](docs/parallel-work/briefs/accessibility-review.md),
  [provider qualification](docs/parallel-work/briefs/provider-qualification.md),
  [operations](docs/parallel-work/briefs/operations.md)
