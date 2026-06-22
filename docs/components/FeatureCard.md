# FeatureCard

Reusable card component for displaying a feature with an icon, title, and description. Includes hover lift and glow animations driven by a per-card accent color.

## Location

`src/components/blocks/FeatureCard.tsx`

## Props

### `FeatureCardProps`

| Prop          | Type              | Required | Description                                                                 |
| ------------- | ----------------- | -------- | --------------------------------------------------------------------------- |
| `icon`        | `React.ReactNode` | Yes      | A Lucide icon (or any JSX) rendered inside the icon container               |
| `iconBgColor` | `string`          | Yes      | CSS color value or `var(--token)` for the rounded icon container background |
| `title`       | `string`          | Yes      | Card heading                                                                |
| `borderColor` | `string`          | Yes      | CSS color value or `var(--token)` used for the hover border and glow effect |
| `children`    | `React.ReactNode` | Yes      | Descriptive body text — pass as children, not a prop                        |

## Notes

- `borderColor` and `iconBgColor` are injected as CSS custom properties (`--card-border`, `--icon-bg`) so hover animations are handled purely in CSS via Tailwind utility classes — no `"use client"` or JS event handlers needed.
- Icon color should be set via `className` (e.g. `className="text-(--color-accent-cyan)"`) — not `style` — so Lucide's `currentColor` picks it up cleanly.
- Uses only project theme tokens. Do not pass hardcoded hex or Tailwind default colors.

## Usage

```tsx
import FeatureCard from "@/components/blocks/FeatureCard";
import { Brain } from "lucide-react";

<FeatureCard
  icon={<Brain size={22} className="text-(--color-accent-indigo)" />}
  iconBgColor="color-mix(in srgb, var(--color-accent-indigo) 15%, transparent)"
  borderColor="var(--color-accent-indigo)"
  title="AI-Generated Content"
>
  Fresh passages and questions created on demand, tuned to your grade level.
</FeatureCard>
```
