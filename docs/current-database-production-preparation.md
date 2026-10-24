# Current database preparation — owner approved, not live

2026-10-23 · Asia/Riyadh.

## Owner decision

The owner explicitly approved preparing the existing BU'D database for production after checks, while preserving their account and data. The owner did not authorize deletion, paid resources or public selling. A separate Supabase project is not technically mandatory. Reuse of `cepmvqqrjcvhyzszqand` is now approved for preparation; its name remains **BU'D Discord Events — Development** until an actual reviewed transition. Do not rename it as evidence of readiness.

The owner also requested complete documentation and a handoff to a new conversation because the current conversation is heavy. No new conversation has been created by the agent.

## Remote read-only inspection

- One Auth user; no user identity, credentials, sessions or metadata were read.
- Zero saved events, checkout orders, wallets, wallet credits or credit ledger entries. No cleanup is needed or authorized.
- Ten private bud_platform tables have RLS enabled; anon and authenticated lack direct SELECT privileges.
- The security advisor reports INFO for RLS without public policies on the private tables (intentional server-only model), and WARN for disabled leaked-password protection. The current application uses Discord sign-in; this warning is recorded, not automatically dismissed or silently changed. Review password sign-in configuration before accepting password accounts.
- Four remote migrations are present; the last is `20261023085539 launch_sandbox_hardening`. Local historical filenames differ from remote history. Never repair history or push all local migrations blindly.
- No remote schema or data changed during this increment. No existing account, event or ledger was deleted. No paid feature was enabled.

## Prepared additive migration (not remotely applied)

Supabase CLI v2.121.0 generated `20261023173930_production_commerce_foundation.sql`. It adds five private tables in the current bud_platform schema:

- live_commerce_control: disabled by default; the runtime service role cannot enable it.
- live_orders: immutable commercial snapshot through the intended RPC contract, unique host/request, checkout and fulfilled payment bindings.
- live_wallets: separate from the existing Sandbox wallet.
- live_deliveries: unique message IDs linked to payment and order, retaining separate deliveries without granting another key.
- live_credit_ledger: append-only grants with unique order and payment IDs.

Service-only invoker RPCs create/reuse an order, attach its exact Whop checkout, read it, read the live balance and atomically grant one purchased key. The database rejects wrong price/currency/plan/product/company/checkout, reusing a message for another order, reusing a payment across orders and a second distinct payment for an already fulfilled order. Failed transactions roll back receipt/wallet changes together. Foreign keys restrict deletion of accounts referenced by financial records instead of cascading away the audit history.

No new public grants or SECURITY DEFINER functions are used. The existing Sandbox schema/constraints remain unchanged. The migration is a foundation, **not** a live event consumption or refund ledger: those need a reviewed follow-up before the full flow can be enabled.

## Tests and limits

`tests/live-commerce-sql.test.ts` exercises the actual migration in isolated PGlite PostgreSQL, with fixtures for two Auth users and an existing Sandbox balance. It verifies preservation, public permission denial, disabled control, inability of the service role to enable commerce, request/checkout conflicts, amount mismatches, same-message replay, another delivery for the same payment, cross-order payment/message reuse and transaction rollback. It also exports/restores a local PGlite snapshot and rechecks Auth/ledger/isolated balances. This does not prove remote backups or multi-connection PostgreSQL concurrency.

An initial test exposed that SELECT FOR SHARE on the control row requires UPDATE privilege. Rather than granting the runtime UPDATE access, the check now uses SELECT only; the operator-only switch must be changed under a separately reviewed activation procedure. All runtime writes remain disabled by default.

Complete local verification of this increment: server typecheck PASS, production build PASS, **87 Node +65 browser =152 tests PASS**, with the existing Chrome test executable. Final commit/CI evidence is recorded in Notion and PR19. No remote migration, credit or backup claim follows from those local results.

## Backup gate

The connected Supabase toolset has no backup inventory or download operation. There is no evidence yet of this project's plan, backup schedule, last successful backup, retention or a remote restore drill. A healthy Postgres project and local snapshot test do not prove those facts.

