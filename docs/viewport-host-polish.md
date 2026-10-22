# Viewport and host polish — 2026-10-22

The owner's latest instruction authorizes Code-first implementation and production publishing, with the current website as the visual source of truth. No Figma work or new art regeneration was needed in this iteration. Prior homepage art and the two exact BU’D emblem overlays remain in use.

## Delivered scope

- Mobile Home uses the dynamic viewport, with the scene integrated across the page and a cream gradient protecting text contrast. Portrait 320×568 through 430×932 and short landscape 568×320, 667×375 and 844×390 are exercised in AR/EN. Footer and CTA separation is asserted; controls are not hidden by overflow clipping. Events and game setup can scroll naturally where their content needs it.
- Desktop fine-pointer navigation changes from icons to labels on hover and keyboard focus. Touch and narrow layouts retain text. Decorative animated faces do not intercept other buttons' pointer events.
- The event-specific three-step explanation lives in Events, with an action opening the existing local demo. Home keeps one primary Explore events action.
- Official white Discord symbol and #5865F2 identify the sign-in button. Its existing honest unavailable state remains; OAuth and purchasing are not activated.
- Reusable `AnimatedSwitch` and `HelpTip` in `InterfaceControls.tsx` use Radix UI primitives. Timer duration controls appear only when enabled; the live timer remains absent when disabled. Help supports hover, focus, Escape, touch toggle and outside dismissal. Validation errors remain directly visible.
- Game return control is an accessible exit icon. `PrizeReveal.tsx` adds a 1,250ms gift anticipation sequence with a persistent, focused Reveal now button; it transitions to Continue draw without losing focus. Reduced motion reveals immediately. Confetti begins only at reveal, lasts 3,200ms and respects the existing celebration setting and reduced motion. Award assignment remains single-use in the reducer and survives closing the visual sequence.

## References actually adopted

The owner-named Godly, Transitions.dev, Animos, Deck.gallery and Cocodly references are inspiration sources, not previously installed component libraries. The earlier reference audit remains historical evidence; its Figma-specific constraints and rejection of confetti were superseded by the owner's later explicit instructions.

- Radix Switch and Tooltip official documentation: https://www.radix-ui.com/primitives/docs/components/switch and https://www.radix-ui.com/primitives/docs/components/tooltip. Newly installed MIT primitives, customized to BU’D. Notice included in `licenses/radix-ui-MIT.txt`.
- Transitions public motion guidance: https://transitions.dev/detail.html?doc=introduction. Original transform/opacity animation, short durations and reduced-motion alternatives; no paid snippets copied.
- Discord official brand source: https://discord.com/branding. White symbol download provenance is recorded in `THIRD_PARTY_NOTICES.md`.

## Verification and scope limits

`npm run build`, `npm run typecheck:server` and `npm test` cover application types, server types, 32 logic/backend tests and 34 browser journeys. New checks include viewport fit and footer separation, pointer-aware navigation, Discord branding, optional timer controls, touch/keyboard tooltips, suspense skip/automatic reveal, focus retention and reduced-motion instant reveal. Native Chrome screenshots are in `docs/evidence/viewport-host-polish/`.

Expert OS independent read-only review found a desktop hit-testing issue and a short-landscape overlap. Both were fixed and independently rechecked in AR/EN, with all four nav centers clickable and no CTA/footer overlap at 568×320 or 667×375. Final review: PASS within this scope. This is not whole-product accessibility certification or stage-gate sign-off.

Vite emits nonblocking warnings about Radix's `use client` module directives; this application renders entirely on the client. Production JS is approximately 103.2kB gzip (previously 81.8kB), reflecting the accessible controls dependency. Exact commit CI and production deployment evidence belong to the associated GitHub PR. No Notion write is performed in this lane because its destination authorization is separately unresolved.

## Owner screenshot corrections — 2026-10-22

The desktop scene previously ended at main content, above the footer. HeroArtwork now belongs to the Home root and covers its complete height, with the original image ratio preserved. Mobile footer links have fully transparent backgrounds. Timer labels stack above the switch. A reusable bounded 1–3 NumberStepper replaces the attempts select, supports buttons and Arrow/Home/End keys, and never submits the form when stepped. Help markers are 11px plain text without a circular border/background; touch targets retain invisible padding. Tooltip content uses a compact translucent surface without the former border or hard shadow. Independent read-only AR/EN review at1243×845,1440×900,390×844: PASS; verified background continuity, transparent links, control bounds/keyboard, label placement and touch tooltips. The expanded suite has32 logic/backend tests and36 browser journeys. New visual evidence: docs/evidence/artwork-controls-correction/.
