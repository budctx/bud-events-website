# Public platform shell — first Codex batch

2026-10-22. Parent baseline: `feat/figma-foundations`, commit `fbd5654dad1982012bd9086bd95b4068718bc3ac`.

## Scope
- `/?screen=site` adds an Arabic RTL / English LTR Light-only one-viewport public platform shell with home, events, bots and designs.
- Brand uses the previously committed `public/assets/bud-emblem.svg` plus Readex Pro and approved BU'D palette.
- Home has one interactive Question-card visual. This is a marketing micro-interaction, not a question draw, timer or session.
- Events links to the existing nonpersistent `/?lang=ar|en` local rehearsal.
- Bots/Designs are explicitly marked future and offer no active checkout.
- Accessible nav controls, reduced-motion media feature, visible focus and screen-aware layout.
- No new npm dependency. The local four-phase game and foundation preview remain unchanged.

## Scope boundaries
- Not connected to Discord, Supabase, Whop, a bot or real participant identities.
- No invented customer reviews, integrations, legal commitments or brand illustrations.
- Existing references are a study library in Notion, not a component license.
- Verify actual viewport layout with browser tests before any Ready-for-merge status; CSS fit constraints are design intent only until tested.

## Acceptance checklist
- [ ] npm ci and npm run build PASS on exact commit
- [ ] Existing npm test regression PASS
- [ ] 360×800 / 375×667 / 390×844 / 1366×768 / 1440×900 browser screenshots and clipping audits
- [ ] AR/EN and navigation/href tests
- [ ] Keyboard and reduced-motion checks
- [ ] Vercel preview deployment READY and rendered navigation verified
- [ ] Independent review and Notion evidence linked
