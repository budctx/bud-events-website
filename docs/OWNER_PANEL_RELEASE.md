# Owner panel, Redeem and payment recovery — review candidate

Arabic-only private account area. Profile is the only entry to redeem and the owner page. The candidate contains overview/alerts, Discord user directory and detail, keys/grants/history, payment inspection/recovery, event monitoring, immutable administration audit, system health, an allowlisted operational note and unified search. It does not introduce new public home/header CTAs.

## Trust and credit boundaries

The server revalidates Supabase's Discord identity for every action and binds the immutable Auth UUID and Discord identity ID against a private `platform_owners` record. Editable user metadata is ignored. No owner is provisioned by the migration. Consumer recipients always come from the verified session. Admin mutations require explicit confirmation/reason, a stable operation UUID and an OAuth session established within five minutes. Refreshing the access token does not reset that timestamp. This is a recent OAuth flow, not MFA or independent hardware verification.

Codes use 160 bits of CSPRNG entropy and a keyed SHA-256 digest. Plaintext is returned only on first creation, never saved in DB/audit/history/logs. A lost creation response can recover the code's receipt, not its plaintext; suspend that undisclosed code and create a new one if needed. Redeems have one-use-per-account and capped campaign usage. Redemption, immutable source record, usage count and wallet update commit together. A bonus ledger records `redeem`/`admin_grant` separately; it never invents a Whop order/payment. Both sources feed the existing live wallet and existing session debit path. Suspending a code affects future redemption, not previously credited or consumed Slots.

All new tables are private, RLS enabled, with no anon/authenticated access. RPCs are service-only. Functions normally use SECURITY INVOKER and empty search_path. Two narrow SECURITY DEFINER helpers read only bounded sanitized Discord directory data and its count because service_role cannot read Auth tables directly. They check both owner identifiers before reading and return no emails, tokens or raw metadata. Service role cannot provision owners or update/delete audit/bonus ledger rows.

## Payment recovery

The owner enters the original payment ID and internal order ID. `inspectPayment` performs a pinned Whop GET and validates company, product, plan, currency, amount, checkout, production metadata, paid status, refunds and disputes against the stored order. It grants nothing. `recoverPayment` repeats those checks immediately before a service-only SQL transaction calls the original purchase fulfillment function and appends an operator audit receipt atomically. Recovery receipt IDs are explicitly operator references (`msg_recovery…`), not simulated signed webhook deliveries. Retrying the same operation or payment cannot credit twice. Existing live fulfillment controls still apply; the UI cannot change them. No new charge, refund API, gift compensation or direct balance edit is used.

The actual pending order remains unfulfilled until authenticated provider verification and live execution are proven. Preparation/testing is not a recovery receipt.

## Monitoring

`GET /api/payment-worker?monitor=owner` reuses the existing operator worker endpoint to stay at twelve API functions. It requires exact CRON bearer authorization, explicit monitor opt-in, production runtime, the fixed BU'D database and exact configured origin. It processes at most one email job. No new schedule, paid plan or recipient is installed.

Known delayed queued payment-success references produce P0; stale worker evidence and payment review produce P1; configured code-expiry warnings produce P2. Unauthorized issuance and configured repeated admin authentication failures are monitored separately. Absence of current Discord/Whop/Vercel observations remains `unknown`; database connectivity does not prove those providers healthy. Acknowledging an alert does not resolve it. Cause rechecks resolve/reopen cycles. P0 reminders have an explicit configured interval.

Notifications use a private leased outbox and stable Resend idempotency key/body. Transient failures retry with persisted backoff. A recipient change or ambiguous retry older than 23 hours moves the job to review rather than risking duplication beyond Resend's documented 24-hour key window. Resend acceptance is explicitly **not inbox delivery**. Actual channel/domain/recipient configuration, delivery receipt and scheduler behavior remain release gates. No email has been sent by this work.

## Configuration and release sequence

All new features fail closed by default. Existing production variables must not be decrypted, copied to Preview or printed. Use an isolated fixture environment to review this candidate. Required settings (names only):

- `BUD_OWNER_PANEL_ENABLED`, `BUD_REDEEM_ENABLED`, `BUD_PAYMENT_RECOVERY_ENABLED` — separate opt-ins.
- `BUD_REDEEM_HASH_SECRET` — a dedicated server secret, at least 32 bytes. Rotation requires a versioned migration; changing it blindly invalidates existing unused codes.
- `BUD_OWNER_MAX_GRANT_SLOTS` (1–100), `BUD_OWNER_MAX_CODE_USES` (1–10000). No product defaults are chosen by the code. DB limits are protective ceilings, not owner-approved commercial quantities.
- `BUD_OWNER_MONITOR_ENABLED`, `BUD_OWNER_HOST_ID`, `BUD_OWNER_DISCORD_ID`.
- `BUD_OWNER_ALERT_STALE_SECONDS` (60–86400), `BUD_OWNER_ALERT_ESCALATION_SECONDS` (300–86400), optional `BUD_OWNER_ALERT_EXPIRY_SECONDS` and `BUD_OWNER_ALERT_AUTH_FAILURES`. Thresholds must be deliberately configured from operational evidence, not presented as already approved.
- `RESEND_API_KEY`, `BUD_OWNER_ALERT_FROM`, `BUD_OWNER_ALERT_TO` — operator-approved verified sender/recipient only; no default email address.

Before release: independent security/QA review on an exact SHA; real PostgreSQL multi-connection CI; a verified compatible snapshot/restore plan; reviewed additive migration preserving account/payment data; explicit binding of the owner's two verified IDs; configuration without exposing secrets; controlled provider/session/RLS tests; actual monitor delivery and schedule test; owner acceptance and separate production/grant approval. Main auto-deploys: do not merge by assuming green CI is release authorization.

Rollback strategy: disable only the new feature/monitor flags and revert application code. Preserve all new audit, receipts and credits. Do not drop new tables or decrement real wallets to reverse a deployment. Any actual ledger correction requires a separately audited forward operation.

## Validation boundaries

PGlite tests use fabricated accounts and inspect transactions, source separation, rollback, permissions, holds, recovery and notification leasing. Twenty Promise requests to PGlite are serialized; they do not claim native multi-connection evidence. `scripts/test-owner-postgres.mjs --local-only` is a separate disposable loopback-only native PostgreSQL test in CI with twenty competing redemption connections and twenty identical grant retries. Browser checks use mocked account/API data and screenshots marked as fixtures; they do not prove a live owner/provider session.

Official sources inspected: [Supabase functions/privileges](https://supabase.com/docs/guides/database/functions), [Resend idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys), [Vercel function runtime limits](https://vercel.com/docs/functions/runtimes). Supabase changelog Markdown fetch was unsupported by the research tool; current functions documentation and live schema/privilege inspection supplied the applicable contract.
