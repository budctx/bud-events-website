# Live commerce cutover — prepared, not activated

This follows PR24. No remote migration, key, setting, schedule or sales flag is changed by this patch. The current official SAR2 CTA stays unchanged.

## Routing and audience

`BUD_COMMERCE_MODE` is server-only. Missing or `sandbox` preserves the existing routes; `live` requires production runtime and WHOP_ENVIRONMENT=production. Unknown modes, preview runtime or disabled live handlers fail closed without falling back to Sandbox. Browsers cannot select a wallet or provider with headers, JSON or query parameters. The existing production webhook remains unavailable in default mode.

Live mode also retains independent checkout, processing, SQL controls, host and receipt gates. `BUD_WHOP_PRODUCTION_MODE=pilot` restricts authenticated customers to the configured owner. The official customer scope requires BOTH mode=public and BUD_PUBLIC_COMMERCE_ENABLED=true. Public means verified Discord customers; it never means anonymous database access. The read-only diagnostic remains owner-only.

Every order, receipt, dashboard and event derives its host from the verified session. Stored payment/order binding determines the wallet for fulfillment. The client accepts a Whop session checkout only when its exact origin matches the response environment; production needs an explicit production marker. Direct plan URLs, credentials, query/hash redirects and foreign hosts remain rejected. The checkout body now carries the originating AR/EN locale. A retry retains the same key and locale even if the visible language changes.

## Required activation sequence

1. Resolve the actual Whop variant read and record product/plan/company/amount, quantity and final amount evidence. Do not bypass conversion/tax checks.
2. Verify a real recoverable backup before applying any of the three reviewed live migrations. Preserve Auth and Sandbox data. Check actual remote RLS, grants and concurrency.
3. Verify webhook subscription/version/signature/delivery and permissions. Install the narrow worker credential and reviewed schedule/monitoring. Never use a Supabase service key as a worker token.
4. Publish reviewed handlers with every financial control still off. Configure live routing with pilot scope first; the existing approved owner is the only buyer during verification. Enable only the required controls for the real SAR2 end-to-end evidence after all gates pass.
5. After independent review, policies/support/content approval and owner commercial approval, configure public scope and its independent opt-in. Keep admin diagnosis scoped. Confirm another verified customer cannot see or resume the owner's order/event.

## Pause, drain and resume

- Stop NEW purchases with BUD_WHOP_PRODUCTION_ENABLED=false and SQL live_commerce_control.enabled=false. Keep live routing, the selected audience, processing, worker and fulfillment controls available for previously paid jobs and late signed delivery. Do not switch to Sandbox during a payment drain.
- Pause NEW event starts with SQL host_enabled=false; keep the live host endpoint available to resume existing events. Turning off the entire endpoint is a separate emergency stop and also interrupts resumes.
- Keep receipts accessible while new buying is paused. Keep the public audience opt-in configured for existing customers; purchase/host controls are the operational pause switches.
- Record oldest pending/review jobs, both worker heartbeats and reconcile freshness. Health returning attention is not a successful drain. Escalate leases/retries/review cases without deleting receipts or ledger rows.
- Refund/dispute holds remain manual and monotonic. No automatic clawback, debt, refund API or hold release is added. Audited manual resolution/requeue tooling remains outstanding.
- Before rollback to a release lacking live routes, stop new purchases, drain or explicitly account for all outstanding jobs and preserve a compatible consumer. A frontend rollback alone does not settle paid orders. Reconcile against provider truth afterward.

## Evidence and limits

The local integration fixture runs all three live migrations and routes a second verified customer through checkout, signed intake, one worker credit, own-only receipt, single start debit and resume. It rejects forged host fields and cross-customer receipts/events, preserves the owner's live balance and Sandbox balance, and keeps receipts readable while buying is paused. Provider HTTP is mocked; this is not actual Whop payment or production concurrency evidence.

GitHub's public API read on 2026-10-24 returned main protected=false and an empty active branch rules list. Protection is confirmed absent, not merely unknown; setup is still an admin task. The available connector cannot configure rulesets. Do not claim protection active or weaken any existing rule.

Before launch, independent financial review, real backup/payment/alerts and audited manual review/requeue are still required. Exact SHA/CI/deployment and real evidence are recorded in Notion; a passing fixture does not close those gates.
