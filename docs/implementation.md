> **ARCHIVED — historical implementation evidence only (superseded on 2026-10-22).** Participant registration/tracking, Discord bots and Dark Mode in this document are **not** current BU’D requirements. See [current approved spec](BUD_CURRENT_APPROVED_SPEC.md), [superseded decisions](BUD_SUPERSEDED_DECISIONS.md) and [archive manifest](BUD_REPOSITORY_ARCHIVE.md). Preserve historical details for traceability; do not implement them as live features.

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

Responsive paging: one multiline prize input, landscape gift cards 2 desktop /1 mobile per page; results 1/page to expose full allowed long content. These adaptations preserve the template primitives while fitting controls and full prize contents. Targeted 320/390×844 and1440×900 samples pass; reduced height/zoom may reflow rather than crop. Universal no-scroll and full WCAG certification are not claimed.

`/?lang=ar&theme=light` opens the journey. `/?screen=foundation&canvas=1&lang=ar&theme=light` preserves the isolated original Live specimen and its test-only preview controls. Display preferences are available on the journey; gameplay configuration cannot be changed after start.

## Services and release boundaries

No OAuth, wallet, entitlement, actual event creation, content-bank RNG/cycle reservation, API, database, retention job, payment webhook, emails or bot is connected. Fixture questions remain illustrative; a published compatible question/condition bank still needs server implementation/QA. Whop remains the approved payment provider.

Vercel preview project created for this exact repository: `prj_yYO1QeZoU8LSs6B56KcrVplxYa0u`, team `team_NMhh6HF2W1chpKCzE1qldNGx`. Deployment evidence is recorded in Drive after actual verification. No verified BU’D Supabase target exists; historical B3D/ATHAR resources are not presumed applicable. Resend account has no verified sender domain; Discord/Whop/Railway configurations are not established.

Next gate: project-specific Supabase/OAuth/payment resources, server commands and tenant/lease/idempotency tests, then actual connected Preview journey. PR #1 remains unmerged; owner review of the specific Preview and connected acceptance evidence precedes production.

## Owner refinement — 2026-10-14, light only

Owner requested one input box with one prize per line, distinct colored landscape cards with flip, and bot-impact study; subsequently mandated Figma-first for every visual/design change and halted Dark Mode development. New journey defaults to Light and exposes only language preferences; the historical isolated Foundation specimen is preserved but excluded from this batch checks. No deletion or certification of prior Dark designs is claimed.

Figma page131:2: Mobile Setup131:111/517, Live131:146/552, Prizes131:225/631 (RTL/LTR); Desktop Setup138:422/526, Live138:445/549, Prizes138:496/600. Revised Basics140:576/652/728/796. Cards280×200 compact and352×252 desktop (~7:5, landscape playing-card proportion); question amber, condition charcoal with ivory foreground, prize ivory. Native icons are reused at32px, including an existing ivory glyph on the condition card; that glyph color is not Dark UI development.

Hidden/Revealed faces exist in both directions. Figma flip timelines133:374/412/449 model horizontal collapse/swap/expand over420ms plus hold; Reduced133:405/442/479 static. Figma does not expose3D transform fields; browser PlayingCard uses rotateY180/perspective,420ms, inert/aria-hidden inactive face and zero-motion instant alternative. The server/local commit never waits for an animation callback. Figma video export was attempted once but downloaded HTML, so rendered Figma motion playback is NOT VERIFIED. Long-prize variants144:754/760 use12px/18px Regular for >70 UTF16 code units, full100-character content retained; short content14px/22px.

Each nonblank trimmed line is one prize, duplicates remain distinct, CRLF normalized, count automatic0–50. More than50 or a name over100 code units shows an error, preserves the entire editable draft, and blocks Start. Valid replacement is atomic and locked after start. Restart/final end clear the raw draft. No independent numeric prize-count control.

Read docs/bot-impact-study.md: optional attendance adapter; full web-source path remains independent of bot installation/health. Actual Discord OAuth/backend connection remains pending. Proposed bot settings are recommendations, not newly approved product policy.
