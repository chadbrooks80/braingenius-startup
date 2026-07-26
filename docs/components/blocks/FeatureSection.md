# FeatureSection

Source: `src/components/blocks/FeatureSection.tsx`

## Purpose and boundary

Client homepage section that composes six static feature cards. The client boundary supports IntersectionObserver-driven staggered reveals.

## Props

No props.

## Structure and behavior

Renders `#features`, an `Eyebrow`, heading/description, and responsive grid of `FeatureCard`. A typed `FeatureAccentColor` is the intersection of `text`, `iconBg`, and `border` token categories. Each card receives a static transition delay. On mount, all refs are observed at threshold `0.12`; intersecting elements gain `reveal-visible`, and cleanup disconnects.

## Styling and accessibility

Uses semantic theme tokens and caller-controlled Lucide icon colors resolved through `getColorClass`. Content is static; no controls or async states.

## Consumers and tests

Rendered by the homepage. No focused test exists.

## Usage

```tsx
import FeatureSection from "@/components/blocks/FeatureSection";

<FeatureSection />
```
