# Local accessibility and bundle improvements

The complete service restoration is preserved in local commit `edc75f7`. This follow-up keeps the
original card, four tabs, setup controls and audience views. No server behavior, authentication,
authorization, score, publication rule, dependencies or data format changed.

## Loading and size

Settings and Policy reviews use dynamic imports with loading announcements and an error boundary
that keeps shell navigation available if an optional screen fails. Settings first mounts on use,
then remains mounted while navigating so unsaved settings are preserved. Review drafts retain their
existing tab-scoped store. Public-library styling is loaded independently of Settings; deferring
Settings must not remove public styling or screen-reader-only captions.

The SDK and React chunks are separately cacheable. This does not eliminate their first-load cost.
The build manifest gate measures all transitive static dependencies, not only the application entry.
PDF parsing and its worker remain on demand. Current budgets in `scripts/check-bundle.mjs` are:

- Initial JavaScript: at most 290,000 gzip bytes across all static imports.
- Application entry: at most 180,000 bytes minified.
- Each application JavaScript chunk: at most 500,000 bytes minified.
- Reviews, Settings and PDF import must remain dynamic entries outside the initial dependency graph.

A fresh build of `edc75f7` was compared with the new build using identical Node `gzipSync` defaults:

| Measurement | Restoration baseline | Follow-up |
| --- | ---: | ---: |
| Initial JavaScript, minified | 1,012,876 bytes | 943,172 bytes |
| Initial JavaScript, gzip | 299,437 bytes | 282,095 bytes |
| Application entry, minified | 1,012,876 bytes | 159,271 bytes |

The actual initial gzip reduction is approximately **5.8%**. The much larger entry-file reduction
mostly represents splitting shared dependencies; it is not an equivalent download reduction.
The largest application chunk is Firestore at about 487 kB. No Vite chunk-size warning remains.
The approximately 1.26 MB PDF worker is still separate and only needed for PDF import.
Further substantial reductions need a deliberate public-data/authentication architecture decision,
not a switch that loses realtime publication behavior. These are build sizes, not latency benchmarks.

## Accessibility changes

- Main navigation exposes the current page. Page titles update, and route changes move focus to a
  named main landmark. The skip link has an explicit programmatically focusable target.
- Settings has a level-one heading. Existing review selection still focuses the service heading.
- Disclosure summaries, tab panels and programmatic heading focus have visible indicators.
  Reduced-motion preferences disable decorative transitions/animations.
- Review-measure refresh is outside its select label, avoiding an extra action in the accessible name.
- Save announcements use a persistent atomic status region; deferred screens and selected-review
  loading have status messages.
- Library dialog closure explicitly restores its trigger when it still exists. Native modal behavior
  preserves focus containment and Escape cancellation.
- Setup primary buttons use darker blue for white-text contrast (the previous blue was too light
  for ordinary-size text).

## Verification and repetition

`npm run ci` passed: TypeScript, 90 unit/isolation tests, build, graph/size budgets and source/bundle
isolation. No authorization or storage change required an additional emulator integration run.
Local browser checks used the actual production build on loopback port 5174 with the existing
`demo-privacypal-local` emulators, including anonymous library and synthetic administrator sign-in.

1. Activate Skip to main content with Enter; verify focus lands on the named main landmark.
2. Open Settings by keyboard; check the current-page attribute, title, heading and focus.
3. Edit a synthetic settings draft, visit Public library, return and verify the draft persists.
   Restore the original field without saving.
4. Open Customize Library by keyboard; check initial focus, backward tab containment, Escape and
   return to its trigger. Do not save changes.
5. Open Policy reviews and Cedar Complete Service. Verify the async loading announcement and
   service-heading focus. Arrow keys, Home and End select the corresponding tab; Tab reaches the
   visible panel with an outline. Hidden panels do not contribute focusable controls.
6. Change Age guidance as an unsaved service draft, navigate away/back, verify retention and discard.
7. Check visible fields have associated names and reflow at 320px without horizontal overflow.
8. Inspect browser warnings/errors. None occurred in the production-build acceptance session.

Evidence, identical-compression size measurements and screenshots are in the ignored local folder
`.local/validation/accessibility-bundle/`. No real agreement, account or district data was used.
These checks are not a full WCAG audit or screen-reader certification: VoiceOver/NVDA reading order,
zoom and contrast throughout every configurable state, validation-error recovery and broader
assistive-technology testing remain release work.
