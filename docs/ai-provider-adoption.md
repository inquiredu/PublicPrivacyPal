# Adapting PrivacyPal to another AI system

The original PrivacyPal prompt system was designed around **Google Gemini**. PublicPrivacyPal
preserves that provenance while making its new analysis contract independent of a model vendor.
Gemini is not required to run the application. A district can implement the same adapter for a
hosted API, an institution-managed endpoint, or a local model. “Compatible” means passing this
contract and the district's evaluation gates, not merely accepting an OpenAI-shaped HTTP request.

The shipped application uses a **recorded synthetic Cedar example**. It makes no inference calls,
accepts no provider credentials, and does not analyze arbitrary policies with a model. The adapter
boundary, prompt preview, validator, private job/result storage and human review UI are implemented.
Live provider registration, priced reservations and operational reconciliation remain deliberate
installation work; adding an environment variable alone does not enable them.

## Portable contract

Start with `server/analysis/provider.ts`. Implement `AnalysisProvider` on the server:

```ts
const provider: AnalysisProvider = {
  id: 'installation-chosen-system',
  model: 'an-exact-supported-model-id',
  version: 'adapter-v1',
  settings: { outputLimit: 16000, reasoning: 'chosen-supported-setting' },
  offline: false,
  maxCostMicros: /* conservative per-request ceiling in millionths of USD */ 0,
  async generate(request, { attemptId, signal }) {
    // Translate request.instructions, reference, source and schema for your system.
    // Use your server-only SDK/client with signal, a response-size limit and no retries.
    // Return completed { output, requestId, usage }, or refused/incomplete.
    // This skeleton is not an executable client or a zero-cost live configuration.
    throw new ProviderFailure('not_sent', 'Implement the chosen transport');
  },
  async reconcile(attemptId, signal) {
    // Read the durable attempt-to-provider mapping. Lookup only: NEVER dispatch here.
    return null; // Unknown stays unknown if the provider cannot retrieve an outcome.
  },
};
```

Use `server/analysis/offline.ts` as the smallest working implementation. Do not label a live or
local inference endpoint `offline: true`; that flag allows replay of the deterministic recording.
Do not copy its zero-cost usage into a paid adapter. Missing usage/cost is `null`, not zero.

### Translate a request

1. Put `request.instructions` in the highest-priority instruction field the system supports.
   Keep `request.reference` and `request.source` in separately delimited data fields/messages.
   Both are untrusted data. Never interpolate a policy into system instructions. Disable browsing,
   retrieval, tool calls and external actions for extraction.
2. Use the supplied JSON Schema for constrained output where supported. Translate only documented
   schema features; preserve all required fields, enums and additional-property restrictions. If a
   system only emits text, parse one complete JSON document. Reject code fences, preambles,
   truncation and malformed JSON. Do not silently “repair” missing findings into policy omissions.
3. Preserve source IDs, passage IDs and exact quote characters. The server resolves offsets into
   the saved text; the model must not count characters. Repeated quotes within one passage require
   a longer unambiguous quotation. Share citation IDs instead of duplicating quoted text.
4. Pin the model identifier and adapter version, and record all generation settings that affect
   output. Changing the prompt, schema, rubric, source, provider, model, adapter or settings must
   change the result-cache key. Historical results stay unchanged.
5. Map vendor refusal, safety blocking, output-limit termination and transport errors explicitly.
   A nonempty partial response is still incomplete. SDK automatic retries must be disabled unless
   provider idempotency and the job reservation cover them. No unsupported parameter should be
   silently dropped or retried with different behavior.

