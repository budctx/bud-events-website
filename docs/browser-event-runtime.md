# Browser-only event runtime — owner decision, 26 October 2026

The owner's explicit decision supersedes server-authoritative gameplay for live Question & Condition sessions: progress, timers, draws, winner names and prize allocation are saved only in the starting browser. Clearing site data, changing browser/device, private browsing expiry or storage failure can lose progress. The host bears this loss; there is no cloud progress backup or automatic restore. Existing cloud history is preserved as historical data, not erased.

The server still verifies Discord authentication, tenant ownership, restrictions and approved content, and atomically debits one Slot per idempotent event start. The server's new event state is only a baseline start receipt with a `browser-v1` marker, no actual prize/settings/result payload. Finish/adoption acknowledgements contain event ID only. Local edits never grant credits or financial entitlements. Local gameplay is intentionally user-editable and is not an authoritative leaderboard or financial result.

## Implementation

- Production flag: `BUD_LOCAL_EVENT_RUNTIME_ENABLED=true`, live API only. Old live start/dispatch uploads return 410; sandbox/legacy tests stay isolated.
- Browser receives the approved pinned Arabic question/condition text and compatible pairs once after the paid start; private answers/examples are not returned. Pure reducer/draw adapter runs in-browser. The second card immediately sets a wall-clock timer deadline, preserved across reload/backgrounding.
- Progress uses account/event-scoped localStorage; sessionStorage holds only the current run pointer. An exclusive Web Lock prevents simultaneous writers in two tabs of the same browser. Explicit logout clears the pointer, not the records. This is not encryption or a cross-device lock.
- Storage support/quota is probed before a paid start. Writes are synchronous; a failure shows a loss warning and allows the in-memory session to continue. A missing/corrupt record does not fall back to a server receipt.
- Previously server-saved active runs can be adopted once: download the verified snapshot, save locally, acknowledge adoption. An interrupted acknowledgement is retried without uploading state. The original historical snapshot remains in DB but is no longer a restoration source after adoption.
- Existing four-hour run duration remains. Local closing/expiry summaries stay in browser history. Closing a missing run releases its server lifecycle record without refund or restoration.
- A service worker caches only public root HTML and same-origin static assets. `/api/` and external requests are never cached. A run loaded online can continue and reload offline after its public assets have cached. Offline access does not authorize purchases or new paid starts.

## Verification

`npm run typecheck:server`, `npm run build`, `npm test`: pure local timing/reload/corruption/cycle tests; authenticated API tests rejecting state/tenant injection and redacting receipts; PGlite migration/owner isolation/RPC grants/single debit/idempotent closure; browser immediate timer, offline play/reload, no gameplay or private prize uploads, second-tab exclusion, lost data and blocked/failing storage, 390px layout. Fixtures do not prove a signed-in production host journey. No real credits, paid event or winning result are created by release QA.

W-01 payment recovery and outbound monitoring remain suspended. This release does not automatically close a project stage or claim independent security certification. Notion holds exact commit, CI and production deployment evidence.
