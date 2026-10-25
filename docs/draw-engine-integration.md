# BU’D Question & Condition — shared event activity integration

**Release status:** technically integrated on draft PR #33; publishing and selling remain blocked by content, live-play and owner release gates.

## Architecture

One Modular Monolith. `server/host.ts` owns Discord-host authority, session orchestration, version and idempotency control, lifecycle, wallet debits, winner/prize management, and persistence. `server/question-condition-activity.ts` encapsulates the game-specific activity transitions and calls the pure `src/draw-engine.ts` engine. The shared event state persists the `activityDraw` snapshot. The frontend never chooses a remote draw pair.

**Source of truth**
- [Arabic questions and conditions](https://app.notion.com/p/404b475e25f1818fb019ffc0bd1586e9): approved 23/15.
- [Arabic answer examples](https://app.notion.com/p/404b475e25f1818aa7d5e5fe4411dd64): owner accepted 345 examples, non-exclusive.
- [English editorial draft](https://app.notion.com/p/404b475e25f181448e30c21494372b5c): 345 English candidates; spelling tests passed, human semantic/playing review pending.
- [Product rule approvals](https://app.notion.com/p/404b475e25f181bcab29e85caaa599e9).

## Integration implemented

1. `bud_host_draw_catalog` and `bud_live_host_draw_catalog` are service-role-only RPCs that return the pinned approved question–condition pair index catalog. Both reject missing/unpublished eligibility.
2. `bud_host_start_draw` and `bud_live_host_start_draw` validate the initial activity snapshot against the approved content version before the existing atomic start/debit. A failed transaction does not consume a run; a retried start key returns the saved event.
3. The shared host dispatcher applies activity-specific steps when a legitimate shared-event reducer transition advances `round`. It persists the next activity snapshot, event state, and idempotent action receipt under the pre-existing versioned `bud_host_update` / `bud_live_host_update` transaction.
4. `bud_platform.host_event` / `bud_platform.live_host_event` render the **persisted** activity pair; legacy events without activityDraw continue to use their historic pair_order path.
5. When no valid pairs remain, the game enters `exhausted`: cards cannot be revealed and the host alone may dispatch `restart-cycle`. No automatic reset. Prizes and closing remain available.
6. All 23×15 pair combinations can be represented as eligible indices, but content versions must explicitly declare eligible pairs. A published content version cannot be edited in place, including its eligibility catalog. The host event pins the version at start.

## Deployment and data

The two additive migrations are staged and verified on the dedicated BU’D Supabase development project. They do not publish a product, grant public table access, modify wallet balances, or enable Whop. The source migrations are safe to reapply when the tool-generated migration timestamps differ from their Git filenames.

A new `qc-23x15-editorial-v1` content version (23/15, 345 candidate compatible pairs) was inserted as **draft**. The existing example version and the product's draft status are preserved. **Never** put the 345 private example answers in the public GitHub repo or the user-facing bundle.

## Tests

- `tests/draw-engine.test.ts`: exactly-once per cycle, balance, compatibility, 20-draw deterministic exercise, explicit reset, serialized resume.
- `tests/question-condition-activity.test.ts`: shared-event game adapter and cycle transitions.
- `tests/question-condition-sql.test.ts`: PGlite-backed pinned content, atomic start, retry, versioned update, server card rendering, owner isolation, permissions and resume.
- `tests/live-commerce-integration.test.ts`, `tests/payment-operations.test.ts`: regression tests for isolated live debit, refund hold, sandbox isolation and retries.
- `tests/browser/host-portal.spec.ts`: explicit persisted exhaustion and host restart UI.
- CI must pass `npm run build`, `npm run typecheck:server`, `npm test`, including responsive visual checks. Inspect current PR's final head SHA and GitHub Actions evidence before merging.

## Publishing gate — intentionally NOT complete

- [ ] Review/approve natural English answer interpretations; written letter checks alone do not guarantee semantic correctness.
- [ ] Perform actual 15–20-round Discord/voice playtest with a human host, confirming fairness, clarity, entertainment, and judgment.
- [ ] Run limited owner-authorized authenticated staging event with draft-to-published content version, verify actual Supabase persistence and both locales; validate host owner-only permissions, two-tab retries, full exhaust/restart, prizes and closing.
- [ ] Perform independent review of PR and SQL migration, no public answer leak, RLS and charge isolation.
- [ ] Approve exact immutable content version and flip product status only after acceptance.
- [ ] Merge into `main` **only after owner release authorization**. Production Vercel auto-deploys from main. Do not activate checkout or actual payments without the separate Whop approval.

The work is a release-candidate implementation on a draft feature branch, **not** a public launch.
