# Local request lifecycle

Implemented October 22, 2026 on the current development branch. This is the first dashboard/request
restoration increment, not completion of the dashboard milestone. DPA automation is excluded.

## States and authority

Every active district member can submit a tool name, purpose and optional reference URL. The URL
is recorded, never fetched. The server sets requester identity, time and initial `pending` state.

| Action | Who | Result |
| --- | --- | --- |
| Claim pending request | Reviewer or administrator | `in_review`, assigned to the actor |
| Release active request | Assigned reviewer/administrator | `pending`, unassigned |
| Take over another active assignment | Administrator, with private reason | Assignment changes; history retains both actors |
| Record outcome | Assigned reviewer/administrator | `decided`: declined with explanation, or linked to an existing district review |
| Reopen decided request | Administrator, with private reason | `pending`; prior outcome remains in history |
| Archive/restore requester view | Request owner | Changes only the requester's archive flag |
| Archive/restore reviewer view | Reviewer or administrator | Changes only the district reviewer archive flag |

A linked review is a work reference, **not service approval or publication**. The request command
cannot alter scores, decisions, catalogue entries or public projections. Automatic request-to-new-review
creation, duplicate matching and a review picker remain pending; the current UI accepts an existing
review ID. No AI dispatch occurs in these commands.

Staff and read-only reviewers see their own requests and current outcomes through explicit projections.
Only reviewers/administrators see assignments, requester identities and paged event history. Takeover
and reopen reasons are private. All direct browser reads/writes of request heads, history and receipts
are denied; the API rechecks current membership and each action's authority transactionally.

## Drafts, concurrency and retries

The workspace form and per-request action text persist in this tab's session storage. Incomplete form
text survives navigation/reload. Sign-out warns before erasing drafts; account/role changes clear them.
This is tab-local continuity, not durable or cross-device draft storage. Completed/unsubmitted drafts
expire after 24 hours; unresolved commands do not expire automatically. Storage failures block writes.

Before submission, the UI saves a UUID command identity and exact normalized payload. The server
atomically writes the new head, immutable before/after event and actor-scoped receipt. Every action
supplies the expected revision. Competing claims or stale actions cannot overwrite newer work.

If a response is uncertain, use **Check saved request result**. A receipt returns the current request,
not an obsolete snapshot. If no receipt exists, retry explicitly with the same identity and payload;
there is no automatic POST retry. Reusing an identity for different content fails. A definite rejection
can be cleared while retaining text. After permission loss or sign-out, inspect existing requests before
submitting again; never treat lack of a visible receipt as proof that a prior command failed.

## Storage and recovery

The local installation is bounded to 100 requests, 64 events per request and 256 KiB per request
including its head, events and receipts. A full limit refuses further changes without deleting history.
Lists/history return at most 20 items per page. Lists currently scan at most 101 heads to include legacy
records; this is a bounded local foundation, not a scalable dashboard query. The UI polls lists every
15 seconds and offers explicit detail refresh. Archive filtering is per loaded page.

Earlier direct-write pending requests remain readable without rewriting them. Their first lifecycle
command adopts version 1, retaining the known original timestamp (or explicit unknown timestamp),
requester archive and an honest revision-zero baseline. No earlier events are invented.

The first version-1 request selects backup schema 11. Under the maintenance fence, save/restore checks
head/history consistency, legal transitions, event ordering, exact receipt links, retained byte counts,
and unknown/orphan descendants. Older manifests cannot hide new request records. Failed restore keeps
maintenance in place. See [backup recovery](backup-recovery.md).

## Independent local acceptance

Use synthetic accounts and records only:

- [ ] As staff, type a partial request, navigate away and reload; verify text survives.
- [ ] Submit once; verify the requester list and details. A second staff account cannot see it.
- [ ] Have two reviewers claim the same revision; exactly one succeeds. Refresh the other view.
- [ ] Verify only the assignee can release/decide. Test administrator takeover and its private reason.
- [ ] Decline with an explanation; verify the requester sees that explanation but no private history.
- [ ] Reopen, claim and link an existing review. Verify no approval/public entry changes.
- [ ] Archive and restore each audience independently; inspect archived entries on the loaded page.
- [ ] Interrupt a response, reload, check the saved result, and retry the same command if absent.
      Verify one request/event per successful command and preserved text after a definite rejection.
- [ ] Inspect history paging; revoke membership and verify read/write/replay denial.
- [ ] Save, shut down and restore using the runbook; verify history and receipt reconciliation.

Next: dashboard totals/attention queues backed by complete bounded data; Active/Decided/Archived
navigation; request-to-review handoff/picker and catalogue-match guidance; broader keyboard and
assistive-technology acceptance. Automated tests do not replace this independent walkthrough.
