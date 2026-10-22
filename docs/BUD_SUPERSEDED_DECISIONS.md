# BU'D — superseded decisions

> **S00-ADR-005 owner override (2026-10-22):** Old instructions requiring design in Figma first, latest immutable frame version, or Figma sign-off before UI implementation are superseded. Current approved website is the design reference; future elements are reusable responsive code components reviewed by Preview/QA. Keep Figma only as archive, not a required delivery system. [Notion](https://app.notion.com/p/401b475e25f1814d9cc7f75ffcd1bf0c).


Version1.2 ·2026-10-22. Owner: project owner. Historical source records are preserved; do not silently rewrite archives.

| ID | Historical clause | Replacement | Current evidence/date | Status/confidence |
|---|---|---|---|---|
| SUP-001 | Registry R-002,R-011/012,R-042–045,R-051 participant clauses; PRD AC-13/16,N03/N04/N11; bot attendance and OAuth participants | No participant registration/tracking or bot; manual winners only | Handoff v1.0 and Buyer Journey20Oct; owner22Oct request | Superseded/high |
| SUP-002 | Registry R-008/025/035, AC-01/N02 fixed5/7/10 only; DB timer constraint | Custom seconds optional timer; preview original bounds3–30/default5 | Handoff22Oct + original live DOM22Oct | Fixed-only superseded/high; final bounds pending |
| SUP-003 | Registry R-031/AC-08 verified participant Discord identity in results | Host-entered display names, no verified identity claim or IDs in export | Handoff22Oct, Buyer Journey20Oct | Superseded/high |
| SUP-004 | Registry R-003/047 wallet/topups/economy | Product play-count Slots only, server-verified purchase and atomic start | Handoff22Oct, Buyer Journey20Oct, retirement report | Superseded/high |
| SUP-005 | Earlier game-led homepage and draftPR2 as approved target | Multi-product Home from original Figma; three galleries | Current owner request,Handoff22Oct | Superseded/high |
| SUP-006 | Old synthetic React game as visual truth; landscape7:5 proposals | Original live game visual interaction source with newer explicit owner changes | Handoff22Oct; O observation22Oct | Superseded/high |
| SUP-007 | Original name input required before Correct | Correct→winner-name modal | Handoff22Oct | Superseded/high |
| SUP-008 | Two-game MVP; dark production mode | Q&C first only; Light only | Handoff22Oct | Superseded/high |
| SUP-009 | Package First Build Brief participant components and Joiner/host/observer surfaces | No participant-facing surface | Current mandate/Handoff22Oct | Superseded/high |
| SUP-010 | Existing code/DB implies feature approval | Code and DB are historical evidence only | Gate00 hierarchy22Oct | Rejected inference/high |

| SUP-011 | Results vanish after 7 days and are temporary in old S04-G06/S04-T03 | Owner-approved persistent Game History with event/date/time/status and Copy Summary; no automatic retention TTL, subject to lawful erasure | S00-ADR-003 22Oct | Superseded/high |
| SUP-012 | Original 240-minute session and restriction of restart during first 60m may be interpreted as one inseparable rule | Four-hour max and free same-session resume are now specifically approved; prestart, restart grace, disconnected clock are **not** approved | S00-ADR-002 22Oct | Partial supersession/high |
| SUP-013 | Per-game duplicated timer settings/controllers could be inferred from game-specific historical UI | One shared Engine Timer Manager; template only signals triggers and policy-specific expiry effects | S00-ADR-001 22Oct | Superseded architecture/high |
| SUP-014 | Older development Supabase schemas and historical migration files are deployment-ready current authority | Owner requested removal of obsolete development schemas; actual reset migration executed, design deferred to S07 and provisioning to S08 | [Verified reset](BUD_SUPABASE_STAGE00_DEV_RESET_20261022.md),22Oct | Superseded for dev/high |

| SUP-015 | Current local rehearsal prevents entering the same winner display name twice; historical winner uniqueness inferred from names/participant registry | Owner allows identical visible winner names with warning that cannot block Save and distinct internal record IDs; prize assignment/export keyed by IDs rather than names | S00-ADR-004,22Oct | Superseded/high; S09 code change and tests pending |

## Historical policies under review, not silently revived

Registry R-004/006/019/032: 7-day prestart and 10-second grace/60-minute restart rules remain open; 240-minute max and same-session free resume are now approved (ADR-002); old 7-day result deletion is superseded by permanent Game History (ADR-003). Historical timer 5/7/10-only frames still exist in Figma; do not implement them as the new duration policy. Resolve open clock policies before implementing real commerce. The old implementation is retained in git history and existing files for regression reference; new platform/game routes must not expose its participant mode.

## Evidence registry

- Current handoff: https://app.notion.com/p/401b475e25f18196b002dc29e039666f
- Current gate: https://app.notion.com/p/401b475e25f181909556f65d42e19590
- Historical Registry: https://drive.google.com/file/d/1GESYhkr9sB_VsD_RnyfJ6SrtCw7w7pEq/view
- Historical PRD: https://drive.google.com/file/d/1DMnh0FdqQlrnuSLSu93_yAcS_4vWCwQ0/view
- Buyer Journey: https://docs.google.com/document/d/1aeyp5rHDzVzG_IZi7fbHrOVBT133aiwxHSouyBxUVTY/edit
- Retirement report: https://docs.google.com/document/d/1RWZe3EolZl6fCmxmc3Zx4cQYcP0dc8Hp1wAKY1hy884/edit

Mutable source URLs and extracted clauses are traceability, not immutable content proofs. Do not invent original owner-message IDs absent from sources.
