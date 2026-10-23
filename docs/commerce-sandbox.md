# Sandbox commerce adapter and commercial activation boundaries

2026-10-23 · Asia/Riyadh. This increment prepares isolated test commerce. It does not activate billing, create provider credentials, approve a selling price, or prove a live provider round-trip.

## Delivered surface

- `POST /api/checkout` accepts only `{idempotencyKey}`. Requires exact HTTPS application origin, JSON, distributed rate limit, encrypted verified Discord host session and explicitly configured sandbox flags. The server alone supplies company, product, plan, currency, amount and host.
- Create/reuse a durable sandbox order before requesting a provider checkout. Verify the provider's existing one-time plan and exact price. Request a checkout carrying only the internal order reference in metadata. Persist checkout binding before returning `{orderId,url,environment:"sandbox"}`. Subsequent identical keys reuse the stored URL.
- `handleSandboxWhopWebhook` is exported for explicit server wiring. The previous webhook route is not modified by this lane. A return-page query or browser receipt never fulfills an order.
- Verify the raw body's HMAC signature and five-minute timestamp window before interpreting payload. Require `v1`, exact `2026-08-14` envelope pin and configured account. For `payment.succeeded`, retrieve the payment from the sandbox API, resolve its server order, match every authority field, then call the existing transactional fulfillment RPC. The database's order/payment/message uniqueness supplies durable duplicate protection.

## Configuration

No values are installed by this implementation. All secrets are server-only; never add `VITE_` prefixes. Required existing backend/auth/rate configuration includes exact development Supabase URL, service-role key, publishable key, Auth cookie secret, exact HTTPS origin, `BUD_BACKEND_ENABLED=true`, `BUD_AUTH_ENABLED=true`, `BUD_RATE_LIMIT_ENABLED=true`, rate-limit secret and trusted Vercel ingress. Additionally require:

| Variable | Restriction |
| --- | --- |
| `BUD_WHOP_SANDBOX_ENABLED` | Exactly `true`; otherwise fail closed |
| `WHOP_ENVIRONMENT` | Exactly `sandbox`; production is rejected |
| `WHOP_SANDBOX_API_KEY` | Sandbox account key, privately provisioned |
| `WHOP_SANDBOX_WEBHOOK_SECRET` | Provider `ws_…` secret, passed verbatim |
| `WHOP_SANDBOX_COMPANY_ID` | Provisioned sandbox `biz_…` account |
| `WHOP_SANDBOX_PRODUCT_ID` | Provisioned sandbox `prod_…` product |
| `WHOP_SANDBOX_PLAN_ID` | Existing sandbox one-time `plan_…` variant/plan |
| `WHOP_SANDBOX_CURRENCY` | Only `sar` or `usd` in this restricted two-decimal adapter |
| `WHOP_SANDBOX_AMOUNT_MINOR` | Positive integer test amount, not a client or newly approved commercial price |

Only `https://sandbox-api.whop.com/api/v1` receives provider requests. Checkout redirects must be exact `https://sandbox.whop.com/checkout/<bound-ch-id>/` (optional final slash), without credentials, query or fragment. Production hosts and request-controlled callback URLs are rejected.

## SQL integration contract

These are service-role-only RPCs; public clients receive no execute authority:

1. `bud_create_sandbox_order(p_host,p_key,p_company,p_product,p_plan,p_currency,p_amount)` returns the durable order. Bind key to the full commercial snapshot; changed parameters must conflict. One order grants one sandbox slot only after verified fulfillment.
2. `bud_attach_sandbox_checkout(p_host,p_order,p_checkout,p_url)` locks/binds the original checkout; changed binding must conflict.
3. `bud_sandbox_order(p_order)` returns the private order for verified webhook reconciliation.
4. `bud_credit_verified_purchase(p_order,p_environment,p_company,p_product,p_currency,p_amount_minor,p_payment,p_message)` validates against the saved order and atomically records receipt/payment and slot ledger entry. Environment is always `sandbox`.

The shared order response is `{orderId,hostId,environment:"sandbox",companyId,productId,planId,currency,amountMinor,checkoutId,checkoutUrl}`. An unattached checkout has two null checkout fields. Neither checkout creation nor provider redirects grant a slot.

## Provider contract verification

Official references inspected on 2026-10-23:

