# Security scope and reporting

PublicPrivacyPal is an emulator-only development checkpoint, not a supported production release.
There is no published security-support window, patch SLA or promise of a response time. Local
authorization and recovery tests are evidence for those behaviors, not a production certification.
Dependency findings are dated in [dependency review](docs/dependencies.md) and need fresh review
before a release.

## Private reporting channel: maintainer decision required

**A monitored private vulnerability-reporting channel has not been verified for this repository.**
This document does not advertise an email address or assume GitHub private reporting is enabled.
Before a release, maintainers must choose a private channel, verify that reports reach responsible
maintainers, and replace this notice with concrete instructions and supported-version information.

Do not post sensitive vulnerability details, credentials, exploit data or district records in a
public issue, pull request or discussion. Until a channel is verified, retain the sensitive report
privately. Use an established private maintainer contact only to arrange an appropriate reporting
channel; if no such contact exists, do not send the sensitive details through an unverified route.

## What a private report should contain

- The PublicPrivacyPal revision, operating system and Node/Java versions tested.
- The affected component and expected versus observed behavior, including the role required.
- Minimal reproducible steps using synthetic data and a `demo-` emulator project.
- The security impact and relevant request/response or log excerpts with all secrets and private
  data removed.
- Any proposed mitigation and whether the issue has been shared elsewhere.

Do not attach complete installation backups, account files, private source snapshots or real policy
packets. If sensitive material is necessary, agree on secure handling through the verified private
channel before transferring it.

## Testing boundary

Reproduce issues only in a disposable local installation you control. The existing district
instance and original repository are outside this development scope; do not test against them.
No cloud credentials, production database exports, real accounts or live provider calls are needed.
Keep emulators on loopback and preserve saved data before destructive local testing.

The application's role and projection boundaries are documented in [permissions](docs/permissions.md).
The privileged operator of the development computer can alter emulator state; emulators do not
provide a hardened production trust boundary. Backup checksums detect accidental changes, and local
backups are not encrypted; follow [backup and recovery](docs/backup-recovery.md) for their limits.

Production provisioning, verified authentication, secret rotation, encrypted off-device retention,
upgrade/rollback, administrator turnover, monitoring and support ownership remain adoption work.
Security fixes must preserve historical records, human decisions and actual publication semantics
and pass the relevant [validation gates](docs/parallel-work/validation.md).
