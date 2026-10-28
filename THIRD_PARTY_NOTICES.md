# Third-party assets

- Question, timer and condition glyphs: Lucide, ISC. Exact approved BU’D Figma instances, preserving source geometry and optical sizes.
- User glyph and component adaptation reference: Figma Simple Design System, MIT. See the included SDS notice.
- Readex Pro: Google Fonts / SIL Open Font License, delivered through `@fontsource-variable/readex-pro`. See the included font notice.

Notices are in `licenses/`. Application code has no general redistribution license granted by this initial implementation; package metadata is `UNLICENSED`.

- Radix UI Switch and Tooltip (and Radix runtime primitives): MIT, Copyright (c) 2022 WorkOS. See `licenses/radix-ui-MIT.txt`. Custom BU’D appearance; no paid animation recipes copied.
- Official white Discord symbol: unchanged brand asset from https://discord.com/branding (download source: https://cdn.prod.website-files.com/6257adef93867e50d84d30e2/66e3d7f4ef6498ac018f2c55_Symbol.svg). Discord branding remains the property of Discord; used only to identify the sign-in provider.

# Third-party component references

## Untitled UI ButtonUtility

`src/ButtonUtility.tsx` adapts the public ButtonUtility component pattern to BU’D's existing CSS tokens, Lucide icons, React Aria button interaction, and Radix tooltip. Source: https://github.com/untitleduico/react/blob/main/components/base/buttons/button-utility.tsx

MIT License

Copyright (c) 2025 Untitled UI

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Aceternity UI interaction references

The step-loader and expandable bot card are independently implemented, styled for BU’D, accessible adaptations of these publicly documented patterns using Motion:

- https://ui.aceternity.com/components/multi-step-loader
- https://ui.aceternity.com/components/expandable-card

The requested paid block https://ui.aceternity.com/blocks/cards/expandable-card-on-click was not copied. The free expandable-card example is the interaction reference. No demo images, artist profiles, fabricated bot products, or automatic time-based success states were imported. Progress is driven by actual API milestones.

- React Aria Components: Apache-2.0, Adobe. See `licenses/react-aria-components-Apache-2.0.txt`.
- Motion and Framer Motion: MIT. See `licenses/motion-MIT.txt` and `licenses/framer-motion-MIT.txt`.

- Magic UI Magic Card (MIT, Copyright (c) Magic UI): adapted gradient mode for BU’D light palette, mouse input and reduced motion. Source: https://magicui.design/r/magic-card.json. See `licenses/magicui-MIT.txt`.
- Mantine Core, Hooks and Carousel: MIT, Vitaly Rtishchev. See `licenses/mantine-MIT.txt`. Carousel is scoped and loaded only in Events.
- Embla Carousel and React adapter: MIT, David Jerleke. See `licenses/embla-carousel-MIT.txt`.

- Magic UI Ripple Button (MIT): adapted for BU’D native purchase button, keyboard-centered waves, touch, bounded ripple state, and reduced motion. Source: https://magicui.design/r/ripple-button.json. See `licenses/magicui-MIT.txt`.
- Saudi riyal symbol: official SAMA design, local SVG asset. Primary source and usage guide: https://www.sama.gov.sa/ar-sa/Currency/SRS/Pages/Guideline.aspx. Download mirror used when SAMA returned HTTP 503: https://github.com/abdulrysrr/new-saudi-riyal-symbol/blob/main/svg/Saudi_Riyal_Symbol.svg (MIT; see `licenses/saudi-riyal-mirror-MIT.txt`). The symbol is not drawn or substituted with a generic currency icon.
