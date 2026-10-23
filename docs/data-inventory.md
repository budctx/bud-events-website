# BU’D released data inventory

Prepared 23 October 2026 against released baseline `9333f54e4c5f1ab6d536583e8abd1a97eb96e21a`. This is a source-derived inventory, not a legal approval, production processing attestation, provider DPA review, or retention schedule. Remote provider activation must be inventoried separately. The historical baseline paragraphs in older policy drafts/runbooks do not override the current protected host implementation.

## Data map

Launch-preparation delta: private sandbox orders now also hold request key, plan and checkout ID/URL; SQL currency is uppercase and provider DTO currency lowercase. No card data is stored. The private `rate_limits` table contains scope, keyed HMAC pseudonym, bounded count and reset time, never raw IP. Each limiter call deletes up to 100 counters expired by over ten minutes; this is bounded request-driven cleanup, not a guaranteed purge schedule. Hosting/provider logs and the final retention policy remain separate.

| Data | Purpose and source | Store / access | Lifecycle actually implemented |
|---|---|---|---|
| Arabic/English preference (`bud-lang`) | Remember the visitor's selected language; written by Platform | Browser localStorage; readable by same-origin JavaScript | No coded expiry; visitor/browser may clear it. No identity or token stored here. |
| Fixed sample card reveal state and five-second timer | Public Events demonstration | Browser React memory; no database mutation | Resets on unmount/reload. Public sample creates no host entitlement or full event. |
| Host Auth UUID, verified Discord identity, provider display name | Verify the account through Supabase Auth; show host display name (truncated to 80 characters) | Supabase Auth account/identity records; application receives UUID and display name; host UUID references in `bud_platform` | Account retention/deletion policy unresolved. Code verifies Discord provider identity and ignores editable user metadata for authorization. Provider-side additional stored identity fields/scopes need account-level verification. |
| OAuth state, PKCE verifier and expiry | Bind the callback to the browser-initiated sign-in | Encrypted `__Host-bud-oauth` cookie, HttpOnly, Secure, SameSite=Lax, Path=/ | Five-minute Max-Age; callback/logout clears cookie. Actual provider lifetime/configuration is separate. |
| Supabase access/refresh tokens, account UUID, token expiry, session expiry | Authenticate server-side requests and rotate provider tokens | Encrypted `__Host-bud-session` cookie, HttpOnly, Secure, SameSite=Lax, Path=/; server decrypts, token verification through Auth | Seven-day application session upper bound; individual access expiry is provider-supplied and refreshed within that bound. Logout clears cookies even when revocation fails; remote revocation failure is reported. These are credentials, never general logs or browser localStorage. |
| Event ID, host UUID, title, start key/fingerprint, phase/version, timestamps, content-version reference, pair order | Own/resume a host's session; atomic one-run start; concurrent mutation control; pin content | Restricted `bud_platform.events`; service-role RPC authority, host identity derived server-side; browser receives only owned event view | Four-hour session deadline enforced in DB on applicable access/mutation. Completion is not deletion. No automatic retention purge or account-erasure workflow implemented. |
| Event JSON state: config, timer flags/duration/deadline, attempts/round, card flags, winners, prizes and assignments | Restore exact host progress and render current results | `events.state` plus event/action receipt snapshots; host-only API | Winner display names are manually entered, repeated names remain separate records; no Discord participant identity verification. Removing a winner from current state does not erase historical receipt snapshots. |
| Action idempotency key, fingerprint, action name, result JSON, creation time | Safe retry/replay without duplicate mutation and version change | Restricted `bud_platform.action_receipts`; snapshots can include winner display names and prize labels | No coded purge. Privacy deletion/retention must address receipts and backups, not only current state. |
| Host wallet run count; append-only credit delta/type/source/timestamp | Track event-run entitlement and debit consistency | Restricted `wallets`, `credit_ledger`, host UUID linkage | Account foreign keys cascade as defined by migration; no supported/public account-deletion workflow. No money-wallet claim; no retention schedule established. |
| Product IDs/names/status/run cost/content reference; content versions, questions and conditions | Server-owned catalog and immutable session-pinned content | Restricted `products` and `content_versions`; authenticated API returns permitted summaries/current pair | Draft/published/retired status, no blanket deletion schedule. Do not treat seeded draft sample banks as approved production content. |
| Sandbox checkout order: host/product/company IDs, currency/amount/slots/payment ID/time; webhook IDs and order linkage | Prepared purchase reconciliation contract | Restricted `checkout_orders`, `webhook_receipts`; sandbox constraints | Purchasing and webhook fulfillment disabled. These schema fields establish a prepared contract, not evidence of live customer payment collection. Never store card details here. |
| Historical manual-winner rows (event/round IDs, display name, creation time) | Earlier additive schema compatibility | Restricted `manual_winners` | Current persisted runtime uses state JSON; legacy table availability does not prove active collection. Preserve until a reviewed migration/data lifecycle decision. |
| IP address, user agent, platform request/access diagnostics | Network delivery, hosting security/troubleshooting may process them | Vercel/Supabase/Discord provider-controlled logs/configurations | Actual collection, locations, access, logging retention and deletion are NOT VERIFIED by application source. Do not claim that no logs or personal data exist. |
| Operator source/evidence, CI artifacts and Notion release records | Release traceability and audit | GitHub/CI/Notion; access governed by connected workspaces | Evidence should exclude tokens, raw cookies, winner lists, raw callback codes and full request bodies. Artifact retention must be verified in account settings. |

