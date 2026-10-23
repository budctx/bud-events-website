# Discord account authentication — contextual public journey

Owner direction, 2026-10-23: login returns to the originating Home/Events/Bots/Designs gallery and locale. It does not open a generic host dashboard. The header shows verified Discord identity and a safe static Discord CDN avatar, with History and Sign out. Event keys are read from the protected dashboard and shown on the Question & Condition product card; this is the only launch product backed by the current wallet. Unknown/unavailable balances are not rendered as zero. History and event setup reuse the protected event components inside the public site; only persisted server events can open the production game. Buying uses the direct protected checkout endpoint and remains unavailable until Whop sandbox configuration is supplied. No production payment is enabled.

Launch-hardening requirement: public Auth/host handlers now require `BUD_RATE_LIMIT_ENABLED=true`, a private `BUD_RATE_LIMIT_SECRET` of at least 32 UTF-8 bytes, the fixed project's service key and the actual Vercel runtime (`VERCEL=1` supplied by the platform). Only `x-vercel-forwarded-for` is trusted there. Missing limiter/edge evidence returns 503; exhausted budgets return 429 with Retry-After. Logout clears local cookies even when the limiter refuses the request. Deploy the rate-limit migration before enabling Auth; no setting is enabled by committing `.env.example`.

2026-10-23, Asia/Riyadh. Implementation evidence, not provider activation or commercial readiness.

## Delivered contract

`api/auth.ts` delegates to server-only `server/auth.ts`. All responses forbid caching and use a no-referrer policy. No client import, localStorage token, service-role key, client-supplied host identity, password flow or fake successful login is provided.

| Request | Result |
| --- | --- |
| `POST /api/auth?action=signin`, exact `Origin` | Optional JSON `{page,locale}`, page limited to home/events/bots/designs and locale ar/en; fixed Supabase authorize URL, encrypted 5-minute PKCE/state/return-context cookie |
| `GET /api/auth?action=callback&bud_state=…&code=…` | Validate browser-bound flow, exchange one-time PKCE code, verify Discord identity, set session cookie, `303` to the sealed gallery and locale at the exact configured origin; no arbitrary return URL |
| `GET /api/auth?action=session` | `200 {code:"OK",data:{id,displayName,avatarUrl}}`, `401 DISCORD_AUTH_REQUIRED`, or sanitized `503` unavailable/configuration response |
| `POST /api/auth?action=logout`, exact `Origin` | Revoke current Supabase session, clear both cookies. An upstream failure returns `503 AUTH_REVOCATION_UNAVAILABLE` while still clearing local cookies. |

`resolveSession(request, env, transport?)` returns `{hostId,headers}` or `null`. Protected handlers must forward every `headers.getSetCookie()` entry after refresh and must map thrown upstream errors to sanitized service-unavailable responses. It never returns access/refresh tokens. Authorization uses verified Auth user ID with a Discord entry in `identities`; editable `user_metadata` is ignored. Display name is bounded to 80 characters from the returned Discord identity display data and has no authority.

## Private configuration gate

No environment variable or provider setting is written by this increment. All are server-only, without `VITE_` prefixes:

- `BUD_AUTH_ENABLED=true` is an explicit activation gate; every other value is disabled.
- `SUPABASE_URL=https://cepmvqqrjcvhyzszqand.supabase.co` is pinned to the approved development project.
- `SUPABASE_PUBLISHABLE_KEY` is the development project's publishable key, not service-role credentials.
- `BUD_AUTH_COOKIE_SECRET` must contain at least 32 UTF-8 bytes; provision a high-entropy generated secret privately. Rotation invalidates all existing cookies.
- `BUD_APP_ORIGIN` must be one exact HTTPS origin without path or trailing slash. Preview deployments need their own explicitly configured origin and allowlist; no request-controlled Host/return URL is trusted.

