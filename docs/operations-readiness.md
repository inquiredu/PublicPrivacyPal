# Operations readiness

This is a proposed operating design for an independently owned district installation. PublicPrivacyPal
currently runs only with synthetic local emulators. OPS-01 changes documentation only: no service,
identity provider, credential, monitor, retention job or production target has been configured.
Use [local setup](local-development.md) and [backup recovery](backup-recovery.md) for implemented
commands; use [the rehearsal plan](upgrade-rehearsal-plan.md) to qualify later changes.

## What works locally and what remains to be built

| Area | Existing behavior | Production prerequisite |
| --- | --- | --- |
| Installation ownership | A stable district ID owns records; memberships refer to individual identities. Only `demo-` projects and synthetic domains are accepted. | District-owned infrastructure, billing, domain and recovery contacts; independently reviewed target configuration. |
| Identity and access | Emulator-only verified identities, operator bootstrap and server/rules membership checks. Creating an identity grants no membership. | Real verified authentication, session/revocation policy, recovery controls and provider outage behavior. |
| Administration | Admins can assign/revoke other memberships. The initial admin is protected; no admin can change their own membership. | Audited initial-admin succession and lost-admin recovery. Bootstrap is not a password reset or ownership-transfer command. |
| Backups | Verified Auth/Firestore snapshots, maintenance fence, exact configuration/lockfile checks, fresh-session restore and bounded legacy conversion. | Encrypted off-device retention, independently recoverable keys, measured restoration targets and a supported upgrade path. |
| Publications | Explicit family/staff projections and atomic publication/removal. Corrections require a fresh decision. | Availability ownership, public incident wording, cache invalidation and agreement-expiry monitoring. |
| AI/provider secrets | Recorded/offline demonstrations; no live provider configured. | Server-only credentials, bounded dispatch/billing, rotation and incident response tested for the selected provider. |

The local machine's privileged operator can bypass emulator administration. Current local access
tests do not certify production infrastructure. [Installation readiness](installation-readiness.md)
records DOC-01's successful pinned install/CI and its unexercised operator/browser steps. Coordinator
integration/recovery evidence is recorded separately in the current [handoff](../HANDOFF.md).

## Proposed responsibilities and provisioning sequence

Assign named people or district teams before a pilot: a service owner approves scope and downtime;
an infrastructure operator owns runtime/recovery; a district administrator owns memberships; a
policy reviewer owns review/expiry decisions; a second custodian can recover backup keys; and a
security contact receives incidents. One employee's departure must not transfer ownership of the
district's project, data, domain, billing or encryption keys. The exact staffing model is a district
decision, not a permission role added by this document.

For a future provisioned pilot, require these reviewable outputs in order:

1. Record the new district-owned target, stable district identity, data location, service owners,
   billing/cost limits and separate public/private audience requirements. Do not reuse the reference
   district's project or credentials. The current emulator configuration is not a production installer.
2. Review deployment/authentication changes in code, including least-privilege service identities,
   HTTPS, network restrictions, database rules, logs and a safe failure state. Prove a disposable
   synthetic environment first; a successful local build does not authorize deployment.
3. Verify the chosen identity provider and district/domain control. An email suffix alone must not
   create a membership or admin. Exercise unverified, disabled, outside-domain and domain-only users.
4. Design an operator-attested first-admin enrollment bound to the empty district and a verified
   identity. Reject replay, a preclaimed account and nonempty installations. Keep the existing local
   bootstrap contract intact until a separately reviewed production implementation exists.
5. Establish a second accountable administrator/custodian and verify recovery access, monitoring,
   backups and private security reporting. Complete a synthetic role/publication/recovery exercise
   before admitting real records. Production approval remains outside this plan.

## Access changes, succession and secret rotation

For an ordinary local membership revocation, an authorized admin uses **People & access** to revoke
another member. Verify the saved membership and a fresh private read/write as that member: old
browser state or a previous token must not confer current access. Retain attributed history and
district records. Disabling an identity and revoking a district membership are distinct operations.
Future production procedures must also address identity-provider sessions; no such provider workflow
is implemented here.

For planned administrator succession, the proposed sequence is: verify the successor's identity;
have an existing authorized admin assign the needed role; independently verify successor access;
inventory operational ownership and key custody; then revoke the departing person's ordinary
membership and provider access. **This cannot retire the protected initial administrator today.**
Initial-admin succession requires a new, versioned operator workflow with independent attestation,
transactional identity/membership checks, an audit event, replay protection and rollback tests.
Do not edit database membership fields or rerun bootstrap as an operational substitute.

For lost-admin recovery, preserve state and audit evidence, verify district control through a
separately approved recovery authority, then use a future audited recovery workflow. Restore of a
local archive requires the existing verified, enabled initial admin and matching membership; it
does not promote an arbitrary replacement. A failed restored-admin check must stop recovery, not
cause a fresh bootstrap. Ownership proof, recovery authority and two-person approval are unresolved
production design decisions.

