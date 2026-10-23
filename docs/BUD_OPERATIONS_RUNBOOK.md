# BU’D operations runbook

Version 0.1 — 23 October 2026. DRAFT / NOT AN OPERATIONS CERTIFICATE.
Owner: BU’D project owner; operational contact and incident deputy UNASSIGNED.
Prepared for the authorized S00–S11 batch. This document creates procedures, not remote configuration, monitoring or backup evidence.

Current implementation addendum: `BUD_PLATFORM_FOUNDATION.md` supersedes the historical baseline table below for host routing, Auth/API code and actual development schema. Migration remote version `20261023023507` was applied; service-role replay/CAS/isolation checks passed in a rolled-back transaction, leaving zero users/events and draft inventory. An isolated PGlite data-directory dump/restore passed; remote backup/PITR remains unverified. Provider activation and independent complete-stage review remain pending.

## Boundaries and current evidence

| Area | Verified source / boundary | What this runbook does not establish |
|---|---|---|
| Public product | Home/Events/Bots/Designs; fixed two-card Events sample. Source: App.tsx, EventPreview.tsx, shared-game-cards.md | Paid host availability |
| Host workspace | Development-only import in App.tsx at baseline; public builds omit full host | Secure production host entitlement |
| Backend | server/commerce.ts rejects missing auth/config, checks Discord identity through Auth, binds host server-side; checkout/webhook disabled at inspected baseline | Live OAuth callback, webhook fulfillment or complete event API |
| Database | Sandbox-only bud_platform migration in source; prior remote application recorded in BUD_BACKEND_CONTRACT.md | Current remote schema inventory, migration health or restore readiness |
| CI | .github/workflows/ci.yml builds, checks server types, runs tests, uploads browser artifacts | Required main protection, automated detailed-stage approval or remote E2E proof |
| Logging | Inspected commerce code emits fixed failure code, avoids raw upstream diagnostics | Structured production logging, alert routing or retention |
| Backups | No backup export or restore performed in this lane | Remote scheduled backups, PITR entitlement, tested recovery or RPO/RTO |
| Notion | Authoritative stage/gate/approval records; evidence writer source exists | Working credentials/sync until real event and readback verify it |

This baseline can become stale during the batch. Root must append final exact SHA, environment, inventory and verification links after implementation. Preserve public sample behavior until a secure host API and entitlement flow are independently accepted.

## Release record and environment inventory

For every release, record repository/branch/commit, PR, CI run+attempt, independent review, migration versions/checksums, deployment ID/URL/target, approved scope, environment name, config names (never values), actor, timestamp, smoke tests, rollback target and Notion evidence URL.

Maintain separate local test, isolated BU’D sandbox, Preview and Production inventories. A Preview origin is not automatically an approved OAuth callback or allowed API origin. Never point tests at another project or copy production customer data into sandbox.

Known intended development project: cepmvqqrjcvhyzszqand. Verify identity immediately before any remote action. Preserve historical bud_private objects unless the exact owner-authorized change names them; no broad cleanup.

Server-only secret names in the inspected contract: SUPABASE_SERVICE_ROLE_KEY and provider secrets; never prefix with VITE_, commit them, print them, include them in screenshots or embed them in browser assets. Public configuration and server enable switches must be scoped per environment. Missing config must fail closed.

## Activation checklist

This is a readiness checklist, not a request to repeat already-authorized reversible implementation permission.

- [ ] Final product/session/Slot contracts reconciled; unresolved policy does not leak into enabled behavior.
- [ ] Correct provider/project/environment and callback/redirect allowlist verified by readback.
- [ ] Auth verifies issuer/user/Discord host server-side; negative, expired, forged and cross-host tests pass.
- [ ] Protected dashboard and all mutations require current host entitlement; public sample routes cannot access them.
- [ ] State, versions and controller ownership are authoritative server-side; stale/duplicate requests are rejected or safely replayed.
- [ ] RLS/privilege audit proves anon/authenticated cannot call service-only authority; tests cover tenant denial.
- [ ] Approved migrations reviewed, dry-run on disposable DB, then isolated sandbox applied and read back; rollback/forward recovery prepared.
- [ ] Sandbox provider webhook validates raw signed payload/timestamp, environment and server-owned product/order mapping; retries/concurrent replay cannot double-credit.
- [ ] New-session start atomic debit, same-session resume zero debit and simultaneous-start tests executed using real concurrent connections.
- [ ] Four-hour cap/disconnected-time policy and clock source tested; no old restart/grace/prestart rule silently restored.
- [ ] Event content versioning, export/history and data lifecycle verified, including duplicate/anonymous prize records.
- [ ] Missing config/provider failure/rate abuse timeouts return honest failures; no fake checkout URL or fabricated success.
- [ ] Restore rehearsal and owner-approved recovery targets evidenced; alerts have an actual destination and responder.
- [ ] Final policy text, support route, operator identity, price/currency/tax/refund/Slot expiry approved where applicable.
- [ ] Independent security/UX review and full browser→Auth→API→DB evidence exist for enabled scope.
- [ ] Appropriate production activation authority exists for the exact commercial scope. Frontend publication approval is not evidence of payment activation.

