# Whop delivery verification without financial intake

Scope: a temporary, separately gated branch at the existing `/api/whop-webhook` URL. It verifies the provider signature and configured dated account envelope only. It has no transport parameter, Supabase dependency, queue, payment lookup, credit, content publication or sale activation.

This is preparation for the owner's SAR3 purchase test, not a payment test itself. The live subscription is presently Disabled/V1, only payment.succeeded, connected-account events off. The dashboard edit UI does not expose api_version_date; its actual date remains unverified. No sample has been sent. Do not infer a dated pin from the API key's date or dashboard's V1 label.

## Configuration and stop rules

Set `BUD_WHOP_WEBHOOK_VERIFY_ONLY_ENABLED=true` only on Production after reviewed release. It requires all five financial flags explicitly false; public and Sandbox checkout flags absent/false; commerce mode absent/sandbox. A conflict returns503 before reading the body, never falls through to live intake. The production signing secret/company must already exist; no API key or service secret is required by this branch. Endpoint origin/path are fixed and query strings rejected.

`WHOP_PRODUCTION_WEBHOOK_API_VERSION` must independently match the existing subscription's supported dated account_id model:2026-08-14 or2026-10-15-1. Null/unknown/newer dates and legacy company_id models are refused. Do not loosen the verifier or invent a date to get a green sample. If the current subscription cannot supply that model, separately review its metadata/version correction first. Preserve its URL/events/disabled state and signing secret; do not recreate it or modify unrelated integrations.

After those prerequisites, send at most one provider sample and inspect the provider delivery response. Required result:200 WEBHOOK_VERIFIED_ONLY, signatureVerified/accountMatched true, matching date, queued/paymentLookedUp/credited false. No payload, signature, buyer data or financial identifiers appear in the response. Repeated signed samples within the signature freshness window have no financial effects; this branch intentionally stores no replay receipt.

Turn the diagnostic flag off before financial intake. Never acknowledge real purchased payments through this temporary branch. It does not prove checkout amount, one-unit binding, actual payment retrieval, worker execution, key delivery or event start/resume. General selling remains closed until the actual owner flow succeeds.

## Verification and review plan

Risk-adaptive Expert OS unit: source/context inspected, explicit owner test intent, financial modes remain closed, no new authority/credential. Definition of done for code preparation: focused negative cases plus full server typecheck/build/tests; independent exact-source review; feature PR and exact-head CI. Definition of done for a later real diagnostic: verified subscription metadata/date, reviewed Production release and no-financial-effects sample receipt. Missing metadata, version mismatch, signature failure or conflict stops the diagnostic; no automatic retry/activation/fallback. Stage approval applies to this narrow unit only.

Sources: [webhook verification](https://docs.whop.com/developer/guides/webhooks), [retrieve subscription](https://docs.whop.com/api-reference/beta/webhooks/retrieve-webhook), [update subscription](https://docs.whop.com/api-reference/beta/webhooks/update-webhook), [send test event](https://docs.whop.com/api-reference/beta/webhooks/send-test-event).
