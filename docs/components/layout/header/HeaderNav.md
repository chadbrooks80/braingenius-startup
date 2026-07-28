# HeaderNav

Source: `src/components/layout/header/HeaderNav.tsx`

## Purpose and boundary

Client navigation for desktop anchors and a mobile slide-out drawer. The client boundary is required for open state, hydration-safe portal detection, handlers, and `document.body`.

## Props

No props.

## Structure and behavior

Desktop renders links for Features, How It Works, Reviews, and Word Tools. Mobile renders an accessible-name menu button with a unique `useId()`-generated drawer ID (each rendered instance gets its own, since `Header` mounts two). `open` controls a clickable backdrop and left drawer portaled to `document.body`; link, backdrop, and close-button clicks close it. `useSyncExternalStore` returns false on the server and true in the browser to defer portal creation until mounted.

The trigger exposes `aria-expanded={open}` and `aria-controls` pointing at its own drawer. While closed, the drawer carries the native `inert` attribute plus `aria-hidden="true"`: it keeps its existing slide-transition structure and remains mounted off-screen, but is unreachable by Tab and hidden from assistive technology. Opening removes both and moves focus to the drawer's first focusable descendant (the drawer itself as a fallback via `tabIndex={-1}`); a document `keydown` listener closes the drawer on Escape. The listener/focus effect keys only on `open`, so it runs exactly once per open/close transition rather than on every render. On close (Escape, backdrop, close button, or link selection) or unmount, the listener is removed and focus returns to whatever was focused before opening -- the trigger that opened this exact instance, never the other breakpoint's copy, since each instance owns independent `open` state.

## Styling and accessibility

Uses semantic theme tokens and breakpoint visibility. Open/Close buttons have `aria-label`, and the open trigger also exposes `aria-expanded`/`aria-controls`; inline SVGs inherit current color. Native anchors are keyboard accessible. `className` is not configurable.

## Consumers and tests

Rendered twice by `Header` in breakpoint-exclusive layouts; the two instances always resolve to distinct drawer IDs. `tests/e2e/headerNavigation.e2e.ts` covers this against the real running home page at a mobile viewport: unique drawer IDs across both instances, the closed drawer being absent from the keyboard tab sequence, `aria-expanded` flipping through open/close, focus moving into the drawer on open and returning to the trigger on Escape, and backdrop/close-button dismissal. The `#how-it-works` link currently has no matching section ID.

## Usage

```tsx
import HeaderNav from "@/components/layout/header/HeaderNav";

<HeaderNav />
```
