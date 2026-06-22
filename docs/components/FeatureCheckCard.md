# FeatureCheckCard

Reusable card component displaying an icon, title, description, and a list of check items. Designed to match the "Word Generator" card style from the landing page. Defaults to the white/light card appearance.

## Location

`src/components/blocks/FeatureCheckCard.tsx`

## Props

### `FeatureCheckCardProps`

| Prop                  | Type              | Required | Description                                                                 |
| --------------------- | ----------------- | -------- | --------------------------------------------------------------------------- |
| `icon`                | `React.ReactNode` | Yes      | A Lucide icon (or any JSX) rendered inside the icon container               |
| `iconBackgroundColor` | `string`          | Yes      | CSS color value or `var(--token)` for the icon container background         |
| `title`               | `string`          | Yes      | Card heading                                                                |
| `children`            | `React.ReactNode` | Yes      | Middle descriptive text rendered below the title                            |
| `checkItems`          | `string[]`        | Yes      | Array of strings rendered as a check list                                   |
| `backgroundColor`     | `string`          | No       | Theme token name (without `--`) for the card background. Defaults to white  |
| `fontColor`           | `string`          | No       | Theme token name (without `--`) for title and check item text color         |
| `checkboxColor`       | `string`          | No       | Theme token name (without `--`) for the check icon color                    |

## Notes

- `backgroundColor`, `fontColor`, and `checkboxColor` accept token names **without** the `--` prefix (e.g. `"color-dark"`, not `"--color-dark"`).
- `iconBackgroundColor` accepts a full CSS value (e.g. `color-mix(...)` or `rgba(...)`).
- Icon color should be set via `className` on the Lucide icon so `currentColor` picks it up.
- Uses only project theme tokens. Do not pass hardcoded hex or Tailwind default colors.

## Usage

```tsx
import FeatureCheckCard from "@/components/blocks/FeatureCheckCard";
import { Bot } from "lucide-react";

<FeatureCheckCard
  icon={<Bot size={24} className="text-(--color-primary-cyan)" />}
  iconBackgroundColor="color-mix(in srgb, var(--color-primary-cyan) 12%, transparent)"
  title="AI-Generated Words by Topic"
  checkItems={[
    "Any subject or theme",
    "Matches grade-level complexity",
    "Includes context-specific definitions",
  ]}
>
  Tell the AI what you&apos;re studying and it generates a rich vocabulary set.
</FeatureCheckCard>

{/* Dark variant */}
<FeatureCheckCard
  icon={<Bot size={24} className="text-white" />}
  iconBackgroundColor="rgba(255,255,255,0.12)"
  title="Dark Card Example"
  checkItems={["Item one", "Item two"]}
  backgroundColor="color-dark"
  fontColor="color-white"
  checkboxColor="color-secondary-lime"
>
  Description text for the dark variant.
</FeatureCheckCard>
```
