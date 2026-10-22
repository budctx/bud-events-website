# BU'D — Stage 00 current-source reconciliation and evidence audit

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

## Decision-conflict ledger

| ID | Scope | Disposition | Remaining evidence |
| --- | --- | --- | --- |
| S00-C01 | Participant registration/attendance/bot from legacy registry | Superseded by explicit owner no-participant/no-bot policy | Reconcile S02–S04 gates and tests |
| S00-C02 | Verified Discord winner, name before correct | Superseded; host correct, then typed winner; do not claim verified ID | Verify current game regression |
| S00-C03 | Timer 5/7/10 fixed only | Superseded; custom seconds optional. 3–30/default5 used in original/demo; **final owner bound pending** | Distinguish observed bounds vs approved specification |
| S00-C04 | 240-minute session clock/10-second grace/60-minute restart/7-day retention | Legacy requirements, not renewed | Scope/owner policy resolution before real sessions |
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
- [ ] Reconcile the existing 140 gates/73 detailed tests to the newer no-bot/manual-winner/Slot policies; mark per-row evidence appropriately.
- [ ] Resolve older clock/retention/payment policies or mark affected work explicitly deferred.
- [ ] Independent qualified QA review and Stage 00 owner approval before marking gate closed.

**Next:** keep the website unchanged; proceed with design-to-production comparative QA and source-to-test reconciliation. Stage00 is **OPEN**, and Stage 01–14 statuses remain untouched.
