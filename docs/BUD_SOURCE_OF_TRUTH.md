# BU'D — source of truth and execution basis

> **CURRENT STATUS ADDENDUM — 2026-10-22:** The verified targets section below records the **historical first-audit baseline** (when `main` was README-only). It is not the current deployed state. The owner's later explicit publication approval supersedes the initial Preview-only limitation **for the website frontend only**. At the Stage 00 restart, current GitHub `main` was `8a60944f05718ffa2476aae7e7791eedd5fa0f5c`; Vercel Production matched that SHA; tests passed. [Scoped release approval](https://app.notion.com/p/401b475e25f181db9c0dd509e7c1c856) · [Current Stage 00 audit](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c). Discord OAuth, Whop real payments and commercial go-live remain **NOT APPROVED**. Do not re-run or reinterpret historical branch/reset/setup instructions as current tasks.

> **NEW VERIFIED DEVELOPMENT BASELINE — 2026-10-22:** After the owner requested removal of premature database setup, **both** BU'D application schemas `bud_private` / `bud_platform` and their 12 empty tables plus four BU'D public functions were removed from **development**. Supabase project `cepmvqqrjcvhyzszqand`, auth/storage, and migration history preserved; it remains ACTIVE_HEALTHY. Applied reset `20261022113143_stage00_reset_legacy_dev_schemas`. Original six-table statements below are historic snapshots, **not current implementation**. GitHub old migration files must not be automatically replayed. [Verified reset record](BUD_SUPABASE_STAGE00_DEV_RESET_20261022.md) · [Stage 00 owner ADR-001/002/003](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c). Current cap: 4 hours, no Slot cost for same-session resume, persistent Game History, centralized Timer Manager. None is a verified running backend after reset.

Version1.0 ·2026-10-22. Project: BU'D — Platform Production. User confirms a new project; ChatGPT memory mode UNKNOWN, strict isolation not asserted. Earlier conversation memories are not specifications.

## Operating specification

Use original Expert Department OS complete AUTOBOOT v1.6.9:
https://drive.google.com/file/d/1UL2VU4Hw8b0_H1yp9GDQeKLTOSOSs-yB/view

Release verification:1NZmiUmXdDnA9js-Mqt9n0hk_044HPE1x. It reports121/121 runtime tests and9/9 mutation probes, **not rerun here**. ChatGPT host certificate1oLeQjXuc1q3rc8Cx_prfFDU6U24RGyB4 explicitly NOT_CERTIFIED. This run follows native Manager/lifecycle/expert/evidence/gate modules through actual tools; it does not claim machine enforcement or invent departments. v1.7.0 is an unintegrated overlay; v1.7.1 candidate directory returned empty.

## Project authority hierarchy

1. Applicable host/platform/tool constraints.
2. Latest explicit owner decision for exact scope, with source/date.
3. Latest owner-approved Figma or original game for visuals, subject to newer owner changes.
4. Reconciled PRD/Registry functional/security policy.
5. Verified current Notion stage/gate/test/decision records.
6. Existing code, branches and database as historical evidence.
7. Old chats, memories and unapproved explorations for discovery only.

Expert OS governance is read from the original file, not replaced by this project hierarchy. For conflicts: record old/current source and scope; use explicit newer owner direction; halt only unresolved affected feature; progress independent scoped work; reopen dependent validation after material change.

## Verified targets

- Repo budctx/bud-events-website. main4acd3035378d8ed884ea6f73ec3758709a4cedb3 is README-only.
- New branch feat/bud-platform-production-20261022 based on feat/figma-foundations fbd5654dad1982012bd9086bd95b4068718bc3ac. This preserves useful code, not visual approval.
- Preserve draftPR2 c56b3a637b38a55f8df133bd879034595ec63e89 and its branch.
- Vercel bud-events-website prj_yYO1QeZoU8LSs6B56KcrVplxYa0u; existing SSO protection preserved; Preview only.
- Supabase cepmvqqrjcvhyzszqand (BU'D Development):6 empty private tables, RLS on, anon/authenticated schema USAGE/CREATE denied; no functions/migrations observed. Legacy participant/timer schema must not be connected unchanged. Discord provider disabled; Vercel env inventory empty. No secrets printed.
- Notion command center: https://app.notion.com/p/401b475e25f18133bdedc0fab9ee1287
- Handoff and source dates: see BUD_CURRENT_APPROVED_SPEC.md.

## Scoped readiness and quality

Native OS S0–S9 govern each execution unit separately from project stagesS01–S14 and cross-stageGate00. Read-only source audit/isolated branch setup authorized; faithful frontend execution requires retrieved high-fidelity contexts and exact assets. Backend code may be developed without applying migrations or enabling live payments. Missing providers/config/policy keeps live integration blocked, never simulated as success.

DoD: faithful responsive Home/Gallery; reusable honest Product Modal; original-style manual game; no legacy participant routes; server-only entitlement contracts; meaningful tests, keyboard/RTL/LTR/short-height/reduced-motion/screenshots, exact commit, independent review, Vercel Preview verification and Notion readback. No closure until all applicable criteria and owner gates pass.

Detailed governance input recovered from BUD_NOTION_CODEX_GOVERNANCE_FULL_v1.0.zip, Library libfile_42eb81326f80819184ba78e2999d0ceb:140 gates,73 tests,14 stages,14 approvals,10 sources. These are requirements, not execution proof. No formulas alone may be described as preventing manual stage edits.
