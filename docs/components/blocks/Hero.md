# Hero

Source: `src/components/blocks/Hero.tsx`

## Purpose and boundary

Server Component for the homepage hero. It presents the primary product message and a static adaptive-session example; it owns no learning behavior.

## Props

No props.

## Structure and behavior

Responsive grid order is eyebrow, heading, persistent example card, description, CTA links, and assurance copy. The primary anchor targets `/sign-up`; the secondary targets `#features`. The example is intentionally visible at all breakpoints and contains static answer/streak content.

## Styling and accessibility

Uses semantic theme utilities and the global `bob` animation. Lucide icons accompany visible text. Links are native anchors. The animated example has no local reduced-motion override beyond global utility behavior.

## Consumers and tests

Rendered by the homepage. No focused test exists.

## Usage

```tsx
import Hero from "@/components/blocks/Hero";

<Hero />
```
