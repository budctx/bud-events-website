# Figma implementation — first bounded slice

Source file: `STOmHGc7E9OQudKbyWDEli`.

| Reference | Node |
|---|---|
| Live mobile, Light | `104:2470` |
| Live desktop, Light | `104:2155` |
| Live mobile, Dark | `104:3091` |
| Live desktop, Dark | `104:2776` |
| Button families | `26:1847`, `26:1872` |
| Card pair | `98:664` |
| Host judgment | `98:1240` |

React + TypeScript + Vite, with plain CSS semantic tokens. This repository was empty; there was no existing application framework to migrate. Readex Pro is self-hosted through Fontsource. No paid runtime service is required for this component preview.

This slice implements the live screen and reusable button/icon foundations. The phase rail is a semantic progress indicator; setup/prize/closing routes and all authentication, payments and event persistence remain future slices. Preview controls sit outside the design viewport. `?canvas=1&lang=ar&theme=light` hides those controls for comparison.

Card reveal is independent. The local demonstration clock starts once after both cards and awaits host judgment at zero. The reducer handles retries with fresh pairs and terminal qualification without awarding a prize. This local reducer is not an authoritative event backend. The session duration is a static fixture, as in Figma.

The public Figma asset endpoint returned an HTML unavailability response. The exact visible native glyph instances were exported directly as SVG instead; no path geometry or SVG dimensions were rewritten. `figma-assets.json` records actual source IDs and sizes. Theme-specific files preserve the approved foreground colors. Desktop card icons use the native 48px exports; compact cards use native 32px exports; user/timer use native 24px exports.

On narrow/zoomed screens content can reflow vertically rather than be cropped. The initial 390×844 specimen fits its reference viewport; this is not a universal no-scroll guarantee.

Next slices: approved setup and prize screens; server-side event state and host authorization; Discord identity and participation; verified Whop payment events; necessary email notifications. Review an actual Vercel Preview before production release.
