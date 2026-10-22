# BU'D — Expert OS × Notion × GitHub automation
Owner approved: 2026-10-22

## Authority and boundaries

Notion is the official source of the project stages, detailed test cases and owner approvals. Expert OS coordinates execution and evidence reviews; GitHub handles code, CI, merges and status checks. The current official website is https://bud-events-website.vercel.app.

Owner decision: https://app.notion.com/p/401b475e25f1811db036f561ace4a253

The 14 stages are not formally closed. Publishing the current Home and rehearsal is not full SaaS launch approval, payment authorization, or a substitute for Stage 00 acceptance.

## CI evidence automation — prepared, not active without credentials

Files:
- .github/workflows/notion-evidence.yml
- scripts/sync-notion-ci.mjs
- tests/notion-evidence.test.ts

A completed trusted push-to-main "Website checks" run triggers a separate post-CI evidence workflow. It only creates an idempotent "Historical evidence" record in the existing Notion Stage Tests data source with:
- Exact run URL, commit SHA, run/attempt identity, outcome and date
- Honest PASS / FAILED / IN REVIEW derived from CI conclusion
- NO Stage relation and no changes to detailed tests, owner approvals, gate results or official stage status

This evidence is about repository CI only. Mapping individual Notion acceptance cases is a separate reviewed step.

**To activate securely**, authorize a least-privilege Notion integration for the existing test data source and add two GitHub Actions secrets under repository Settings > Secrets and variables > Actions:
- BUD_NOTION_TOKEN — Notion integration secret
- BUD_NOTION_TESTS_DATA_SOURCE_ID — existing test data source UUID (not a new database)

Until both exist the workflow logs a notice, performs no writes and must not be called synced. Never put a token in source files, screenshots, public logs, website client env or chat. Test one real main CI event and read the exact evidence row back before marking this integration verified.

## Main branch protection — approved, not enforced by this tool connection

The GitHub connector returned a 403 on reading branch protection and offers no ruleset mutation capability. A GitHub repository administrator must configure and independently verify protection:
1. Open repository Settings > Rules > Rulesets > New branch ruleset.
2. Target only refs/heads/main.
3. Require a pull request and required check **verify** from "Website checks".
4. Block force pushes and deletion; avoid broad bypass.
5. Validate by attempting to merge a failing PR (it must be blocked).
6. Treat the post-merge Notion evidence writer as reporting, never as a pre-merge required check.

GitHub docs: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets

## Acceptance

- [x] Owner approval recorded in Notion.
- [x] Isolated workflow/script/tests source committed to a feature branch.
- [ ] GitHub CI validates the new change on its exact SHA.
- [ ] Automation PR reviewed and merged.
- [ ] Actions secrets added privately and a real Notion evidence record confirmed.
- [ ] Main ruleset enabled with evidence of a blocked failing merge.
- [ ] Detailed case-to-test mapping separately reviewed before any auto-PASS.
- [ ] Stage closures remain evidence/QA/owner-gated.

## Progress snapshot at adoption

Formal stage closure: 0/14. Detailed gate PASS: 0/140. Detailed Notion acceptance test PASS: 0/73. Historical test evidence: 3 PASS (not interchangeable with detailed cases). Baseline: S01 and S03 discovery closed, S02 conditional review, S04 specification closed, S06 design in progress. Development increments exist across S07–S11 without full stage signoff. UI is live on main, while real Discord OAuth, Whop payments and production-grade connected security/QA are blocked.