Record each checked item with SHA, environment, actor, date and evidence. An unchecked item may remain intentionally disabled with a clear boundary; it may not be presented as active.

## Backup and restore readiness

### Inventory before selecting a mechanism

Record database provider/plan/region, backup features actually available, retention and encryption controls, storage ownership/access, recovery-account access, data size and sensitivity. Treat provider PITR support and cost as UNKNOWN until account-level confirmation. Set recovery point/time objectives with the owner; do not invent an SLA.

Inventory everything needed to reconstruct service: schema/migrations, DB data, Auth configuration and identities where permitted, provider settings, storage objects if used, content versions, runtime configuration references and deployment manifest. Database-only recovery does not prove OAuth, object storage or payment reconciliation recoverability.

### Safe backup procedure to implement and test

1. Use an approved isolated target and least-privilege server-side export identity. Record environment, migration versions and snapshot timestamp.
2. Create a consistent logical export or approved provider snapshot without printing secrets or customer payloads. Encrypt and store outside the primary failure domain with restricted access.
3. Record checksum, object location, access-control result and retention/deletion policy. A zero-byte file or “job success” is not a usable backup.
4. Check a scheduled job actually runs and failed/late backups notify the designated responder.
5. Preserve a deployment/config manifest separately from secret values; recovery must have a secure credential provisioning path.
6. Record the latest verified snapshot age. Until this exists, recovery readiness is NOT VERIFIED.

### Restore drill — mandatory separate evidence

Restore only into a new disposable isolated database. Resolve and verify the target identity before restore; never test over production. Disable outbound emails/webhooks/payment fulfillment and use sandbox credentials. Restore schema/data, check roles/RLS/RPC grants, compare table counts and ledger consistency, check event/content/history references, verify tenant denial and run representative authenticated read/mutation/retry tests.

Measure actual backup age and restore duration against proposed objectives. Record defects, cleanup, actor/date/target/snapshot/hash and exact validation output. Have an independent reviewer inspect the drill. A completed local PGlite migration test is not a remote restore drill.

After disaster recovery, reconcile externally acknowledged payment/order/webhook IDs against the restored ledger before accepting fulfillment. Replayed provider deliveries must remain idempotent. Never repair balances with anonymous direct edits or erase audit history to make totals match.

**Readiness record at creation:** backup feature/account inspection NOT RUN; scheduled backup NOT VERIFIED; external encrypted export NOT RUN; isolated restore NOT RUN; measured RPO/RTO NOT SET; recovery signoff NOT APPROVED.

## Content operations and versioning

Applies to actual event banks/catalog assets; the public sample remains the explicit fixed pair unless owner changes it.

- Assign stable content ID, locale, version, author, source/rights, review status, effective date and checksum. State the supported template/schema version.
- Separate draft → reviewed → approved → published → retired. Only approved versions are served to new authenticated sessions.
- Validate schema, bounds, AR/EN copy, duplicate IDs, empty strings, maximum lengths and question/condition compatibility. Do not introduce participant data or unsupported mechanics through content.
- Pin a session to its content/policy version at start. Editing a catalog must not silently alter an active game's draw/history. Define cross-version resume behavior before activation.
- Keep published content immutable; corrections create a new version. Retiring content does not delete audit/history references.
- Record owner/editor permissions and audit events. Never allow a browser field to grant publish authority.
- Roll back catalog version by reviewed pointer change; preserve referenced versions and explain whether active sessions remain pinned.
- Record official emblem/art provenance and generated-asset approvals; retain prior accepted assets in version history.

Acceptance evidence: publish permission denial, draft invisibility, exact version pin, invalid-bank rejection, rollback, AR/EN visual review and old-history rendering.

## Logging, monitoring and alerting

### Proposed structured events

Use request/correlation ID, timestamp, environment, release SHA, operation, duration, stable outcome code, safe internal resource reference and retry/version outcome. Store sensitive actor linkage only in restricted audit storage when justified. Redact authorization/cookies/service keys/OAuth codes, winner display names, emails, request bodies and full webhook payloads from general logs.

