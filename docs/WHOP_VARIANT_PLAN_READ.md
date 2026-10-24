# Whop plan read contract

The actual protected inspection after PR23 failed only currency conversion and tax. Plan/account/product/billing/currency/price/renewal predicates passed. This does not identify whether the failed fields were enabled, missing or incompatible, and does not justify changing merchant tax settings.

The follow-up uses a single GET `/variants/{stored plan ID}` pinned to `2026-10-15-1`, with the documented `account` identity model. No fallback accepts a mixture of company/account response models. Price remains the approved SAR2 in major units, zero renewal, one-time billing, conversion explicitly false and tax explicitly not collected or inclusive. Missing fields still fail closed.

Only the plan read uses the new pin. Checkout creation, payment lookup and the separate dated webhook envelope retain their previous contracts; no merchant key pin, subscription, secret or external configuration is changed. The adapter's explicit request header controls the model independently of the saved key pin.

On mismatch, the admin endpoint additionally returns only allowlisted states for conversion, tax collection and tax treatment: enabled/disabled/missing/invalid and inclusive/exclusive/unspecified. No provider body, customer data or credentials are returned or logged. The UI maps only those fixed states into localized text. This is diagnostic evidence, not a tax determination or a successful payment.

The new provider read must be verified in production before recording the issue as fixed. Sales, workers and all three unapplied live migrations remain gated. Existing official SAR2 CTA and owner data are preserved. Exact head, CI, deployment and actual result belong in the Notion work log.

Sources: [Whop API versions and migration compatibility](https://docs.whop.com/developer/api/versioning), [Variant fields](https://docs.whop.com/api-reference/beta/variants/variant).
