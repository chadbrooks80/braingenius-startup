# HeaderNav

Source: `src/components/layout/header/HeaderNav.tsx`

## Purpose and boundary

Client navigation for desktop anchors and a mobile slide-out drawer. The client boundary is required for open state, hydration-safe portal detection, handlers, and `document.body`.

## Props

No props.

## Structure and behavior

Desktop renders links for Features, How It Works, Reviews, and Word Tools. Mobile renders an accessible-name menu button. `open` controls a clickable backdrop and left drawer portaled to `document.body`; link, backdrop, and close-button clicks close it. `useSyncExternalStore` returns false on the server and true in the browser to defer portal creation until mounted.

There is no Escape handler, focus trap, focus restoration, `aria-expanded`, or dialog/navigation label. The closed drawer remains mounted off-screen after hydration.

## Styling and accessibility

Uses semantic theme tokens and breakpoint visibility. Open/Close buttons have `aria-label`; inline SVGs inherit current color. Native anchors are keyboard accessible. `className` is not configurable.

## Consumers and tests

Rendered twice by `Header` in breakpoint-exclusive layouts. No focused test exists. The `#how-it-works` link currently has no matching section ID.

## Usage

```tsx
import HeaderNav from "@/components/layout/header/HeaderNav";

<HeaderNav />
```
