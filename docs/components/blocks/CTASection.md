# CTASection

Source: `src/components/blocks/CTASection.tsx`

## Purpose and boundary

Client marketing block that renders the homepage closing call to action. The client boundary is required for `IntersectionObserver`, a DOM ref, and the reveal class mutation. It owns presentation only.

## Props

No props.

## Structure and behavior

Renders a dark gradient `<section>` card with two decorative glows, heading, description, and a `Button` link to `/sign-up`. On mount it observes the card at threshold `0.12`; once intersecting it adds `reveal-visible`. Cleanup disconnects the observer. There are no pending, disabled, error, or reset states.

## Styling and accessibility

Uses semantic theme utilities, shared container/shadow tokens, and global `.reveal-item` behavior. Decorative glow elements are non-interactive and pointer-disabled. The CTA is an anchor through `Button`; the section has no explicit accessible label.

## Consumers and tests

Rendered by `src/app/(website)/page.tsx`. No focused test exists.

## Usage

```tsx
import CTASection from "@/components/blocks/CTASection";

<CTASection />
```
