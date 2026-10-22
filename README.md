# BU’D — Official Discord-first Digital Products Website

**Canonical production:** https://bud-events-website.vercel.app  
**Source of truth for decisions, approvals, and stage gates:** [BU’D Project Command Center in Notion](https://app.notion.com/p/401b475e25f18133bdedc0fab9ee1287)

BU’D is a Saudi Discord-first digital products brand. The official website includes Home, Events, Bots and Designs galleries, with a reusable product-detail modal. **Question & Condition / سؤال وشرط** is the first event demo, not the entire brand or a live paid service.

## Current approved experience

- Light-only, Retro Modern/Arcade identity, Readex Pro, AR/EN with RTL/LTR, responsive layouts and reduced-motion support.
- Public browsing. Product CTAs may show coming-soon or unavailable integration states.
- Local unpaid host-operated Question & Condition rehearsal: setup → flip question/condition cards → host correctness decision → winner-name dialog → prizes → closing.
- **No Discord bot, participant registration/tracking, verified participant identity, or production Dark Mode.**
- Discord purchaser OAuth, Whop checkout, paid Slots and authoritative server-side gameplay are **not enabled**. Never simulate a successful charge or entitlement.

## Work on the repository

```sh
npm ci
npm run typecheck:server
npm run build
npm test
```

`npm test` runs the current unit suite and browser production tests. Browser runs require Playwright Chromium; locally, first run `npx playwright install chromium`. Do not use superseded browser suites as release criteria.

Work in a feature branch, open a PR, and require green **Website checks / verify** before merging. Deployments are managed by the connected Vercel project. **Main branch protection still requires admin ruleset configuration and independent verification**; GitHub CI passing does not itself enforce merge protection. Do not bypass failed checks or treat deployment `READY` as formal Stage approval.

## Architecture & project records

| Item | Authoritative reference |
| --- | --- |
| Current decisions | [Approved spec](docs/BUD_CURRENT_APPROVED_SPEC.md), [superseded decisions](docs/BUD_SUPERSEDED_DECISIONS.md) |
| Front-end visual evidence | [Figma mapping](docs/BUD_FIGMA_COMPONENT_MATRIX.md), [verification report](docs/BUD_VERIFICATION_REPORT.md) |
| Server contracts & environment | [Backend contract](docs/BUD_BACKEND_CONTRACT.md), `supabase/migrations/` |
| CI → Notion historical evidence | [Governance automation](docs/BUD_GOVERNANCE_AUTOMATION.md) |
| Historical branches and files | [Archive manifest](docs/BUD_REPOSITORY_ARCHIVE.md) |
| Notion Stage 00 | [Decision reconciliation gate](https://app.notion.com/p/401b475e25f181909556f65d42e19590) |

The historical `docs/implementation.md`, `docs/verification.md` and `docs/bot-impact-study.md` are archive evidence, **not current implementation instructions**. Retired participant-based code and tests were removed from active files but are recoverable from Git history. Historical drafts should never override current owner decisions or Notion approvals.

## Security and delivery boundaries

- Do not commit secrets; use CI/hosting secrets with the minimum access required. `.env*` and `supabase/.temp` are gitignored.
- The Notion evidence publisher may write **historical run records only** when secrets are configured. It does **not** auto-PASS detailed tests or close stages.
- A production front-end release was approved by the owner on 2026-10-22. **Stage 00 and all 14 official stage completion gates remain open** until separately verified and approved.
- Preserved older branches, original assets and prior releases are references/rollback history, not alternate official BU’D websites.

## Licenses

See [third-party notices](THIRD_PARTY_NOTICES.md) and [license files](licenses/).
