# BU'D — Codex execution brief (2026-10-22)

## Authority and scope
- One-game MVP: «سؤال وشرط». Four phases: إعداد الفعالية → شاشة الفعالية → الجوائز → الختام.
- Implement in safe feature branches and Vercel preview; never overwrite the local playable journey or production without verified acceptance gates.
- Notion command center: https://app.notion.com/p/401b475e25f18133bdedc0fab9ee1287
- The owner approves Codex-first implementation. Figma is used for visual investigation and review only when needed.
- Light only. Palette #333333, #FBB03B, #F6F0E2, #E6E6E6 and white containers #FDFDFF. Readex Pro. Existing emblem/vector assets only.
- Every page fit within viewport as designed, with access to every control on short/tall mobile; no cropped controls. Respect reduced motion.
- Search → Evaluate → Reuse → Customize → QA → Create Only If Necessary. Do not synthesize new brand marks/icons.
- Implement Arabic RTL and English LTR equally. Do not fabricate available products, partners, reviews, account/session/payment or Discord integrations.
- Do not confuse mock data with production Discord IDs or payment states.

## Workflow
1. Inspect existing repository and latest approved product decisions before making changes.
2. Work in an isolated branch, preserve main and previous feature branch.
3. Implement smallest complete increment; typecheck, build, browser-test 360×800, 375×667, 390×844, 1366×768 and 1440×900 and AR/EN; test keyboard/focus and reduced motion.
4. Record test commands and actual result. Never mark PASS without execution.
5. Push reviewed commits, open a PR, review Vercel preview; log evidence and blockers in Notion. No automatic merging or production publishing with unverified backend/financial/security gates.
6. Before genuine Supabase integration, identify a project dedicated to BU'D; do not repurpose ATHAR or historically ambiguous B3D. RLS and authorization are mandatory on all exposed tables.
7. Require explicit approval for new paid subscriptions, live payment acceptance, public launch or other irreversible acts even when routine development autonomy is granted.

## Current split
- `/?screen=site` — public platform shell, initial functional visual batch (noncommercial).
- `/?lang=ar` — preserved local four-phase gameplay rehearsal, never a production session.
- `/?screen=foundation` — historical component foundation specimen.
- No live OAuth, WebSocket sync, Discord attendance, bot, Supabase/Whop wallet, or verified result retention is claimed.

## Execution evidence
- Baseline: `feat/figma-foundations` @ `fbd5654dad1982012bd9086bd95b4068718bc3ac`.
- Change: new public platform site route with AR/EN, brand, navigation, limited interactive card, mobile fit and reduced motion.
- All backend and payment gates remain NOT VERIFIED.
