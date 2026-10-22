# BU'D — current approved specification

Version: 1.0 audit baseline · 2026-10-22 (Asia/Riyadh). Owner: BU'D project owner. Status: source reconciliation in progress; **not production acceptance**.

## Source identifiers

- H: https://app.notion.com/p/401b475e25f18196b002dc29e039666f — Handoff v1.0, last edited 2026-10-22T08:23:31.434Z; fetched this run.
- G: https://app.notion.com/p/401b475e25f181909556f65d42e19590 — Gate00, last edited before audit 2026-10-22T08:22:11.310Z.
- D: https://app.notion.com/p/401b475e25f18148b0f2cdfcb882f76e — provisional baseline, last edited 2026-10-22T08:21:34.558Z.
- F: https://www.figma.com/design/STOmHGc7E9OQudKbyWDEli — current live Figma; Home339:2068 and339:2070; gallery383:11100 and383:11923. Node IDs are stable identifiers, not immutable version IDs. Version history/owner acceptance receipt remains to verify.
- O: https://bud-qc-xi.vercel.app/ — original game inspected in cloud browser on2026-10-22. Live URL is mutable; observations below are not owner approval of every behavior.
- B: https://docs.google.com/document/d/1aeyp5rHDzVzG_IZi7fbHrOVBT133aiwxHSouyBxUVTY/edit — Buyer Journey20Oct; contains older proposals; latest H overrides conflicts.

## Current requirements

| ID | Current rule and scope | Authority/date | Evidence | Confidence |
|---|---|---|---|---|
| CUR-001 | BU'D is multi-product Discord-community brand; Q&C is first playable product only. Home must reproduce current approved Figma. | Owner20–22Oct | H,G,F | High on scope; visual acceptance pending |
| CUR-002 | Events/Bots/Designs use reusable Gallery→Product Modal→CTA. Clearly distinguish upcoming/unavailable; no fake checkout. | Owner22Oct | H,D | High; exact modal geometry not in current frames |
| CUR-003 | Public browsing requires no login. Purchaser/host Discord auth occurs at Buy Now before payment. | Owner20–22Oct | H,G,B | High |
| CUR-004 | No bot, participant accounts, attendance, registration, selection or tracking. Store manual winners only. | Owner20–22Oct | H,G,B | High |
| CUR-005 | Host marks Correct first, then enters winner name in a modal. Names must never imply verified Discord identity. | Owner20–22Oct | H,G,B | High |
| CUR-006 | Four phases: setup→event→prizes→closing; spoken answers, manual judgment; one prize per line. | Owner/Handoff22Oct | H and original O observation | High |
| CUR-007 | Optional timer, custom seconds. Starts only after both cards revealed. Original slider min3/max30/default5 inspected through DOM; adopt as reversible preview bounds pending owner-bound confirmation. | Owner custom seconds22Oct; O observation22Oct | H,G,O | High availability; medium final bounds |
| CUR-008 | Product play-count Slots: verified purchase +1, new event start −1 exactly once, resume no charge; server authority required. These are not stored money. | Owner20–22Oct | H,B | High |
| CUR-009 | Light only, Readex Pro, official vector emblem. #333333,#FBB03B,#F6F0E2,#E6E6E6; cards/containers #FDFDFF. Retro Modern/Arcade75% + Gaming25%. | Owner/Handoff22Oct | H,G,F | High |
| CUR-010 | Fit viewport without clipped controls; overflow available where needed. AR/EN, RTL/LTR, keyboard, focus restoration and reduced motion. | Owner22Oct | H,G | High |
| CUR-011 | No fabricated partners/testimonials. Current Figma contains sample placeholders; preserve honest empty/sample states until real content supplied. | H explicit no invented endorsements | H + F current context | High |
| CUR-012 | Preserve archive, main, existing PR2, infrastructure; isolated feature branch; Vercel Preview only. No real payment/purchases/prod merge/release. | Owner22Oct | Current request,H | High |

## Open decisions and bounded execution

Historical240-minute limit, restart/grace/retention periods, final price/currency/tax/refund/Slot-expiry policy are not reapproved by silence. Commercial enforcement stays blocked. Duplicate winner names need a final policy; preview rejects exact normalized duplicates and labels this reversible implementation choice. Do not claim fully verified production acceptance.

The current source hierarchy and conflict list are adjacent documents. Gate00 stays OPEN until all its checks pass. A scoped engineering readiness decision may authorize independent reversible code only after the relevant sources are inspected; it does not close Gate00 or S05/S06/S07.
## Scoped owner update — Prize Draw UX (2026-10-22)

For the current prize UX request, the owner adopts the current site as the official visual reference and requires Code-first work without Figma. Winner names may repeat and are independent numbered records. Add the recipient sidebar, editable/deletable winner manager, confirmation before prize opening, and configurable celebration. See `BUD_PRIZE_DRAW_UX.md` for implementation and validation. Older Figma-first and unique-winner-name clauses are superseded within this scope; broader project gates are unaffected.

## Homepage and scoped production approval — 2026-10-22

The owner accepted the prize UX, requested a competitor-informed homepage clarity/responsiveness pass, explicitly requested regenerated higher-quality background art and official logos on both cards for mobile/desktop, and authorized direct upload/publication without returning for approval. Existing site identity and Code-first/no-Figma direction remain active. This permits release of these tested frontend changes, including the accepted prize UX, after CI/review gates; it does not authorize purchases or activation of disabled commerce. See `BUD_HOMEPAGE_REFRESH.md` for source observations, image provenance, implementation and validation.