For future secret rotation, inventory each server identity/provider credential and its consumer;
create a replacement through the district's verified operator; validate it in the disposable target;
switch the server; check health and permitted operations; revoke the old credential; and verify old
access fails. Record versions/times, never key values, in the audit. Credential overlap, rollback
window and incident-driven immediate revocation must be chosen for the actual provider. Preserve
request receipts and unknown billing outcomes during worker restarts; rotation must not blindly
replay a paid request. Backup encryption keys have a separate recovery lifecycle below. No credential
rotation command or live-provider procedure is claimed to exist in this local build.

## Backup sets, retention and key recovery

Maintain an inventory that links each saved artifact to its source revision, configuration identity,
lockfile hash, creation time, owner and restore evidence. Keep these classes distinct:

| Artifact | Preservation requirement |
| --- | --- |
| Whole-installation archive | Preserve the complete verified Auth/Firestore directory, native metadata and manifest. It includes password state and private records; current files are unencrypted. |
| Source/configuration/toolchain | Preserve reviewed source plus the exact lockfile and synthetic configuration needed to restore. Keep deployment secrets separately. A source hash is not a source backup. |
| Plaintext local account files | Not included in the installation archive. Store privately if required for the synthetic trial; production authentication needs its own recovery procedure. |
| Offline qualification packets/raw returns | Separate private operator artifacts with their own provenance/version/integrity inventory. Installation restore does not recreate them. |
| Browser drafts | Tab-local, expiring and outside installation backups. Save important work or retain a private copy before closing; do not claim disaster recovery for unsaved drafts. |

A proposed production backup sequence is: quiesce supported writes; capture a consistent versioned
snapshot; verify it; encrypt with authenticated encryption using a reviewed tool/service; copy the
encrypted package to district-controlled storage outside the runtime's failure domain; verify the
remote object and retrieval; record the encryption key version; then perform a restore drill from
that off-device copy. Choose and qualify the tool before claiming encrypted backup support. Do not
print secrets, put keys beside the only archive, or assume a checksum proves authenticity.

For a synthetic pilot only, a reviewable starting schedule is daily recovery points retained for
7 days, weekly points for 4 weeks, and monthly points for 3 months, plus protected pre-upgrade
points. Proposed measurement targets are at most 24 hours of saved-data loss and 4 hours to restore
service. These are candidate test targets, not achieved service levels or a district retention policy.
The district must set actual retention, deletion/legal-hold rules and recovery objectives. No deletion
job runs now. Do not expire the last verified compatible recovery point or a point required by an
unresolved upgrade, incident or hold.

Key recovery must be tested by a second designated custodian using a separate authorized recovery
path when the primary operator/device is unavailable. Retain every old key version needed by
retained ciphertext. A rotation is incomplete until old/new retained archives decrypt and restore;
lost keys mean those archives may be unrecoverable. Proposed deletion includes both retained objects
and the relevant key lifecycle, after the applicable retention/hold decision. Measure successful
decryption and application recovery separately.

## Expiry review and public-library availability

Today an agreement expiring after publication remains published until an authorized reviewer acts.
Detail checks use the current date; card warnings summarize the last write. The server checks the
agreement again on approval/publication, but no time-triggered withdrawal job exists. Expiry is
inclusive in UTC. Treat this limitation as an operational prerequisite before using real agreements.

Proposed monitoring should identify agreements approaching expiry, assign a reviewer, record
acknowledgment and escalate missed review. The district must choose deadlines and whether an expired
entry is withdrawn automatically or remains visible with approved wording. Any automatic change
requires a separately reviewed transaction/receipt/history contract and tests; this plan schedules
nothing. The immediate manual response is inspect the adopted requirements, unpublish if needed,
verify actual family/staff removal, and record the district's next decision through normal controls.

For a future public service, define who detects an outage, communicates it and restores availability.
Separate “healthy but empty” from “could not load records.” A failed refresh must not silently show
stale approval as current. Any CDN/offline cache needs publication-version and invalidation design;
do not create an independent static approval list as an unreviewed fallback. Proposed probes cover
the public projection's availability, private-access denial, backup age and expiry-review queue
without exposing private review contents in monitoring logs.

## Decisions and costs before a pilot

The service owner must choose provisioning/authentication, operating ownership, private reporting,
succession authority, backup/key custody, retention/recovery targets, expiry policy and outage
communications. A measured pilot must include hosting/compute, database reads/writes/storage,
network traffic, encrypted backup copies and restore retrieval, key management, identity/email,
monitoring and staff time. AI usage is a separate provider/token budget. No monthly price or free
hosting allowance is inferred from the software license.