Track authentication rejection, origin denial, expired/stale controller, unauthorized tenant access, invalid mutation version, provider/config failure, start idempotency conflict, duplicate fulfillment, upstream timeout, DB failure, content publish and policy/config changes. Separate security/audit events from debug output. Define access, retention, lawful deletion and tamper-evidence with the data policy.

### Monitoring to provision, not claimed active

| Signal | Intended check | Evidence needed before ACTIVE |
|---|---|---|
| Frontend availability | Canonical alias/status/critical assets and sample smoke | Real schedule, latest timestamp, tested alert |
| API health | Safe config/route/readiness outcome without public privileged health data | Correct env response and denied unauthorized probe |
| DB/API errors | Unexpected error/timeout trend and denied permission anomalies | Safe logs, threshold, actual notification receipt |
| Auth/provider | Callback/signature failures and fulfillment backlog | Sandbox delivery and alert drill |
| Transaction consistency | Repeated debit/credit conflicts and reconciliation drift | Replayed/concurrent test plus restricted report |
| Backup freshness | Latest successful usable backup and restore drill age | Stored checksum/age and failure notification |
| Performance | Real route/API durations and approved budget | Measured baseline; no fabricated Lighthouse/60fps PASS |

Owner must select response windows and thresholds based on measured traffic and service commitments. Do not mark a dashboard or a proposed metric “monitored” without an enabled schedule, receiver and test. Keep metrics free of high-cardinality personal names/tokens.

## Incident response

1. Declare incident with time/environment/release SHA, impact and evidence. Separate availability, integrity, security and provider-delay symptoms.
2. Assign incident commander and technical responder. Contacts are currently UNASSIGNED; fill them before commercial activation.
3. Contain narrowly: disable affected mutations/checkout/webhook fulfillment or roll back frontend; keep public browsing available when safe. Preserve evidence and ledger records.
4. Investigate using correlation IDs and restricted logs. Never paste secrets or personal data into Notion/GitHub.
5. Compare last known good deployment, migration and config changes. Token exposure requires scoped rotation/revocation and dependency audit, not merely a code revert.
6. Recover with tested procedure; verify ownership, privileges, transactions, history and provider reconciliation before re-enabling affected paths.
7. Communicate verified impact and next checkpoint using the approved support channel. Do not invent incident timing, restoration promises or legal notification requirements; jurisdiction-specific obligations require qualified review.
8. Write post-incident cause, timeline, data impact, corrections and regression cases; track owners/deadlines. Update runbook after independent review.

## Rollback

Record known-good commit/deployment and compatible schema before release. Main auto-deploys; merging is production release. Existing owner authorization applies only within its approved scope; require successful CI and appropriate independent review. Do not claim branch protection active without checking.

For frontend regression, promote/redeploy the verified compatible build through the supported deployment mechanism and confirm canonical alias, target SHA, assets and critical journeys. A Vercel READY state alone is not a smoke test.

For database regression, prefer reviewed additive compatibility and a forward correction. Do not reverse a migration by dropping live data or rolling a payment ledger backward. A destructive restore is a separate consequential recovery decision requiring verified targets, preserved evidence and external-provider reconciliation. Keep provider fulfillment disabled during uncertain ledger recovery.

For configuration regression, revert only affected environment settings from secure records, not from a public document. Verify callbacks/origin/feature flags after redeploy. Reverting code may not revert provider dashboard settings or applied SQL.

## Release verification and operational handover

Execute required npm run typecheck:server, npm run build and npm test on final candidate. Match CI and deployed SHA; retain browser artifacts and failures. Test public fixed sample and production host-route exclusion independently from protected host/backend paths. Test mobile/desktop, AR/EN, keyboard/focus/reduced-motion and fault paths relevant to changed scope.

Add independent review and a real rollback rehearsal result. Root records evidence in Notion; CI evidence sync reports runs only and must not auto-close detailed gates. Release handover contains named responder, monitored endpoints, latest backup/restore evidence, known limitations and unresolved activation dependencies.

## References

- [Current stage/decision audit](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c)
- [Notion governance](https://app.notion.com/p/401b475e25f1811db036f561ace4a253)
- Repository: BUD_BACKEND_CONTRACT.md, BUD_GOVERNANCE_AUTOMATION.md, BUD_STAGE_RECONCILIATION_20261023.md, policy-drafts.md, server/commerce.ts, supabase/migrations/.
- Provider backup/auth/payment product capabilities must be verified against current official documentation AND the actual account before selecting procedures or activation.

