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
- [ ] Publish approved 23-question, 15-condition Arabic content; pin product to correct version (never `qc-example-v1`).
- [ ] Enable real host start and SQL commerce controls.
- [ ] Enable public checkout last, only if delivery path and callback are functional.
- [ ] Verify real paid purchase, exactly-once fulfillment, refund/retry and matching host account.

**Financial safety:** Do not assert launch or successful payments when checkout or fulfillment is unverified.