# TrustSymbol

Source: `src/components/blocks/TrustSymbol.tsx`

## Purpose and boundary

Server-compatible pill displaying an icon/image and two lines of trust metadata.

## Props

| Prop | Type | Required | Default |
| --- | --- | --- | --- |
| `iconOrImage` | `React.ReactNode` | Yes | — |
| `iconBgColor` | `ColorTokenFor<"iconBg">` | No | no added background class |
| `title` | `string` | Yes | — |
| `subtitle` | `string` | Yes | — |

## Structure and behavior

Renders one flex wrapper, circular visual container, `<strong>` title, and subtitle. No state/actions.

## Styling and accessibility

`iconBgColor` accepts `primary`, `secondary`, `surface`, `feature`, `highlight`, `warning`, or `success`. Caller owns the visual's alt/ARIA semantics. Hover lift is decorative.

## Consumers and tests

Used by `TrustSection` and `/playground`. No focused test exists.

## Usage

```tsx
<TrustSymbol
  iconOrImage={<span aria-hidden="true">A</span>}
  iconBgColor="primary"
  title="Partner"
  subtitle="District"
/>
```
