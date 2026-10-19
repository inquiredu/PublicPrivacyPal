# Focused review-flow accessibility assessment

A11Y-01, October 18, 2026. The coordinator assessed the assembled UX-01 interface in native Chrome
on macOS, using a separate Guest window and the saved synthetic `demo-privacypal-local` installation.
This is a focused keyboard, accessible-state and visual assessment, not a conformance certification
or a VoiceOver/NVDA result. The source baseline is `cb5bb04` plus the coordinated working-tree
increment; final source identity and checks are in [the coordinator report](parallel-work/reports/coordinator-wave1.md).

## Observed task walkthrough

| Task | Result and evidence |
| --- | --- |
| Enter the installation and select a service | Anonymous library showed five saved entries; the existing synthetic administrator loaded nine reviews. Selecting Cedar Source Bundle — Browser QA exposed the named service heading and four-tab detail. |
| Understand evidence and permission | Overview distinguished the pending district decision, unresolved score, reviewed count and incomplete source coverage. Classification exposed separately named permitted-use, parent-permission, alternative-activity and grade-scope controls. |
| Inspect a source | The saved source disclosure showed document label, capture/applicability, dependencies, text and hash; the unavailable backup addendum remained explicit. Expanding it did not fetch a website or alter a finding. |
| Use the dependency editor | A temporary unsaved capture retained text, required-document choices and a selected backup-deletion clause. Native Tab and Space operated its checkbox with a visible focus indicator. Named fieldsets, labels and disclosure summaries were exposed in the accessibility tree. |
| Retain an unfinished draft | Navigation and two reloads retained the temporary capture, empty linked-material label, exact leading/trailing exclusion spaces and selected dependencies. Only this identifiable temporary draft was discarded afterward. |
| Recover from validation | An empty link label produced named feedback and blocked Save. Supplying its label cleared that blocker. Review-scope changes required explicit document-scope reconciliation and reset applicability to unresolved for reassessment; unresolved applicability can be saved, but cannot establish complete applicable coverage. Changing the rubric retained the earlier snapshot/selections, blocked Save and required explicit adoption; obsolete selections remained individually removable. |
| Navigate review tabs | Home/Right/End selected the appropriate tab; Tab moved focus into the corresponding panel. Chrome exposed the selected tab and named panel. Classification and Publish & Documents remained distinct. This does not establish spoken screen-reader announcements. |
| Inspect publication | The saved review exposed missing decision/tier/evidence blockers and disabled publication. No decision, review, setting or public record was saved. |
| Reflow and zoom | At an emulated 320 CSS-pixel viewport the dependency labels and selected clause wrapped within the visible panel. At browser 200% zoom, classification labels, controls and wrapping tabs remained visible. These are focused visual observations, not an automated whole-page overflow measurement. Zoom and device emulation were reset. |

Private screenshot: `.local/validation/coordinated-wave1/dependency-editor-320.png` (640 × 1502
physical pixels at device scale 2). The native accessible-state observations and interaction record
are in the coordinator conversation. The browser console showed the development React information
message and no errors in the inspected view; Chrome's separate Issues panel was not fully audited.

## Findings and proposed next checks

| ID / severity | Affected task and evidence | Proposed fix or check | Retest criterion |
| --- | --- | --- | --- |
| A11Y-F1 / low, source-observed usability issue | Dependency validation is a text list at the end of `SourceDependencyEditor.tsx` in a `role="status"` region. Individual controls do not reference the applicable error with `aria-describedby`, and there are no links from that list to the affected control. The blank-label browser exercise confirmed visible recovery, but spoken behavior was not tested. | In a separately assigned UI increment, use stable control/error IDs, associate applicable feedback, and offer links to the relevant field or dependency group. Keep draft text intact and avoid moving focus on each keystroke. | With two documents and two invalid links, keyboard users can reach each affected control from the summary; a screen reader announces its label and relevant error without duplicate or continuous announcements. |
| A11Y-F2 / verification gap | Named landmarks/headings, fieldsets, labels and tab states exist in the inspected tree and source (`App.tsx`, `ReviewDetail.tsx`, `SourceDependencyEditor.tsx`). Native keyboard checks passed; no speech-based reading-order or announcement assessment was performed. | Run the complete task with VoiceOver/Safari and NVDA/Firefox or Chrome, including long dependency lists, error recovery, modal return focus and dynamic status changes. | Record actual spoken labels/states, reading and focus order, and successful recovery for each task. DOM/AX inspection alone does not close this item. |
| A11Y-F3 / verification gap | `src/styles.css` contains a reduced-motion rule disabling decorative transition/animation, and dependency controls have a visible focus rule. Runtime reduced-motion and forced-colors modes, every configurable theme, contrast ratios and every disabled/error state were not assessed. | Exercise those runtime modes and measure configured foreground/background pairs, including focus indicators and public tier colors. | Record tested settings and ratios; any changed token must preserve readable text and visible keyboard focus across its affected states. |

No blocking keyboard or layout defect was observed in this focused walkthrough. This statement is
limited to the exercised routes and synthetic records. F1 is a concrete improvement proposal, not
an asserted screen-reader failure or a completed source fix. Full form reflow at all widths, 400%
zoom, alternative platforms and a complete contrast/assistive-technology audit remain open.

## Environment distinction and preservation

The in-app browser stalled on local Firestore streaming/membership reads before the owner unlocked
the Mac. Native Chrome then loaded the same restored installation with the original client code.
Temporary transport/logging experiments were reverted byte-for-byte before native acceptance; no
transport workaround is shipped. The in-app transport issue remains a separate environment finding.

The preview was restored from verified archive `0ace614b-1352-401f-9049-ee40382270b2`. The walkthrough
created only the named temporary tab draft, then discarded it. Saved reviews, public entries, user
membership and backup contents were preserved. Existing source/human decisions and publication
rules were inspected without executing a publication command.
