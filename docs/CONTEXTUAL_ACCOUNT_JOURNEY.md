# Contextual account and event keys

Owner direction, 2026-10-23, Asia/Riyadh. Code-first against the current website; no Figma.

- Sign in from Home, Events, Bots or Designs returns to that gallery and language. The server seals only the allowlisted enum and locale into the existing encrypted PKCE flow cookie. It accepts no arbitrary return URL. The provider callback path and configured Supabase allowlist are unchanged.
- A verified Discord name and static CDN avatar replace the header sign-in button. Missing or failed avatars have an initial fallback. The account menu supports mouse hover/click, touch, keyboard arrows/Escape and outside dismissal. It exposes History and Sign out.
- The old `screen=host` URL maps to Events. Sign in never opens the generic host workspace. Event setup and read-only event history reuse the existing protected host component inside the platform. Production gameplay still requires a server event; no public full-game trial was restored.
- The Question & Condition card displays the actual protected wallet balance as keys. This is the only current wallet-backed product; do not reuse this balance for future products without separate entitlement accounting. Unknown/error balances are distinct from zero. Window focus refreshes the session and keys, including after a future provider checkout return.
- The product-details modal and View event action are removed. The primary card action is Buy now. Guests sign in and return to Events; no checkout is automatically created on return. Signed-in buyers call the server-only checkout endpoint with a stable per-account idempotency key. Repeated clicks are locked and retries reuse that key. Only the existing exact sandbox Whop checkout URL shape is accepted.
- Keys greater than zero expose event setup. Ongoing server events can be resumed from the card or History. Starting still checks the server balance, product and published content; the browser never grants a key or bypasses those checks.
- Logout clears cached identity, balances and history even when upstream revocation fails. Focus refresh is suppressed during logout. Child API authentication loss invalidates the shared account and cancels outstanding account reads. Keyboard focus moves into History/setup and returns to its trigger on Back.

## Validation boundaries

Server tests cover all gallery/locale pairs, malformed/oversized return bodies, encrypted flow tampering boundaries, legacy-cookie fallback, and trusted/untrusted Discord avatar sources. Browser coverage includes public CSP, no product modal, direct checkout failure/retry, zero versus unknown balance, focus refresh, menu input modes, long names at 320/390/1440 in AR/EN, session loss, logout races, history, persistent start retries and lost-response recovery.

Local account screenshots use mocked session/balance data for UI QA; they do not prove a Whop purchase. Production Auth was configured in the preceding increment, with the owner reporting successful Discord login and showing the old protected dashboard. The new release still needs a real account check of its updated return/header behavior.

Whop remains unconfigured/disabled. Its existing server adapter is sandbox-only. No live checkout, price, key credit, policy approval or commercial readiness is claimed. Next phase: configure the owner's sandbox account, agreed product/plan/currency/amount and versioned signed webhook, then verify provider payment → durable order → one key → card refresh before considering production payments.
