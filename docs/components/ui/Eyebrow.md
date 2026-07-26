# Eyebrow

Source: `src/components/ui/Eyebrow.tsx`

## Purpose and boundary

Server-compatible uppercase pill for section/category labels.

## Props

| Prop | Type | Required | Default |
| --- | --- | --- | --- |
| `bgColor` | `ColorTokenFor<"tintBg">` | No | `"primary"` |
| `textColor` | `Extract<ColorTokenFor<"text">, ColorTokenFor<"tintBorder">>` | No | `"text"` |
| `children` | `ReactNode` | Yes | — |

`bgColor` supports `primary`, `secondary`, `feature`, `highlight`, or `warning`. `textColor` supports the intersection `primary`, `heading`, `text`, `feature`, `highlight`, or `warning`.

## Structure and behavior

Renders one styled `<span>` containing caller content. It has no state/actions.

## Styling and accessibility

Background uses `tintBg`; foreground and border use the same `textColor` through `text` and `tintBorder`. Child icons must provide their own ARIA treatment.

## Consumers and tests

Used across homepage sections, `PlanStep`, and `/playground`. No focused test exists.

## Usage

```tsx
<Eyebrow bgColor="feature" textColor="feature">Reviews</Eyebrow>
```
