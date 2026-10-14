# Figma implementation — local event journey

2026-10-14. Source file `STOmHGc7E9OQudKbyWDEli`.

| Template | Desktop RTL | Mobile RTL |
|---|---|---|
| Setup Basics | 104:80 | 104:82 |
| Setup Prizes | 104:84 | 104:86 |
| Prizes | 104:92 | 104:94 |
| Closing | 104:96 | 104:98 |

The previous Live foundation is preserved. React/TypeScript/Vite, plain semantic CSS, self-hosted Readex Pro and shared Button/Icon components remain unchanged. No new application dependencies. Exact native prize glyphs were exported from existing Light/Dark nodes after the temporary asset URL returned HTML; source IDs and dimensions are in figma-assets.json. Existing Lucide/SDS licenses apply.

The default page now starts blank Setup and supports the complete local four-phase event journey. Configured durations 5/7/10, attempts 1/2/3, and 0–50 filled prize definitions lock at start. Explicitly local fixture participants support manual new/previous-loser selection, new-only random selection, immutable qualification order, capacity confirmation and success without prizes.

Prize opening requires confirmation, commits an assignment or permanent unassigned opening, clears the recipient selection and permanently locks gameplay return/restart. Closing warns about unopened gifts, can return to Prizes before final end, and confirmed end preserves only local actually awarded winners/prizes in original qualification order. The copied example list explicitly labels unverified local identifiers; it is not a production Discord handoff. User-entered copy text removes control characters and breaks mentions.

Restart is once, strictly before 60 minutes from original local first start, before any opening, outside Closing; zero-prize restart is Live-only. It returns blank Setup while preserving the original timestamp and consumed restart marker. These are local guards, not server authorization, payment clocks or concurrency guarantees.

Responsive paging: editors 3/page, gift cards 8 desktop /2 mobile /1 narrow (<370px); results 1/page to expose full allowed long content. These adaptations preserve the template primitives while fitting controls and full prize contents. Targeted 320/390×844 and1440×900 samples pass; reduced height/zoom may reflow rather than crop. Universal no-scroll and full WCAG certification are not claimed.

`/?lang=ar&theme=light` opens the journey. `/?screen=foundation&canvas=1&lang=ar&theme=light` preserves the isolated original Live specimen and its test-only preview controls. Display preferences are available on the journey; gameplay configuration cannot be changed after start.

## Services and release boundaries

No OAuth, wallet, entitlement, actual event creation, content-bank RNG/cycle reservation, API, database, retention job, payment webhook, emails or bot is connected. Fixture questions remain illustrative; a published compatible question/condition bank still needs server implementation/QA. Whop remains the approved payment provider.

Vercel preview project created for this exact repository: `prj_yYO1QeZoU8LSs6B56KcrVplxYa0u`, team `team_NMhh6HF2W1chpKCzE1qldNGx`. Deployment evidence is recorded in Drive after actual verification. No verified BU’D Supabase target exists; historical B3D/ATHAR resources are not presumed applicable. Resend account has no verified sender domain; Discord/Whop/Railway configurations are not established.

Next gate: project-specific Supabase/OAuth/payment resources, server commands and tenant/lease/idempotency tests, then actual connected Preview journey. PR #1 remains unmerged; owner review of the specific Preview and connected acceptance evidence precedes production.
