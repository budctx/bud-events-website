# BU’D platform foundation — 23 October 2026

Status: implemented foundation; integrations disabled; no formal stage exit certified.

## Delivered contract

- `api/auth.ts` / `server/auth.ts`: Discord via Supabase PKCE, encrypted Secure/HttpOnly/SameSite cookies, state binding, fixed origin/project, refresh and verified user lookup. Browser receives no tokens.
- `api/host.ts` / `server/host.ts`: cookie-authenticated POST dashboard/start/resume/dispatch, strict origin/content/body checks and server-derived host identity. No client state replacement, start/reset command, wallet, price or identity authority.
- Start consumes one run transactionally. Normalized payload fingerprint prevents reusing a request key for another start. Existing owned session resumes without a charge.
- Actions use a request key plus command/version fingerprint, server reduction and locked compare-and-swap. A retry recovers its receipt before re-reducing advanced state. Conflicts require a fresh review; the UI synchronizes without silently overwriting another tab.
- Events retain config, manual winner IDs/names, prize assignment, round/reveal state, server deadline, pinned content version and randomized pair order. Duplicate names remain independent. Only the current pair is returned; full banks are private.
- The optional round timer uses a persisted server deadline and continues across reload/absence. Host adjudication remains manual. A four-hour wall-clock maximum from the actual start closes an event on the next protected read/start; there is no background scheduler or additional resume charge. Four hours includes disconnection; this implementation choice is explicit and must be reconciled with policy before activation.
- Closing is terminal and stored as completed history. Results can be copied. Host history returns the latest 100 records; retention is persistent but pagination/export/erasure policy still requires a later contract.
- Published content cannot be edited in place; create another version. Product/content examples are **draft**, never live paid inventory. No fake slots, customer data or successful purchases were seeded.
- `/api/commerce` retains read-only balance and disabled checkout. Its old start/resume actions return 410 `HOST_API_REQUIRED` so they cannot bypass content and session controls. The old SQL start function is server-only and used inside the new atomic start transaction.

## Actual development database evidence

Dedicated target: `cepmvqqrjcvhyzszqand`, BU’D Discord Events — Development. No other project touched.

Before this change: `bud_platform` absent, zero Auth users. Migration history contained `bud_manual_commerce_contract` and later `stage00_reset_legacy_dev_schemas`. Historical source files alone were not current schema evidence.

The CLI generated `20261022215208_host_persistence_foundation.sql`. Its reviewed SQL was applied remotely as `host_persistence_foundation`; the remote tool assigns its own migration timestamp. The migration is additive, transactional, preserves historical tables where present, and restores only the dedicated application schema. Nine tables have RLS with no public/authenticated policies or privileges; service-only functions are invokers with fixed search paths.

A real PostgreSQL transaction exercised service-role start/debit/replay, action replay, stale-version conflict, cross-host denial and privilege assertions. It rolled back all fixtures, users, inventory publication and credits. Readback confirmed **zero users, zero events, product still draft**. This is real database proof, not real Discord/provider proof and not multi-connection load/concurrency proof.

Advisors after application: informational RLS-without-policy findings for nine deliberately private tables, and unused-index information for the empty new schema. No warning/error was reported. Do not add public policies merely to silence these intentional deny-by-default informational findings.

## Verification and review limits

Node tests cover Auth/session/CSRF, input authority, reducers, transactional SQL, replay/CAS/isolation, four-hour closing and restoring an actual PGlite data-directory dump into a second isolated database. Browser tests cover Arabic/English public regression, protected access states, uncertain start retry, history and mobile layout. Counts and exact candidate SHA belong in the release evidence, not inferred from this document.

PGlite restore proves only isolated local restore, not remote backups, PITR, recovery objectives or production recovery. Provider traffic is mocked in tests. A fresh independent review of the completed integration remains a stage gate; the parallel authors did not approve their own code. No stage is closed by these tests.

## Remaining external/launch gates

- Configure Discord application secret and exact callback allowlist in the correct Supabase environment; validate real callback, concurrent refresh, revocation and multi-tab behavior.
- Configure server-only Vercel variables from `.env.example`; they remain disabled/unconfigured. Never expose service or cookie secrets through VITE variables.
- Approve/publish a complete content bank, settle session/retention terms and establish operator/support ownership.
- Implement and verify the actual commerce provider contract: server-created sandbox orders, cryptographic webhook verification, refund/reversal policy and reconciliation. Checkout/webhook remain unavailable; no real charging path exists.
- Complete independent security/acceptance, multi-connection PostgreSQL contention/load tests, rate-limiting/alert routing, remote backup inventory/restore proof and protected branch enforcement.
- Reconcile the detailed Notion gate/test/approval rows against an exact reviewed release. Documentation readiness is not automatic legal, owner or QA approval.

## References

- Supabase current [changelog](https://supabase.com/changelog.md), read before implementation; current TLS and framework changes did not require an SDK migration because this adapter uses standard HTTPS/Web Crypto.
- [Database functions](https://supabase.com/docs/guides/database/functions) and [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security): invoker functions, explicit grants, private data.
- `auth-setup.md`, `host-portal-ux.md`, `BUD_STAGE_RECONCILIATION_20261023.md`, `BUD_OPERATIONS_RUNBOOK.md`, `policy-drafts.md` contain setup, detailed acceptance reconciliation and unpublished policy drafts.
