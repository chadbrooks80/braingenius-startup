# HowItWorksSection

**Path:** `src/components/blocks/HowItWorksSection.tsx`

A two-column landing page section explaining the platform's adaptive learning approach. Left column shows a live Student Progress card (via `ExampleBlock`); right column has an `Eyebrow`, heading, description, and `CheckBadge` feature list.

## Props

None — self-contained layout block with no configurable props.

## Layout

**Desktop (lg+):** Two columns. `ExampleBlock` spans the left column across all rows. Right column stacks: Eyebrow → Heading → Description → CheckBadges.

**Mobile:** Single column in DOM order — Eyebrow → Heading → ExampleBlock → Description → CheckBadges.

Responsive order is achieved via CSS grid `col-start` / `row-start` assignments (same pattern as `Hero`).

## Notes

- Progress bars animate on load via the `progressFill` keyframe in `globals.css`
- The `ExampleBlock` bobs via the `bob` animation from `globals.css`
- All colors use theme tokens or Tailwind opacity utilities (`bg-white/10`, `bg-white/5`)

## Usage

```tsx
<HowItWorksSection />
```
