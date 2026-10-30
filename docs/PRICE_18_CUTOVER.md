# Question & Condition price change — prepared, not activated

Owner approved one key at SAR 18, display reference SAR 20 struck through within the purchase button. Use Latin digits 0–9 in all audience-facing numbers, monetary values and dates.

Release gate: edit the existing Whop one-time SAR plan to initial_price=18, renewal_price=0, preserving currency, product, plan, stock and recurring/tax settings. Reconfirm the exact provider price. Update only Vercel Production WHOP_PRODUCTION_AMOUNT_MINOR from 300 to 1800, then merge/deploy this change. Do not publish a UI price that differs from the charged price. No real charge/grant/event is used as QA.

Keep historical orders unchanged. Checkout creation remains bound to the current server price. Only payment fulfillment, reconciliation and owner recovery may recognize stored SAR 3 orders under the same company/product/plan/currency and verified provider payment total. No other historical amount is introduced.

On retry, an old incomplete checkout operation may require starting a fresh checkout at the new price rather than reusing a request key with a changed contract. Already-created provider checkouts retain stored verification.

Rollback: restore provider price and Production amount expectation to SAR 3 and revert the release together. Never delete payment/credit ledgers or rewrite previous receipts.
