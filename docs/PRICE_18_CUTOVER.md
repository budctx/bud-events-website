# Price and coupon release

Supersedes the unshipped flat-SAR-18 proposal. Base plan price is SAR 20 (2000 minor). SAR 18 is obtained only from a real Whop 10% promo code. No invented "applied coupon" label or unconditional struck-through price.

Before activation: verify existing one-time Whop plan at SAR 20, zero renewal, same account/product/plan, no conversion or additive tax. Update Production WHOP_PRODUCTION_AMOUNT_MINOR to 2000 and deploy the matching frontend in a coordinated window. Do not change the existing plan to SAR 18. Historical SAR 3 orders remain exact-bound during processing only.

Apply additive promo/review migrations after fixture validation. Enable BUD_PROMO_MANAGEMENT_ENABLED only after read/create/update scopes on the existing Whop key are verified. Owner UI creates product-scoped percentage coupons, pauses/resumes and copies a site link with promoCode; no delete/export. Request payload is reserved before the provider write; provider idempotency and immutable owner audit receipt support uncertain-response retry.

Enable BUD_PROMO_CODES_ENABLED only after checking the pinned promo schema against the actual account and an isolated sandbox payment receipt. Coupon link is retained in this tab through Discord login. A server-validated eligible code changes the button; invalid code blocks that purchase until explicitly removed. New checkout revalidates the code, records base/discount/net/promo identity atomically and appends promoCode to the existing session-bound checkout URL. The persisted checkout URL remains canonical. New codes don't alter old order snapshots.

Payment delivery still checks exact order, account/product/plan/currency/checkout, paid state, refunds and disputes. Discounted orders additionally require the exact authoritative promo identity, subtotal and net total. Unknown totals/promo changes go to review; checks are never weakened to accept arbitrary lower amounts. Whop remains final authority on per-customer eligibility and stock; if the buyer removes or changes the coupon or Whop falls back to full price, the receipt intentionally goes to review rather than silently granting for a mismatched order. This scenario must be resolved before enabling automated promo fulfillment broadly.

No real purchase, refund, grant or paid-event start is used as agent QA. Flags default false. Until provider evidence is available this feature is prepared, not production-certified. Do not describe a mock or a READY deployment as a successful live payment.

Reviews: BUD_REVIEWS_ENABLED is independent. Event ownership plus a server-recorded debit is required; no winner/prize/runtime data is uploaded. One immutable submission per event; optional unchecked publication consent; pending until owner moderation; only consenting nonempty reviews may be published. No ratings are seeded or fabricated. Hide retains the record and removes it from fresh public reads (no CDN cache).
