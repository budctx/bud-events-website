# BU’D Public Commerce — Production Rollout Record

Owner instruction (2026-10-25): operate on `main`; public purchasing for all authenticated Discord users, not a single-host pilot. Fixed official price **SAR 3.00 for one non-recurring event-start credit**. Arabic-only UI.

## Safety envelope

Checkout, fulfillment, and live-host session start are controlled separately. Whop production signed webhooks create a pending payment. The secret-protected payment worker independently verifies the order, amount, payer metadata and payment state, then grants a credit once with an idempotent SQL receipt. The host may start one new event per available credit; resuming a session does not consume another credit.

## Scheduler fix

The previous Vercel Hobby cron entries ran **daily**, unsuitable for prompt delivery. The production Supabase project now uses pg_cron + pg_net:
- `bud-payment-delivery-minute`: one worker invocation every minute.
- `bud-payment-reconcile-five-minutes`: reconciliation every five minutes.

Both target `https://bud-events-website.vercel.app`, send a bearer token loaded at runtime from the protected Supabase Vault entry `bud_payment_worker_token`. No token is committed. This scheduler is expected to be used while Vercel remains on a Hobby plan. Do not remove without replacing and verifying it. Native Vercel daily jobs remain redundant fallback, not the delivery SLA.

## Activation checklist

- [x] Supabase scheduler created and active.
- [x] Vercel env mode switched to live/public for production only.
- [x] Payment processing, worker and receipt environment feature flags configured.
- [x] SQL fulfillment flag enabled while checkout disabled.
- [ ] Verify Vercel production deployment includes updated variables; inspect worker heartbeat and invocation logs, including Supabase cron HTTP response.
- [ ] Confirm Whop production webhook registration points to the expected signed `/api/whop-webhook` and delivers matching API version `2026-10-15-1`.
- [x] Published `qc-23x15-editorial-v1` as 23×15 catalog with 345 candidate pairs and set product to `published`; prior example version remains archived.
- [x] Enabled production SQL commerce, fulfillment and live host controls for all Discord-authenticated users.
- [x] Enabled public production checkout and live host flags after authenticated minute-worker call returned 200 OK. **Provider-to-webhook delivery has not yet been proven with a real payment; this must be checked immediately.**
- [ ] Verify real paid purchase, exactly-once fulfillment, refund/retry and matching host account.

**Financial safety:** Do not assert launch or successful payments when checkout or fulfillment is unverified.

## Checkout mismatch incident (2026-10-25)

The owner-supplied plan was reachable after `WHOP_PRODUCTION_PLAN_ID` changed, but checkout failed closed with `PRODUCTION_PLAN_MISMATCH`. A read-only public plan response confirmed the product binding and exposed three commercial mismatches against the approved contract: SAR 2 instead of SAR 3, adaptive currency pricing enabled, and exclusive tax collection. The same response uses the documented `account` seller shape; production code had incorrectly switched the plan read to `company`, which is corrected here. The checkout integrity gates remain unchanged: one-time billing, exact seller/product/plan, SAR 3, no renewal, adaptive pricing disabled, and no additive tax.

Owner action in Whop remains required before retrying: edit this exact pricing option to SAR 3, disable adaptive/local currency pricing, and disable tax collection or make it inclusive so the buyer is not charged above the approved SAR 3. Do not create another product or replace the verified product binding.
## Public launch action (2026-10-25)
Owner explicitly authorized public buying on main. Whop environment is production with public audience, currency SAR, unit price 300 minor units. Supabase cron response confirmed HTTP 200 with worker code OK when no work was queued. Remaining operational validation: confirm actual Whop webhook registration and first purchase → exactly-once credit. Do not infer successful paid purchase from empty worker success.
