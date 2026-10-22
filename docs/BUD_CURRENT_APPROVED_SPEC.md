# BU'D — current approved specification

Version: 1.2 owner-policy reconciliation · 2026-10-22 (Asia/Riyadh). Owner: BU'D project owner. Status: Stage 00 reconciliation in progress; **official frontend publication approved, commercial SaaS not accepted**.

## Operational checkpoint

The later owner decision to use only the current official website supersedes the earlier *Preview-only* release restriction **for the frontend alone**. Current production source is GitHub `main` commit `8a60944f05718ffa2476aae7e7791eedd5fa0f5c` as audited in Notion; the exact SHA can change through reviewed subsequent PRs. Stage 00 remains OPEN and payments remain disabled. [Working reconciliation audit](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c).

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
| CUR-013 | One shared Event Engine Timer Manager is the single owner of timer state/clock/configuration; individual templates supply supported events/triggers and expiry behavior, not duplicate timers. Exact template timer duration bounds need separate acceptance. | Owner22Oct, S00-ADR-001 | [Stage00 decision](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c), F metadata316:508 | High architectural; not implemented |
| CUR-014 | Session Manager in shared Engine: maximum session lifetime 4h (240m); same interrupted session may resume without consuming another Slot. Only initial new session starts debit once. Wall-clock behavior while disconnected not final. | Owner22Oct, S00-ADR-002 | [Stage00 decision](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c) | High policy; not implemented |
| CUR-015 | Persistent Game History grid per host: activity name/type, date, time, status and Copy Summary matching closing's winner — prize list. No automatic 7/30-day results TTL. Respect separate privacy/erasure and financial-log rules; don't duplicate summary text storage unnecessarily. | Owner22Oct, S00-ADR-003 | [Stage00 decision](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c) | High policy; privacy implementation pending |
| CUR-016 | Development Supabase was reset before final database architecture: two historical BU'D schemas and their 12 empty tables + four obsolete RPCs removed. Project/auth/storage preserved. Do not replay old migrations or connect payments until S07/S08. | Owner22Oct, executed reset | [Verified reset](BUD_SUPABASE_STAGE00_DEV_RESET_20261022.md) | Verified dev action; no final DB |
| CUR-012 | Preserve archive, legacy branches, development infrastructure. Official BU'D **frontend only** is owner-approved on GitHub `main` and Vercel Production; further changes use reviewed feature PRs. Real purchases, payment activation, Discord OAuth and commercial SaaS go-live remain disallowed until separately verified and approved. | Owner22Oct later explicit release approval | [Notion approval](https://app.notion.com/p/401b475e25f181db9c0dd509e7c1c856), [PR #4](https://github.com/budctx/bud-events-website/pull/4) | High for scoped website release only |

## Open decisions and bounded execution

The 240-minute session maximum and same-session resume without Slot cost are **now owner approved**, and a Game History without automatic retention expiration is approved. Historical 7-day prestart/restart grace/60-minute restart provisions, exact clock semantics during disconnect, timer default/bounds, final price/currency/tax/refund/Slot-expiry policy remain unresolved. The Figma D01/D02 setup frames still display old 5/7/10-second presets; these require revised S05/S06 acceptance rather than silently imposing obsolete product rules. Commercial enforcement stays blocked. Duplicate winner names need a final policy; preview rejects exact normalized duplicates and labels this reversible implementation choice. Do not claim fully verified production acceptance.

The current source hierarchy and conflict list are adjacent documents. Gate00 stays OPEN until all its checks pass. A scoped engineering readiness decision may authorize independent reversible code only after the relevant sources are inspected; it does not close Gate00 or S05/S06/S07.
