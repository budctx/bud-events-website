# Unified action feedback

Owner approved converting the audited action messages to the shared BU’D toast on 2026-10-29.

- Success: 5 seconds. Information: 8 seconds. Warnings: 15 seconds. Errors: 20 seconds.
- Payment pending/review/dispute/refund/verification failure, uncertain requests, local save failures, blocked event access and one-time key instructions persist until dismissed or the underlying state resolves.
- Every toast has an accessible X close button. Hover and keyboard focus pause dismissal.
- State-driven notices deduplicate by source and change only when their message changes. Resolving their source removes stale feedback; navigation alone does not discard action outcomes. Conditional validation notices dismiss when their invalid field/state is corrected; polling the same payment state must not repeat a dismissed toast.
- Critical notices are never evicted by newer feedback. The viewport scrolls when needed and is hosted inside the active modal so keyboard and screen reader access remain available.
- Order/receipt references, balances, one-time secrets, retry controls, field labels, blocking screen headings, confirmation dialogs and gameplay instructions remain in their functional locations. Whop inspection outcomes use the same toast; raw diagnostic references remain in the inspection report.
- Payment success comes only from the verified server receipt, never URL flags or a checkout click. No live charges or credit operations are used for verification.

## Completed sweep — 2026-10-30

- Removed duplicate local-access explanations and administrative pending banners. Blocking views keep a neutral heading and their recovery controls; the explanation is announced once in the toast.
- Host access failures, gameplay/preview expiry, exhausted combinations, winner capacity and Whop inspection results use shared toasts. Correcting the state removes its stale notice.
- Lazy-load text paragraphs now use skeleton loading indicators; payment-status lazy loading has no inline placeholder.
- Functional UI remains: timers, multi-step progress, card instructions, selected winner/prize context, prize reveal celebration, empty/search states and explicit confirmation dialogs. These are interface content, not action-notification substitutes.
