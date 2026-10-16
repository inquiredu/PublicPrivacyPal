# Permissions and initial administration

The stable district record is `districts/{districtId}`. No employee UID owns the district's data.
Roles live in server-controlled `members/{uid}` documents, so revocation does not depend on a stale
browser flag or custom claim. A verified identity, matching member email, active membership, and
the correct district are required for private access.

| Action | Anonymous / nonmember | Staff | Read-only reviewer | Reviewer | Administrator |
| --- | --- | --- | --- | --- | --- |
| Read explicit public library | Yes | Yes | Yes | Yes | Yes |
| Read staff catalogue | No | Yes | Yes | Yes | Yes |
| Read internal tool notes | No | No | Yes | Yes | Yes |
| Edit internal tool notes | No | No | No | Yes | Yes |
| Submit own pending request | No | Yes | Yes | Yes | Yes |
| Read own requests / archive own request | No | Yes | Yes | Yes | Yes |
| Read all district requests | No | No | No | Yes | Yes |
| Read private district settings | No | No | No | No | Yes |
| Save evaluation/library settings through API; read saved versions | No | No | No | No | Yes |
| List/manage memberships through API | No | No | No | No | Yes |
| Read analysis, decisions, history / export review | No | No | Yes | Yes | Yes |
| Capture policy, edit evidence, analyze, decide, publish/unpublish, import draft | No | No | No | Yes | Yes |
| Reconcile/retry own review command through the API | No | No | No | Yes | Yes |
| Write public records directly | No | No | No | No | No |
| Write a role, audit event, bootstrap, or domain registry directly | No | No | No | No | No |

All other data paths are denied. Public documents have no catch-all grant into private records.
Sample seeding and the local review publication API pick public fields individually. Publication,
unpublication, private state, and history updates commit in one transaction. See `review-workflow.md`.
Library customization uses the same explicit projection boundary: only validated appearance and
notice fields are public. The live evaluation settings and settings author/history fields remain administrator-only.
An explicitly adopted copy of evaluation context becomes private review data, readable by review
readers through the API. It is never in a public or staff projection.
Settings saves enforce expected revisions, recheck membership inside the write transaction, and
commit the private record, immutable version, audit event and public appearance together. See
`district-setup.md`.

Review command receipts are private server records. All direct browser reads and writes to them
are denied. API lookup is scoped to the authenticated actor and current district and requires
active reviewer/admin membership. Retries recheck current authorization and maintenance before
replaying a receipt. Read-only reconciliation remains available during maintenance. Receipts bind
the command ID to a canonical request hash and route; they cannot authorize different content.

## Trust boundaries

The operator-only bootstrap command reads a validated local configuration, creates the configured
identity, and atomically creates the installation, district, initial admin membership, initial audit
event, and synthetic records. It never adopts a preexisting sign-up, exposes no HTTP bootstrap
endpoint, and does not change state on repeat execution. Configuration drift is rejected.

The membership API verifies the token with the Auth emulator, checks verification/domain and the
current membership, validates a strict command schema, and rechecks the actor's administrator role
inside the transaction that writes the target membership and audit event. No submitted actor UID
or email is used as the audit actor. The initial administrator cannot be demoted or revoked through
the API. Administrators cannot edit their own membership. Production transfer/recovery is not yet
implemented and will need an explicit operator procedure.

The API binds to loopback, restricts Host/Origin, requires bearer tokens for private endpoints,
requires local Origin on mutations, bounds JSON request size, and exposes no general Admin SDK proxy.
The browser has no service credential. Every browser database write is also constrained by
`firestore.rules`, including field allowlists and server timestamps.

Requests must start pending, name the authenticated requester, and contain only request fields.
Review status/history cannot be supplied during creation. Staff updates are limited to an archive
boolean on their own request. Internal tool writes cannot inject scores or publication fields or
forge `updatedBy`. Review decisions use strict server commands with revision checks; direct review/job/history writes are denied.

## Operator backups

Backups are local operator commands with no browser/API endpoint. A server-only maintenance document
fences every API write transaction, analysis claim/completion, and allowed direct browser write.
Account operator commands share the same exclusive maintenance lock. Reads remain available.
A worker already running cannot commit across the fence; it recovers its lease after maintenance.
The lock has no automatic expiry, so a slow or unconfirmed export cannot silently reopen writes.
Only a matching operator lock ID can resume after a failure. Local operators can still bypass the
application through emulator administration; the freeze is not protection from that operator.

Restore accepts only a verified, supported backup bound to the same synthetic configuration and
lockfile, and only in a fresh emulator session. It verifies the initial admin's identity and role
before releasing the saved lock and starting the application. This preserves existing authorities;
it does not grant a new account ownership. See `backup-recovery.md`.

## What the tests exercise

Tests use the real rule evaluator and local HTTP endpoints. They cover public reads, every role,
cross-district isolation, verified vs. unverified identities, domain-only/nonmember access, revoked
membership, forged ownership/status/history/timestamps, legacy invite/registry escalation, direct
membership/public/audit writes, bootstrap replay/preclaim/config drift, protected/self admin changes,
server role enforcement, malformed commands, disabled accounts, origin/host rejection, and a second
independent configuration. They do not rely on hidden or disabled UI controls to establish denial.

The previous private snapshot and its rules remain unchanged. No part of these tests contacts the
existing district instance. This local foundation does not claim production readiness.

## Pasted sources and evidence commands

Pasted text uses the same private reader/editor roles as fixture reviews. Only the local server can
write the source snapshot, findings, scores, reviewer attribution and history. Each evidence edit
checks exact source offsets, required rationale, known criteria and the current revision, then
withdraws both publications and invalidates the previous decision atomically. Every enabled measure in the adopted rubric
requires explicit review before deciding. Source text is immutable through the API; quotes
and rationales remain private. No HTML execution, URL fetch, model call or client-provided authority
is involved. Imports require fresh review and cannot restore an archived approval.

Review heads/history permit only bounded client lists (at most 21 including lookahead). Source,
definition, evaluation, finding and decision subcollections deny direct client access for every
role. Private API reads recheck current membership and return one selected review/version. See
[review storage](review-storage.md) for the format and limits.
