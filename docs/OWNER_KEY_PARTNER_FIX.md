# Fixed key lifetime and partner field errors

New owner-issued keys expire three calendar months after their database creation time, calculated in UTC with calendar month-end behavior. The owner form no longer accepts an expiry date. The SQL migration replaces only `bud_owner_command`, preserving its authorization, operation lock, audit receipts, grants and other commands. Existing key rows are not changed. Legacy payloads with `expiresAt` remain accepted and retain their audit request identity, but the date is ignored for new issuance. Receipt replay returns before issuance, so retries do not extend expiry.

Apply `20261101082718_fixed_key_lifetime.sql` before releasing the new frontend/server: the previous database function required an expiry input. Verify the deployed function definition and permissions without issuing a real key. The old frontend remains compatible with the new function. Do not roll the database back while the new frontend is active; roll back the application first if necessary.

Partner inputs show Arabic errors by field for name, HTTPS/image format, optional website and sort order. Review save stays actionable, focuses the first invalid field and does not submit invalid data. Failed image previews identify the logo field and offer retry. Direct image URLs and copied Markdown links normalize to the same URL; the supplied image2url PNG opened as a 500×500 image in the browser. Browser tests mock its response rather than rely on external hosting.

No live grants, key issuance, partner changes or production migrations were performed while preparing the package. Full local and GitHub checks must pass before release approval.
