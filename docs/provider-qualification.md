# Provider qualification without live inference

PROV-01, October 18, 2026. This follow-up supplies **offline transport and worker evidence** after
the design-only acceptance of [INT-001](parallel-work/contracts.md). It selects no provider or
account, enables no dispatch and changes no application storage or authorization. PrivacyPal's
original Gemini provenance is retained; the qualification boundary is vendor-independent.

The shipped application still runs only its exact synthetic Cedar recording. The provider interface
and current ordinary worker are useful foundations, but they do not yet satisfy every live or
segmented adoption requirement. The procedure below identifies what must be implemented and
verified before a separately authorized trial.

## Executable harness and scope

[`provider-qualification.test.ts`](../test/unit/provider-qualification.test.ts) runs the real
`processNextAssistance`, cancellation helper, source/evidence validators, versioned review storage
helpers and deadline implementation against a narrow in-memory storage/identity double. Scripted
responses use authored fictional source and the preserved Cedar recording. The fixture is in
[`provider-qualification.ts`](../test/fixtures/provider-qualification.ts).

The fake provider deliberately has `offline: false` so recovered attempts take the production
lookup-only path. It makes no network requests. The fixture seeds a hypothetical job directly in
memory; it does **not** pass or weaken the shipped provider-registration gate. An arbitrary provider
cannot be enabled by these tests, an environment variable, or a browser command.

The storage double serializes atomic callbacks and supplies the worker's small query subset. It
does not implement Firestore rules, optimistic retries, indexes, network RPC ambiguity, crash
durability or multi-process concurrency. The fixture's `cancel()` invokes `prepareAssistance` but
omits `reviewAction`'s review-revision increment, history and command receipt. Its cancellation
cases prove helper/worker fencing, not end-to-end cancellation or reconciliation behavior.
Gate-controlled responses provide deterministic
ordering for cancellation, revocation and human correction, while short real deadlines exercise
bounded waiting. These are production-helper checks with fake dependencies, not a new prototype
segmented lifecycle represented as application code.

Run with Node 24 and the repository's pinned dependencies:

```sh
node --import tsx --test test/unit/provider-qualification.test.ts
npm run typecheck
```

| Exercise | Observed current boundary |
| --- | --- |
| Completed response and known cost | One accepted suggestion, one settlement; no human evaluation, decision or publication. Re-running the worker does not charge twice. |
| Refusal / output-limit truncation | Explicit failed result; no accepted findings. A known reported charge is still accounted for. |
| Malformed JSON / wrong schema / invented citation / missing measure / forbidden field / oversize output | Strict validation rejects; no accepted suggestion. No repair into policy silence. |
| Invalid usage or request identifier | Validation-only checks call the provider envelope schema directly; they do not establish worker settlement behavior for malformed envelopes. Unknown cost is represented as null, separately from known zero. |
| Slow / stalled transport and identity | A bounded response may succeed. Deadline cleanup cannot accept a late response or dispatch after an expired identity wait. |
| Queued / in-flight cancellation and shutdown | Undispatched cancellation releases its reservation. A possibly dispatched request remains unknown and late completion has no result authority. |
| Unknown dispatch and repeated recovery | Generate is called once; subsequent attempts use lookup only. Unknown cost remains reserved until a known outcome settles once. |
| Revocation before dispatch / before completion | No unauthorized generation or accepted result. Unknown charges remain reserved after access loss. |
| Human correction before late completion | Saved human evaluation is preserved; the late job becomes stale and cannot replace it. |
| Maintenance before dispatch / during completion | No mutation crosses the fence; a marked dispatch uses lookup after maintenance clears. |
| Historical schema / changed adapter identity | The fake adapter explicitly supports or rejects v1; no silent conversion. A different model or adapter version cannot claim the job. |
| Original segmented assessment versus derived readiness | Original `established` output remains distinct from server-derived `unavailable` when a required annex is missing. This calls the existing offline validator, not an application segmented worker. |
| Known limitations | Completed/stale/revoked terminal jobs can retain unknown reservations with no current worker lookup path. Ordinary suggestion storage keeps parsed output, not exact original transport formatting. |

