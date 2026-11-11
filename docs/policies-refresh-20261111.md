# Public policy centre refresh — 2026-11-11

## Scope and owner authorization

The owner requested implementation of the researched policy structure in the existing policy centre. This change updates public copy and navigation only. It does not change payments, credit expiration, session duration, storage, refunds, authentication or account restrictions.

The centre has five sections: support, terms, purchase/keys, cancellation/refunds/technical faults, and privacy. Existing support/terms/refund/privacy hashes remain valid; purchase receives its own hash. Both current events use the same policies.

## Verified implementation evidence

- `server/auth.ts`: Discord via Supabase Auth. The application resolves account ID, Discord identity, display name and avatar. Provider-side identity metadata follows the OAuth permissions shown at authorization; do not claim no email processing without verifying provider configuration.
- `supabase/migrations/20261101082718_fixed_key_lifetime.sql`: administrative redeem code expires three calendar months after issuance. This is not an expiration of purchased wallet credits.
- `supabase/migrations/20261023173930_production_commerce_foundation.sql`: wallet is a credit counter without a per-credit expiration column.
- Event runtime contracts: a successful new start debits one credit; an existing event resumes without another debit while eligible; expiry is four hours from initial start.
- `src/browser-event.ts`, `src/mini-games/session.ts`: browser-only progress. No server copy of winners/prizes for restoration.
- `src/ReviewPage.tsx` and `server/review-submission.ts`: text reviews and optional publication consent; public identity is display name/avatar.
- Existing supported providers: Discord, Whop, Supabase and Vercel. No provider-region or DPA assurance is inferred from source code.

## Sources used for content review

- Saudi e-commerce law, Article 13 and related delivery rights: https://laws.boe.gov.sa/BoeLaws/Laws/LawDetails/360de590-0286-4fa5-a243-aa9100c31979/1
- SDAIA privacy policy guidance: https://dgp.sdaia.gov.sa/wps/portal/pdp/knowledgecenter/details/ElaborationandDevelopingPrivacyPolicyGuideline
- Whop Buyer Terms: https://whop.com/buyer-terms/

The refund copy preserves mandatory rights and distinguishes payment errors, platform faults and local data loss. Replacement credit is not presented as a substitute for a refund required by law. No automatic refund feature or unconditional discretionary remedy is promised.

## Remaining business/legal decisions

These are not invented or represented as complete compliance:

1. The legal supplier's identity, registered details and required contact information. Preserve the previously supplied freelance document number and verification link without asserting validity or merchant certification.
2. Exact minimum account/purchaser age. Use general legal-capacity and guardian requirements pending the decision; do not invent a numerical age.
3. Support response and resolution commitments. No numeric SLA is published without owner confirmation.
4. Provider processing regions, transfer safeguards and purpose-specific retention/deletion periods. Public copy describes current records and rights without claiming that end-of-event deletes account/payment records or that transfers are certified.
5. Legal classification of unused browser-service credits and any applicable statutory cancellation exceptions. Do not claim all digital purchases are categorically exempt from cancellation.

Owner review remains necessary for these decisions; publishing the implemented copy is not legal certification or stage acceptance.

## Validation

Updated the existing policy browser tests to exercise all five sections, purchase deep-link reload, search reset, RTL keyboard selection, browser history, administrative-code versus wallet expiry, event duration, mandatory refund rights and the retained certificate link. CI retains desktop/mobile screenshots. Record the exact release SHA, CI and deployment in Notion after publication.
