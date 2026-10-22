# BU'D — Question & Condition / Prize Draw UX

Delivery continuation: the later owner acceptance and homepage refresh request authorize direct production delivery of these accepted frontend changes after successful checks. See `BUD_HOMEPAGE_REFRESH.md`; earlier Preview-only statements below describe the historical delivery boundary.

Owner request: 2026-10-22, current chat and seven attached screenshots.
Baseline: main `8a60944f05718ffa2476aae7e7791eedd5fa0f5c`.
Branch: `feat/prize-draw-winners-ux`.

## Authority and execution basis

Latest owner direction adopts the current shipped interface as the visual authority and requires Code-first implementation, without Figma. It supersedes older Figma-first requirements for this scoped change. No Figma tools were called. Reference screenshots supplied by the owner guide the sidebar, winner manager, confirmation and celebration states. Existing Readex Pro, BU'D assets, light palette, borders and shadows remain the implementation base.

Expert Department OS complete core v1.6.9 was retrieved from the registered original Drive file `1UL2VU4Hw8b0_H1yp9GDQeKLTOSOSs-yB`. Governance is instruction-driven; this is not host/runtime certification. Current local workspace and repository identity verified; project memory mode UNKNOWN. Research applicability: USER_MATERIAL_ONLY for visuals; targeted reads of the project registry and original OS for governance. External research or social sampling adds no evidence to this owner-directed implementation.

S0–S9 scoped basis: current owner request, verified repository, narrow reversible frontend change, no billing/production changes; DoD is the requirements and evidence below. Readiness PASS for this scope. Coverage: UX/accessibility, React implementation, state invariants and browser QA. Independent context-isolated review (L1) complements deterministic checks. Broader Stage00/05/06/07 project gates remain outside this task and are not closed here.

## Behavior and component coverage

- `WinnerList` and `WinnerNumber`: shared sidebar and management identity. Winner record numbers remain stable after deletion; repeated names are allowed without case/name uniqueness checks.
- Desktop: inline-start sidebar (right for Arabic, left for English). Mobile: compact scrollable winner list above cards. Sticky recipient status remains visible while scrolling long prize lists.
- No automatic winner selection. Cards cannot open until an eligible record is selected. Amber selection also includes a text status and pressed state.
- Empty, single, multiple and duplicate-name states. Already awarded records show their prize and cannot receive another; revealed cards show recipient name/record number and prize.
- Opening a card shows confirmation with recipient name, stable record number and card number. Prize content stays hidden until confirmation. Cancellation preserves selection and does not mutate the prize.
- Result dialog shows recipient and prize, with bounded confetti inside the native dialog top layer. Effects can be disabled through the visible checkbox; `celebrationConfig` controls count/duration. Reduced motion suppresses the animation, including runtime preference changes.
- Winner manager supports rename and confirmed delete. Deleting an awarded record explicitly warns that its prize returns to the available cards; cancellation preserves it. Closing results remain read-only.
- Native dialogs trap focus, support Escape/backdrop dismissal, explicitly set initial focus, and restore focus after closing or management subview changes. Award confirmation initially focuses Cancel.

## Validation

`npm run build` and `npm run typecheck:server`: PASS.

32 Node tests: PASS, including duplicate-name identity, stable IDs after deletion/replacement, rename validation, one prize per record, unknown IDs, terminal closing and existing commerce/SQL guards.

26 browser tests: PASS across the existing platform suite and 10 prize UX cases. Chrome was run with `BUD_BROWSER_EXECUTABLE=C:\Program Files\Google\Chrome\Application\chrome.exe` because the Playwright-managed browser was not installed in this environment.

Prize UX coverage includes AR/EN at 1440×900, 390×667 and 360×667; empty list, duplicate records, rename, deletion/cancellation, recipient-first confirmation, hidden prize contents, two independent assignments, effect toggle, reduced motion, keyboard-only selection, focus containment and restoration, terminal read-only results, 50 prizes / eight winners / 80-character name on short mobile, and reassignment after confirmed deletion of an awarded record. Existing platform coverage additionally includes 1366×768 and 375×667.

Independent reviewer initially found two focus failures (management save focus and confirmation initial focus). They were repaired and regression assertions added. Final L1 review: PASS; reviewer independently reproduced save/cancel/delete-cancel focus restoration, initial Cancel focus and Tab containment in Chrome at 360×667 EN. Confidence high for those verified paths; other viewport/language evidence comes from the automated suite and implementer visual inspection.

Screenshot evidence: `docs/evidence/prize-draw/` contains Arabic empty/selected/management/confirmation/result desktop states and selected mobile state. Reviewed against owner screenshots, without changing the site's visual identity. Tested application code is committed as `37dd96ba30cd2f8b70b17e5ff0e6cd4db67cbb78`.

Delivery status: complete and verified locally. Automatic approval review rejected `git push -u origin feat/prize-draw-winners-ux` because exporting the code/documentation to GitHub needs explicit authorization for that destination. No push occurred; no PR, remote CI run or Vercel Preview was created. Notion evidence synchronization remains pending together with the remote delivery. Local preview is available at `http://127.0.0.1:4174/?screen=game&lang=ar` while the development server is running.

Delivery continuation: the owner explicitly approved uploading this branch, opening a PR and creating a Vercel Preview. Branch uploaded and PR [#8](https://github.com/budctx/bud-events-website/pull/8) opened, without merging. Vercel deployment `dpl_Arf36tn1trEBwJiUC2vDp4HJuPAi` for `c3c0eebb60299ab08b533b66e19f5dc07aae010f` reached READY. A protected-preview browser smoke test at 390×844 AR completed registration → sidebar selection → confirmation → reveal; prize text correct, zero page errors and no horizontal overflow. Access protection was preserved.

First CI run `39791309980` passed 32 Node tests and 25 of 26 browser tests. The pre-existing purchase keyboard test raced `Platform.navigate`'s next-frame focus handoff. It now waits for the expected main focus before moving focus to the product button; Enter activation, unavailable-payment status and restoration assertions are unchanged. Final CI run `39791824463` completed SUCCESS for `dc2e0e32e264becf0ff6ddcf5307b85c96091182`. Vercel preview `dpl_DB9VwxUSriuVFdpPjBdcQztex3wr` is READY for that SHA and serves the same application bundles as the browser-tested preview. Notion synchronization was attempted but rejected by automatic approval review because sending implementation details to the external Notion page requires explicit authorization; it remains pending. This paragraph is a documentation-only follow-up; no application code changed after the successful CI run.

## Limits

The existing game remains an in-memory local rehearsal. This change does not add persistence or activate the commerce/backend path. No production merge, paid resource or production deployment is part of this patch. Existing global project acceptance gates remain open until separately satisfied.