Current provider examples: Gemini exposes structured output and thinking controls; OpenAI exposes
structured output and reasoning controls. These controls differ by endpoint/model. Use the
provider's current official documentation when writing an adapter:
[Gemini structured output](https://ai.google.dev/gemini-api/docs/structured-output),
[Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking),
[OpenAI structured output](https://developers.openai.com/api/docs/guides/structured-outputs),
[OpenAI reasoning](https://developers.openai.com/api/docs/guides/reasoning).
For another system, apply the same contract to its native API; these two SDKs are not prerequisites.

### Translate an outcome

Return the provider request ID, canonical output and available input/output/cached/reasoning token
usage. Record cost in integer millionths of USD using a dated price schedule, including reasoning,
cache and retry charges. A locally hosted system can report zero API charge when that is true;
hosting/compute still costs money. Do not equate absent billing metadata with free inference.

`ProviderFailure('not_sent', ...)` is reserved for a verified failure before dispatch.
`rejected` means the provider definitively rejected the request; charges may still need settlement.
`unknown` means dispatch may have completed. A generic transport failure after dispatch is unknown.
Exception messages are not returned to the browser; do not log secrets, policy text or raw responses.
Respect `AbortSignal`, but do not assume an abort canceled remote processing or its charge.

`validateSuggestions()` independently checks byte limits, all enabled measure IDs exactly once,
allowed state/uncertainty combinations, source/citation integrity, unresolved questions and summary references. It cannot
prove that a quotation supports the interpretation. Human review and the semantic benchmark remain
necessary even with schema-constrained output.

## Version and deadline contract

Existing profiles use prompt `evidence-extraction-v2` and output `policy-suggestions-v2`. The shared
`findingRules` and `questionReasons` specification drives the prompt, conditional JSON Schema,
runtime validation and draft eligibility. Translate conditional schema rules faithfully (for
example to an equivalent union) or explicitly use validated text output; do not silently claim
native enforcement of unsupported schema features. Exact quotations still do not prove that a
finding is semantically correct.

The explicitly selected [precision pilot](rubric-adoption.md) uses `evidence-extraction-v3` /
`policy-suggestions-v3`. Its 14 refined measures require the adopted subrequirements, scope and
evidence roles; the server calculates the aggregate finding. The other 36 measures retain the
ordinary shape. Do not add an aggregate-state field to refined output or a free-form summary.
The supplied mixed schema and full adopted definitions are the adapter contract.

Historical v1/v2 reads and queued recordings retain their original version and request identity.
Provider adapters must deliberately support a requested historical version or fail before dispatch;
never silently relabel old output with the current schema. New requests do not reuse the v1 cache.

The worker's 60-second operation deadline covers identity and database waits as well as provider
work, followed by at most five seconds of status-only cleanup. Every transaction callback checks
its authority before returning buffered writes. Deadline expiry stops heartbeat renewal and late
provider dispatch. SDK RPCs already submitted may still complete; timeout is not remote cancellation
or proof that a database commit failed. Lease tokens, transaction conflicts and subsequent reads
resolve those outcomes. Full priced settlement remains separate unfinished work.

## Install and qualify an adapter

Ordinary development and CI use synthetic inputs with an injected fake transport. No API key is
needed. Before registering a live adapter:

1. Add transport tests for your provider's actual response envelope: success, refusal, truncation,
   invalid schema, timeout, connection loss, unknown billing and read-only reconciliation. Reuse
   `test/unit/analysis.test.ts` and `test/integration/analysis.test.ts` as the contract/lifecycle suite.
   Ensure a recovered dispatched request cannot call `generate()` again for a live adapter.
2. Run `npm run ci`, `npm run test:integration`, and `npm run test:recovery`. Add any newly persisted
   request mappings to backup/restore tests. Verify anonymous/staff denials and that model output
   cannot write decisions, scores, service facts or public projections.
3. Review the 40 provisional development labels in `test/fixtures/analysis-cases.ts`. Add complete
   district-rubric cases and an independently reviewed holdout. Current cases cover all eight
   practice measures and common failure types; they do **not** establish full-rubric model quality.
   That legacy grader now rejects multi-measure cases. The separate [rubric precision laboratory](rubric-precision.md)
   exports 91 synthetic cases for 14 refined measures and grades every subrequirement. Its frozen
   candidate is now available as an explicit application pilot, while labels remain provisional.
   Laboratory input/output differs from application v3; translate against the requested application
   schema and validate it separately. Neither suite establishes full-policy model accuracy.
4. Export synthetic requests with `npm run analysis:eval -- export /private/tmp/requests.jsonl`.
   The exporter excludes expected labels and refuses to overwrite an existing file. It makes no
   network requests. Run the chosen adapter only under an explicitly selected account/data scope
   and total spending cap. Keep provider credentials in a server secret store, never settings
   returned to the browser, a `VITE_` variable, source control or exported review files.
5. Supply one JSONL observation per case: `{ "caseId": "sale-clear", "output": { ... },
   "elapsedMs": 1200, "usage": { "inputTokens": 100, "outputTokens": 80,
   "cachedInputTokens": null, "reasoningTokens": null, "costMicros": 25 } }`.
   `npm run analysis:eval -- grade /private/tmp/observations.jsonl` reports structural validity,
   expected-state matches, expected-evidence coverage, false assurances, missing cases and unknown
   costs. Inspect supporting/limiting quotations, account scope, questions and summaries manually.
   These automated metrics are not a semantic or legal certification. Compare repeated runs in
   separate reports; include all retries and failures in the cost/latency analysis.
6. Replace the **server-owned** provider selection in `prepareAssistance()` and the worker together.
   Replace its Cedar-only eligibility gate only after qualification. Add transactional reservation
   of a conservative per-attempt ceiling against an installation daily/total spend limit, using
   a dated pricing table. The current ledger deliberately permits only the zero-dollar recording;
   its request-count limits are not a production billing cap. Settle charges exactly once; retain
   reservations for unknown outcomes, including revoked/stale jobs. Add an operator workflow for
   status lookup, charge settlement and explicit abandonment before enabling paid requests.
7. Resolve unknown/stale/revoked dispatched outcomes through that operator workflow. The local
   worker only performs lookup on eligible unknown jobs; a stale or revoked job may still retain
   its reservation without accepting an output. Never clear a reservation solely to unblock retry.
   Document retention, cancellation, logs, data location and provider training/cache policies.

## Efficiency without vendor lock-in

Use one extraction over the adopted measures before adding routing or chained calls. Keep reusable
instructions/definitions stable and source data last for systems that support prefix caching. A
provider cache is optional; the application also reuses an exact validated result within the same
review. It never reuses another district's data or restores an approval from a cache.

Compare a strong model, a cheaper model and a bounded deeper-review variant on the same reviewed
cases. Measure false assurances and human corrections alongside cost per completed review, cold
and warm latency, schema failures and repeated-run disagreement. Larger context, lower temperature
or agreement between models is not proof of correctness. Add provider-specific caching, batch
endpoints or reasoning settings inside the adapter, leaving the canonical contract unchanged.

Moving between systems requires a new benchmark and cache namespace, not rewriting the district's
historical evidence, rubric, scores or decisions. The free software license is independent of API,
hosting and local compute costs.

## Bundle qualification contract

Explicit source bundles use evidence-extraction-v4 / policy-suggestions-v4. Models no longer supply
sourceStatus: the server derives readiness from the immutable document manifest and exact segment
coverage. Preserve document/passage identities, every coverage acknowledgment, clause evidence roles
and cross-document limitations. Never silently truncate an over-budget bundle. Provider adapters
must enforce an actual tokenizer/context budget in addition to the conservative byte ceiling. The
shipped job path refuses bundle inference; qualify offline first. Historical v1/v2/v3 identities remain
supported without reinterpretation. See [source bundles](source-bundles.md).

Long-policy qualification is a separate **offline** contract: `evidence-segment-v1` /
`segment-candidates-v1`, followed by `evidence-synthesis-v1` / `segment-synthesis-v1`. The full
source/definition and immutable request keys bind the segment plan. Preserve original failed/invalid
returns, all supporting/limiting/opposing candidates, and every required segment through synthesis.
A later attempt makes earlier synthesis stale; it cannot erase earlier evidence. Requests cap at
256 KiB and outputs at 128 KiB, with provider tokenizer/context and cost checks still required before
dispatch. No provider is enabled and these outputs cannot yet become application suggestions.
See [long-source protocol and operator workflow](source-segments.md). This extends the same
vendor-neutral contract while retaining the original Gemini provenance.