Before activation configure Discord application credentials in Supabase, Discord's provider callback `https://cepmvqqrjcvhyzszqand.supabase.co/auth/v1/callback`, and the application redirect allowlist. The app callback is the exact configured origin's `/api/auth?action=callback&bud_state=<random-state>`; ensure the allowlist permits its query parameters while restricting the origin/path. Do not allow arbitrary deployment wildcards. Confirm actual redirect matching in isolated browser/provider testing before enabling the flag. Credentials, dashboard permissions and an actual provider login remain external prerequisites.

## Session and threat boundaries

- `__Host-bud-oauth` and `__Host-bud-session`: `HttpOnly; Secure; SameSite=Lax; Path=/`, no Domain, max ages 300 seconds and 7 days respectively. HTTPS is required; HTTP localhost is intentionally unsupported.
- AES-256-GCM encrypts/authenticates cookie content with fresh 96-bit IVs and purpose/origin-bound additional authenticated data. The configured high-entropy secret is SHA-256-derived into the encryption key. Tampering, duplicate cookie names, malformed encoding, expiry, wrong secret and cross-purpose/origin replay fail closed.
- PKCE uses a 32-byte random verifier and S256 challenge; a separate 32-byte random state travels in the allowlisted callback and encrypted browser cookie. Supabase's own OAuth state still handles the provider leg. Starting a second login replaces the browser's first pending flow; the older callback fails. The application clears flow cookies after callback; Auth's one-use code and verifier bind successful exchanges. No in-memory replay cache is claimed.
- Access tokens nearing expiry refresh server-side. Every protected resolution calls `/auth/v1/user` and binds the verified ID to the encrypted session's original ID. Absolute session expiry never slides beyond 7 days. Provider revocation of a refresh token does not instantly invalidate already-issued access tokens; provider JWT expiry/revocation behavior must be included in activation testing.
- Requests use fixed upstream origin, reject redirects, have 8-second timeouts, and bound parsed upstream JSON to 64 KiB. Encrypted cookies are capped below 4 KiB and oversized tokens fail closed. No raw upstream errors or credentials are logged/returned.
- Logout clears browser state on revocation failure; a revoked/disabled client must not display an unqualified successful upstream sign-out when `503` is returned. Distributed concurrent refresh and logout/replay behavior require real provider integration tests. No process-local rate limiter is represented as production protection.

## Verification and remaining evidence

`node --test tests/auth.test.ts`: 12/12 PASS. Covers disabled/malformed configuration, exact origin and method, provider/PKCE construction, missing/forged/expired flow cookie, state rejection, token exchange binding, encrypted session/duplicate cookies, no token exposure, ignored metadata, email-only/anonymous/changed identity denial, refresh rotation and absolute expiry, logout CSRF/revocation failure, sanitized upstream errors, sealed gallery/locale return context, malformed/oversized return payloads, legacy cookies and verified Discord avatar paths.

Explicit TypeScript check of `server/auth.ts api/auth.ts`: PASS using the repository's ES2022/DOM server target. No dependency added. These are mock-transport tests, not evidence of live Discord login. Pending: real provider round-trip, callback allowlist, secret installation, multi-tab refresh behavior, upstream outage UX, and revocation behavior. No stage gate is closed by these tests alone.

Official references inspected 2026-10-23:

- [Supabase changelog](https://supabase.com/changelog.md): .NET/Go/adapter changes do not affect this direct Fetch integration. Modern Node TLS satisfies the announced November 10 TLS cipher restriction.
- [PKCE flow](https://supabase.com/docs/guides/auth/sessions/pkce-flow): verifier/code exchange and overlapping-flow boundaries.
- [Discord provider](https://supabase.com/docs/guides/auth/social-sign-in/auth-discord): credentials and provider callback prerequisites.
- [Supabase Auth client implementation](https://github.com/supabase/auth-js/blob/master/src/GoTrueClient.ts): PKCE token request payload and challenge method.
