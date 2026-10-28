# Section-first buttons and feedback

Owner direction: review Home → Events → Bots → Designs, then event interiors. References: Untitled UI utility-buttons, Aceternity multi-step-loader, and expandable-card-on-click.

| Section | Controls and decision | Feedback |
| --- | --- | --- |
| Home | Keep Explore, Discord sign-in, named navigation and legal/footer actions. Existing icons remain. | Login waiting is a persistent toast tied to the request; failures are dismissible error toasts that survive section changes and can repeat. Sign-out success is a success toast. |
| Events gallery | Keep purchase/price, setup, resume and how-to actions explicit. Payment-status refresh uses ButtonUtility. | Checkout waiting is request-bound toast; checkout unavailability/auth/network errors are persistent error toasts. Authoritative payment receipt stays in the page, never replaced by a transient message. |
| Bots | A category card expands into an accessible dialog using the free Aceternity expandable-card interaction and Motion shared layout. Close uses ButtonUtility. | Existing “coming soon” state remains. No fabricated bots, purchase options or install actions were added. |
| Designs | Keep the current coming-soon details action and shared navigation/footer. | Product availability remains visible in the card/modal. |
| Inside events | Untitled UI-style ButtonUtility for exit, add/edit/delete winner, management close, copy results, host summary close and refresh. Keep save/confirm/start/judgment/prize/finish controls explicit. | Winner addition/rename/deletion and copy success use toast. Field validation, uncertain request recovery, local-save problems, expiry, payment state and receipts remain inline where actionable. |

## Event start using a key

The Aceternity multi-step-loader pattern is adapted to real milestones: awaiting localStart, awaiting localContent, then preparing browser-local storage. A timer never advances a checkmark. The existing idempotency key, one-slot debit, retry payload and browser-only event state are unchanged. The overlay closes on success or failure and restores focus; retry/recovery remains available on failure. No extra request, live charge or credit grant is introduced.

## Toast behavior

The provider stays above public navigation and gameplay. Pending toasts have stable IDs and explicit dismissal when a request settles; errors persist until dismissed; successes expire after five seconds and pause on focus/hover. Toasts move into the active native dialog so they remain visible and interactive in the modal top layer, then move back when it closes. No error-string effect suppresses repeated identical errors. Important form/payment/storage messages retain their in-context recovery guidance.

## Sources and adaptation

ButtonUtility adapts the MIT Untitled UI component pattern using React Aria, the installed Radix tooltip and Lucide icons, with BU’D CSS rather than a Tailwind/design-system migration. See `THIRD_PARTY_NOTICES.md`.

The requested Aceternity card block is paid; its code was not copied. The free public expandable-card example supplies the same shared-layout interaction reference. The bot catalogue currently has only the existing truthful category/coming-soon content until approved product data exists.

All new controls have Arabic accessible names, keyboard focus, reduced-motion treatment and 44px utility targets. Scope is public sections and event controls, with owner/payment permissions and financial invariants preserved.
