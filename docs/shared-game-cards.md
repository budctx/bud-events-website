# Shared gameplay cards in the public sample — 2026-10-22

Owner correction: the Events sample must use the actual gameplay card design, replacing the separately designed gold/dark fronts.

`GameCard.tsx` and `game-card.css` now supply both `Game.tsx` and `EventPreview.tsx`: original dark backs, Q/C circles, corner emblems on both faces, white revealed faces, title/footer labels, amber/blue accents, hard shadows and420ms flip. Host card JSX/styles are extracted rather than duplicated. Size-based container queries adapt the original compact gameplay styles to narrow cards; RTL order and logical corners match gameplay. Revealed content is associated through aria-describedby.

The sample's fixed pair, five-second circular timer and replay behavior remain. Public builds still exclude the full host workspace. No host reducer, purchase or entitlement changes are included.

Validation: application build and server typecheck;34 logic/backend tests and48 browser journeys in the full release suite. The9 sample tests pass against built production, including a new same-width computed-style comparison against the development host cards. Six AR/EN viewport cases assert that card content stays clear of its title/footer. Independent Expert OS review found a320px English collision caused by inherited28px line height; explicit compact title/footer line heights fixed it. Rechecked AR/EN320px: at least14px above body text and5.2px below; final PASS. Other reviewed sizes:1440px/390px, with no overflow or host-specific bundle markers.

Visual evidence: `docs/evidence/shared-game-cards/`. Exact candidate CI and deployment evidence is recorded in the associated GitHub PR. No Notion write or wider stage sign-off is included.
