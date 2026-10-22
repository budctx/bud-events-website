# Fixed inline event sample — 2026-10-22

The owner replaced the publicly usable full rehearsal with a fixed two-card sample in the Events product tile. The latest Code-first website direction and standing publication authorization apply. Earlier host-workspace improvements remain source/development work, but no longer form the public sample.

## Behavior

- `EventPreview.tsx` replaces the gallery's decorative pair. The question is always “اذكر دولة” / “Name a country”; the condition is always “تبدأ بحرف س” / “Starts with S”. Each card reveals independently. The product tile itself no longer opens its modal when the sample is clicked; View event remains the details action.
- After both cards reveal, a five-second numeric timer and circular shrinking progress indicator appear above them. The timer uses a monotonic deadline and reconciles on visibility changes. It stops at zero. No answer validation, winner names, prizes, configuration or event rounds exist in this component.
- Try again repeats the same pair, resets the timer and restores first-card focus. Locale changes and navigation away reset/unmount the sample. Keyboard buttons, screen-reader labels/status and reduced-motion instant flips/static ring are supported.
- Product/how modal Try cards actions close the modal and focus the inline sample, without opening the host workspace.

## Public/development boundary

`App.tsx` imports the full host workspace only through a development-only lazy branch. Production builds omit that module. Production `?screen=game`, including the retired legacy query variant, shows Events with the fixed sample. The complete workspace remains available in local development for continued implementation. Production paid hosting is not being activated; future access must be connected to server-verified entitlements. No payment/OAuth configuration changes occur.

An initial local test detected stale host bundles from older builds in `dist/assets`. The temporary build output was safely removed within the workspace and rebuilt. Tests inspect every emitted JS file for host implementation markers, in addition to testing production route behavior. CI builds from the checkout before testing; Vercel production output must match the verified candidate. This does not revoke copies of previously downloaded public builds.

## Verification

Build and server typecheck,34 logic/backend tests,39 retained host/platform browser journeys and8 new built-production sample journeys. Tests exercise both reveal orders (keyboard/mouse), no timer after only one card,5→3→0 countdown and ring depletion, same-pair replay, route/CTA separation, locale/unmount reset, AR/EN at1440/390/320 widths and reduced motion. Browser tests now run a development server and a separate built-production preview; run build before npm test.

Independent Expert OS review: PASS for AR/EN desktop/mobile, timer/keyboard/replay/focus, locale reset/reduced motion, production legacy route behavior and omission from the active production bundle. The stale local output observation was addressed with a clean rebuild and whole-output assertion. Visual evidence: `docs/evidence/inline-event-preview/`. Exact-head CI and deployment records belong to the associated GitHub PR. No Notion write or broader stage sign-off is included.
