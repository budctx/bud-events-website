> **ARCHIVED — historical implementation evidence only (superseded on 2026-10-22).** Participant registration/tracking, Discord bots and Dark Mode in this document are **not** current BU’D requirements. See [current approved spec](BUD_CURRENT_APPROVED_SPEC.md), [superseded decisions](BUD_SUPERSEDED_DECISIONS.md) and [archive manifest](BUD_REPOSITORY_ARCHIVE.md). Preserve historical details for traceability; do not implement them as live features.

# Verification — local journey batch

2026-10-14; baseline parent a91109217abc27f74544b8990fa22c01f556a7b9, branch feat/figma-foundations. This report covers the new local journey, not a connected service.

- Root production build/typecheck: PASS.
- Root state tests:12/12 PASS (9 event-core,3 challenge).
- Root Chromium:35/35 PASS (20 journey,15 preserved foundation).
- Independent reviewer /root/journey_qa: build,12/12 state,20/20 journey browser PASS; no observed P0/P1 in covered local flow.
- Scope: setup validation/locking,0–50 prizes, all50 editors reachable, new-only random/manual loser re-entry, capacity no-winner confirmation, immutable award/open-unassigned commits, first-open locks, warning/cancel state preservation, final order/minimal local results, strict once-only restart.
- UI: AR/EN×Light/Dark at320/390/1440 widths; targeted fit viewport at320/390×844 and1440×900; long prize content, keyboard confirmation Tab/ShiftTab/Escape and focus restore, reduced motion, native asset loading/geometry, preferences persistence.
- Fixed independently reported defects: lost completed result order, false qualification at capacity, native modal boundary focus leak,320px editor overflow, mobile active Live overflow and long opened-prize overflow.
- Exact native Light/Dark gift SVG roots are32×32 and extend the existing16 assets; no temporary Figma asset URL in runtime code.
- Root rendered AR mobile Setup/Live compared with Figma. Adaptive pagination/compact host controls are documented functional layout adaptations, not a claim of exact pixel identity for every state.

Local browser is Chromium153 from a temporary test-only package at /workspace/scratch/27fae539779e/browser-check/chromium, not an application dependency. GitHub Actions uses standard Playwright installation. New-commit CI/deployment evidence is recorded separately after retrieval.

NOT TESTED: backend auth/RLS, Discord verified identity, real bank draw cycles, server time/leases/recovery/concurrency, Whop charges/webhooks/ledger,7-day operational retention/deletion, Resend email/bot, full WCAG/zoom/short-height viewport certification. Local identifiers never stand in for verified Discord IDs. No production release or PR merge is authorized by these results.

## Actual team

Root: integration lead, Figma reads/exports, UI/CSS, local browser checks and release documentation.
/root/contracts_review: independent current contract review (read only).
/root/event_core: pure local event reducer and state tests.
/root/services_inventory: actual resource inventory (read only).
/root/journey_qa: independent implementation/test review (read only).

Expert OS policy coordination only; this is not a claim of installed/certified Expert OS runtime.

## Latest light refinement evidence — supersedes prior batch counts

Root build/typecheck PASS;19/19 state tests and17/17 Light journey browser tests PASS. Independent /root/refinement_qa repeated build,19state,17Light browser: scoped PASS, no remaining P0/P1 observed. Figma-only-before-code authoring and independent light AR/EN mobile/desktop bounds/contrast checks PASS. Fixed timer row parentage, mobile/desktop page fit,100W full prize-face containment. Native icons reused; no new raster/temporary URLs.

No Dark designs/tests maintained in this batch. Default test command is the current Light journey; historical Foundation tests remain as prior evidence. No full OAuth, actual no-bot deployment/server journey, real Stage attendance, bot permissions, or80-character production recipient validation. CSS flip is functional; Figma motion readback is structural only (export download unavailable). Root remains integration lead; /root/prize_lines parser/core implementation; /root/bot_study official-source study; /root/refinement_qa independent read-only final QA.
