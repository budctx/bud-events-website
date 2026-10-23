# Host portal UX and client contract

Owner authorization: 2026-10-23 batch implementation; existing light visual language retained, no new artwork or commerce activation.

## Surfaces
- `/?screen=host`: sign-in required; honest loading, unavailable, expired-session and network-error states. No fabricated user, balance, or events.
- Authenticated dashboard: server-reported event-run count, ongoing sessions, read-only past results, new-event setup with optional timer, bounded attempt stepper and shared prize validation.
- Starting consumes the server-defined product run cost; continuation consumes no additional run. UI is advisory: server remains authoritative.
- A completed event opens a native modal summary, supports keyboard close and copying the displayed results. Event IDs remain independent of repeated titles and winner names.

## Safety and recovery
- Requests use same-origin cookie credentials. No session token is written to localStorage.
- Start uses a crypto-random idempotency key retained with the exact request body after an uncertain network outcome. Editable fields remain disabled until retry recovers its result; duplicate clicks are synchronously locked.
- Discord authorization redirects accept the current same origin or the configured Supabase project authorize endpoint with provider=discord or the official Discord OAuth endpoint. External arbitrary URLs are rejected.
- Unavailable product, missing published content or insufficient runs prevents starting. Authentication and entitlements must also be enforced by the backend.
- Purchase controls are intentionally absent until commerce has been separately authorized and configured.

## Accessibility and responsive behavior
- RTL/Arabic and LTR/English, existing Readex Pro/light palette, explicit native labels, focus rings, 44px actions, wrap-safe titles and single-column mobile layout.
- Existing accessible Radix Switch/Tooltip and reusable NumberStepper are reused. Summary uses native dialog focus trapping and Escape behavior.

## Verification
- Initial TypeScript check passed while implementing these files. Browser coverage added in `tests/browser/host-portal.spec.ts` for fail-closed auth, start retry key/body stability and narrow-viewport read-only history. Final integrated build/browser results are recorded by the root implementation task.

## SEO artifacts
- robots/sitemap contain public Arabic/English Home and Events URLs only; API paths excluded. Browser metadata component marks host/game screens noindex. Share image reuses the approved existing desktop artwork, with no generation or raster modification.
- JSON manifest retains browser display mode and uses the existing BU’D emblem. No installability or offline-operation claim.
