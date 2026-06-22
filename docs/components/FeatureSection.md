# FeatureSection

**Location:** `src/components/blocks/FeatureSection.tsx`

Landing page section that displays all product feature cards in a responsive grid.

## Usage

```tsx
import FeatureSection from "@/components/blocks/FeatureSection";

<FeatureSection />
```

No props — content is defined internally via the `features` array.

## Composition

- Uses `Eyebrow` for the "Features" section label
- Uses `FeatureCard` for each individual feature
- Feature data (icon, colors, title, description, animation delay) is maintained in the `features` array at the top of the file

## Layout

- Responsive grid: 1 col (mobile) → 2 cols (sm) → 3 cols (lg)
- Section padding uses `--spacing-section` and `--spacing-container` tokens
- Container capped at `--max-width-container`

## Animation

- Cards reveal on scroll via `IntersectionObserver` — toggling `.reveal-visible` on `.reveal-item` elements
- Each card has a staggered `transitionDelay` (0s → 0.5s) so they animate in sequence
- Card hover lift and glow is handled by `FeatureCard`

## Colors

All colors reference theme tokens from `globals.css`:
- Border/glow: `--color-accent-{cyan,lime,indigo,pink,amber,teal}`
- Icon backgrounds: `--color-icon-bg-{teal,lime,indigo,pink,amber,teal-green}`
- Icon foreground: `--color-accent-*` tokens via inline style
