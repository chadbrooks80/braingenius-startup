# WordGeneratorSection

Landing page block that showcases the three word generation methods using `FeatureCheckCard` components.

## Location

`src/components/blocks/WordGeneratorSection.tsx`

## Props

None — all content is defined internally.

## Cards Rendered

| Card | Variant | Icon |
|------|---------|------|
| Recommended Words by Grade Level | Dark | GraduationCap |
| AI-Generated Words by Topic | Light (default) | Bot |
| Words from URLs or PDF Uploads | Dark | FileText |

## Notes

- Uses `"use client"` for IntersectionObserver scroll-reveal animations
- Reveal delays: 0s, 0.1s, 0.2s per card
- Uses `Eyebrow`, `FeatureCheckCard` only — no additional components

## Usage

```tsx
import WordGeneratorSection from "@/components/blocks/WordGeneratorSection";

<WordGeneratorSection />
```
