# Whop production preparation — billing remains closed

2026-10-23 · Asia/Riyadh. Owner selected an existing official Whop account and approved a **SAR 2 one-time pilot price**, to be changed before commercial launch. The owner subsequently approved preparing the existing Supabase project while preserving account/data. General sales remain closed; remote backup and migration review gates remain.

## Verified setup evidence

- Company supplied by the owner through its dashboard URL: `biz_ytADNSjjYVsa7O`.
- Plan supplied through its checkout link: `plan_9ztA5kXWGC73u`.
- Owner screenshots show SAR 2 once and a hidden plan. These are UI evidence, not an authoritative API read or proof of a purchase.
- Vercel metadata read without decryption confirms `WHOP_PRODUCTION_API_KEY` and `WHOP_PRODUCTION_WEBHOOK_SECRET` are Production-only sensitive secrets; company and plan IDs are Production-only configuration.
- Owner was instructed to create a separate **disabled** `payment.succeeded` webhook for `https://bud-events-website.vercel.app/api/whop-webhook`. Saving its secret does not prove registration, disabled status, subscription version, delivery or secret validity. The existing b6oh key and webhook are unrelated and must be preserved.
- Owner redeployment `dpl_3fTh39mD6EkyWCKnAdW7sEKt7RaR` was READY on existing main SHA `0de6130fc158d0636fca745ba30e8aae1382775e`. Redeployment installed configuration, not production checkout code.

No credential values or checkout session identifiers belong in this document.

## Delivered in this increment

`server/whop-production.ts` provides isolated server-only plan inspection, pilot configuration, checkout creation, URL validation, signed webhook verification, authoritative payment lookup and exact payment/order matching. It is **not wired to any HTTP route or SQL fulfillment**. Existing `/api/checkout` remains Sandbox-only and `/api/whop-webhook` remains unavailable. There is no public purchase activation in this patch.

The provider uses only `https://api.whop.com/api/v1` and an explicit original `2025-01-01` compatibility pin. This avoids inheriting the new key's default response model. Whop still documents compatibility plans and legacy Payment resources as supported. A current-variants migration should have its own fixtures and actual provider evidence; no mixed response models are accepted here.

Read-only inspection derives the product ID from the expected plan and verifies company, one-time billing, zero renewal, exact currency/price, disabled adaptive currency pricing and no additive tax. It returns only commercial identifiers and the amount. A wrong price or ownership stops checkout before POST.

Pilot configuration requires explicit enabled/environment/mode flags, an exact host UUID, product ID, expected currency/amount, webhook secret and independently confirmed subscription version. Supplying the four currently installed values alone never enables it. The accepted envelope pins are `2026-08-14` and `2026-10-15-1`; neither is inferred from an API-key pin. An operator must inspect the actual webhook subscription before configuring one.

Checkout metadata contains the internal order reference and `bud_environment: production`; the provider idempotency key includes the production namespace and durable order UUID. Only bound `https://whop.com/checkout/ch_…` URLs are accepted. Sandbox hosts, direct plan URLs, credentials, query strings and fragments fail closed. Redirect returns to Events; it never grants a key.

The shared raw-HMAC signature primitive retains the Sandbox behavior unchanged. Production accepts only signed `payment.succeeded`, exact account/message/version and a five-minute timestamp window. A separate GET retrieves the authoritative payment. Matching rejects another host/environment/product/plan/order/checkout/currency/amount, pending state, invalid paid timestamp, refund and dispute indicators. Matching **does not grant credit**. Durable duplicate prevention and atomic ledger fulfillment still require production SQL integration and concurrency tests.

## Safe operator preflight

`npm run whop:preflight` is a command-line **GET-only** probe. It does not create a checkout, payment, customer or key. It requires these variables in a secure server process environment:

