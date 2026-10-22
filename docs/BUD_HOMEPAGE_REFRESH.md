# BU'D homepage clarity and artwork refresh

Owner request, 2026-10-22: accept the prize UX, inspect competing websites, improve homepage button clarity and placement on mobile/desktop, regenerate cleaner background art, place the official BU'D emblem on both light/dark cards for both sizes, and publish directly without another approval round. This is explicit authorization for production delivery after checks; it supersedes the previous Preview-only restriction for these accepted changes. No billing, purchase activation or unrelated infrastructure changes are authorized.

## Observed references and decisions

Read the official homepages through Firecrawl. These are adjacent Arabic group-game references, not an exhaustive competitor study or a claim of measured conversion improvement.

- [Jam3aa](https://jam3aa.com/): concise game introduction followed by “العب الآن” and “كيف تلعب؟”. Adopted the distinction between a primary next action and an explanatory secondary action; BU'D keeps its own wording, identity and multi-product structure.
- [Seen Jeem](https://seenjeemkw.com/): game creation and purchase actions accompany game/category explanations and a FAQ. Adopted a short explanation before asking visitors to commit; did not import its pricing, account requirements or content.
- [Jawaker](https://www.jawaker.com/ar/home): game catalog and game guides are distinct surfaces. Retained the BU'D Events/Bots/Designs galleries and clear coming-soon labels; no forced sign-in for browsing.

Inference for BU'D: keep one amber homepage CTA, “استكشف الفعاليات”, and a secondary “كيف تعمل بُعد؟” action opening a reusable native dialog with three concrete steps and a functioning gallery CTA. Keep the existing umbrella-brand heading, palette, font and portal concept. No Figma access. No invented testimonials or partners.

## Implementation

- Header tools now share a normal-flow row. Mobile has a separate navigation row, with at least 44px targets; language/login no longer compete for absolute coordinates.
- Homepage copy explains Discord community products. Primary and secondary actions are distinct; short helper copy explains browsing and trying before purchase.
- Mobile uses stacked full-width actions, with artwork below the reading/action area. Desktop keeps side-by-side text/art and mirrors the scene placement in English, counter-mirroring the exact logo vectors.
- New `HeroArtwork` component keeps proportional artwork geometry and the exact official SVG emblems together. Both card marks scale/rotate with their surfaces; no model-redrawn logos. The dark-card variant changes only the original charcoal fills to ivory for contrast; all original paths are retained.
- Regenerated landscape and portrait images have clean blank card faces. The original SVG marks are overlaid as decorative vector assets, preserving their shape at any resolution.
- WebP is served by `picture`, with size-specific PNG fallbacks, high fetch priority and explicit dimensions. Desktop WebP: 103,470 bytes; mobile WebP: 90,588 bytes. Original generated PNGs are retained as fallbacks. No generative logo distortion is shipped.
- Art is excluded from pointer interactions and the accessibility tree. Header/footer sit above artwork; horizontal clipping prevents the section transition from creating a transient horizontal scrollbar.

## Assets and generation provenance

Built-in `image_gen` mode used; no API/CLI fallback. Inputs were existing local desktop/mobile illustrations and a raster rendering of the exact official SVG. First generated logo attempt was rejected visually; the final scene has blank faces with deterministic SVG overlays.

Final saved images:

- `public/assets/home-portal-desktop-v2.png` and `.webp` (1536×1024).
- `public/assets/home-portal-mobile-v2.png` and `.webp` (941×1672).
- `public/assets/bud-emblem.svg` (existing original) and `bud-emblem-light.svg` (same vector paths, contrast variant).

Final desktop edit prompt:

> Precise edit of this finished BU'D landscape hero image. Remove ONLY both geometric emblems from the charcoal and ivory playing cards, leaving perfectly clean blank smooth card faces with same lighting. The official vector emblems will be composited exactly by the website, so DO NOT draw any symbols or logos. Preserve all other geometry, colors, placement, camera, portal, clouds and cream negative space unchanged. Smooth ceramic material, clean high definition edges, no noise. Maintain landscape 3:2 aspect ratio and highest available resolution. No text or watermark.

Final mobile prompt:

> Create a crisp premium regenerated MOBILE portrait 9:16 hero illustration for BU'D. Image 1 is the old mobile composition, image 2 is the newly approved desktop art style and scene. Preserve the brand: warm cream #F6F0E2, amber #FBB03B and charcoal #333333, smooth satin materials and soft warm light. Mobile adaptation: one amber rounded rectangular gateway with charcoal and ivory inset layers, gently glowing interior, subtle sun disk behind, airy restrained clouds and pale floor. Place scene fully in lower 62% of canvas and leave top 38% uninterrupted smooth cream for mobile text. Two floating BLANK playing cards at lower-right of the portal, one clean matte charcoal behind, one clean ivory white in front. Both must have rigid physically correct planar rectangular surfaces and precise rounded edges. Faces completely blank: NO dots, NO symbols, NO logos, NO letters, NO text. The exact official vector logos will be placed by the website later. One thin amber orbital arc can go behind the cards, never across their face centers. Entire portal and both cards safely inside composition, no clipped edges, no warping, no melty geometry, no speckled texture or coarse noise, no extra objects, no watermarks. High-definition photorealistic stylized 3D, not a website screenshot. Highest available resolution, portrait 9:16.

## Validation and governance

Scoped Expert OS v1.6.9 instruction-driven lifecycle continues from the verified original source. Readiness basis: explicit owner intent, current repository, reversible frontend implementation, existing reusable components and meaningful browser/state checks. Source research is targeted to the requested competitors; implementation decisions remain the owner's scope. This does not certify the host or close unrelated project stages.

Build/server typecheck passed. Existing 32 Node tests and all 10 prize browser tests passed after the homepage changes. Homepage suite expanded to 18 browser tests covering AR/EN, target size, actual hit-testing, no horizontal overflow, source image decode, native modal keyboard containment/restore and gallery navigation. Additional 320×568, 768×1024, 844×390 landscape and 1920×1080 paths complement the existing desktop/mobile matrix. Independent review and exact-SHA CI gate production delivery.

Screenshot evidence is in `docs/evidence/homepage-refresh/`. Notion synchronization remains pending the separate explicit destination authorization requested earlier; no retry or external Notion write is part of this homepage request.

Independent context-isolated review: PASS. Reviewer separately exercised ten AR/EN journeys across 1440×900, 390×844, 768×1024, 844×390 and 320×568 in Chromium. No obscured controls or horizontal overflow; How dialog trap/Escape/return focus and Explain→Events focus pass. Both official vector marks align within their cards; desktop/mobile WebP variants load. Confidence high for those tested layouts; no claim of separate Safari/Firefox device execution.