The focused run passed **26 tests**; exact revision and commands are in the
[PROV-01 report](parallel-work/reports/PROV-01.md). Passing a limitation probe confirms that the gap
is present. It does not qualify the missing behavior. These tests are not model-quality, production
latency, actual billing or legal-compliance evidence.

Non-author reviewer `/root/independent_installation` found no blocking defect and accepted this
offline scope. Coordinator integration remains separate; this review grants no application or
live-provider authority.

## Qualification blockers and retained guarantees

Status reconciliation, October 22: the table records the PROV-01 ordinary-worker/offline baseline.
INT-002 subsequently implemented typed segment/synthesis requests, immutable original responses,
durable synthetic run storage, human provenance and schema-10 recovery for the exact Lantern lab;
see [segmented reviews](segmented-reviews.md). The segmented-interface row is no longer wholly
pending for that synthetic path. This does not repair ordinary-worker response retention or qualify
live adapters, general imports, billing settlement or spending limits. Those remain open.

| Gap | Current evidence | Required next increment |
| --- | --- | --- |
| Terminal settlement discovery | Runnable probes show `succeeded`, `stale` and `failed` jobs with unknown billing are outside the worker's eligible query. Reservations remain, rather than being falsely released. | Independent dispatch/settlement index and bounded operator lookup for every unsettled attempt, regardless of result status. |
| Original response retention | Runnable ordinary-worker probe shows original JSON whitespace is lost; invalid/stale output is not stored as an immutable response artifact. | Preserve bounded original bytes/hash and separate validation/result authority as INT-001 specifies. Do not relabel a parsed object as original wire output. |
| Segmented application interfaces | Current `AnalysisProvider.generate` accepts `AnalysisRequest`; bundle jobs are rejected, and segment archives have no application import authority. | Separately assigned typed segment/synthesis request union, immutable run storage, versioned human provenance and schema/recovery gates. |
| Currency enforcement | The shipped start path permits only the zero-cost recording. Injected fake reservations demonstrate worker branches, not live admission control. | Atomic conservative per-attempt, run, day and installation/trial ceilings with provider pricing/version identity. |
| Transport/body/token limits | Output validators reject the authored oversize string after return. The harness has no vendor SDK, tokenizer, streaming body or real endpoint. | Adapter bounds before dispatch and while reading, no unbounded buffering, actual context/token accounting and explicit refusal/incomplete mappings. |
| Queue compatibility | Source inspection: the current query limits 20 status-eligible jobs before checking provider/model/version. This follow-up does not run the starvation probe. | Filter compatibility before the limit or use bounded pagination; test an unsupported backlog ahead of eligible jobs. |
| Transaction/receipt/recovery behavior | In-memory atomicity does not reproduce Firestore conflict retries, unknown committed RPC acknowledgments or persistent restarts. | Existing emulator integration/recovery gates plus new transport-record/settlement/lost-ack cases. Run under coordinator-owned resources. |
| Interpretation and applicability | Exact source quotations can support the wrong account scope; INT-01 deliberately retains that structural-validity limitation. | Independently adjudicated labels, full-source holdout, explicit human scope/qualification review and correction measurements. |

Retain the current exact quotation/source checks, historical prompt keys, whole-operation deadline,
lease fencing, no blind non-offline resend, null unknown usage, immutable human evaluations,
separate decisions and explicit publication. Do not replace those guarantees with adapter-specific
heuristics. Existing stored outputs must continue to validate against their recorded versions.

## Adapter capability and resource contract