[Supabase's current backup documentation](https://supabase.com/docs/guides/platform/backups) says paid plans have scheduled daily backups and recommends off-site CLI exports for free projects. Do not infer the project's actual plan from that generic documentation. Before applying the prepared remote migration or describing this environment as commercially ready, inspect the actual **Database → Backups** status and establish a verified secure backup/restore path. Do not buy a plan or PITR, ask for a secret in chat, or restore over the live account without explicit authorization. Database backups do not include Storage object contents.

Next: obtain backup evidence; test remote concurrency safely; apply only the new reviewed migration; implement server-owned pilot preflight/checkout/webhook/receipts, locale-preserving return and separate live balance/consumption; verify actual Whop subscription version, product ID and pilot host; then perform an owner-only SAR 2 purchase. General sales remain closed.

## Continuation inspection — 23 October 2026

The organization API now confirms **Free** (`tier_free`). The authenticated Dashboard Database → Backups page explicitly says **Free Plan does not include project backups** and offers an upgrade, with no scheduled backup inventory. This replaces the earlier unknown-plan status; no paid plan or PITR was enabled. A free external logical export remains an option, but no remote export or restore has been performed. This machine has no `pg_dump`, `psql`, Docker, or prepared database connection in the process environment. Do not copy an Auth JSON query and describe it as a complete database backup. An existing database password must be supplied through a secure local operator channel, never through chat, and must not be reset merely to create a backup.

Read-only baseline repeated: Auth users **1**, Sandbox orders/wallets/credits/saved events **0**. Ten existing private tables still have RLS. Four remote migrations remain, ending at `20261023085539`; the live migration is still **not applied**. The current project name returned by the API is **BU'D Discord Website**; no rename was performed by this continuation.

PR19 review found that the prepared checkout return dropped the user's language. The unapplied migration now stores an allowlisted `ar`/`en` locale with each live order, rejects reuse of the same request key with a different locale, and returns it to the provider. Checkout redirects now preserve Events and that stored locale. This edits only an unapplied migration; never rerun an already applied migration to obtain this change.

Before pilot activation, review the control switch's operational semantics: the current check is a statement-time gate, not cancellation of transactions already in flight. It also blocks purchase fulfillment when disabled. A reviewed pause/drain and paid-order reconciliation procedure is required before any real checkout; do not rely on this boolean alone to prevent orphaned paid orders during shutdown.

Latest continuation: official portable PostgreSQL 17.11 is now available under ignored `.temp`. The owner reported resetting the unknown database password personally. Masked local backup attempts still did not verify a backup: first `INVALID_LOCAL_INPUT`, then a Windows PowerShell compatibility failure, and finally `POSTGRES_PSQL_FAILED`. The prompt issues are covered by a standalone fixture; the last database-command failure has no established cause. Do not request further password attempts after the owner's final-attempt instruction. No success receipt, remote restore or remote migration exists. The separate live-commerce handlers are now locally integrated/tested but remain disconnected from public routes.

Further approved local preparation adds `20261023193330_live_payment_queue_and_event_consumption.sql` after the live foundation. It separates new orders, paid-order drain and new event starts, adds a private leased payment queue and live event/debit/action audit, and replaces only the prepared live functions. Existing Auth, Sandbox objects and historical migrations are not rewritten. Queue intake is durable without granting credit; claims/finish use independent fulfillment control and fencing. Start locks/debits only the live wallet and reuses event receipts. Resume/dispatch use isolated live state. No runtime may update control flags or delete audit rows.

Native PostgreSQL 17.11 concurrency was verified locally with fabricated data and 12 separate connections, supplementing PGlite failure/lease/replay tests. This does not prove production privileges/concurrency or a backup of the real project. Neither additive live migration has been applied. See `docs/LIVE_PAYMENT_QUEUE_AND_KEYS.md` for schema ordering, paused-drain semantics, queue review and remaining activation gates.
