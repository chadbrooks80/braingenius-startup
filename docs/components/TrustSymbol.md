# TrustSymbol

Single pill component that renders a circular icon/image, a bold title, and a muted subtitle. Compose multiple pills together in a flex container to build a trust bar.

## Location

`src/components/blocks/TrustSymbol.tsx`

## Props

### `TrustSymbolProps`

| Prop           | Type              | Required | Description                                                    |
| -------------- | ----------------- | -------- | -------------------------------------------------------------- |
| `iconOrImage`  | `React.ReactNode` | Yes      | A Lucide icon or a Next `<Image />` component — rendered as-is |
| `iconBgColor`  | `string`          | No       | CSS color value or `var(--token)` for the circular background. When omitted, no background is applied — suitable for image items that fill the container. |
| `title`        | `string`          | Yes      | Bold title text                                                |
| `subtitle`     | `string`          | Yes      | Muted subtitle text                                            |

## Notes

- `iconOrImage` accepts any JSX — the caller decides whether to pass an icon component or an image component. No internal type detection occurs.
- `iconBgColor` should be omitted when passing an image (the image fills the container naturally).
- Hover lift behavior (`hover:-translate-y-0.5`) reuses the same motion pattern as the primary button.
- Uses only project theme colors and tokens.

## Usage

```tsx
import TrustSymbol from "@/components/blocks/TrustSymbol";
import { School } from "lucide-react";
import Image from "next/image";

{/* Icon pill */}
<TrustSymbol
  iconOrImage={<School className="w-5 h-5 text-(--color-primary-cyan)" />}
  iconBgColor="color-mix(in srgb, var(--color-primary-cyan) 12%, transparent)"
  title="Nixa Public Schools"
  subtitle="Nixa, Missouri"
/>

{/* Image pill — no iconBgColor needed */}
<TrustSymbol
  iconOrImage={
    <Image src="/logos/partner.png" alt="Partner" width={40} height={40} className="object-cover w-full h-full" />
  }
  title="EdTech Award"
  subtitle="2024 Winner"
/>

{/* Composing a trust bar */}
<div className="flex flex-wrap gap-4">
  <TrustSymbol ... />
  <TrustSymbol ... />
</div>
```
