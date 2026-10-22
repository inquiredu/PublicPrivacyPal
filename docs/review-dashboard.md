# Review and publication dashboard

Implemented locally on October 22, 2026. Dashboard now has a review overview for administrators,
reviewers and read-only reviewers. Staff retain only their personal request dashboard. Anonymous,
nonmember, staff and revoked callers cannot read the review overview endpoint.

## Totals and attention

- **All reviews:** every supported review head, including queued and cancelled reviews.
- **Public review notices / Staff review entries:** actual `review-` projection records in each
  audience, matched to a review. Bootstrap sample catalogue resources are excluded. These are
  presence counts, not a fresh legal, content-integrity or approval certification.
- **Failed analysis jobs:** the review's primary analysis job is failed. Separate assistance and
  segmented-run failures are not included in this category yet.
- **Unfinished evidence:** awaiting-review state, or an evaluated pasted/bundled review with fewer
  resolved human reviews than enabled measures. Synthetic fixture analysis retains its existing
  completion semantics; zero human edits alone does not flag an otherwise complete fixture.
- **Decision needed:** a succeeded evaluation lacks a decision bound to its current evaluation and
  adopted service revision. A current declined decision is a recorded outcome, not a new task.
- **Requirement gaps at last save:** the existing saved service-summary blocker list is nonempty.
  This does not recalculate agreement expiry with the clock or implement ongoing monitoring.
- **Publication mismatch:** the head's publication flag disagrees with either actual audience record.
  Opening the review permits inspection and existing publication/removal commands; the dashboard
  never repairs records, publishes, approves or retries jobs automatically.

Attention categories overlap. The distinct attention total counts each review once. Up to six rows
prioritize publication mismatches, failed jobs, evidence, decisions, then requirement gaps; IDs break
ties. Each total opens its matching queue within Dashboard, filtered before 20-row pagination. Every
row opens the existing authoritative Policy reviews detail. Capture/evidence/decision drafts and
unresolved commands retain their existing tab journals. Read-only reviewers keep read-only controls.

## Data and reliability boundary

`GET /api/review-dashboard?queue=all` returns an explicit projection of counts, as-of time and
ID/name/category rows. Optional `cursor` is a review UUID. Invalid queues/cursors are rejected.
The transaction rechecks district membership and scans at most 1,001 review heads and 1,001
review-prefixed projections per audience. More than 1,000 reviews/projections, unmatched publication
records, unsupported heads or missing referenced decision/service summaries fail visibly rather
than yield partial or zero totals. No persisted aggregate, migration or new browser database grant
is introduced.

Reads select lightweight head fields, projection identities, decision outcome/version bindings and
service revision numbers. No source, rubric, finding, private rationale or history is loaded for
rollups or returned by the endpoint. The full review loads only after explicit selection. This is a
bounded local scan, not a production-scale/cost-qualified aggregate design. Queue paging may change
as concurrent work changes; each response's totals and rows come from one transaction snapshot.

The UI polls every 15 seconds and offers explicit refresh. Loading is distinct from zero; failures
clear stale totals and show unavailable. The review dashboard loads separately from the initial app
bundle and fails independently of the request overview and review editor.

Tier/score distributions, live requirement checks, broader review search, assistance/segmented-job
attention and production-scale aggregation remain pending. DPA automation remains excluded.

## Independent acceptance

- [ ] Compare totals with all queue pages in a fresh synthetic installation with more than 20 reviews.
- [ ] Exercise publish/unpublish and check both audience totals after refresh.
- [ ] Open failed, incomplete and decision-needed rows with the keyboard; inspect the selected review.
- [ ] Keep capture/evidence/decision drafts, visit Dashboard, open another review and return; verify text.
- [ ] Compare reviewer and read-only reviewer behavior; verify staff has no review totals.
- [ ] Revoke membership or interrupt API access; verify unavailable/access-loss behavior, not zero work.
- [ ] Check empty state, narrow layout and spoken screen-reader navigation.
