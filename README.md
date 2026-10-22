# BU'D — Discord-first digital products platform

This repository hosts the BU'D **development Preview** and the first playable **Question & Condition / سؤال وشرط** event rehearsal. BU'D is a multi-product platform with Events, Bots and Designs galleries; it is not a single-game homepage.

## Review the Preview

- [Preview deployment (first production branch build)](https://bud-events-website-6hknms09l-budctx1-8956s-projects.vercel.app)
- [Development PR #3](https://github.com/budctx/bud-events-website/pull/3)
- [Acceptance evidence](docs/BUD_VERIFICATION_REPORT.md)
- [Current approved spec](docs/BUD_CURRENT_APPROVED_SPEC.md)

Browse the landing page and galleries in Arabic or English. Open the **سؤال وشرط** product modal and click **جرّب العرض / Try the demo** to use the *local, unpaid rehearsal*.

### Host-operated game

1. Enter event name, choose 1–3 attempts and optionally set a custom timer in the **3–30 second** range.
2. Enter the prizes (one per line), then start the local event.
3. Flip each question/condition card separately; when enabled, the timer begins after both are revealed.
4. Listen to the spoken answer externally, then mark **correct** or **incorrect**. **After** a correct answer, enter the winner's display name in the dialog.
5. Continue through prizes and closing. There is **no** participant registration, participant tracking or Discord bot.

The demo does not persist authoritative events, spend paid Slots, authenticate users, fulfill purchases or award verifiable prizes. Demo data is illustrative, not a production question bank.

## Development

Node.js 24 is configured on Vercel.

```sh
npm ci
npm run build
npm run typecheck:server
npm test
npx playwright install chromium
npx playwright test tests/browser/production.spec.ts
```

For design comparison, see [Figma component matrix](docs/BUD_FIGMA_COMPONENT_MATRIX.md) and [visual evidence](docs/evidence/). Retain approved Light-only identity, AR/EN and reduced-motion behavior.

## Backend and deployment boundaries

- An **isolated BU'D Supabase development** schema `bud_platform` was applied on 2026-10-22; this is not a commerce go-live. See [backend contract](docs/BUD_BACKEND_CONTRACT.md).
- Discord OAuth is disabled; Vercel secrets are not configured. The payment endpoint and Whop webhook intentionally fail closed.
- Real purchase fulfillment, provider verification, multi-connection security tests, payment policies, Figma visual acceptance and final compliance gates remain **OPEN**.
- Never treat a successful Preview build or passing unit suite as approval to merge to `main`, promote production, activate billing or close Notion Stage 00.

Notion is the progress standard; see the [Stage 00 gate](https://app.notion.com/p/401b475e25f181909556f65d42e19590). Historical flows and old PR #2 remain archived; they are not the current product spec.
