# TrustSection

**Path:** `src/components/blocks/TrustSection.tsx`

## Overview

Full-width trust strip for the landing page. Displays a centered "Trusted by schools and educators" label above three `TrustSymbol` pill cards.

## Usage

```tsx
import TrustSection from "@/components/blocks/TrustSection";

<TrustSection />
```

## Props

None — data is defined internally via `TRUST_ITEMS`.

## Trust Items

| Title | Subtitle | Icon |
|---|---|---|
| Nixa Public Schools | Nixa, Missouri | School (teal) |
| Ozark R-VI Schools | Ozark, Missouri | GraduationCap (indigo) |
| EdTech Horizon Award | 2024 Best K-12 Tool | Award (lime) |

## Design

- Background: `--color-surface-soft` (translucent white)
- Top/bottom borders: `--color-border-soft`
- Label: small uppercase, `--color-text-muted`, shield icon in cyan
- Items: centered flex row with `gap-12`, wraps on smaller screens
- Each symbol rendered via `TrustSymbol` component
