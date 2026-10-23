# BU'D — handoff to the next conversation

Updated 2026-10-23, Asia/Riyadh. Read this file, AGENTS.md and the latest Notion work log before continuing. This is continuation context, not evidence that pending work is complete.

## Latest continuation delta

- Owner accepted preparing a free encrypted external backup after the explanation. `scripts/database-backup.ps1` is a local masked-input prompt; `scripts/database-backup.mjs` fixes the source project, enforces TLS verification/read-only source sessions, encrypts the dump and verifies Auth/application restoration in a separate local cluster. Official portable PostgreSQL 17.11 is downloaded in ignored `.temp`; no service or paid tier installed. Fixture self-test passed; **real export still depends on owner input and actual successful receipt**. Read `docs/DATABASE_BACKUP_OPERATOR.md` before using or interpreting it. Never request a password in chat or infer real-backup success from the fixture test.

- Connected Chrome UI now works. Owner completed Whop sign-in. Do not repeat the earlier kernel-failure assumption. Opera is not connected; it is unnecessary while Chrome works.
- Actual Supabase organization plan is Free. Database → Backups explicitly says Free Plan does not include project backups. No scheduled backup exists in this UI; no external export/restore yet. Local `pg_dump`/`psql`/Docker and a prepared database connection are absent. A secure external export/recovery path remains the remote-migration gate; no paid upgrade is authorized.
- Remote read-only counts repeated: Auth 1, Sandbox orders/wallets/credits/saved events 0; four migration versions unchanged. API project name is now BU'D Discord Website; this continuation did not rename it.
- PR19 head `70bad7d48075f51726d020b8196999875234a770` had exact-head CI success [run 39997730597](https://github.com/budctx/bud-events-website/actions/runs/39997730597). Later continuation edits require their own checks.
- Whop website webhook was actually **Active**. Switched that subscription only to **Disabled**, saved and verified. Existing URL/secret/payment.succeeded and unrelated active b6olh integration preserved. Dashboard shows webhook `v1`, with no dated pin visible; API key's `2026-10-15-1` is independent.
- Product editor `prod_vaq6H0Lz1ID3h` shows سؤال وشرط / hidden SAR 2 one-time option / conversion off / multi-quantity allowed. UI evidence only; plan-to-product API validation remains unrun. No product setting changed.
- Added separately gated owner-only `/api/whop-preflight` for an empty same-origin POST from a verified pilot Discord host. Uses hosting's existing secret, distributed limits, and only a Whop GET; returns sanitized plan/amount/IDs with no checkout/payment/credit. Not deployed, not an actual provider result. Enable diagnostic independently of sales only after review.
- Review fix: prepared live order persists locale (`ar`/`en`), idempotency rejects locale changes, and checkout return keeps Events and language. Migration is still unapplied. See reports for pause/drain and reconciliation limits before real payments.

## Owner's latest instructions and authorization

- Continue preparing commercial launch without asking again for already approved work. Arabic-first, Code-first; preserve the current site identity. No Figma.
- Owner chose the existing official Whop account, approved a real **SAR 2 one-time pilot price**, and will change the price before launch. Do not activate general sales or treat SAR 18 from earlier simulations as approved.
- Owner explicitly said **موافق** to preparing the existing Supabase project for production after checks, preserving their account/data. A separate project is not required or approved. Do not request this approval again. Do not delete data, incur cost or enable selling under that approval.
- Owner requested documentation in Notion and a handoff because this conversation is heavy. Do not create another Codex conversation unless explicitly asked; the owner will open one in this same project.

## Code and deployment

- Local workspace: `C:/Users/Bar10/Documents/ChatGPT/مشروع موقع بُعد`.
- Repository: https://github.com/budctx/bud-events-website
- Live site: https://bud-events-website.vercel.app
- Current branch: `feat/whop-production-provider`.
- Draft PR: https://github.com/budctx/bud-events-website/pull/19 (attached to the originating conversation). Keep draft until reviewed; no automatic merge based on tests alone.
- Earlier reviewed candidate commit on this branch: `8e3ff8b2d3c4f8a3ceca60c680a20d24d2bf6c96`, production provider preparation only. CI run https://github.com/budctx/bud-events-website/actions/runs/39995513848 succeeded on that SHA. Later database/handoff changes are a new head; obtain its exact SHA and CI state from Git/Notion/PR rather than attributing that earlier CI to it.
- Deployed main stays `0de6130fc158d0636fca745ba30e8aae1382775e`. Latest verified owner redeploy: `dpl_3fTh39mD6EkyWCKnAdW7sEKt7RaR`, READY. Current preparation changes are not deployed.
- Untracked `artifacts/` predates this work. Preserve it and do not commit it wholesale. Build output/test-results are ignored.
- Main automatically deploys to Production. Follow AGENTS.md: feature PR, typecheck/build/tests, appropriate review and exact-head CI before merge. Stage completion is separate.

## Existing product and account journey

Home, Events, Bots, Designs; only launch product is سؤال وشرط. Login returns to the same gallery and locale. Header shows verified Discord avatar/name, history/logout menu. Event card displays protected real wallet balance; error is not zero. Guest buy requests login and returns without automatically purchasing. There is no separate host landing dashboard or product details modal.

The game requires a server event outside local development. Winner sidebar, duplicate-name independent records, manual prize reveal, host winner management, suspense/confetti, timer toggle, attempt stepper and limited event card preview are already implemented. Do not rebuild them or reintroduce a full free trial.

## Whop setup already supplied by owner

- Company: `biz_ytADNSjjYVsa7O`.
- Plan: `plan_9ztA5kXWGC73u`.
- Checkout link: https://whop.com/checkout/plan_9ztA5kXWGC73u/
- Owner screenshots: SAR 2, one-time, plan hidden; this is not an authoritative API read.
- Vercel Production contains four verified-by-metadata variables: WHOP_PRODUCTION_API_KEY and WHOP_PRODUCTION_WEBHOOK_SECRET (sensitive secrets), WHOP_PRODUCTION_COMPANY_ID and WHOP_PRODUCTION_PLAN_ID (configuration). Never reveal/decrypt secrets into chat or documentation.
- Owner was instructed to register a **disabled** payment.succeeded webhook at `https://bud-events-website.vercel.app/api/whop-webhook`. They confirmed saving the secret. Registration, actual enabled state and subscription version have not been independently verified. API-key version and webhook version are independent.
- Preserve existing unrelated `b6oh-production` key and webhook to `https://b6oh.vercel.app/api/webhooks/whop`.
- New product ID has not been retrieved from the API. Do not use a product URL UUID as prod_… ID.
- Do not ask for the company/dashboard link again; it has already been obtained.

## Implemented production provider preparation

See `server/whop-production.ts`, `scripts/whop-production-preflight.mjs`, `tests/whop-production.test.ts`, and `docs/whop-production-preparation.md`.

The production provider is server-only and not wired to a route. It uses api.whop.com, explicit legacy REST pin 2025-01-01, verified company/plan/product/amount/currency, one-time billing, no additive tax/automatic currency conversion; host-restricted explicit pilot configuration; internal order/environment metadata; stable namespaced provider idempotency key; exact bound checkout URL; raw HMAC signature/account/version/time validation; authoritative payment lookup and exact payment/order matching including refund/dispute indicators.

`npm run whop:preflight` only performs GET. It needs the production key in an approved secure process environment plus company, plan, currency=sar and amount_minor=200; the last two expectations are currently only in .env.example, not confirmed installed in Vercel. It outputs sanitized IDs/amount or fixed failure codes and never creates a payment/key. Do not pull production secrets into local files just to run it. No actual production API preflight has yet run.

`/api/checkout` still supports Sandbox only. `/api/whop-webhook` still returns 503. The client still only accepts sandbox checkout URLs. There is no production wallet/event consumption hookup, queue, refund policy or pilot purchase proof. Never claim otherwise.

## Database: existing project approved for preparation

- Ref `cepmvqqrjcvhyzszqand`, URL https://cepmvqqrjcvhyzszqand.supabase.co
- Dashboard https://supabase.com/dashboard/project/cepmvqqrjcvhyzszqand
- Current project name: BU'D Discord Events — Development. Status ACTIVE_HEALTHY; region ap-south-1, Postgres 17.11. Name was not changed.
- Owner approves preparing **this project** for production with preservation. Do not silently create a second one or suggest one is mandatory again.
- Read-only baseline: Auth users=1; saved events/orders/wallets/ledger rows and wallet credits=0. No cleanup/deletion needed. No user identity/credential was extracted.
- Existing bud_platform has ten private RLS tables. anon/authenticated lack direct SELECT. Advisor INFO for no public policies is expected for this server-only model. WARN: leaked-password protection disabled; current app uses Discord. Record/review password auth availability before any password-account flow; don't silently change unrelated Auth settings.
- Remote migrations: 20261022093928 bud_manual_commerce_contract; 20261022113143 stage00_reset_legacy_dev_schemas; 20261023023507 host_persistence_foundation; 20261023085539 launch_sandbox_hardening.
- Local historical migration filenames differ from remote history. Do not blindly db push, reset, repair or rerun old migrations.
- Auth/host/rate-limit and old Sandbox SQL currently target this exact project. Do not change account identity, rotate secrets or delete sessions for this preparation.

## New database foundation, local only

See `supabase/migrations/20261023173930_production_commerce_foundation.sql` and `tests/live-commerce-sql.test.ts`.

The migration was generated by official Supabase CLI 2.121.0. It adds five separate private tables: live_commerce_control (false), live_orders, live_wallets, live_deliveries, live_credit_ledger. It leaves all existing Sandbox tables/data and Auth intact. Server-only invoker RPCs persist/reuse an order, bind the exact production checkout, read order/balance and grant exactly one live key atomically with unique payment/order and unique message receipts. New delivery of the same payment records the delivery without another key. Conflicting message/payment reuse rolls back; financial references restrict cascading account deletion. The runtime service role cannot enable the operator control.

**Not applied remotely. Not an operational production wallet.** Event start/consume, receipt UX, reconciliation and refund/debit ledger require follow-up. Local tests prove real PostgreSQL statements via PGlite and local snapshot restoration only; not actual multi-connection remote concurrency or remote backup/restore.

## Immediate next steps

1. Confirm current branch/head, draft PR, Notion latest state and clean working tree. Continue from existing code; don't recreate credentials/products or ask for already supplied IDs.
2. Verify an actual backup/recovery path before applying the prepared remote migration. Supabase tools available here do not expose backup inventory/download. Use the Dashboard Database → Backups or an approved secure CLI/Management API route. Do not request secrets in chat or buy a paid tier/PITR without explicit approval. No backup's existence, retention or restore capability has been verified. No restoration over the current account is authorized.
3. Review migration/provider contracts and run required checks. Apply only the new additive migration after the backup gate; verify preserved account/data counts, privileges and disabled control afterward. Record actual migration version. Do not turn on live_commerce_control yet.
4. Build server-owned pilot-only preflight/checkout/webhook processing using this live schema, durable retries and strict environment/account binding. Obtain product ID from verified plan. Confirm actual webhook version. No return query or client success flag grants credit.
5. Integrate separate live balance/one-time consumption with existing host start/resume and ledger, preserve locale, resolve provider ambiguity/orphan checkouts, queue/reconciliation and refund/dispute behavior. Add API→SQL tests, actual concurrency/replay/crash tests, no fake grants.
6. Configure pilot host and runtime expectations only after all code and guards are reviewed. Keep public buying disabled. Ask owner to pay SAR 2 only when the deployed pilot flow is proven ready; verify one credit, replay, one consumption and resume without another debit. Update the final selling price and server expectation together later.
7. Complete backups/monitoring/policies/support and independent review before an explicit general-sales decision. Tests or a PR alone don't close commercial stages.

## Verification and tools

- Previous provider candidate: server typecheck/build +86 Node+65 browser=151 local PASS and exact-head CI success.
- New SQL candidate: server typecheck/build PASS and **87 Node +65 browser=152 local tests PASS**. Latest exact final commit and its CI state are recorded in Notion/PR; don't imply an earlier run covers later changes.
- Local browser default bundled Playwright headless shell is missing. Existing compatible Chrome is `C:/Program Files/Google/Chrome/Application/chrome.exe`; set BUD_BROWSER_EXECUTABLE for isolated automated tests. No new browser install is needed.
- Computer-use and in-app browser tools repeatedly fail at kernel initialization with `failed to write kernel assets: The system cannot find the path specified. (os error 3)`. Do not claim live UI control or loop retries. browser-act and uv were unavailable earlier; no installation consent was given.
- Prefer Supabase/Vercel/GitHub/Notion connectors. Read relevant SKILL.md and discover tool schemas. No proactive subagents unless explicit user/repository/skill authorization.
- Firecrawl account ran out of credits; official web or Supabase search_docs can be fallbacks. No upgrade was authorized.

## Documentation sources

- Launch plan/decisions: https://app.notion.com/p/402b475e25f18177bf8cc6ce0e5d0fcc
- Execution evidence: https://app.notion.com/p/401b475e25f181478074d37ce27b8f13
- Database preparation report: docs/current-database-production-preparation.md
- Provider preparation report: docs/whop-production-preparation.md
- Earlier overall plan: docs/COMMERCIAL_LAUNCH_PLAN.md (historical entries may predate Discord setup; latest Notion/owner decisions supersede them).

All documentation must distinguish owner approval, saved configuration, implemented code, local/mock tests, actual provider/remote database evidence, deployed behavior and commercial readiness. Preserve secrets and existing data throughout.