- `WHOP_PRODUCTION_API_KEY` (secret)
- `WHOP_PRODUCTION_COMPANY_ID`
- `WHOP_PRODUCTION_PLAN_ID`
- `WHOP_PRODUCTION_CURRENCY=sar`
- `WHOP_PRODUCTION_AMOUNT_MINOR=200` for the approved pilot

Do not paste a secret into a terminal command, process arguments, logs or Notion. Do not pull a Production secret to a local file merely to run this probe; use an approved secure runtime. Output is limited to pass/failure codes and validated product/plan/company IDs, currency and amount. A successful real probe still does not prove checkout creation, webhook signing or fulfillment.

## Remaining work before owner pilot

1. Prepare the already approved existing project `cepmvqqrjcvhyzszqand`, preserving Auth/data and isolating the live ledger from Sandbox. Do not ask for the database-target decision again. Establish a real backup/recovery path before applying the additive migration. No live money may be credited into the Sandbox wallet.
2. Execute the GET-only probe in a secure runtime, bind its verified product ID, and independently verify the webhook subscription/version and pilot host ID. Installed variable names do not prove credential validity.
3. Implement and review production-only durable order/checkout bindings, receipts, unique payment/message constraints and atomic one-key ledger credit, without broadening existing Sandbox constraints or mixing wallets. Add actual concurrent duplicate delivery and crash/retry tests.
4. Wire pilot-only checkout and webhook routes, checkout URL acceptance in the client, receipt/pending/failed states and refresh of the actual key balance. Preserve originating locale. No direct public Whop plan link may bypass the server order.
5. Establish queue/reconciliation and refund/dispute handling, backup and monitoring, then verify one owner-only SAR 2 purchase from login through confirmed webhook, one key, replay, consumption and resume. Never treat the redirect as payment success.
6. Replace the pilot price and matching server expectation together before a separately approved commercial release.

## Verification boundaries

`tests/whop-production.test.ts` uses mock HTTP and real local WebCrypto signatures. It exercises commercial mismatch rejection, pilot isolation, exact checkout binding, sanitized failures, malformed/oversized responses, payment matching and webhook tampering/version/replay rejection. These tests do not prove the actual key, product, API pin, webhook secret, delivery latency or provider idempotency. Existing Sandbox regression coverage is retained. Complete check results and exact SHA belong in the work log and PR.

Local verification on this candidate: server typecheck PASS; application build PASS; all **86 Node tests PASS**; all **65 browser tests PASS** using the existing Chrome executable through `BUD_BROWSER_EXECUTABLE` (151 total). The first full test attempt passed Node but could not start any browser because Playwright's expected headless-shell binary was absent. Re-running the browser suite with installed Chrome passed all 65. No source repair or browser installation was required. These are local regression results, not remote provider or database-production evidence.

