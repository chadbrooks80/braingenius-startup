# FeatureCheckCard

Source: `src/components/blocks/FeatureCheckCard.tsx`

## Purpose and boundary

Server-compatible marketing card combining an icon, description, and checklist. It owns the card recipe and check icons.

## Props

| Prop | Type | Required | Default |
| --- | --- | --- | --- |
| `icon` | `React.ReactNode` | Yes | — |
| `iconBackgroundColor` | `ColorTokenFor<"iconBg">` | Yes | — |
| `title` | `string` | Yes | — |
| `children` | `React.ReactNode` | Yes | — |
| `checkItems` | `string[]` | Yes | — |
| `backgroundColor` | `ColorTokenFor<"bg">` | No | `"surface"` |
| `fontColor` | `ColorTokenFor<"text">` | No | `"heading"` |
| `checkboxColor` | `ColorTokenFor<"text">` | No | `"primary"` |

## Structure and behavior

Renders a flex card with icon box, heading, paragraph, and `<ul>` generated from `checkItems`. It has no state/effects/actions. Array indexes are checklist keys.

## Styling and accessibility

Typed categories are `iconBg`, `bg`, and `text` as defined in `theme-colors.ts`; raw color strings are not accepted. The checklist uses semantic list markup; Lucide checks are not explicitly hidden, so accessible output depends on the icon library.

## Consumers and tests

Used by `WordGeneratorSection` and `/playground`. No focused test exists.

## Usage

```tsx
<FeatureCheckCard
  icon={<span aria-hidden="true">AI</span>}
  iconBackgroundColor="primary"
  title="Generated practice"
  checkItems={["Current level", "Ready to use"]}
>
  Build a focused set.
</FeatureCheckCard>
```
