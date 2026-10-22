# BU’D — Repository hygiene / archive register

Audit date: **2026-10-22**. Cleanup based on official website SHA `7cb565cdbbfd9d0414271baf27a61ff1fd958bf3`. No git-history rewrite or destructive archive cleanup.

## Source-of-truth

- Official website is [bud-events-website.vercel.app](https://bud-events-website.vercel.app), built from GitHub `main`.
- Source of owner approvals and mandatory stage gates is [Notion](https://app.notion.com/p/401b475e25f18133bdedc0fab9ee1287).
- Historical early branches/PRs are **not** current product requirements.

## Retired code — recoverable from historical main commit

Old source:
- `src/FoundationPreview.tsx`: unmounted component from participant-era / Dark Mode specimen
- `src/components/Button.tsx`, `src/components/Icon.tsx`, `src/components/PlayingCard.tsx`: no production imports
- `src/event-core.ts`, `src/preview-state.ts`, `src/journey-copy.ts`: participant-centered experimental state/copy; not imported by current production routes
- `src/i18n.ts` retains only the shared `Locale` type; unused historical texts/pairs removed

Old tests (not part of current `npm test`, and assert superseded participant or dark-mode functionality):
- `tests/browser/preview.spec.ts`
- `tests/browser/journey.spec.ts`
- `tests/event-core.test.ts`
- `tests/state.test.ts`

To inspect any retired source, use a historical commit **without reintroducing it**: `git show 7cb565c:src/FoundationPreview.tsx`; equivalent GitHub tree at [pre-cleanup main SHA](https://github.com/budctx/bud-events-website/tree/7cb565cdbbfd9d0414271baf27a61ff1fd958bf3).

Do not delete image assets or archived screenshot evidence only because a current component no longer references them; provenance and license reviews should be separate.

## Historical but preserved

- `feat/figma-foundations`: ancestor of merged product work; keep for design provenance.
- `feat/bud-platform-production-20261022`: merged to main via PR #4; keep for release provenance.
- `feat/notion-ci-evidence-governance-20261022`: merged via PR #5; keep for rollback/traceability.
- `feat/codex-platform-foundation-20261022`: **diverged** (4 commits ahead / 15 behind from main at audit). Includes historical `AGENTS.md`, old `src/PlatformLanding.tsx`, design-only Supabase scripts and obsolete layout. Do not merge wholesale; keep branch for selective archival/research.
- PR #2 and PR #3 were obsolete unmerged drafts that targeted `feat/figma-foundations`. They must be closed as superseded with links to PR #4, **without deleting branches**.
- `docs/implementation.md`, `docs/verification.md`, `docs/bot-impact-study.md` are dated historical work; their participant/bot clauses are superseded.

## Follow-up controls (not implied completed by cleaning)

- GitHub `main` branch ruleset: requires admin setup; connector read returned 403 and `protected: false`.
- Notion CI evidence writer: merged in PR #5, but missing Actions credentials means publication step is skipped, not fully operational.
- Review original screenshot/evidence asset copyright and redundant large binary storage separately; **no bulk deletion during safe cleanup**.
- Stage 00, detailed 140 gates, 73 detailed test cases, Stage 01–14 closure statuses remain unchanged by this repository cleanup.