Before implementation, record a capability manifest for each proposed provider/model/endpoint and
adapter version. Read its current official documentation at that time; this document makes no claim
about a currently available vendor model or price. Record supported canonical prompt/schema
versions, input/message roles, structured-output restrictions, refusal/truncation signals, tokenizer,
context and output limits, billing categories, cancellation behavior and lookup/idempotency support.
Test local/institution-managed endpoints to the same standard; a familiar HTTP shape is insufficient.

Version negotiation must fail before dispatch if a required schema construct, generation setting
or historical contract cannot be preserved. An equivalent constrained schema translation is allowed
only when tested and versioned. Validated plain JSON output may be a deliberate capability choice;
silently weakening a schema or dropping an unsupported setting is not. Disable model browsing,
retrieval, tools and external actions. Canonical source/context are untrusted data, separate from
server instructions. Model output may not supply actor identity, scores, service facts or decisions.

Preflight must account for the actual rendered provider request, including messages, wrappers,
instructions, schema, passages and any reserved reasoning/output tokens. Use the exact documented
tokenizer or a conservative proven upper bound for that endpoint. Compare input plus output and
reasoning allowances with the selected context cap; do not assume a 256 KiB canonical JSON request
always fits. Reject an over-budget request unchanged. Do not drop candidates, sources, schemas or
the final segment to force admission. Record the tokenizer/budget algorithm version in the request
identity so an upgrade cannot silently change historical request accounting.

Bound the serialized canonical request and exact transport representation independently. INT-001's
264 KiB request record holds a canonical JSON object and metadata, not an escaped raw request
string. If exact provider wire is retained, give it its own encoding, byte bound and reservation.
For the segmented contract keep 256 KiB canonical requests and 128 KiB original returned bytes;
ordinary result validation retains its current 256 KiB output cap. Reject overrun at the transport
reader, preserve an explicit overflow outcome, and never call a partial prefix a complete response.
Reserve raw-output, validation-outcome and reconciliation space before dispatch, including failures.

The adapter must disable automatic SDK retries and retry-on-parameter-error behavior. Mark
`not_sent` only when no provider request could have been accepted. A timeout or broken connection
after a possible send is `unknown`; abort is not proof of provider cancellation. Persist the
attempt-to-provider mapping before a result can be accepted. Reconciliation must be lookup-only.
If an endpoint cannot retrieve uncertain outcomes, keep the attempt unknown and prevent automatic
resend; operator resolution and the spending policy remain necessary.

## Proposed cost reservation and settlement rules

No real prices or spending authorization are supplied by this assignment. The fake ceiling of
1,000 microdollars and fake charge of 25 are arbitrary branch-test numbers, not cost estimates.

1. Pin a dated price schedule, currency, model/endpoint, adapter/settings and tokenizer version.
   Bound maximum billed input, output, reasoning, cache-write and other endpoint-specific categories.
   Compute the conservative integer-microcurrency ceiling with upward rounding. Do not budget
   speculative cache discounts. Include every segment, synthesis and allowed explicit retry in
   the whole-run ceiling; account for provider minimum/rounding rules.
2. Atomically admit an attempt only if `spent + reserved + ceiling` fits **all** applicable run,
   UTC dispatch-day and overall installation/trial ceilings, and storage/count limits still fit.
   Competing starts must conflict on the same ledgers. A request-count quota is an additional
   bound, not a monetary cap. Bound concurrent dispatches separately.
3. Bind a reservation to the immutable attempt/price identity, not the currently displayed result.
   Preserve it for unknown charges even after validation failure, refusal, cancellation, access
   revocation or stale completion. A known no-send releases it; an explicit zero-charge response
   can settle at zero. Absent billing remains null.
4. Settle through one idempotent transaction keyed by attempt and provider settlement identity:
   record the charge, decrement its reservation once, increment the original dispatch-day and total
   spend once, and retain immutable settlement evidence. Same-ID replay is read-only; conflicting
   charge evidence is an operator dispute, not a second debit or overwrite. A receipt lost after
   commit must reconcile the same command before any retry.
