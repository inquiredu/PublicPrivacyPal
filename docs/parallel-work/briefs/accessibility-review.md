# A11Y-01 — Review flow accessibility assessment

Follow-up assignment; obtain a stable UI revision and any shared-browser reservation first. Read
AGENTS.md, `docs/accessibility-performance.md`, `docs/service-detail.md` and the UX-01 report.

Initial ownership: `docs/accessibility-review.md` and `reports/A11Y-01.md`. Submit concrete fix
proposals; the coordinator assigns source files before edits to avoid concurrent UI changes.

Assess the complete task: select a service, understand permitted use and evidence gaps, inspect a
source, retain an unfinished draft, recover from validation failure, review conditions and inspect
publication. Cover keyboard navigation/focus, landmarks/headings, labels, tab announcements, error
recovery, zoom, 320px reflow, reduced motion and configurable contrast states.

Exercise actual available assistive technology where possible. DOM inspection and keyboard tests
are not VoiceOver/NVDA validation; label missing assistive-technology/platform checks explicitly.
Use synthetic records, preserve existing drafts, and identify temporary changes before discarding
them. No public or service data mutations without coordination and corresponding backup handling.

Acceptance: reproducible findings with severity, affected task, source location, screenshot or
accessible-state evidence, proposed fix and retest criteria. Separate verified behavior from
untested platforms; do not claim certification or complete conformance from a focused pass.
