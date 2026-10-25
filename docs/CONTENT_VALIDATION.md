# Private content review tooling

Commercial card inventory, editorial answers and owner review documents are kept local/private because this repository is public. They are explicitly ignored, never force-added, and are not imported by the client. Publication into the existing private server content contract is a separate reviewed operation; these tools never contact Supabase or Whop.

`node scripts/validate-question-condition-content.mjs` validates the local candidate at content/question-condition/bank.json against editorial-answers.json. It checks stable IDs, both locales, duplicate labels, bounded text, complete Cartesian coverage and at least two distinct lexical examples per pair/locale. Each word must contain letters in its intended script; combining marks alone are not words. The eight condition rules are explicit, including word counts and four-letter minimum. Errors expose IDs/locale only.

Mechanical success does not establish semantic correctness, enjoyment, owner acceptance, publication or payment readiness. The tool deliberately does not attest those claims. Independent editorial review must bind its conclusion to the exact private asset hashes; a new revision invalidates earlier asset evidence.

Public CI uses only `tests/fixtures/content-bank.mjs`, a synthetic noncommercial office example. Negative tests exercise missing/duplicate pairs, wrong conditions, missing translations and combining-mark answers. No private inventory or editorial example file is needed in CI.

To review actual private card typography locally, set BUD_CONTENT_REVIEW_DIR to the local content directory and run tests/browser/content-bank.spec.ts. Otherwise the same typography checks use the public fixture. Tests use the existing host card UI with mocked APIs, load and verify Readex Pro Variable, then measure every proposed label against card/title/footer bounds at320/390/1440px in AR/EN. This is isolated typography evidence, not a real persisted event, live content publication or payment test. Screenshots and private proof logs remain ignored/local. Do not upload local traces, screenshots or logs containing private card text as public CI artifacts.

No runtime routes, UI components, content database, wallet, credentials, provider settings or financial controls are changed by this preparation.
