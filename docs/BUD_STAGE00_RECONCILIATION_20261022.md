# BU'D — Stage 00 current-source reconciliation and evidence audit

> **S00-ADR-005 (2026-10-22):** Owner approved the current published website interface as visual baseline and discontinued Figma-first/required Figma approval. Figma materials remain archived provenance only. New screens (including Game History and custom timer input) use **shared responsive code components**, not a fresh Figma design. Remove immutable Figma acceptance/version as Stage 00 blocker; retain tested Preview/interactive QA, accessibility and functional correctness as gates. This latest owner decision supersedes earlier Figma parity and visual approval prerequisites in this audit. [Living Notion decision](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c).


**Date:** 2026-10-22 · **Status:** ACTIVE / OPEN (not closed) · **Governance:** Expert Department OS AUTOBOOT v1.6.9, original Google Drive source. The original OS verification report is documentary evidence, not host certification or proof of independent agents.

[Primary living audit and resolution table in Notion](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c) · [Gate 00](https://app.notion.com/p/401b475e25f181909556f65d42e19590)

## FINAL BATCH REVIEW — Stage 00 decision baseline, handoff and closure evidence (2026-10-22)

**RECONCILED / HANDOFF-READY, FORMAL STAGE 00 GATE STILL OPEN**. The owner requested one consolidated documentation and QA sweep rather than per-command review. The below is the working Stage00 audit disposition (older investigation notes further down are historical, not today's approved design workflow).

### Authoritative owner decisions — FREEZE for downstream stages

| Decision | Approved policy | Implementation owner / acceptance |
|---|---|---|
| S00-ADR-001 | **One Event Engine / Timer Manager** owns clock, configuration, start/stop/reset/expiry. A game template only declares triggers and expiry consequences; Q&C starts only after both cards revealed. | S07 engine contract, S09 game wiring, S11 tests. Specific Q&C default/min/max values are **not** approved by ownership decision; observed old demo 3–30/default5 is provisional. |
| S00-ADR-002 | **Four hours maximum per session.** Reconnect/resume the same active session without a second Slot debit; new session start debits once. | S07 Session Manager contract, S09/S10 server implementation, S11 idempotency/concurrency/expiry tests. |
| S00-ADR-003 | **Persistent Game History:** one host-visible row per activity/session with game name, date, time, status and Copy Summary identical to closing winner–prize list. No automatic 7-/30-day results TTL. | S05/06 responsive reusable Table and Empty/Error states, S07 data/RLS/privacy, S09/S10 save/restore, S11 test. Lawful erasure/security and financial retention remain separate. |
| S00-ADR-004 | **Duplicate winner display names allowed.** Informational warning only, never prevents Save. Distinct internal winner record ID each time; use ID not name for prize references. No Discord identity assertion. | S09 correct the current `winnerNameError` duplicate rejection, S11 regression with normalized equivalent names and two independent winners. |
| S00-ADR-005 | **Code-first; existing published BU'D website visual design approved.** Reuse common responsive components; **Figma is archive only**, no new Figma frames/version/acceptance prerequisites. | S05/S06 code components + Preview mobile/tablet/desktop, AR/EN, RTL/LTR, keyboard/short height/reduced-motion checks. Preserve existing tokens/assets. |

Additional current owner scope (20–22 Oct): Discord-first multi-product website with Events/Bots/Designs catalogs; Q&C first playable activity; public browsing requires no auth; only purchasing host authenticates with Discord at Buy Now; **no bot, player accounts, web participant join, attendance, player tracking or automated player selection**; host Correct → winner name modal; physical money wallet superseded by product-use-count Slots (+1 verified purchase; -1 at new session start only). Only the frontend was authorized to publish to Vercel Production. Auth/payment/commercial session is **fail-closed**, not activated.

### Explicit bounded deferrals — NOT silently approved

| Owner of next decision / work | Deferred topics | Must be resolved BEFORE |
|---|---|---|
| **S05/S06** | Build **code-based** Game History table, shared custom timer input, catalog empty states, responsive/accessible UI review. Never require Figma edits. | UI-specific acceptance or further page/interaction launch |
| **S07 / S09** | Final optional Q&C timer numeric bounds/default, central timer contract; four-hour server clock including whether disconnection consumes time, which session ID is resumable. | Production session engine implementation and acceptance |
| **S07 / S08** | New DB ERD/schema, row-level permissions, privacy/erasure vs history preservation, migration consistency/rollback/backup; existing dev Supabase schemas and four RPCs were **removed**. | Any new DB migration/replay, host authentication, or data persistence |
| **S09 / S11** | Implement/test warning-not-block duplicate winner names, stable IDs, copy summary parity, persistent history; remove old participant/wallet/bot model. | Claim that the playable game matches ADR-004 |
| **S10** | Price, currency, taxes, refunds, Slot expiration, seven-day prestart entitlement proposal, one-time first-60-minute restart proposal, ten-second grace proposal, payment provider signature/settlement, concurrent debit security and Discord OAuth scopes. These historical clauses remain UNAPPROVED. | Any paid checkout or commercial SaaS go-live |
| **S11–S14** | Independent live UI/keyboard/mobile/browser/performance/security QA, release readiness, pilot and operational safeguards. | Corresponding stage gate/release claims |

**Critical deferral rule:** unapproved clauses are *not implemented by default*, and no dependent production capability may activate until its business owner decision and evidence-based acceptance tests exist. A deferred item cannot be interpreted as PASS or as a new approval.

### Stage00 gate exit checklist — evidence ledger

| Original gate obligation | Current evidence / disposition |
|---|---|
| Figma desktop/mobile snapshot and design references | **Historical source audit DONE**: source node IDs, game states, screenshots, exact assets recorded in BUD_FIGMA_COMPONENT_MATRIX.md; ADR-005 now archives Figma and removes requirement for future Figma sign-offs. |
| Original live Q&C UI/hover/flip/controls mobile/desktop | Earlier original live browser/DOM walkthrough and game state observations documented in [parent Stage00](https://app.notion.com/p/401b475e25f181909556f65d42e19590); Q&C original remains historical visual reference. **Fresh runtime/browser interaction comparison unavailable in this chat**, not a new PASS. |
| Inventory GitHub/Figma/Drive/Notion/Vercel/Supabase | DONE with named repos, development project, verification/audit pages and historical branches; detailed observations in parent and [Notion audit](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c). |
| Current approved spec with source/ID | DONE: BUD_CURRENT_APPROVED_SPEC.md, CUR-001..017 with latest ADR-001..005 override. |
| Superseded decisions and replacement | DONE: BUD_SUPERSEDED_DECISIONS.md, SUP-001..015, with restricted legacy migration replay. |
| Authority/conflict procedure | DONE: BUD_SOURCE_OF_TRUTH.md; current owner's explicit decisions > older Figma/spec/code. |
| Source conflicts resolved/recorded | **RECORDED AND SCOPED:** 8 original conflict families C01–C08; approved owner resolutions; deferred risky/financial decisions explicitly block S07–S10 implementations, no implicit adoption. |
| Component map / responsive tokens | Historical design map DONE; ADR-005 moves final visual authority to current website and reusable code components. |
| Five UI/UX reference research sources | DONE as historical research/proposed use status: BUD_UI_UX_SOURCE_ADOPTION.md; no requirement to import assets or external design tools. |
| Prepare S05/S06 UX/QA matrix | Existing 15 Playwright checks in BUD_VERIFICATION_REPORT.md tested several screen sizes, AR/EN, keyboard/modals/reduced motion **on an earlier implementation SHA**. Future current-SHA and new Game History checks remain due in S05/S06/S11. |
| Detailed Notion governance migration/relation/validation | **VERIFIED LIMITED:** 140 detailed gates and 73 detailed tests, stage relations/formula negative test documented in [migration proof](https://app.notion.com/p/401b475e25f181c9925ae9b7e6482517). **No enforced prevention of a manual stage status edit**; operational branch protection, CI→Notion sync and gate security remain follow-up. |
| Independent QA, exact-SHA current evidence, owner approval, closure | **NOT SATISFIED in this checkpoint.** User approved the five decisions and requested closure work, but no independent qualified reviewer has verified this final reconciliation against exact current source and no fresh live interactive QA for current site/game was run. Existing CI tests on docs PR are useful build evidence, not a replacement for independent decision/UX QA. |

**Notion coverage:** 51 *distinct* existing detailed gate/test records have had material policy annotations applied (not a claim that every one of the 140/73 was executed). Two focused Notion test-row updates were blocked by connector safety checks (S02-T01 and S03-T04); their historical notes remain, and this final audit gives replacement criteria without changing their recorded Result. All 14 project stages remain **Not verified**; detailed gate/test PASS remains zero in current project governance. Those stage results are not to be fabricated.

**Production/data safety:** Remote Supabase development reset `20261022113143_stage00_reset_legacy_dev_schemas` removed two BU'D business schemas (12 empty tables) and four obsolete functions; original auth/storage and migration ledger remain. No DB recreation, no real paid processing, no production code changes in this audit. Draft docs PR remains unmerged.

### Outcome and permitted next action

**Current formal state: Stage00 OPEN — source/policy baseline reconciled, close attempt blocked on independent qualified QA plus valid evidence for the mandatory original-game/current-site interaction audit and trustworthy closure certification.** Keep the Stage00 decision baseline frozen and allow *scoped* S05–S11 work under the explicit fail-closed rules above; do not conflate that permission with completed downstream gates. Stage00 can be marked CLOSED only after independent checklist/evidence review and verified required tests, then owner/QA acceptance in Notion. No further design-tool/Figma questions or repetitive owner policy polling necessary.

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
| S00-C06 | Missing modal/EN/empty states; formerly Figma version acceptance | ADR-005 settles Code-first visual authority; UI quality verification remains S05/S06/S11, not a Figma requirement | Real Preview/mobile/accessibility/browser QA required before downstream PASS |
| S00-C07 | Discord OAuth, Whop webhook, Slot charging on live sessions | Blocked until security/end-to-end tests | No real billing, do not remove fail-closed guards |
| S00-C08 | Slot expiry/refund/tax/price; duplicate winner-name behavior | ADR-004 resolves duplicate names; all commercial terms held to S10 with payment fail-closed | Get merchant/owner policy and security evidence before commerce |

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
