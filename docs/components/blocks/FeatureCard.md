# FeatureCard

Source: `src/components/blocks/FeatureCard.tsx`

## Purpose and boundary

Server-compatible marketing feature card. It owns icon framing, heading, body copy, and accent hover recipe.

## Props

| Prop | Type | Required | Meaning |
| --- | --- | --- | --- |
| `icon` | `React.ReactNode` | Yes | Caller-supplied visual. |
| `iconBgColor` | `ColorTokenFor<"iconBg">` | Yes | Tinted icon background. |
| `title` | `string` | Yes | Card heading. |
| `borderColor` | `ColorTokenFor<"border">` | Yes | Hover border/glow accent. |
| `children` | `React.ReactNode` | Yes | Description rendered in a paragraph. |

## Structure and behavior

Renders one card `<div>`, an icon box, `<h3>`, and description `<p>`. There is no state or action; hover only translates and changes shadow/border.

## Styling and accessibility

`iconBgColor` accepts `primary`, `secondary`, `surface`, `feature`, `highlight`, `warning`, or `success`. `borderColor` accepts `primary`, `secondary`, `feature`, `highlight`, `warning`, or `success`. Both resolve through typed theme recipes. The icon's accessible meaning is supplied by the caller.

## Consumers and tests

Used by `FeatureSection` and `/playground`. No focused test exists.

## Usage

```tsx
<FeatureCard
  icon={<span aria-hidden="true">A</span>}
  iconBgColor="primary"
  borderColor="primary"
  title="Adaptive practice"
>
  Practice responds to learner performance.
</FeatureCard>
```
