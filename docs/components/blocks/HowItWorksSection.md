# HowItWorksSection

Source: `src/components/blocks/HowItWorksSection.tsx`

## Purpose and boundary

Server Component explaining the marketed learning process with static progress visualization and `CheckBadge` claims.

## Props

No props.

## Structure and behavior

Renders a two-column responsive section: eyebrow/heading/description/check badges plus an `ExampleBlock` with three progress bars and four stats. Runtime-calculated inline styles set each bar width and animation delay. There is no state, data fetching, or action.

## Styling and accessibility

Uses theme utilities and global `progressFill`/`bob` animations. Progress bars are visual `<div>` elements without progressbar roles or text alternatives beyond adjacent labels/percentages. The section has no ID even though the header links to `#how-it-works`; that current mismatch is not repaired here.

## Consumers and tests

Rendered by the homepage. No focused test exists.

## Usage

```tsx
<HowItWorksSection />
```
