# BU'D — GitHub CI → Vercel → Notion evidence sync

## What it does
- Reads only completed `Website checks` GitHub Actions runs caused by a `push` to `main`.
- Finds a matching **production** Vercel deployment by the **same Git SHA**, not by approximate time.
- Creates or updates one Notion Release Evidence row for each GitHub run ID (idempotent).
- Reconciles on `workflow_run.completed`, every six hours, or `workflow_dispatch`.
- Keeps `Manual Review` unchanged on updates.
- **Never** mutates Stages, Gates, Tests, Approvals, Execution Queue, purchase/slot data or production app code.

## One-time activation (owner action)
1. In Notion, create an **internal integration** with read and insert/update content capabilities, and connect it to the `BU’D — Release Evidence | CI → Vercel` database. Avoid granting unnecessary workspace access.
2. In GitHub `budctx/bud-events-website`, open **Settings → Secrets and variables → Actions → Repository secrets**. Create:
   - `BUD_NOTION_TOKEN`: Notion integration token. Never paste it into Notion pages, code, chat or logs.
   - `BUD_VERCEL_READ_TOKEN`: a Vercel token with read access to project `bud-events-website` under team `team_NMhh6HF2W1chpKCzE1qldNGx`. Use the least-permissive scope available.
3. After the workflow is merged to `main`, run **Actions → Notion release evidence → Run workflow**. It will reconcile the last 10 qualifying CI runs. Review the database for SHA parity and correct links.
4. If `BUD_NOTION_TOKEN` is missing, the workflow emits a warning and **does not sync anything**. If Vercel token is missing, rows are labeled `NOT_CONFIGURED`, not `READY`.

## Sources and schema
- Notion database: https://app.notion.com/p/9988f50dd5c344a7993d5e4ba1f65902
- Notion data source ID: `09afce51-e031-41f3-9cd3-7b633be79cf6`
- Workflow: `.github/workflows/notion-release-evidence.yml`
- Runner: `scripts/sync-release-evidence.mjs`
- GitHub repo `budctx/bud-events-website`; Vercel project `prj_yYO1QeZoU8LSs6B56KcrVplxYa0u`.
- Notion API version `2025-09-03`: queries `/v1/data_sources/{id}/query`.
- A Vercel `READY` record means Vercel reported a same-SHA production deployment; it does **not** prove the custom domain serves that deployment or that real users can complete checkout.

## Security and operational rules
- The secret-bearing `workflow_run` workflow is on trusted `main` only. It does not checkout untrusted PR heads, execute PR artifacts or process user-supplied code. The GitHub token uses read permissions.
- Notion token is used solely for the evidence data source; never copy production OAuth/payment/API secrets.
- A failed provider API call fails the sync rather than forging evidence. A Vercel deployment absent from the latest 100 returns `NOT_FOUND` (not proof of failed deployment).
- Run ID deduplication avoids repeated pages from scheduled reconciliation. Unexpected duplicate rows fail closed. No `Manual Review` reset.
- **No auto approval**: human review and official Stage Gates remain separate. For QA sign-off capture browser, auth, Whop live validation, rollback, exact release and owner decision independently.
- Current integration uses GitHub Action repository secrets; this chat connection cannot set them. Until the secrets are configured, automation is **installed but inactive**.
- Never authorize real payments, refunds, keys or slot mutation as part of CI sync.

## Validation
- `node --check scripts/sync-release-evidence.mjs`
- `node --check` is executed in `Website checks` CI.
- Verify a first manual Action after secret setup; compare the resulting Notion row against GitHub run and Vercel deployment.
- Test re-running the workflow and confirm a single Notion row for the same run ID.
- Compare scheduled results to the newest main deployment and report any `NOT_FOUND` or `ERROR` as **unverified**, not automatic incident resolution.
