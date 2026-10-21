# UX-03 — Navigate source validation feedback

Read AGENTS.md, HANDOFF.md, original accessibility brief, docs/accessibility-review.md and source
continuity references. The exact exclusive allowlist is in adoptionWave.assignments. Do not delegate,
commit, run emulators or control shared browsers. Install your own dependencies if required.

Implement A11Y-F1 for SourceDependencyEditor: stable control/error identifiers, applicable
aria-describedby/aria-invalid associations, and keyboard-operable links from a named error summary
to the affected field or dependency group. Preserve exact text/drafts, current validation meaning,
required documents, scope reconciliation, stale-definition handling and removable obsolete choices.
Do not move focus on every keystroke or introduce repeated live announcements. Keep the four-tab
experience and existing save contract. Avoid broad styles/formatting or unrelated form redesign.

Use a small pure feedback mapping only if needed to make multi-document/multi-link error targeting
reliable. Meaningful tests should prove correct target/error binding through additions/removals and
stable IDs, not mirror rendering. Run focused checks and typecheck. Prepare a reproducible keyboard,
320px/200% and announced-error test plan for coordinator browser acceptance. Explicitly distinguish
source/DOM evidence from actual VoiceOver/NVDA verification. Report in UX-03.md.
