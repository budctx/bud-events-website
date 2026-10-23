# BU’D implementation guidance for coding agents

These instructions apply to the active GitHub `main` codebase. They do not replace Expert Department OS's original department instructions.

1. **Decisions:** latest explicit owner approval → Notion decision registry/Stage 00 → current approved spec → current approved website/code as visual authority and implementation evidence → legacy archives only for historical comparison. ADR-005 and the owner explicitly adopt Code-first without Figma.
2. **Product:** BU’D is a multi-product platform. Maintain Home, Events, Bots and Designs galleries. `سؤال وشرط` is first demo. Do not restore a participant UI, bot integration, legacy participant state machine, Dark Mode, ghost CTAs, or stale sample testimonials.
3. **UX:** current Light-only visual language, Readex Pro, official BU’D assets, RTL/LTR AR/EN, mobile/desktop, fit-to-viewport (no critical clipping), accessible focus/keyboard and reduced motion. Develop reusable components against the current site and owner references; do not return to Figma.
4. **Backend:** sandbox Supabase `bud_platform` contract is not billing go-live. Purchasing/Whop/Discord OAuth are intentionally disabled. Never activate charges, fake success, public RLS access, or service secrets in client code.
5. **Process:** use a narrow feature branch and PR. Verify `npm run typecheck:server`, `npm run build`, `npm test`, verify visual parity for UI-affecting changes, record exact SHA + run evidence in Notion. Stage gates are not auto-closed by CI.
6. **Cleanup:** avoid regenerating previous art, deleting archived approvals or rewriting history. Retired code is recoverable from Git before the 2026-10-22 hygiene commit. Treat `docs/implementation.md`, `docs/verification.md`, `docs/bot-impact-study.md` and closed legacy PRs as archive, not requirements.
7. **Publishing:** GitHub `main` auto-deploys to https://bud-events-website.vercel.app, so merging a PR is a production release. Enforce successful CI and appropriate approval. Branch protection ruleset remains an admin setup item; do not claim it active until verified.

Reference: https://app.notion.com/p/401b475e25f18133bdedc0fab9ee1287
