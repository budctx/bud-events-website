# Live payment queue and event keys — preparation only

The owner approved continuing local queue/retry and key-consumption work after the final backup attempt failed. No production database migration, scheduler, HTTP route activation or purchase is performed by this increment. Public checkout remains Sandbox-only, and the published production webhook remains unavailable. Preserve the account and existing data.

## Delivery and retry contract

The disconnected `handleProductionWebhook` verifies the fresh raw signature, company, version and payment.succeeded event before persisting just the message/payment references. A confirmed enqueue returns **202 PAYMENT_QUEUED**, with `credited:false`. It is a durable receipt of the notification, not proof of payment or credit. No provider/customer payload or signature is stored. Duplicate message IDs must retain their original payment. Lost enqueue responses can be retried without resetting backoff.

The internal `runProductionPaymentJob` claims one job per invocation. SQL uses `FOR UPDATE SKIP LOCKED` and a new two-minute lease token; network calls happen after that transaction commits. The worker GETs the authoritative payment, loads its durable order and checks company/product/plan, pilot host, environment, checkout, amount/currency and refund/dispute indicators. Credit and marking the job done commit together in `bud_live_finish_payment`. Its lease must still match and be unexpired. A worker that loses its lease cannot finish or reschedule the newer worker's job.

Transient/unconfirmed operations retry after 30 seconds, exponentially increasing to 30 minutes. A failed worker can be reclaimed after its lease expires. At 12 attempts the job remains in **review**, with a fixed code, for operator reconciliation; it is not deleted or falsely marked paid. Duplicate notifications do not reset attempts or revive review jobs. `bud_live_queue_status` exposes service-only counts and the oldest pending time. These states still need a reviewed scheduler, alerting, operator requeue/reconciliation procedure and actual provider delivery tests before live activation. No scheduled worker is installed or running.

No refund or dispute is granted a credit. A newly refunded/disputed authoritative payment is held for retry/review. Detecting a refund after a completed purchase, reversing unspent credits, consumed-credit debt and notifying/supporting the owner remain unfinished. No refund API is called or commercial refund policy invented here.

## Independent controls

The local CLI-created migration `20261023193330_live_payment_queue_and_event_consumption.sql` follows the unapplied live foundation. It leaves the old Sandbox functions/data intact and adds three operator controls, all initially false:

| SQL control | Effect |
| --- | --- |
| `enabled` | Permits creating/attaching new checkout orders; creation also requires fulfillment_enabled. |
| `fulfillment_enabled` | Permits claims/credit of settled payments independently of new orders. |
| `host_enabled` | Permits new live event starts. Existing start receipts, resume and action replay remain available when it is paused. |

The service role can read these controls but cannot update them. A pause is checked by each statement, not cancellation of a transaction already in flight. Persisted jobs and independent drain controls let operators stop new orders while preserving processing of already paid orders. An activation/pause/drain procedure and full recovery evidence still require review.

Server flags are also separate: checkout needs both `BUD_WHOP_PRODUCTION_ENABLED` and `BUD_WHOP_PRODUCTION_PROCESSING_ENABLED`. The processing flag independently permits signed intake/worker configuration after checkout is paused. `BUD_LIVE_HOST_ENABLED` gates the disconnected live host wrapper and its exact pilot host. A browser cannot choose an environment/wallet or an arbitrary host. All example flags stay false; no runtime configuration was changed.

## One key per live event

Live events, event debit audit and action receipts use separate private RLS tables. They reuse the existing immutable published content and server-owned game reducer, not the Sandbox wallet or event history. Draft/retired content cannot start a new live event.

Starting locks the live wallet, looks up the host/request fingerprint, and reuses the existing event before checking the new-start switch. A new start requires one available key and no active live event. The event, one immutable debit audit row and decrement commit together. The unique event debit plus request fingerprint prevent another charge after a lost response. The prior Sandbox balance is never used as a fallback.

Resume never creates an event or a debit. Live dispatch uses the same server reduction, version comparison, durable action receipts and fresh response clock as the existing host flow. At the existing four-hour boundary the event completes without another debit or automatic refund. Archived content remains linked to its event version. All functions are invoker functions; public/anonymous/authenticated users cannot call them or read the private tables.

## Verification boundaries

PGlite integration tests run the actual migrations with fixture Auth sessions, raw HMAC signatures and mocked Whop responses. They inject failure before/after enqueue, checkout binding, credit commit and live-start response. They cover changed price/refund, signed duplicates, mismatched message/payment, backoff, stale lease fencing, review exhaustion, exact one key/debit, resume/dispatch replay, content gates and isolation from Auth/Sandbox fixtures.

The optional Windows test `tests/windows/live-postgres-concurrency.mjs --local-only` runs the existing official portable PostgreSQL 17.11 in a disposable loopback-only cluster. It ignores inherited PG connection variables, uses fabricated accounts/payments, verifies its ASCII path points to this workspace, stops its own cluster, and checks containment before removing test files. It never imports the backup engine or reads production credentials. Twelve independent connections test order reuse, single credit, single event debit and distinct queue leases. This is native local concurrency proof, not production database concurrency, Whop idempotency or an owner backup. The test is not part of Linux CI.

Remaining gates: verified real backup; review/application of both additive migrations; actual plan/product GET, dated webhook pin and one-unit checkout; authenticated worker scheduling/monitoring/reconciliation; refunds/disputes and receipt UX; independent review; then the owner-only SAR 2 end-to-end purchase/consume/resume test. General selling remains closed.
