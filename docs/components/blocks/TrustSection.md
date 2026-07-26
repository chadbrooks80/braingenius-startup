# TrustSection

Source: `src/components/blocks/TrustSection.tsx`

## Purpose and boundary

Server Component that presents three static trust/award symbols on the homepage.

## Props

No props.

## Structure and behavior

Renders a labeled section and maps `TRUST_ITEMS` to `TrustSymbol`. Items provide Lucide visuals, title, subtitle, and typed `iconBg` token. No state or interactions.

## Styling and accessibility

Uses surface/heading semantic tokens. The visible label supplies context; Lucide icons are not explicitly hidden. The source does not claim or verify the marketing statements.

## Consumers and tests

Rendered by the homepage. No focused test exists.

## Usage

```tsx
<TrustSection />
```
