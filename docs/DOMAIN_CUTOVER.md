# BU’D domain cutover — 2026-10-30

Canonical origin: https://budteam.net. Previous origin: https://bud-events-website.vercel.app.

DNS: Spaceship A @ 216.198.79.1; www CNAME e7b91311bc0c39ad.vercel-dns-017.com; Vercel www redirects to apex. Nameservers remain at Spaceship.

Supabase: same project and Discord identity provider; Site URL and exact application callback allowlist updated. Preserve old callback during the transition. No credential rotation.

Whop: update the existing BU’D webhook URL in place; preserve signature secret, events and version. New checkout return URLs derive from BUD_APP_ORIGIN. Existing checkout links may retain the old URL; the temporary root redirect preserves query parameters. API routes are not redirected.

Runtime: BUD_APP_ORIGIN changes to the new exact HTTPS origin. Browser session cookies are host-only and origin-bound; users sign in again. Local game progress, drafts, service worker cache and pending UI markers do not migrate between origins. No local progress is uploaded. Root redirect excludes screen=local to avoid forcibly navigating an old running game. No unexpired open live events were found during pre-cutover inspection.

Schedules: update only URLs in the two existing cron commands using cron.alter_job; retain job IDs, active state, schedules and Vault token references. Do not edit historical migrations or enable new financial flags.

Validation: exact-SHA server typecheck, build and tests; live HTTPS and auth boundary probes; provider login round-trip; scheduled worker heartbeats and signed webhook delivery. No real payment, grant, Redeem or paid event is created as a test.

Rollback: revert release and BUD_APP_ORIGIN, restore Site URL, existing webhook URL and cron command host; remove temporary root redirect. DNS can stay attached to the same project. Code rollback does not undo provider settings or cron commands. Never delete payment/credit ledgers.
