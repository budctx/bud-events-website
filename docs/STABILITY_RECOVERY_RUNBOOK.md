# BU'D — Stability and recovery runbook (evidence-oriented)
Last reviewed: 2026-11-03. **Not an attestation that backups or a restore have been tested.**

## Ownership and scope
Production: https://budteam.net · GitHub `budctx/bud-events-website` (`main`) · Vercel project `bud-events-website` · Supabase `cepmvqqrjcvhyzszqand` (schema `bud_platform`) · Whop payment provider.

Protect financial, checkout, wallet, redeem, owner-audit and idempotency records. **Never** delete or replay ledger rows, create fake purchases, or reset wallet balances during an incident test. Host event progress is local to the user's browser by approved product policy: infrastructure recovery cannot restore that local state.

## Current inspected state (2026-11-03)
- Existing CI: local Postgres concurrency test, server TypeScript check, build, Node/Playwright tests; read-only workflow token, SHA-pinned actions, upload browser evidence.
- Existing web config: CSP, frame restrictions, `/api/*` no-store; payment worker and reconciliation routes.
- Supabase project status reported `ACTIVE_HEALTHY`. Security advisors report 33 `rls_enabled_no_policy` **INFO** findings in the private `bud_platform` schema; this is not automatically insecure: investigate whether the tables are deliberately service-role-only before adding public policies. One warning concerns leaked-password protection, which may not be relevant to Discord-only authentication. Do not relax RLS to silence warnings.
- Vercel team-level drains query for this project returned none. Existing application-side audit/worker-health functionality is separate; no conclusion about its alert delivery or retention until an end-to-end test.
- **Backup plan and successful restore are not verified.** Do not assume daily backups or PITR. Check the project's Supabase plan and Database → Backups before claiming recovery coverage.
- GitHub branch protection / required checks could not be read or changed with the available connector; **must be verified in repository settings**. A passing PR check alone does not enforce merge blocking.

## Release checklist (one PR; no live money movement)
1. Confirm current product decision, precise files, and acceptance criteria in Notion.
2. PR to `main` with current commit SHA; ensure `owner-database-concurrency`, `verify`, and Vercel checks pass. Never bypass red checks in production without an explicit documented incident decision.
3. Verify no new auth/Whop/Supabase privileges or exposed secrets, database migration, unreviewed cron, or UI-only trust boundary.
4. Deploy via existing Vercel Git integration, verify deployment is `READY` at the intended SHA. Conduct production smoke of **safe/read-only** endpoints and real login when appropriate.
5. Update evidence (commit, PR, run, environment, notes) in Notion; technical checks do **not** close Stage Gates.

## Protect `main` (manual project-owner action; not yet verified)
GitHub repository → Settings → Rules → Rulesets **or** Settings → Branches → branch protection:
- Target `main`; require pull request before merge (avoid direct pushing to protected main).
- Require successful status checks **`verify`** and **`owner-database-concurrency`** from `Website checks`; configure Vercel separately if stable and genuinely necessary.
- Require conversations resolved; prohibit force pushes and deletion; apply to admins if allowed.
- Avoid mandatory extra human reviewer until a second maintainer actually exists; don't create an impossible approval gate. Require strict up-to-date branch only if the extra CI cost and workflow fit.
- Test in a safe, disposable PR before asserting enforcement. Never disable checks for convenience.

## Dependency and CI maintenance
- Dependabot proposes limited weekly npm/GitHub Actions PRs; no auto-merge or unreviewed major upgrades.
- `Dependency security review` runs weekly and manually on trusted `main`; creates a read-only production dependency advisory artifact. It does **not** auto-fix packages, close issues or certify a vulnerability-free release. A successful job may contain advisories: review counts and artifact separately.
- `check-operational-guardrails.mjs` runs in standard CI to catch accidental removal of core web headers, `/api` no-store, financial cron endpoints, workflow least privilege and source trust boundary. It is a configuration regression check, **not** an intrusion test.

## Backups and isolated restore drill — mandatory before backup Gate PASS
1. Open Supabase → project → **Database → Backups**, record active plan, most recent backup timestamp, retention and PITR availability. Free plan does **not** include automated Supabase backups; use encrypted, access-controlled off-site logical exports or approve upgrading. Do not place raw production dumps in GitHub, CI artifacts, public Notion pages or chat.
2. Ensure backup encompasses required schema/table data including ledgers, redeem codes, audit events and relevant SQL functions, grants and extensions; verify the export format using the documented CLI / approved method. Avoid embedding database credentials in committed scripts.
3. Provision a **separate disposable, isolated target** for a restore rehearsal, with payments, webhooks, emails, cron, and external side effects DISABLED. **Never restore over production** merely for validation.
4. Restore, validate schema/table existence and record counts, key constraints, important functions, ledger conservation, duplicate fulfillment protection and owner access. Use sanitized test fixtures where possible; scrub personal/financial data in any shared report.
5. Record backup timestamp, restore start/end, actual measured RTO, estimated RPO, operator and audit evidence. Propose target RTO/RPO only after measuring and owner acceptance; do not invent achieved targets.
6. Delete isolated credentials and target on approval, retaining evidence but not raw dumps. Update official Gate/Test only after independent verification.

## Failure triage / rollback
- **High error rate or domain down:** capture time, scope, Vercel logs and latest known-good deployment SHA. Inspect read-only API status; disable disruptive operations only via approved safe controls.
- **Failed code rollout:** consider rollback to a known-good **production** deployment only after checking that DB migrations, Discord callbacks, Whop webhook routing and scheduled worker hosts remain compatible. Vercel rollback may stop automatic alias assignment; explicitly validate and re-enable normal production promotion afterward.
- **Whop delivery delays:** inspect existing worker health, queue, delivery receipts and reconciliation logs read-only. Do not replay webhook or grant a slot before provider source-of-truth reconciliation and idempotency proof.
- **Data damage:** quarantine writes if authorized, determine trustworthy recovery point, request explicit incident authorization. Isolate a restore and reconcile ledger differences; destructive production restore requires separate incident approval.
- **Secrets leakage:** revoke/rotate the exposed credential with provider, validate consumer config, invalidate sessions as relevant, review logs and document the incident; never put token strings into the runbook or Notion.

## Observability still to prove
- Vercel drains were not configured when checked. Select a restricted destination and retention/redaction policy if centralized telemetry is justified; ensure no Discord access tokens, payment PII or cookies enter logs.
- Test an alert for worker failure and a checkout/reconciliation anomaly **without a real purchase**. Confirm responsible contact receives it, and measure detection and acknowledgement time. Do not claim monitoring is active because a health table or cron exists.
- Do not create repeated synthetic paid operations just to prove monitoring.

## Acceptance and evidence
Engineering PR may close when CI checks pass and changes are reviewed. **Stage stability/backup gates remain open** until: proven `main` protection, real isolated restore evidence, meaningful alerts validated, and release/rollback smoke verified on an exact SHA with independent QA.
References: `docs/DOMAIN_CUTOVER.md`, `scripts/launch-readiness.mjs`, `docs/notion-release-evidence-sync.md`, Notion Stage Gates and Execution Queue.