## Access and exports

Public visitors browse galleries and the fixed sample. They do not receive privileged RPC credentials. Cookies are same-origin; host mutations require verified identity and configured origin. `bud_platform` tables/RPC grants are service-only in the released SQL; a complete production privilege inventory must still be evidenced. General API failures return fixed codes rather than raw upstream messages.

The host can copy their displayed results. Clipboard writes intentionally move names/prizes outside application-controlled storage; the host is responsible for where they paste them. No automatic email recipient, analytics event payload or participant signup was introduced. Do not interpret this as an independently verified absence of provider analytics.

## Providers and processors: factual boundary

- **Vercel:** released website/API hosting. Account plan, legal entity, region, subprocessors, access-log settings and DPA/transfer basis need verified account/contract review.
- **Supabase:** dedicated project `cepmvqqrjcvhyzszqand` provides development database/Auth contract. Production designation, region, provider configuration, backup entitlement and DPA/transfer basis remain explicit verification items.
- **Discord:** intended identity provider; actual enabled scopes/consent-screen behavior and account settings require live provider evidence. No bot, attendance or participant-account integration.
- **Whop:** prepared commerce contract only; disabled checkout/webhook routes are not an active payment-processing integration.
- **GitHub and Notion:** development/release collaboration and evidence. Do not upload application credentials or customer payloads as evidence.

No list above constitutes a legally complete subprocessor register. Identify the contracting business/controller, support/privacy contact, applicable countries/laws, processor agreements and transfer basis before policy publication.

## Decisions still required before commercial data handling

Record-specific retention and lawful basis; winner-name collection guidance; access/deletion identity verification; receipt/ledger legal holds; provider log retention; backup expiry and restoration of deleted records; named privacy/security responders; tested request route and realistic response commitments. No durations, tax/refund policies, service guarantees or legal jurisdiction are invented here.

## Machine-readable release checks

`config/launch-readiness.example.json` deliberately has pending gates and exits nonzero:

```
node scripts/launch-readiness.mjs --manifest config/launch-readiness.example.json --sha FULL_40_CHARACTER_RELEASE_SHA --out artifacts/launch-readiness.json
node scripts/launch-smoke.mjs --mode maintenance --out artifacts/launch-smoke.json
```

The validator accepts only a full matching release SHA, known required gates, passing status, evidence kind/environment, safe HTTPS links without credentials/query/fragment, exact evidence SHA and fresh UTC timestamps. Deployment/smoke evidence expires after one day; live provider/config/integration/CI/concurrency/monitoring and commercial approval after seven; policy/scope/content/field-trial/restore after thirty. These are freshness requirements for evidence, not customer data retention.

The report projects only fixed IDs/codes/booleans and never echoes raw evidence URLs, request bodies or input secrets. It validates attestations structurally and does **not** fetch or independently authenticate linked evidence. Named human/independent review must establish evidence truth before signoff; a hand-authored “passed” manifest is not actual proof. CI fixtures use invented links solely to test validation logic.

The smoke tool permits only the canonical production origin, sends no cookies, never signs in or starts/charges a session, and probes public shells plus unauthenticated boundaries. Maintenance mode requires explicit disabled-service 503 codes; commercial mode requires protected 401 codes. A successful commercial smoke still reports `commercialReady: false`: it cannot prove authenticated provider flow, payment, concurrency, real restore, field acceptance or launch approval. No local test/PGlite restore may substitute for those gates.
