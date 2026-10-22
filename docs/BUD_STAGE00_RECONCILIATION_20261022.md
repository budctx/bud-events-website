# BU'D — Stage 00 current-source reconciliation and evidence audit

> **S00-ADR-005 (2026-10-22):** Owner approved the current published website interface as visual baseline and discontinued Figma-first/required Figma approval. Figma materials remain archived provenance only. New screens (including Game History and custom timer input) use **shared responsive code components**, not a fresh Figma design. Remove immutable Figma acceptance/version as Stage 00 blocker; retain tested Preview/interactive QA, accessibility and functional correctness as gates. This latest owner decision supersedes earlier Figma parity and visual approval prerequisites in this audit. [Living Notion decision](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c).


**Date:** 2026-10-22 · **Status:** ACTIVE / OPEN (not closed) · **Governance:** Expert Department OS AUTOBOOT v1.6.9, original Google Drive source. The original OS verification report is documentary evidence, not host certification or proof of independent agents.

[Primary living audit and resolution table in Notion](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c) · [Gate 00](https://app.notion.com/p/401b475e25f181909556f65d42e19590)

## Working baseline and source precedence

- Owner's latest explicit decision in current applicable scope, then approved Figma for visuals, current reconciled PRD/decision log for functionality, verified Notion stage gates, and finally implementation code as evidence only.
- GitHub `main` at start of this audit: `8a60944f05718ffa2476aae7e7791eedd5fa0f5c`; current website is [BU'D production](https://bud-events-website.vercel.app), Vercel READY matching that commit. [Website checks green](https://github.com/budctx/bud-events-website/actions/runs/39763354291) on exact SHA.
- Owner's Oct 22 release permission for the frontend supersedes older preview-only text, **not** bans on activating Whop, Discord OAuth or paid sessions.
- Supabase development project `cepmvqqrjcvhyzszqand`: previously verified migration `20261022093928 bud_manual_commerce_contract` is present. No production commerce authentication or payment acceptance.
- Notion's existing 14 stages and detailed 140 gates/73 tests are authoritative for progress. GitHub CI green is historical evidence only, not automatic detailed PASS, QA approval or stage closure.

## Current source and visual evidence

| Screen/reference | Figma or source | Audit at restart |
| --- | --- | --- |
| Home Desktop | [339:2068](https://www.figma.com/design/STOmHGc7E9OQudKbyWDEli?node-id=339-2068) · 1440×900 | Screenshot retrieved; amber portal, CTA and proof/footer placement identified |
| Home Mobile | [339:2070](https://www.figma.com/design/STOmHGc7E9OQudKbyWDEli?node-id=339-2070) · 390×844 | Screenshot retrieved; CTA and visual hierarchy identified |
| Events Desktop | [383:11100](https://www.figma.com/design/STOmHGc7E9OQudKbyWDEli?node-id=383-11100) · 1440×900 | Screenshot retrieved; Q&C card, whitespace and CTA structure identified |
| Events Mobile | [383:11923](https://www.figma.com/design/STOmHGc7E9OQudKbyWDEli?node-id=383-11923) · 390×844 | Screenshot retrieved; stacked card and text/CTA identified |
| Original QC Figma | [314:2](https://www.figma.com/design/STOmHGc7E9OQudKbyWDEli?node-id=314-2) / 316:508 | Metadata confirms approved original playing-card references and *Correct → winner-name* note, no participant bot |
| Original live QC | [bud-qc-xi.vercel.app](https://bud-qc-xi.vercel.app) | HTTP 200 now; earlier interactive walkthrough in Notion is cited as historical. **Not re-tested interactively in this audit** |
| Current implementation | [main source](https://github.com/budctx/bud-events-website/tree/main) | Manual Game phases and host Correct → winner modal, optional timer 3–30, no active participant or bot route. UI pixel parity **not certified** |

The original Figma Home/Gallery screenshots are visual evidence, **not proof** of immutable Figma design version or final user acceptance for every modal, translation and placeholder.


## Approved owner decision — S00-ADR-002 (session maximum and free resume)

Owner approval 2026-10-22: **one session has a maximum lifetime of 4 hours (240 minutes); resuming the same interrupted session must not deduct another Slot.** This is a shared Event Engine / Session Manager responsibility, not a per-template implementation. The backend must enforce idempotent single debit for a newly started session and resume by the original session identity, with expiry and concurrency regression tests in S07–S11.

This approval does **not** resolve the legacy seven-day prestart window, 60-minute one-time restart, result retention period, or exact wall-clock accounting while a host is disconnected. Those remain separately open; 240 minutes + no-double-debit is an approved policy, **not a working/live authenticated session**. The latest decision is recorded in [Notion Stage 00 audit](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c), cross-referenced in existing S02-G05/G06 policy-review fields. No new release authorization implied.

## Owner decisions recorded during Stage 00 (2026-10-22)

- **S00-ADR-001** — Shared Engine / Timer Manager uniquely owns timing, time config and clock. Activity templates provide only triggers and activity-specific expiry policy. Do not infer final time input range from an architecture approval; S07 API/S09 implementation, S11 tests.
- **S00-ADR-002** — Sessions capped at four hours; reconnect/resume existing session consumes zero new Slots. An authentic new session starts with exactly one idempotent debit. Exact disconnected wall-clock semantics and legacy grace/prestart/restart clauses remain unresolved.
- **S00-ADR-003** — Persistent **Game History** table/list with event/date/time/status and Copy Summary equal to closing's winner—prize lines; no automatic 7-day results deletion. Privacy/erasure and financial retention are separate.
- **Dev reset evidence** — Owner requested cleanup before S07/S08. [Exact verified reset migration and scope](BUD_SUPABASE_STAGE00_DEV_RESET_20261022.md): `bud_private` + `bud_platform` removed (12 empty tables), four legacy `public.bud_*` functions removed, main Supabase Development project preserved. Do NOT replay obsolete migration drafts. Never confuse this with production DB readiness.
- **Notion reconciliation coverage:** 17 **write operations** across pre-existing S02–S04 gate/test Policy Review fields updated to reflect ADR-001/002/003 and current owner scope, all retaining NOT RUN/BLOCKED results. Earlier 10 updates are retained; S02-T01 originally refused by connector and remains unmodified. Updated rows: S02-G04,G09,G10; S03-G01,G04,G05,G10; S04-G05,G06; S02-T02,T03,T04,T05; S03-T02,T05; S04-T02,T03.
- **Figma game source detailed inspection:** original `314:2` metadata now inventories 42 top-level frames: D01–D17, M01–M10, countdown 5→0, card and button components. Direct screenshot response obtained for setup timer-on (`317:1945`), winner modal (`317:2333`), mobile setup (`317:2857`) and mobile close (`317:3397`); all correct canvas dimensions reported. Metadata confirms D01/D02 **still use legacy 5/7/10 duration chips**. This is a visual/spec drift: current owner wants a custom-second timer, and current exact numeric range remains unapproved; update S05/S06 before final design acceptance. Fetching a screenshot is not proof that browser animation and gameplay were interactively tested.
- **Browser audit limitation:** Connected browser list_tabs was unavailable. Local container cannot resolve Vercel domain, and ordinary web URL fetch failed; original/current live interactive visual parity remains unverified. These failures are not UI test passes; carry open into S05/S06/S11.

## Owner approval — S00-ADR-004: duplicate manual winner names

Owner 2026-10-22 explicitly approved allowing multiple winner records with the **same display name** within an activity, showing a **non-blocking duplicate warning**, and assigning each saved winner **its own internal stable identifier**. The host judges Correct first; a duplicate detected by name normalization does **not** disable or reject Save. Prizes and Game History/Copy Summary must preserve separate winner rows and use record IDs instead of display names for referential integrity. Such IDs are app records, **not** Discord IDs, and must not imply verified participant identities.

**Implementation mismatch discovered:** `src/manual-game.ts` has `winnerNameError` returning `duplicate` for case-insensitive matching names, which the present `Game.tsx` UI blocks. This behavior violates ADR-004; targeted change is deferred to S09 implementation and versioned acceptance tests, not made in this documentation-only Stage00 PR. Blank/max-length validation is independent and remains blocking.

**Notion traceability:** Stage00, S03, S04 and S09 stage pages updated. Existing Policy Review fields on S03-G07, S03-G08 and S03-T05 updated without PASS. **S03-T04 update was rejected by connector safety checks** and remains at its prior documented supersession note; do not claim it was rewritten. S03/S09 game acceptance and QA are still NOT RUN.

## Cross-stage propagation and source QA expansion

- A full Stage Gate/Test **name scan** across S01–S14 identified superseded player/bot/wallet and data-retention clauses reaching S05, S07, S09, S10, S11, S12, S13 and S14 (not just S02–S04).
- **18 more existing records** received targeted Policy Review updates for S05/07/09/10/12 (11 gates + 7 tests); **8 further gate records** for S11/S12/S13/S14. Total **51 unique detail rows annotated in this Stage 00 audit** (35 gates and 16 tests), counting the two repeated S02–S04 updates once. All results retain NOT RUN/BLOCKED; no PASS inferred.
- S10 and S12 game/business checks now explicitly prohibit Discord player onboarding or bot fallbacks; S14 privacy backup/deletion checks distinguish persistent Game History from lawful erasure. Old row titles remain as provenance only.
- Original live game URL and current official site both responded **HTTP 200 with HTML** to authorized Vercel site fetch (2026-10-22), establishing reachability, **not visual parity, navigation, animation or gameplay QA**. Connected Browser unavailable for new interactive comparison.
- Source Figma game screenshot for timer-enabled Desktop visually confirms old fixed 5/7/10 chips; winner modal desktop and closing Mobile show proper winner-name entry and copy-results layout. These are sources, not certifying implemented runtime.
- PR documentation is isolated. GitHub Website Checks on `0dd3ee9f637f5546a6f307e8dee4a8f1d3a6b876` reported completed/success run 39772775223; Vercel check success. A later docs commit requires new exact-SHA CI checking.

## Decision-conflict ledger

| ID | Scope | Disposition | Remaining evidence |
| --- | --- | --- | --- |
| S00-C01 | Participant registration/attendance/bot from legacy registry | Superseded by explicit owner no-participant/no-bot policy | Reconcile S02–S04 gates and tests |
| S00-C02 | Verified Discord winner, name before correct | Superseded; host correct, then typed winner; do not claim verified ID | Verify current game regression |
| S00-C03 | Timer 5/7/10 fixed only | Superseded; custom seconds optional. 3–30/default5 used in original/demo; **final owner bound pending** | Distinguish observed bounds vs approved specification |
| S00-C04 | 240-minute session clock/10-second grace/60-minute restart/7-day retention | Partly resolved: 4h + free same-session resume approved; 7-day result TTL superseded by permanent Game History; prestart/60m/disconnect clock still open | Implement only approved session/history rules; keep other runtime contracts blocked |
| S00-C05 | Old Preview-only/release restrictions | Superseded **only for public frontend** by newer site release approval | Correct stale docs; maintain commercial go-live restriction |
| S00-C06 | Modal, content, EN locale, dotted containers and Figma version acceptance | Still open for final design/QA | Responsive screenshot comparisons and owner receipt |
| S00-C07 | Discord OAuth, Whop webhook, Slot charging on live sessions | Blocked until security/end-to-end tests | No real billing, do not remove fail-closed guards |
| S00-C08 | Slot expiry/refund/tax/price, duplicate winner-name rules | Business policy still open | Reconcile before activating provider contracts |

[Authority Handoff](https://app.notion.com/p/401b475e25f18196b002dc29e039666f) · [Current approval](https://app.notion.com/p/401b475e25f181db9c0dd509e7c1c856) · [Superseded decisions](BUD_SUPERSEDED_DECISIONS.md)

## Applicable review coverage / evidence limits

Product policy, UX/Figma, Engineering/Security, QA and Documentation are review **disciplines**, not proof that independent subagents executed. Under Expert OS v1.6.9, no work item may be closed without versioned evidence, applicable expert review, regression testing and acceptance. The Stage 00 source audit is scoped to the selected repo and Notion material; no market/community research is required merely to reconcile internal approved requirements.

## Stage 00 checklist progress

- [x] Owner adoption and Stage 00 active scope established.
- [x] Read the original Expert OS AUTOBOOT file from Drive; identified source/version and limitations.
- [x] Read Notion Handoff/Gate00/S02–S04 and current repo decision files.
- [x] Retrieve Figma Home and Events screen screenshots for Desktop/Mobile and inspect original-game Figma metadata.
- [x] Inspect GitHub main SHA/CI, Vercel production SHA and Supabase migration presence.
- [x] Record updated published-front-end override and clearly preserve historical docs.
- [ ] New interactive browser audit of original/current games and animation, timer, winner flow, mobile behavior.
- [ ] Visual screenshot-vs-rendered comparison on current website (AR/EN/320/390/1440, short height, keyboard, reduced motion).
- [ ] Confirm immutable design version/acceptance receipt and other missing modal/container visual states.
- [ ] Continue remaining registry coverage; 25 **distinct** S02–S04 Policy Review items updated (10 initial plus 17 further writes, with two rows modified twice) without changing PASS. This is **partial**, not full 140/73 coverage.
- [ ] Resolve older clock/retention/payment policies or mark affected work explicitly deferred.
- [ ] Independent qualified QA review and Stage 00 owner approval before marking gate closed.

**Next:** keep the website unchanged; proceed with design-to-production comparative QA and source-to-test reconciliation. Stage00 is **OPEN**, and Stage 01–14 statuses remain untouched.
