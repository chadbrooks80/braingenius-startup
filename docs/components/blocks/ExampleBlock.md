# ExampleBlock

Source: `src/components/blocks/ExampleBlock.tsx`

## Purpose and boundary

Server-compatible presentational card for labeled marketing examples. It owns its dark shell and optional status badge, not child content.

## Props

| Prop | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `label` | `string` | Yes | — | Card header label. |
| `status` | `string` | No | — | Enables and labels the status pill. |
| `statusColor` | `ColorTokenFor<"bg">` | No | `"secondary"` | Solid theme background token for the status pill. |
| `children` | `ReactNode` | Yes | — | Caller-owned card body. |

## Structure and behavior

Renders a `<section>`, a header with label and conditional status, then the child body. It has no local state, effects, actions, or error states.

## Styling and accessibility

The shell uses fixed semantic `heading`/`surface` tokens. `statusColor` resolves through `getColorClass(token, "bg")`; accepted tokens are `primary`, `secondary`, `surface`, `heading`, `background`, `feature`, `highlight`, `warning`, and `success`. There is no `className` escape hatch.

## Consumers and tests

Used by `Hero`, `HowItWorksSection`, and `/playground`. No focused test exists.

## Usage

```tsx
<ExampleBlock label="Progress" status="Live">
  <p>Session details</p>
</ExampleBlock>
```
