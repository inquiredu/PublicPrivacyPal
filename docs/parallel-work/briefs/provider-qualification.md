# PROV-01 — Provider qualification harness

Follow-up assignment after the coordinator accepts the intelligence interfaces needed by this
increment. Read AGENTS.md, `docs/ai-provider-adoption.md`, `docs/analysis-invariants.md`,
`docs/source-segments.md`, and the accepted contract log. The original Gemini provenance stays
acknowledged; qualification is provider-neutral.

Initial ownership: `docs/provider-qualification.md`, `test/fixtures/provider-qualification.ts`,
`test/unit/provider-qualification.test.ts`, and `reports/PROV-01.md`. Actual provider/worker/storage
code remains coordinator-owned until a specific change is assigned.

Build a fake-transport qualification harness for successful output, refusal, truncation, schema or
citation failure, slow/stalled requests, cancellation, uncertain dispatch/billing, retries, revocation
and late completion. Check original-versus-derived output, version negotiation, bounded execution,
and no duplicate generation after uncertain dispatch. Preserve existing historical fixtures.

Propose provider-specific token/context checks and conservative per-attempt/daily/total cost
reservations with exactly-once settlement and operator reconciliation. Request-count quotas do not
establish a currency cap. Unknown outcomes retain reservations until explicitly reconciled.

No provider/account is selected by this assignment. Do not obtain keys, make paid or free live
inference calls, or enable dispatch. A future live trial must identify provider/model versions,
account/data scope, spending ceiling, retention/training policies and held-out evaluation cases.

Acceptance: executable fake-transport cases, known interface gaps and a concrete live-trial
qualification procedure. Separate structural validity, semantic quality, latency and actual cost;
synthetic transport tests establish neither model accuracy nor production billing behavior.
