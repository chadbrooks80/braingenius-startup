# WordGeneratorSection

Source: `src/components/blocks/WordGeneratorSection.tsx`

## Purpose and boundary

Client homepage section that presents three static word-generation offerings. The client boundary supports staggered IntersectionObserver reveals.

## Props

No props.

## Structure and behavior

Renders `#word-generator`, heading copy, and three `FeatureCheckCard` items from a typed configuration. Cards vary semantic color props and receive fixed transition delays. Observed elements gain `reveal-visible`; cleanup disconnects.

## Styling and accessibility

Configuration uses `ColorTokenFor<"iconBg">`, `ColorTokenFor<"bg">`, and `ColorTokenFor<"text">`. No generator, upload, URL input, or AI action is implemented in this component; it is marketing copy only.

## Consumers and tests

Rendered by the homepage. No focused test exists.

## Usage

```tsx
<WordGeneratorSection />
```
