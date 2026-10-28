# Shared public header/footer and icon-button review

Owner request: unify the existing header and footer across current public sections, investigate an open-source header alternative, and identify text buttons that could use icons.

## Implemented

The existing shared JSX in `src/Platform.tsx` already renders one header/footer. The inconsistency came from page-specific CSS: home-only centering, header offsets, wide-screen gutters and compact footer/mobile rules. Those chrome rules now apply to every public section at the same viewport. Content-specific home composition stays scoped to home.

Desktop: brand at the left edge, navigation centered, Discord/account at the right edge. Mobile: the same responsive rows, spacing and footer treatment in Home, Events, Bots and Designs. Footer remains in document flow, so its vertical position follows page length. Standalone owner administration and the full-screen event runtime retain their task-specific controls.

Regression coverage compares header/brand/navigation/account geometry and footer layout across all four sections, signed in and anonymous, at widths 320, 390, 700, 768, 920, 1440 and 1920. Existing home viewport checks remain in place.

## Open-source alternative

[shadcn/ui Navigation Menu](https://ui.shadcn.com/docs/components/radix/navigation-menu), built on Radix, has an RTL guide and an [MIT license](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md). It is a navigation primitive rather than a complete branded header/footer. [Radix Navigation Menu](https://www.radix-ui.com/primitives/docs/components/navigation-menu) provides keyboard/focus behavior for richer dropdown navigation.

Recommendation: retain the current four-link shared header for this change. A new navigation library would not fix page-specific CSS on its own; it becomes useful when real dropdowns or nested product navigation are needed. No new library or visual redesign was introduced.

## Candidates for icon-only controls (review, not replacements)

Use the installed Lucide icon set, with an Arabic accessible name, a visible tooltip on keyboard focus/hover, and a touch target of at least 44 px. Show feedback for clipboard and refresh actions. On touch, a label must remain available without relying only on hover.

| Current button/location | Candidate icon | Recommendation |
| --- | --- | --- |
| Refresh in HostPortal heading and PaymentStatus | RefreshCw | Good when adjacent to a clear section/status heading; retain loading/error feedback. |
| Search submit in OwnerPanel search bar | Search | Good; input is already labelled. |
| Enlarge partner-logo preview in PartnerManager | ZoomIn | Good next to the image, with label “تكبير معاينة الشعار”. |
| Copy event summary in HostPortal | Copy / Check | Good in the summary toolbar; announce success/failure. |
| Close in HostPortal summary and PartnerManager preview | X | Good in the top corner of the dialog; retain focus restoration. |
| Previous/next in OwnerPanel pagination | ChevronRight / ChevronLeft | Suitable for compact pagination beside the visible page number, with Arabic names. |
| Return to site/profile in Profile or OwnerPanel | ArrowRight | Prefer icon plus text on desktop; icon-only is possible in constrained toolbars with a clear destination label. |

Already icon-only: owner refresh, clear search, close composer, add-new partner, public dialog close, toast dismissal, stepper plus/minus. No duplicate conversion needed.

Keep text (optionally alongside an icon): sign in through Discord, purchase and price, start/resume/setup event, redeem, save/review/confirm, partner deletion, payment recovery and grants. Keep Privacy/Terms labels in the footer and descriptive account-menu labels. These communicate destination or consequences more precisely than a symbol alone.
