# بُعد — سؤال وشرط (Local Play Preview)

This repository contains a **single-browser host-operated rehearsal** of BU'D's first Discord event. It is not a real multi-user Discord service and does not charge or issue wallet credits.

## Try a complete round

1. Open the Vercel feature-branch Preview (not production), choose Arabic or English.
2. Enter an event name, set 1–3 attempts, and optionally enable a 5/7/10-second timer.
3. Enter zero to fifty prizes in one box, one prize per nonempty line, and start the event.
4. Choose one of the three example participants or use **Add a player for this preview / إضافة مشارك للتجربة** to type a new local participant name.
5. Choose manually or randomly. Tap the two white Question / Condition cards to flip them; the optional countdown starts only when **both** are revealed.
6. The host listens to the voice answer in Discord and clicks the accessible correct/incorrect icons. On an unsuccessful attempt, a new question-condition pair is drawn. Local pair combinations are shuffled without replacement until the cycle is exhausted.
7. Navigate to Prizes, select a qualified winner, confirm opening/assignment, then close and copy the **unverified** example results.

> This is a nonpersistent demo: participant identifiers are fictional, do not represent Discord user IDs, and must **not** be used to fulfill real prizes. Browser refresh may lose all gameplay state. The demo bank is small and is **not** the production question bank.

## Development

Node 24:

```sh
npm ci
npm run dev
npm run build
npx playwright install chromium
npm test
```

For clean Figma comparison: `/?canvas=1&lang=ar&theme=light`.

## Authoritative design and release boundaries

Owner-approved Figma Page 10 is the live game layout source. Figma Page 08 contributes white cards, emblems, flip and optional-timer states. Reuse existing Figma components first; never create a new visual asset from scratch without the owner's separate explicit consent. New work is **Light only**; Dark development is suspended.

Project's four activity phases: Setup → Event Screen → Prizes → Closing. See [implementation notes](docs/implementation.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

**Not connected:** authenticated Discord OAuth host/attendees, live Stage/bot, a verified BU'D Supabase project with tenant RLS and authoritative data, server question deck/clock/control lease and recovery, Whop top-ups/credits, verified winner identities, persisted seven-day results, email or production integrations. This PR cannot be merged or deployed to production as playable commercial SaaS before these integrations and connected E2E/security/a11y tests pass and the owner approves the result. Until then it is **ready for a local rehearsal only**.
