# Local district setup and library customization

These screens adapt the original PrivacyPal SetupWizard and LibraryDesignWizard, preserving the
six-part setup, priority controls and library-design dialog. Sign in with the local administrator
and open **Settings**. Initial account bootstrap remains a separate operator-only operation.

## Evaluation settings

Select sector/state, standards and law references; optionally add district guidelines, mission
and strategic priorities. The optional PrivacyPal Evaluation Framework 2.0 example preserves
the original 50 measures across 11 areas. Preview its questions and choose Disabled, Low,
Standard, High or Critical for each area. Selecting a standard supplies review context; it does
not remove questions from the bundled framework. You can instead choose measures later.

No state is preselected. Live AI law discovery is unavailable locally; the example state law
is visibly fictional. The law references are choices to review, not a determination of which
law applies. A completely disabled selected framework is rejected; choosing no framework is
an explicit deferred choice. All eight-criterion practice reviews retain their existing test
profile. New pasted reviews can explicitly adopt the saved 50-measure framework, priorities and
context at its current revision. See [versioned review storage](review-storage.md).
There is no implicit rescore, reanalysis or republication.

PDF import reads at most five pages from a file up to 5 MB, entirely in the browser with the
bundled PDF.js worker. It shows extracted text for review before you place it in the strategic
plan field. The PDF itself is not stored. Image-only, malformed, encrypted or timed-out documents
produce an error and can be replaced by pasted text. A synthetic document is included at
`test/fixtures/district-context.pdf` for the walkthrough.

**Finish Setup / Save Settings** waits for server confirmation. Failed saves keep your edits and
do not complete setup. Each successful save has a revision, server-authenticated author, time,
definition version and content hash. Previous versions remain private. The same section cannot
be silently overwritten by a second administrator: a stale revision is rejected. Use **Reload
saved settings** to discard a draft explicitly and load the latest version. Switching local
navigation keeps setup edits in memory; reloading the page warns about unsaved changes.

## Customize Library

Open **Customize Library** from Settings or the public library while signed in as an administrator.
The dialog retains title, logo, accent color, notice text, contact address, footer sections and
display preferences. Use **Preview library** to see the unsaved design with fictional sample
records. Saving updates the local public page; previewing and cancelling do not.

- Logos accept local PNG, JPEG or WebP files up to 100 KB. SVG and remote image URLs are rejected.
- Contact addresses use synthetic `.example` or `.test` domains in this sandbox.
- Footer sections can be edited, reordered, added, removed or reset. An empty section list
  intentionally hides the footer; it does not restore defaults. `{email}` uses the contact address.
- Cards/compact display, district/alphabetic/tier sorting, and the opening tier filter are defaults
  visitors may change for their session. Records without a tier appear as Pending; existing
  practice records do not acquire invented classifications. The preview supplies fictional tiers.
- The public page contains no score, so its sort menu does not offer score sorting.
- Accent labels automatically use black or white text for contrast. User-authored text is rendered
  as text, never as HTML. No remote assets, telemetry, discovery calls or email are sent.

External Drive configuration remains deferred; it is not required to save appearance settings.

## Storage and permission boundaries

`GET/POST /api/settings` requires a current administrator membership. Commands address only the
configured district and explicitly name either `evaluation` or `library`, its expected revision,
and validated values. Browsers cannot write settings, versions, audit or public settings directly.

Current records live at `districts/{districtId}/settings/{section}` and immutable saved copies at
`.../settings/{section}/versions/{revision}`. Library saves update the private record, version,
audit event and an explicit public field projection in one transaction. Evaluation context,
mission, priorities, actor and history are absent from the public projection. Separate section
revisions keep a library save from overwriting concurrent evaluation edits.

Maintenance fences these writes during operator backups. The additive settings records have
their own schema version and are included in the existing whole-installation backup. When
dependencies change, preserve a backup under the prior lockfile, then create and verify a new
snapshot with the new lockfile against the still-running local sandbox before switching runtimes.
Never edit an old backup manifest to bypass its dependency check.

Synthetic tests cover schema validation, access for every role, foreign district membership,
concurrent saves, rollback, revocation, maintenance, public projection, restart and recovery.
The implementation does not deploy to or modify the original district instance.