Official references inspected: [Whop API versioning](https://docs.whop.com/developer/api/versioning), [legacy Payment resource](https://docs.whop.com/api-reference/payments/payment), [webhook signing and independent pins](https://docs.whop.com/developer/guides/webhooks). The checkout configuration reference was previously inspected for the existing adapter; a fresh fetch timed out during this increment, so no new contract was inferred from that failed fetch.

## Continuation — authenticated dashboard inspection and secure-runtime preflight

The connected Chrome browser now works. After owner sign-in, the actual company dashboard showed `bud-website-production` with API-key version `2026-10-15-1`. This is **not** a webhook payload-date confirmation. The website webhook existed at the expected URL, subscribed to `payment.succeeded`, connected-account events off, but was **Active**, contrary to the intended disabled preparation state. It was switched to **Disabled** and saved; readback and the success notification confirmed the change. URL, secret and events were preserved. The unrelated `b6olh` integration was left Active and unchanged.

The webhook table/editor exposes **v1** only; no dated subscription pin was visible. Do not infer its date from the API key or install a guessed value in runtime configuration.

The product editor for **مفتاح فعالية سؤال وشرط**, `prod_vaq6H0Lz1ID3h`, showed a hidden SAR 2 one-time pricing option, no visible purchasable plans, and local-currency conversion off. More than one per order is currently allowed. No product/plan/price setting was saved. This is authenticated **UI evidence**, not a successful GET of `plan_9ztA5kXWGC73u`, and not sufficient to install that product ID as API-verified configuration. Verify one-unit checkout behavior before any pilot payment.

Added `/api/whop-preflight`: a separately disabled server diagnostic that uses the existing Production API secret inside the hosting runtime. It accepts only an empty same-origin POST, a verified Discord session for the configured pilot host, and distributed edge/host rate limits. Expectations come from server configuration. Its only Whop operation is the existing plan GET. It returns sanitized commercial IDs/amount and explicit false checkout/payment/credit flags. It does not need a live ledger or enable selling, and does not expose the raw provider response, customer fields, API key or webhook secret. A POST to this diagnostic can use Auth refresh and limiter RPCs; “GET-only” describes the Whop operation, not every internal HTTP request.

Operator use after review/deployment: retain sales disabled; configure `BUD_WHOP_PREFLIGHT_ENABLED=true`, the exact pilot host UUID, currency `sar` and amount `200` alongside the saved company/plan/key. From an authenticated same-origin page, send an empty POST to `/api/whop-preflight`; record only its sanitized result. Disable the diagnostic after inspection. No new credentials or public plan links are needed. **The diagnostic has not been deployed or executed against Whop.**

Locale is now persisted in the prepared live order and bound to request reuse; provider checkout return retains `screen=events&lang=ar|en`. No public UI, purchase route or fulfillment activation changed. Full checkout/webhook/queue/consumption/refund integration and actual provider proof remain pending.

## Local orchestration increment — still not deployed

`server/live-commerce.ts` prepares checkout and synchronous webhook handlers, without adding or changing an HTTP route. Checkout requires verified Discord identity for the configured pilot, exact same-origin JSON, edge and host limits, an allowlisted locale/request key, and the server-owned commercial expectations. The SQL operator gate is checked by order creation/attachment. A reused request preserves the same order and provider idempotency key. No URL is returned until attachment is confirmed; a paid order cannot be returned for another purchase.

Webhook processing verifies the raw signed envelope, retrieves the authoritative payment, reads the durable live order, validates its pilot/environment/amount/checkout binding, then calls the atomic live-credit function. Acknowledgment requires a confirmed credit or replay receipt. Database/provider failure or an ambiguous response returns a failure for retry. Customer payloads, secrets and SQL errors are not returned. Existing public `/api/checkout` and `/api/whop-webhook` stay unchanged.

The new integration test executes the prepared SQL as service_role inside PGlite, with real fixture Auth cookies/HMAC and a mocked Whop transport. Failure injection covers checkout attachment and credit both before commit and after a committed response is lost; retries recover one credit. Repeated/new message IDs and overlapping handler calls retain one ledger row. Tests also cover non-pilot identity, forged price/host/quantity/success fields, mismatched/refunded payments, malformed receipts and preservation of Sandbox balance/Auth fixture counts. PGlite uses a serialized connection: this is not independent-connection concurrency, actual Whop idempotency, a durable queue, or a real owner purchase.

Review blockers remain explicit: the shared enable flag/control cannot yet stop new orders while draining settled ones; transient provider states require durable queue/reconciliation; live credit consumption/resume, refund/dispute handling and user receipt states are unfinished. Hidden SAR 2 product settings still permit multiple quantities until actual one-unit behavior is verified. No handler should be wired/deployed for real purchasing until those gaps, real backup and independent review are resolved.

The official Supabase changelog was checked for this increment, including [HTTP TLS cipher changes](https://supabase.com/changelog/cbc-tls-ciphers-deprecated) and [PostgreSQL 17.11 changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes). This increment adds no extensions, direct-Postgres code or SQL migration. No remote permissions, Auth settings or data changed.
