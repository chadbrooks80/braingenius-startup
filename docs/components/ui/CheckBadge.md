# CheckBadge

Source: `src/components/ui/CheckBadge.tsx`

## Purpose and boundary

Server-compatible labeled pill with a check icon and typed theme colors.

## Props

| Prop | Type | Required | Default |
| --- | --- | --- | --- |
| `label` | `string` | Yes | — |
| `backgroundColor` | `ColorTokenFor<"bg">` | No | `"surface"` |
| `fontColor` | `ColorTokenFor<"text">` | No | `"text"` |
| `checkboxColor` | `ColorTokenFor<"text">` | No | `"primary"` |

## Structure and behavior

Renders one inline `<span>`, a Lucide Check, and the label. No state/actions.

## Styling and accessibility

Colors resolve through exact `bg` and `text` categories in `theme-colors.ts`; no raw tokens or class escape hatch. The icon is not explicitly aria-hidden, though the visible label communicates the content.

## Consumers and tests

Used by `HowItWorksSection`, `PlanStep`, and `/playground`. No focused test exists.

## Usage

```tsx
<CheckBadge label="Spaced reviews" checkboxColor="success" />
```
