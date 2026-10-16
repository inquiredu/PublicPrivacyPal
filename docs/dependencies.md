# Dependency review

Reviewed 2026-10-15. Runtime: Node 24. Dependencies are exact versions with a lockfile.
The local app is built on React 19, Firebase JS SDK 13, Admin SDK 14, and Zod 4. Tooling uses
TypeScript 7, Vite 8, and Firebase CLI 15. These are independent of the private source's lockfiles.

The setup screen adds pinned **PDF.js 6.4.299** for local district-document text extraction.
Its matching worker is bundled with the application and loaded only when importing a PDF;
the original screen's external CDN worker is not retained. Version selection was checked against
[Mozilla's release notes](https://github.com/mozilla/pdf.js/releases/tag/v6.4.299). Runtime audit
remains at zero reported vulnerabilities after this addition; the seven development-tool flags
below are unchanged. The PDF module adds an approximately 430 kB lazy chunk and a 1.26 MB worker.

## Targeted patch

The Firebase JS SDK's Node dependency path pins an old `@grpc/grpc-js` release. The lockfile overrides
it to **1.14.6**, preserving its major-version API and removing the reported certificate-authorization
and error-message advisories. Auth/Firestore integration and build checks passed with the override.
Revisit this override when the SDK updates its dependency. Advisory:
[gRPC certificate authorization](https://github.com/advisories/GHSA-m9gg-hp2v-232j).

## Audit result and limits

- `npm audit --omit=dev`: **0 reported vulnerabilities**.
- Full development tree: **7 flagged packages** (3 high, 4 moderate), all under Firebase CLI tooling.

The remaining sources are `braces`/`chokidar` (unbounded nested glob patterns), OpenTelemetry baggage
handling, and an older `uuid` used by the CLI's HTTP dependency. The CLI itself and intermediate
packages inherit these flags. These are not seven distinct vulnerable runtime features.

This milestone invokes the CLI only for local Auth/Firestore emulators with a fixed, trusted JSON
configuration; it does not expose user-supplied glob patterns, Pub/Sub handlers, or UUID buffer
operations. They remain known development-tool risks, not silently dismissed audit findings. No
unreviewed major-version override was applied to those dependencies. The audit proposes downgrades
that are unsuitable as automatic fixes. Update the CLI and rerun the audit/tests when compatible
patched dependencies become available. Keep this local toolchain off public networks.

Evidence for this working copy is saved under `.local/validation/` and excluded from Git. Audits
change over time and are not a security certification. A production release still requires a new
dependency review and the remaining operational milestones.
