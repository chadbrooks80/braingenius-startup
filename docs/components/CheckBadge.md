# CheckBadge

Small pill-style badge with a checkmark icon and a text label. Used to communicate feature bullets or capability items in a compact, scannable format.

## Location

`src/components/ui/CheckBadge.tsx`

## Props

### `CheckBadgeProps`

| Prop              | Type     | Required | Default                    | Description                                                                 |
| ----------------- | -------- | -------- | -------------------------- | --------------------------------------------------------------------------- |
| `label`           | `string` | Yes      | —                          | Text displayed inside the badge                                             |
| `backgroundColor` | `string` | No       | `--color-white`            | CSS variable name (without `var()`) for the badge background                |
| `fontColor`       | `string` | No       | `--color-text-primary`     | CSS variable name (without `var()`) for the label text color                |
| `checkboxColor`   | `string` | No       | `--color-primary-cyan`     | CSS variable name (without `var()`) for the check icon color                |

> Pass CSS variable names as plain strings — e.g. `"--color-accent-cyan"`, not `"var(--color-accent-cyan)"`. The component wraps them in `var()` internally.

## Notes

- Uses `--color-border-muted` for the border and `--shadow-sm` for the drop shadow — both theme tokens.
- The check icon is always a `lucide-react` `<Check />` at 14px. Only its color is customizable.
- Default appearance matches the white pill style from the landing page "How It Works" section.

## Usage

```tsx
import CheckBadge from "@/components/ui/CheckBadge";

{/* Default */}
<CheckBadge label="Never too easy" />

{/* Custom background and font color */}
<CheckBadge
  label="Spaced reviews"
  backgroundColor="--color-accent-indigo"
  fontColor="--color-white"
  checkboxColor="--color-white"
/>

{/* Custom checkbox color only */}
<CheckBadge label="Mastery-based" checkboxColor="--color-accent-pink" />

{/* Composing a pill row */}
<div className="flex flex-wrap gap-3">
  <CheckBadge label="Never too easy" />
  <CheckBadge label="Never too hard" />
  <CheckBadge label="Spaced reviews" />
  <CheckBadge label="Mastery-based" />
  <CheckBadge label="Works offline" />
  <CheckBadge label="Grade-aligned" />
</div>
```
