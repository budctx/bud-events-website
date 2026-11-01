# Clean public URLs — review package

Public navigation uses `/`, `/events`, `/bots`, `/designs`, and `/policies`. Arabic is the only current product locale, so navigation does not emit `lang=ar`. Existing root query links remain readable and are normalized using replaceState without an extra history entry. Recognized paths take precedence over stale screen query values.

Vercel rewrites only the four named public paths to index.html. APIs and assets are not rewritten. Canonical URLs and the sitemap use public paths. Policy anchors, account panels, verified payment order references, Whop inspection and coupon parameters retain their existing functions. Credentials and unrelated query values are not copied into navigation.

Local game links intentionally retain `/?screen=local&event=…`; runtime storage, restoration, timers and commerce contracts are unchanged. Exiting a game returns to `/events` or `/`. The service worker accepts the public paths for network-first HTML with the existing root-shell offline fallback; no API or user data is cached.

This branch depends on the owner-session/navigation/accessibility package (#83). Review it against that branch and merge only after #83, then verify the combined main checks. Vercel branch previews can use production-backed APIs: do not make live purchases or grants as tests.

Review direct path refreshes on the protected preview before production approval. Existing open tabs controlled by the prior service worker may need one online load to receive the new worker before offline deep-link reloads work. No production deployment is authorized by the existence of this draft.
