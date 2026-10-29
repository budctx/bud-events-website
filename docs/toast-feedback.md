# Unified action feedback

Owner approved converting the audited action messages to the shared BU’D toast on 2026-10-29.

- Success: 5 seconds. Information: 8 seconds. Warnings: 15 seconds. Errors: 20 seconds.
- Payment pending/review/dispute/refund/verification failure, uncertain requests, local save failures, blocked event access and one-time key instructions persist until dismissed or the underlying state resolves.
- Every toast has an accessible X close button. Hover and keyboard focus pause dismissal.
- State-driven notices deduplicate by source and change only when their message changes. Resolving/unmounting their source removes stale feedback; polling the same payment state must not repeat a dismissed toast.
- Critical notices are never evicted by newer feedback. The viewport scrolls when needed and is hosted inside the active modal so keyboard and screen reader access remain available.
- Order/receipt references, balances, one-time secrets, retry controls, field labels, blocking screen headings, confirmation dialogs and gameplay instructions remain in their functional locations. Technical Whop inspection output remains a diagnostic report, outside this action-message migration.
- Payment success comes only from the verified server receipt, never URL flags or a checkout click. No live charges or credit operations are used for verification.
