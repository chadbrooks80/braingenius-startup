# TestimonialCard

Source: `src/components/blocks/TestimonialCard.tsx`

## Purpose and boundary

Server-compatible card for a five-star quote and attributed portrait.

## Props

| Prop | Type | Required | Default |
| --- | --- | --- | --- |
| `children` | `React.ReactNode` | Yes | — |
| `name` | `string` | Yes | — |
| `title` | `string` | Yes | — |
| `imageUrl` | `string` | Yes | — |
| `backgroundColor` | `ColorTokenFor<"bg">` | No | translucent surface recipe |
| `fontColor` | `Extract<ColorTokenFor<"text">, ColorTokenFor<"textMuted">>` | No | `"text"` |

## Structure and behavior

Renders five stars, italic quotation, and portrait/name/title attribution. No state or actions.

## Styling and accessibility

`backgroundColor` uses the `bg` category. `fontColor` is restricted to tokens supported by both `text` and `textMuted`: `surface`, `heading`, or `text`. The Next Image alt text is the supplied name. Stars are not explicitly aria-hidden.

## Consumers and tests

Used by `TestimonialsSection` and `/playground`. No focused test exists.

## Usage

```tsx
<TestimonialCard name="Alex" title="Teacher" imageUrl="/person.jpeg">
  The practice is easy to use.
</TestimonialCard>
```
