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
creation and duplicate matching remain pending. Reviewers now search existing review names, explicitly
select a review and inspect it with a return-to-request action; selection is preserved in the action draft. No AI dispatch occurs in these commands.

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
15 seconds and offers explicit detail refresh. Queue filtering occurs on the server before pagination.

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
- [ ] Archive and restore each audience independently; inspect the Archived queue.
- [ ] Interrupt a response, reload, check the saved result, and retry the same command if absent.
      Verify one request/event per successful command and preserved text after a definite rejection.
- [ ] Inspect history paging; revoke membership and verify read/write/replay denial.
- [ ] Save, shut down and restore using the runbook; verify history and receipt reconciliation.

Implemented: request dashboard totals/attention queues backed by complete bounded data and
Active/Decided/Archived navigation. Next: create-review handoff and submission catalogue-match suggestions; broader keyboard and
assistive-technology acceptance. Automated tests do not replace this independent walkthrough.


## Request dashboard — October 22

Dashboard and Requests (My Requests for staff/read-only reviewers) are distinct destinations.
The dashboard API rechecks membership in the same transaction as its bounded inventory read.
It returns counts and at most six allowlisted attention rows, never request history or policy evidence.
Staff and read-only reviewers see only their own requests; reviewers/admins see district requests.

All requests includes archives. Pending, In review and Decided exclude that audience's archives.
Assigned to you is a subset of In review. Reviewer attention includes unassigned and self-assigned
active requests; requester attention shows decided outcomes, not unread notifications. Rows sort by
creation time then ID; unknown legacy dates sort first. Cards open matching server-filtered queues;
rows open authoritative request details. Archives stay independent for requester/reviewer audiences.

Counts use the complete supported inventory (100 heads maximum), not the loaded page. Inventory
above the bound fails explicitly. A transaction snapshot supplies counts, rows and an as-of time;
polling every 15 seconds and explicit refresh keep it current. Errors clear counts instead of showing
zero or stale totals. Queue paging uses document IDs and may change as concurrent work changes.
No persistent aggregates or migration were introduced. Request drafts retain the existing journal.

Review/publication totals, tier distributions and review-specific attention categories are implemented locally; independent acceptance remains pending.
DPA automation remains excluded.

## Existing-review picker and current staff guidance — October 26

The picker reuses `/api/review-dashboard` name search: full bounded inventory matching, 20-row pages,
reader authorization and explicit loading/error/empty states. Only assigned editors can record a
link; selection alone does not mutate anything. The existing server validates review existence,
revision, assignment and retry identity. No request or backup schema changes are needed.

Linked request outcomes offer **View current staff guidance** using only
`districts/{districtId}/staffTools/review-{reviewId}` under existing membership rules. The subscription
removes displayed guidance on withdrawal and denies cached/offline results the label of current.
Absent guidance does not claim a decline: it can mean not yet published or withdrawn. Read failures
are separate from absence. Historical outcome text is never rewritten by publication changes.
Reviewers can open the private linked review; staff receive no private review navigation or evidence.

Additional acceptance:
- [ ] Search duplicate names and more than 20 matches; explicitly select and inspect the intended review.
- [ ] Return to the request; verify selection/reason survive and only the assignee can record the link.
- [ ] Open staff guidance as requester; verify only published conditions/fields appear.
- [ ] Withdraw or correct the review while guidance is open; verify guidance disappears, outcome remains.
- [ ] Disconnect/revoke access; verify no cached guidance is presented as current.
- [ ] Exercise keyboard controls, narrow screens, empty search and failed search without losing text.