5. If actual billed cost exceeds the reserved ceiling, record the actual amount and stop further
   admission for review. Never clamp costs to the estimate or silently expand the configured cap.
   A price/model mismatch requires a new versioned request configuration. Keep terminal unsettled
   attempts discoverable without scanning an unbounded history.
6. Provide an authenticated bounded operator queue showing attempt/provider IDs, dispatch state,
   last lookup, current result authority, reserved amount, known usage/cost and next action. Lookup
   never generates. An operator may record evidence-backed settlement or explicitly abandon local
   result recovery; abandonment alone does not establish zero remote charge. Keep disputed/unknown
   financial exposure visible and reserved until the adopted policy resolves it explicitly.

These are required implementation rules, not a new ledger in this patch. The existing worker can
settle the tested known response once, but it cannot yet supply the full terminal reconciliation
and admission policy above. Backup/restore must preserve reservations, original dispatch dates,
settlement receipts and provider mappings before live qualification is considered.

## Concrete future live-trial procedure

The first step is a separately authorized trial record. Do not perform later steps merely because
this documentation exists.

1. **Freeze authorization and inputs.** Name the installation, provider, exact model/endpoint,
   account, adapter commit, allowed canonical versions, synthetic/approved data scope, total and
   daily spending ceilings, time window and person responsible for stopping/settling the trial.
   Review retention, training use, caching, region and deletion terms against that data scope.
   Keep credentials server-side and outside source, browser settings and exports.
2. **Close the blockers above.** Review the adapter and version negotiation, bounded I/O/token
   estimates, full reservation/settlement path, exact raw records and lookup mapping. For segmented
   work first implement its separately assigned application contract. Run CI plus emulator
   authorization/integration and two-cycle backup/restore, including unknown terminal attempts,
   cancellation, revoked membership, maintenance and a deliberately lost command acknowledgment.
3. **Freeze evaluation labels before model outputs.** Have qualified human reviewers adjudicate
   complete source sets, target scopes, explicit commitments, omissions, late exceptions and
   conflicts. Keep a separate held-out set and label disagreements. Existing synthetic fixtures
   are development cases and are not an independently adjudicated gold standard. Set the permitted
   critical-failure threshold and reviewer-effort target before comparing providers.
4. **Export exactly the approved request manifest.** Preserve source/definition/prompt/schema,
   tokenizer, adapter/model/settings and request hashes. Export no expected labels. Confirm token,
   output, total-run and cost bounds before the first send. Preflight rejection is a recorded
   failure with zero dispatch, not an excuse to alter a request silently.
5. **Run the bounded sample.** Keep first returns, refusal/truncation/invalid outcomes, all explicit
   retry ordinals, elapsed time and usage. Do not repair an output in place or hide failed attempts.
   Stop on the predeclared cap or a critical authority/false-assurance failure. Recover uncertain
   dispatch through lookup only; preserve reservations during any uncertainty.
6. **Review every target and every material exception.** Validate structure/citations separately
   from human semantic judgments. Compare supporting/limiting/opposing evidence, school-versus-adult
   scope, missing-final-material behavior, original output versus derived readiness and preserved
   qualifications. Check that human corrections, decisions and actual publication never change
   merely because model output arrives or a cache is reused.
7. **Report denominators and settle.** Report structural acceptance, semantic agreement/critical
   failures, evidence recall and qualification retention separately from measured cold/warm latency,
   active human correction time and total cost per completed human-reviewed case. Include failed
   attempts, synthesis, retries, cache/compute costs and unresolved billing counts. No model/provider
   is selected while a required gate is unresolved. Preserve the trial artifacts privately and
   verify the installation backup before ending the owned runtime.

The software license remains separate from hosted inference, local compute and operating costs.
Use [provider adoption](ai-provider-adoption.md) and [segmented adoption](segmented-adoption.md)
for the preserved architecture and human handoff. This qualification packet grants no publication,
deployment, data transfer or live-provider authority.
