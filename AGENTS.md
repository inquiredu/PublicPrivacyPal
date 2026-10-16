# PublicPrivacyPal working agreement

## Purpose and boundary

Build a self-hosted, open-source PrivacyPal that each district installs and controls independently.
The existing district instance and the original `inquiredu/privacypal` repository are reference
material only. The user explicitly requires that the district instance remain untouched.

- Work in this repository, whose origin is `inquiredu/PublicPrivacyPal`.
- Never deploy to, migrate, seed, rescore, or change the existing district project.
- Do not change the original repository or its GitHub settings as part of this work.
- No production logins, credentials, database exports, or live analysis calls are needed for development.
- Use synthetic data and explicitly named `demo-` emulator projects for local work.
- Do not start the archived upstream app: its Firebase client defaults to the district project.
- Do not execute upstream maintenance scripts. Several target the district database directly.
- Do not copy upstream Git history, operational documents, fixtures, environment files, or deployment
  bindings into releasable source. Preserve license and attribution when importing reviewed code.
- `.private/` holds local source/evidence only; never force-add or publish it. Git ignore rules are
  an accidental-add safeguard, not a security boundary.

## Engineering direction

- Refine the existing PrivacyPal product experience. Preserve its setup, cards, four-tab service
  detail, staff catalogue and public notice; read the original implementation before changing them.
  Use `docs/design-continuity-plan.md` for the source-based feature map and proposed next milestone.
- Reliability takes priority over restoration. Interrogate original and newly written approaches
  before carrying them forward. Preserve useful workflow continuity, but justify changes with
  failure cases and usability evidence. Follow the reliability gate in the design continuity plan:
  protect drafts, make retries unambiguous, and establish bounded/versioned review storage before
  expanding the eight-measure prototype into the full service-detail experience.
- Treat the simplified local screens and eight-criterion profiles as development/test slices,
  not a replacement design or a universal district rubric. Record intentional behavior changes.
- Preserve evidence-based extraction and deterministic scoring, with synthetic regression tests.
- Run model calls on the server; never return provider secrets to browsers.
- Keep district review decisions separate from policy findings and calculated scores.
- Expose only explicit public projections; test anonymous, staff, viewer, editor, and admin access.
- Make successful publication/unpublication mean the public state actually changed.
- Keep jurisdiction-specific policy text configurable and versioned.
- Treat hosted services and AI costs separately from the free software license.

## Current work

Start at `docs/open-source-plan.md`. Detailed upstream findings and reproducible local evidence
are in `.private/audit/REPORT.md`. The audit is a starting point for the rewrite, not a production
security certification. The repository now has a runnable emulator-only foundation. It is not
release-ready or deployable. Read `docs/local-development.md` and `docs/permissions.md` before
changing configuration, bootstrap, or authorization. Run `npm run ci` and `npm run test:integration`
for authorization changes; these require Node 24, and integration tests need Java 21+.
