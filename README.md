# PublicPrivacyPal

A community edition of PrivacyPal, intended for school districts to install and control themselves.

**Status: development checkpoint — district setup, complete four-tab service review, staff/family views, and tested backup/recovery.** This milestone uses Auth and Firestore emulators, synthetic
districts, and a local API. It is not a production deployment or a release for district adoption.

The first release will focus on reviewing educational tools, extracting evidence from privacy
policies, calculating reproducible scores, and publishing a district-curated library for families.
Districts will own their data, accounts, infrastructure, and provider credentials. The software
will be freely licensed; hosting, email, and AI services can have operating costs.

Start with the [open-source plan](docs/open-source-plan.md) and [source provenance](docs/provenance.md).
See the [service workflow](docs/service-detail.md) and [accessibility and bundle checks](docs/accessibility-performance.md) for implemented behavior and remaining limits.

## Run locally

Prerequisites: **Node 24**, **Java 21+**, and Git. No Firebase login, cloud project, or API key is needed.
The first emulator run downloads Firebase's emulator binaries.

```sh
nvm use
npm ci
npm run local:init
npm run dev
```

Open **http://127.0.0.1:5173**. In another terminal, create the administrator named in
`config/local.json`:

```sh
npm run local:bootstrap
```

The command writes a randomly generated, emulator-only password to a file under `.local/accounts/`
and prints that file's path. Sign in using those details. The initial administrator is protected;
there is no public sign-up-to-admin flow or HTTP bootstrap endpoint.

To add a colleague, create a local identity, then use **People & access** to assign its role:

```sh
npm run local:user -- --email teacher@maple.example
```

An identity alone has no workspace access. Available roles are staff, read-only reviewer, reviewer,
and administrator. Permissions are enforced in the database and the API, not just the interface.

**Save before stopping:** run `npm run local:backup` in another terminal, then restart with
`npm run dev -- --restore .local/backups/YOUR_COMPLETED_DIRECTORY`. Existing accounts and data are
restored together. There is no automatic save; starting without `--restore` creates an empty sandbox.
Use synthetic data and local passwords only.
See the [local setup guide](docs/local-development.md) and [permission model](docs/permissions.md).

Administrators can open **Settings** for the original six-part district setup and **Customize
Library** for appearance, notice/footer text and display defaults. See the [district settings
guide](docs/district-setup.md). The optional original 50-measure framework can be previewed and
saved and explicitly adopted for a new pasted review. Source, rubric and evaluation versions are
preserved in bounded records; see [review storage](docs/review-storage.md). Existing eight-measure
practice reviews keep their own scoring profiles. The original four-tab detail is the next increment.

## Checks

```sh
npm run ci
npm run test:integration
npm run test:recovery
```

Stop `npm run dev` before running integration tests: they need the same loopback ports. Tests use a
separate demo project, synthetic accounts, and negative authorization cases. CI runs all three checks.
Deployment is disabled: `npm run deploy` exits with an explanation. No hosting or Functions target
is configured. **Policy reviews** supports pasted-text manual review, synthetic analysis, evidence corrections, recorded decisions,
and atomic publish/unpublish actions in the local library. See the [workflow guide](docs/review-workflow.md).
New reviews use a versioned evidence-first scoring candidate; earlier reviews retain their formula.
Start with the [independent trial guide](docs/independent-trial.md), [rubric review](docs/scoring-rubric.md),
and [backup/recovery runbook](docs/backup-recovery.md). Live AI, real-policy fetching, production
provisioning, district rubric approval, encrypted operational backups and production upgrade/rollback remain future work.

## Private reference copy

The initial source snapshot and detailed audit evidence live in `.private/`, excluded from Git.
They include district-specific material and must not be published. The snapshot has no Git remote
or copied Git history. Do not run its app or maintenance scripts: they still contain production
connections. Development will import reviewed, generalized code in small steps.

The isolation check in `npm run ci` detects known district connections and common accidental
private-file imports. It is not a full secret scanner or proof that a future deployment is safe.

## License

The upstream project supplies the GNU Affero General Public License v3.0. Its [LICENSE](LICENSE)
is preserved here, together with [provenance](docs/provenance.md). Retain upstream notices when
bringing reviewed code into this repository.

## Portable policy-analysis infrastructure

The original prompt system was designed with Google Gemini. This rewrite defines a server-side
contract for any hosted or local AI system and includes a recorded Cedar example for offline
review, citation validation, job recovery and human correction. It does not enable live inference.
See [provider adoption](docs/ai-provider-adoption.md), [local suggestions](docs/policy-suggestions.md),
and [the modernization plan](docs/ai-analysis-plan.md).

The review refinement preserves [scope, questions and suggestion provenance](docs/review-context.md)
through drafts and human saves. Unresolved findings withhold the aggregate score and district decision
while retaining their scoring weight. Historical scores remain fixed; precision-profile archives use schema 7.

The [rubric precision candidate](docs/rubric-precision.md) makes 14 difficult measures executable as
26 subrequirements with 91 synthetic boundary cases. `npm run rubric:lab -- check|export|grade`
supports offline review and testing with any system. A separately selectable [precision pilot](docs/rubric-adoption.md)
now uses those clauses in prompts and human review. Existing reviews and the default profile remain
unchanged; the synthetic labels still require independent adjudication.
