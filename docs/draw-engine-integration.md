# Question & Condition engine — integration checklist

Owner-approved content: **23 question prompts, 15 condition prompts, 345 Arabic answer examples**. The Notion answer matrix is the editing authority; examples are **not** an exclusive validator. Treat this as a frozen review snapshot, not public client content.

- Bank: https://app.notion.com/p/404b475e25f1818fb019ffc0bd1586e9
- Matrix: https://app.notion.com/p/404b475e25f1818aa7d5e5fe4411dd64
- Rules & signoff: https://app.notion.com/p/404b475e25f181bcab29e85caaa599e9

## Engine available in this draft
`src/draw-engine.ts` supplies a pure, serializable state transition that:
1. Draws from an explicit **approved compatible-pair catalog**, not every arbitrary pair in a Cartesian product.
2. Does not repeat a pair within its cycle.
3. Prefers a different question from the preceding round and balances question/condition exposure.
4. Preserves a complete chronological history with cycle and draw index.
5. Enters an explicit exhausted state and requires host approval before starting a new cycle.

## Integration work required before enabling it
- Import private versioned content through a secured backend-only ingestion process after AR/EN language review. Do **not** commit private answer examples to this public repository, expose them via Vite bundle, or serve them to participants.
- Resolve question IDs and condition IDs to the version pinned to the host event. The event must keep using the same content version after refresh; no edits to published content in place.
- Store the `DrawState` snapshot **in the server's authoritative host-event transaction**; include version compare-and-swap and idempotency keys, consistent with existing `bud_host_update` and dispatch receipts. Do not draw on the client or trust the client to supply chosen pair IDs.
- Fetch eligible catalog from the approved content version and language, and enforce server-side compatibility; only the host has authority to reveal cards.
- Persist the drawn pair **with event state and both cards** in one operation. On refresh/resume, return the same pair, not a new one. Retry the same request key without consuming a second draw.
- On exhaustion, show a localized host modal prompting explicit cycle restart. The session must remain usable for prizes, closing and summary; do not silently loop.
- Surface an informational example to the host only if the UX calls for it; do not auto-reject unlisted voice answers. Judgment remains manual.
- Verify 15–20 consecutive rounds, AR/EN, mobile/desktop, two tabs, network retry, refresh, exhaustion, selected distribution, backend RLS and public-data leakage.
- Run `npm run typecheck:server`, `npm run build`, `npm test` and record exact SHA/run links in Notion; owner approval and stage checklists remain separate. **Do not merge PR or deploy main automatically.**

## Important status
This document is an integration contract. Adding the shared engine and its unit tests does not by itself wire the production RPC, client UI, event persistence, private question bank, or commerce.
