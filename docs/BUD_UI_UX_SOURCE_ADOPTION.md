# BU'D UI/UX reference audit — 2026-10-22

Scope: targeted inspection of the five owner-named sources. This report is research evidence, not approval to replace BU'D Figma. No code adoption, animation export, paid subscription, new integration or publishing occurred in this lane. All proposals need implementation callsites + preview screenshots + acceptance results before the register can say IMPLEMENTED.

## Exact inspected sources and disposition

| Source | Exact inspected example | Direct observation | Concrete BU'D proposal | Status / exclusion |
|---|---|---|---|---|
| Godly | https://godly.design/website/gitnimble/ and its desktop/mobile images | Both desktop and mobile visual captures inspected. Product screenshot and feature cards retain a consistent dark frame; the mobile composition stacks the same core content and keeps CTA readable. | Treat desktop/mobile as paired acceptance targets; preserve Figma's product-art frame, short title, short value statement and one strong details action across breakpoints. Use a 2px/short lift on eligible pointer hover only. | PROPOSED benchmark discipline, not copied layout. No source imagery or branding for BU'D. |
| Transitions.dev | https://transitions.dev/ ; https://transitions.dev/studio.html?lib=modal-open-close ; https://transitions.dev/detail.html?t=page-side-by-side ; https://transitions.dev/detail.html?doc=introduction | Library names a scale-based modal, forward/back page transition and moving tab indicator. Official docs describe shared duration/easing/distance tokens, reduced-motion instant states, DOM/text state parity and semantic buttons. | One shared motion scale, initially 180ms controls / 240ms sections (BU'D engineering choices, not source-measured constants). Product dialog opacity + subtle scale; section transform + opacity; direction-aware travel in RTL/LTR. State updates immediately. Reduced-motion removes all movement. | PROPOSED architecture; no snippets copied. Reject confetti, gooey menus, 3D cursor glare and permanent blur as unnecessary for Figma fidelity/performance. |
| Animos | https://animos.app/ ; https://animos.app/editor | Homepage describes looping media showcases and MP4/WebM export. Editor screenshot shows Card Globe and other 3D/perspective templates behind a Pro upgrade overlay, with commercial rights listed as a Pro feature. No export performed. | Optional later gallery-demo media only: a short Q&C reveal showcase, user initiated, static poster by default, no audio, pause control, stop offscreen and show poster under reduced motion. Preserve product gameplay state outside media. | INSPECTED / MEDIA DEFERRED. Commercial-use rights for free exports unresolved; no asset/code adoption. Not a React runtime animation engine. |
| Deck.gallery | https://www.deck.gallery/burger-king-brand-2020/ ; public cover and Introduction slide images | Warm limited palette, large type, clear rounded section framing and short section titles visible in public preview. Full deck is membership-gated; only public preview inspected. | Apply the editorial lesson to Figma-preserving gallery/modal copy: one title, one short explanatory sentence, one CTA; keep game setup/live/prizes/closing as distinct compact sections. | PROPOSED composition lesson; no Burger King typeface, logo, assets or brand forms copied. Full 129-slide deck not inspected. |
| Cocodly | https://www.cocodly.com/ ; https://www.cocodly.com/about | Public About page explicitly addresses completeness beyond the landing surface and honest scope; workflow covers refinement in context and real-code delivery. Home shows design token/state examples and a visible build plan. | Build real loading/unauthenticated/unavailable/error states, disable unavailable checkout honestly, keep upcoming product state explicit, and require exact-SHA UI/API/data tests before readiness. Do not display placeholder reviews as endorsements. | PROPOSED completeness discipline; no service connected, no stack replacement or generated code copied. |

## License and performance decisions

- Godly/Deck/Cocodly: public visibility is not a reusable-asset license. Observe principles; use no downloaded site asset in the product. Research screenshots stay evidence only.
- Transitions: official public docs advertise free recipes without accounts, while Pro advertises commercial access. Terms URL retrieval failed in this audit. Use our own short CSS implementation of general transform/opacity patterns; do not copy paid recipes or claim a license was verified.
- Animos: do not equate free export with clear commercial rights. Editor's upgrade overlay makes the current free-commercial status uncertain. No media adoption before resolution.
- Animate opacity/transform; avoid animating layout dimensions or broad `transition: all`. Avoid permanent `will-change`. Validate on short mobile screens and prefer static, legible content over movement.
- Modal acceptance: native semantic dialog, focus moves inside, focus remains inside, Escape closes, focus returns to trigger, internal overflow preserves close/CTA, screen-reader title, reduced-motion alternative. Verify rather than assuming animation confers accessibility.
- Coming-soon acceptance: item can open informative product details but has no false purchasable state; never fabricate price, testimonials, partner identities or successful payment.

## Research evidence files

- `reference-evidence/godly-gitnimble-desktop.png` — Godly-published desktop screenshot, inspected through retrieval image.
- `reference-evidence/godly-gitnimble-mobile.png` — corresponding mobile screenshot, inspected through retrieval image.
- `reference-evidence/animos-editor.png` — rendered editor capture with Pro overlay, inspected locally.
- `reference-evidence/transitions-public.png` (110KB), `cocodly-public.png` (897KB), `deck-public.png` (348KB) — rendered public captures saved, nonempty and inspected locally. Public web retrieval text and Deck public slide images were inspected independently.

## Evidence limitations / handoff

No runtime interaction timing was measured on these external sites. The 180/240ms proposal is a reversible local design choice. No claim of all-five-source code adoption is justified. Root should fill a final table with source -> actual code callsite -> exact-SHA preview screenshot -> test -> IMPLEMENTED/PROPOSED/DEFERRED. Preserve Animos as deferred if commercial rights and actual asset use remain unresolved; that is more accurate than forcing an unrelated runtime dependency.

Native Expert OS verdict for this lane: LIMITED / evidence-backed proposals ready; implementation adoption not yet verified. Qualification: research access sufficient for public-source comparison, no license counsel or independent product QA claimed.

## Current code adoption, checked 2026-10-22

| Source | Implemented callsite / evidence | Acceptance |
|---|---|---|
| Godly | Platform.tsx shared CardPreview/card information; platform.css paired responsive layout. docs/evidence/home-desktop.png and home-mobile.png; browser matrix AR/EN ×5sizes. | Implemented benchmark method; source branding/imagery not copied. |
| Transitions.dev | tokens.css control180ms/section240ms; platform.css transform/opacity section entry, native dialog open/close discrete transitions and reduced-motion overrides; Game card flip420ms. | Implemented original CSS, no third-party recipe copied. Focus8Tabs/Escape/restore and reduced motion tested. Duration is local choice, no external timing measurement claimed. |
| Deck.gallery | Platform gallery title, single supporting sentence, clear details CTA; Product Modal compact copy. | Implemented editorial principle within Figma constraints; no deck assets copied. |
| Cocodly | Platform explicit upcoming/checkout-unavailable/legal preparation; API rejects unconfigured/authless operations; no invented partner/review content. | Implemented honest state discipline; payment integration still blocked, no fake success. |
| Animos | Public editor inspected, screenshot docs/evidence/reference-animos-editor.png. | Deferred media. Commercial license unresolved; no export, asset, runtime dependency or claim of adoption. |

Evidence screenshots from other references are prefixed reference- in docs/evidence and never bundled as product assets. Research screenshot files are direct retrieval artifacts, not proof of measured runtime speed. Native browser tests verify current implementation interaction; whole-product performance/a11y certification and full visual parity remain open.
