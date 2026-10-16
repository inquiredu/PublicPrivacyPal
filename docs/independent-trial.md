# Independent local trial

Audience: someone trying the community edition on their own computer, without the author's accounts.
This is a synthetic local rehearsal, not a public hosting guide. It uses no district Firebase
project, cloud credential, AI key, mail service or real vendor policy. The software is AGPL-3.0;
a future hosted installation may incur infrastructure and provider costs.

## Prepare a copy

Use the independent `inquiredu/PublicPrivacyPal` repository, then open a terminal in its directory.
Keep a Git/source revision with your eventual backups. Install Node 24 and Java 21 or newer.
If you use nvm, `nvm use` selects the repository's Node version. Verify with `node --version` and
`java -version`. The first install/download requires internet access to dependency and emulator
distributors; the application itself runs locally.

```sh
npm ci
npm run local:init
```

Inspect `config/local.json`. For this trial, keep the synthetic Maple Grove defaults, or use the
provided `config/second-district.example.json`. Project IDs must begin `demo-`; allowed email domains
must end `.example` or `.test`. These names deliberately cannot become a live district connection.
Do not substitute your district's real project IDs or accounts. The config contains no passwords.

## Start and enter the staff workspace

In the first terminal:

```sh
npm run dev
```

Wait for the local browser address. In a second terminal, in the same directory and Node version:

```sh
npm run local:bootstrap
```

Open the credential file printed by that command. It contains the administrator email and a random
local password. Open http://127.0.0.1:5173 and refresh/check again if the setup screen remains.
The default page is the **public library**. Scroll to **For your district team**, sign in there, then
choose **Policy reviews** or **People & access** in the sidebar. The public view alone does not mean
the administrative workspace is missing.

The bootstrap command refuses to replace an existing administrator or adopt a preclaimed account.
If you have an uninitialized disposable trial with a conflicting sign-up, stop and start an empty
session, then bootstrap before creating any other accounts.

## Rehearse a colleague's access

```sh
npm run local:user -- --email reviewer@maple.example
npm run local:user -- --email viewer@maple.example
npm run local:user -- --email teacher@maple.example
```

Use **People & access** as admin to assign reviewer, read-only reviewer and staff respectively.
Creating an identity alone grants no private access. Sign out and use each generated local password
to check what that role sees. Reviewers can analyze/decide/publish; viewers can inspect; staff can
request tools but cannot inspect private reviews. Revoke a test membership and confirm access ends.
Return to the admin account for the rest of the rehearsal.

## Complete a review and recover it

1. Open **Policy reviews**, choose **Bundled synthetic policy**, a fictional name, and **Missing and conflicting commitments**.
   Keep **Evidence-first candidate** selected. Analyze, then inspect the score and exact quotations.
2. Expand **Review the scoring rubric**. Compare a separate review using the inherited profile.
   Expect 36 and 66 with the same evidence. Record unresolved policy questions using the
   [rubric review](scoring-rubric.md); neither version has district sign-off.
3. Record a conditional decision, internal rationale, public summary, category and conditions.
   Publish locally. Sign out and verify only the intended public wording appears. Sign back in
   and unpublish; verify the entry disappears. Try the temporary-failure fixture and retry it.
4. Follow [backup and recovery](backup-recovery.md) to save the complete installation, stop the
   services, restore it, and sign in with the same credentials. Check private history and role limits.

To use the second example, stop the first session and consistently set
`PRIVACYPAL_CONFIG=config/second-district.example.json` for dev, bootstrap, user and backup commands.
Its sample accounts use `river.example`. Each installation's backup is bound to its own configuration.

## Run the checks and record the outcome

Save your sandbox first and stop development services. Run:

```sh
npm run ci
npm run test:integration
npm run test:recovery
```

Then restart your sandbox using its backup. Port conflicts mean another local process still owns
one of the required ports; stop that process deliberately rather than changing emulator addresses.
If local source files repeatedly stall in a cloud-synced folder, keep a working copy on local disk
and rerun the pinned install there. Never copy an old app's deployment settings into this project.

For an independent trial, record the source revision, OS, Node/Java versions, setup friction, rubric
questions, and whether sign-in, role checks, publication/removal and recovery matched expectations.
Do not include passwords or backup files in feedback. One successful automated rehearsal does not
replace this independent user trial. Live hosting, real-policy extraction, a district-approved profile,
accessibility review, encrypted operational backups and upgrade recovery remain release work.

## Try pasted text and corrections

Use **Paste policy text** with an authored fictional policy. A copyable example and suggested
findings are in [the synthetic paste walkthrough](synthetic-paste-walkthrough.md). Confirm that:

- The new review begins with zero completed criteria and cannot be approved or published.
- Exact source selection and pasted quotations both work; ambiguous quotes require selection.
- Multiple passages can capture a promise and its exception. A fabricated quotation is rejected.
- Completing all eight findings enables a decision. Saving an evidence correction after publication
  removes the public entry and requires a fresh decision before publishing again.
- History records the old and new findings and authenticated reviewer. Source text and rationales
  do not appear in the anonymous library.
- Export/import creates a new unreviewed draft; backup/restore preserves the original review.

These interactions passed the local browser walkthrough recorded in `provenance.md` on 2026-10-15.
Repeat them during an independent adopter trial; that broader acceptance remains outstanding.
