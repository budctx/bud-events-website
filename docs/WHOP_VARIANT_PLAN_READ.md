# Whop plan read contract

The actual protected inspection after PR23 failed only currency conversion and tax. Plan/account/product/billing/currency/price/renewal predicates passed. This does not identify whether the failed fields were enabled, missing or incompatible, and does not justify changing merchant tax settings.

The follow-up uses a single GET `/variants/{stored plan ID}` pinned to `2026-10-15-1`, with the documented `account` identity model. No fallback accepts a mixture of company/account response models. Price remains the approved SAR2 in major units, zero renewal, one-time billing, conversion explicitly false and tax explicitly not collected or inclusive. Missing fields still fail closed.

Only the plan read uses the new pin. Checkout creation, payment lookup and the separate dated webhook envelope retain their previous contracts; no merchant key pin, subscription, secret or external configuration is changed. The adapter's explicit request header controls the model independently of the saved key pin.

On mismatch, the admin endpoint additionally returns only allowlisted states for conversion, tax collection and tax treatment: enabled/disabled/missing/invalid and inclusive/exclusive/unspecified. No provider body, customer data or credentials are returned or logged. The UI maps only those fixed states into localized text. This is diagnostic evidence, not a tax determination or a successful payment.

The new provider read must be verified in production before recording the issue as fixed. Sales, workers and all three unapplied live migrations remain gated. Existing official SAR2 CTA and owner data are preserved. Exact head, CI, deployment and actual result belong in the Notion work log.

Sources: [Whop API versions and migration compatibility](https://docs.whop.com/developer/api/versioning), [Variant fields](https://docs.whop.com/api-reference/beta/variants/variant).

## Evidence correction and independent quote preview

The protected plan inspection now supplies validated expected/observed account, plan and product IDs, an explicit API version, inspection time and sanitized provider Date/Age metadata. Provider requests use no-store; this does not prove that a provider has no internal cache. A missing expected product is explicitly `not_configured`, never a product identity match. A configured different product fails before checkout or quote POST.

Raw adaptive pricing is not the processor-effective configuration. Account tax collection and exclusive treatment do not prove a particular buyer owes tax. The UI explains this distinction and says tax is added **if assessed**. The existing strict checkout checks remain in place; no raw mismatch is waived for real purchasing.

`POST /api/whop-quote` is a separate owner-only empty-body diagnostic, with all the same auth/origin/rate limits plus `BUD_WHOP_QUOTE_PREFLIGHT_ENABLED=true` and a configured expected product. Default is disabled. It first verifies plan identity, product, price, currency, one-time billing and zero renewal; only raw conversion/tax mismatches can be bypassed **for this preview**. It then sends only account ID, existing plan ID/quantity 1, presentment_country SA and presentment_currency sar to POST /payment_quotes pinned independently to 2026-10-24. No address, IP, name, buyer registration, card, inline plan, promo code or payment is sent. Permission failure is reported without expanding key scopes.

Country-only quotes are previews; according to Whop a payment cannot consume a quote located by presentment_country. The handler verifies that location mode, a future expiry, unspent state, account/plan/quantity, unconverted SAR money objects, zero discount, line and overall arithmetic and available tax status. It reports an additive-tax total honestly instead of normalizing it to 200. Quote IDs and raw bodies are discarded. Results do not authorize selling, establish tax exemption, prove a customer's final charge, or alter runtime/SQL controls. The existing checkout does not consume this quote. A final buyer quote/payment integration remains separate work before any change to strict checkout acceptance.

The implemented quote contract still needs a real deployment and authenticated provider verification. Local tests use mocked Whop responses. Do not call a mock preview actual Whop evidence or rerun the failed backup prompt as part of this inspection.

Quote source: https://docs.whop.com/api-reference/beta/payment-quotes/create-payment-quote

The real first quote attempt returned access denied. After owner-approved addition of Charge payments, it advanced to a request-format rejection. Quote diagnostics now identify the failing operation (plan GET versus quote POST), provider status, pinned version, fixed reason and an allowlisted request-field name if present. Error bodies/messages are classified only in server memory; unknown reasons stay unclassified. No raw provider response, key, buyer details or arbitrary error text is exposed. A 400/422 is not treated as another missing permission or automatically retried on a different version.