- [Sandbox guide](https://docs.whop.com/developer/guides/sandbox): separate test hosts/account/credentials; card testing, no actual payments. Elements sandbox availability is limited, so this increment uses hosted checkout rather than claiming an embedded payment form works.
- [Create checkout configuration](https://docs.whop.com/api-reference/checkout-configurations/create-checkout-configuration): `POST /checkout_configurations`, existing-plan input union, metadata inheritance, hosted `purchase_url` and expected `/checkout/ch_…/` path.
- [Legacy Payment resource](https://docs.whop.com/api-reference/payments/payment): page expressly remains fully supported and documents company/product/plan objects plus decimal `total`/currency, checkout reference, paid/refunded state and metadata.
- [API versioning](https://docs.whop.com/developer/api/versioning): explicit original `2025-01-01` pin overrides key defaults. REST legacy reads/checkout creation use that pin. `/plans` is compatibility support and needs a separately tested migration to current variants before retiring it.
- [Webhooks](https://docs.whop.com/developer/guides/webhooks): raw `ws_` HMAC key, frozen signature headers, five-minute tolerance and independent subscription version pin. Current documentation supersedes older blog examples that base64-encoded the secret. Envelope `2026-08-14` uses `account_id`; only payment ID is taken from event data, followed by authoritative REST relookup.
- [Current Payment successor](https://docs.whop.com/api-reference/beta/payments/retrieve-payment): current money/identity shape differs, which is why this adapter rejects implicit version changes instead of mixing response fields.

Separate envelope/REST pins are deliberate and supported independently in the official versioning contract. Their real combination, actual secret format and purchase URL must still be proven against sandbox deliveries before activation. No provider SDK dependency is added; WebCrypto implements the documented HMAC algorithm.

## Matching and failure behavior

The authoritative payment must be paid/succeeded, have a valid paid timestamp, match exact order/company/product/plan/currency/checkout reference and decimal amount, carry the bound order metadata, and show no refund or dispute. Two-decimal parsing rejects excess precision and never rounds a mismatch into acceptance. No payment payload field selects a host or slot quantity. Provider secrets, raw errors, card/customer data and webhook bodies are neither logged nor returned.

Only `payment.succeeded` is handled. Other signed payment events return `422`; refunds and disputes require reconciliation/retention policy and are not silently treated as resolved. A later refund does not currently reverse previously granted credit. This remains an activation blocker requiring an explicit reviewed business rule, not an invented automatic debit policy.

Provider requests and database calls are bounded with timeouts; payload sizes are bounded. Synchronous verification/relookup/credit may exceed the provider's five-second acknowledgement target during degraded service. Retry-safe database fulfillment prevents duplicate grants, but a durable queue/reconciliation worker and measured delivery latency are required before commercial readiness.

An `Idempotency-Key` derived from the server order is sent for checkout creation. Actual legacy-endpoint duplicate behavior is not claimed verified. Concurrent creation can result in a binding conflict; orphan provider checkout configurations must be reconciled before activation. Durable database attachment always gates any URL returned by the application and any payment fulfillment.

## Tests and honest evidence

`tests/checkout.test.ts` and `tests/whop.test.ts` add transport/crypto checks for disabled or production configuration, origin/session gates, server-owned commercial fields, plan validation, URL binding, raw-body tampering, stale/future timestamps, wrong company/version/message, exact decimal/refund matching, authoritative provider relookup, duplicate-safe fulfillment contract and sanitized errors.

Executed verification: `node --test tests/checkout.test.ts tests/whop.test.ts` **10/10 PASS** after fixing Node's strip-only TypeScript compatibility and updating test auth setup for the distributed rate limit. An earlier attempt was prevented by an automatic-approval service usage limit; verification subsequently became available. Root release verification must still record the exact final commit and complete suite. Mock transport tests cannot prove real provider credentials, signing bytes, version compatibility, delivery timing, tax behavior, checkout idempotency, refund policy or full browser→Auth→checkout→provider→webhook→database behavior.

Remaining external gates: sandbox account and credentials, verified plan/price/tax settings, public webhook registration with exact version pin, private environment installation, real signed test deliveries/declines/replays, refund/dispute decisions, reconciliation/queue checks and security review. Production billing is expressly unavailable in this adapter.

Root integration addendum: an isolated API-to-PGlite test passed checkout persistence, signed mock webhook fulfillment, canonical currency conversion, duplicate delivery without another credit and wrong amount rejection. Dedicated `/api/sandbox-webhook` is now wired behind disabled sandbox configuration; the legacy production-named webhook remains unavailable. Independent schema review found payment-mode checkout top-level currency may be null: the adapter now checks the nested plan currency and accepts the nullable setup-only field, with an official-schema fixture. Complete candidate checks/review and remote evidence are recorded in Notion.
