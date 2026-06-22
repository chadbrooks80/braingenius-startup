# TestimonialCard

**Path:** `src/components/blocks/TestimonialCard.tsx`

A reusable testimonial card displaying 5 stars, a quoted passage, and an author with avatar.

## Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `children` | `ReactNode` | Yes | Testimonial quote text |
| `name` | `string` | Yes | Author's name |
| `title` | `string` | Yes | Author's role/title |
| `imageUrl` | `string` | Yes | Avatar image path |
| `backgroundColor` | `string` | No | CSS variable name (without `--`), e.g. `color-dark` |
| `fontColor` | `string` | No | CSS variable name (without `--`), e.g. `color-white` |

## Defaults

- Background: `--color-surface` (frosted white)
- Font color: `--color-text-primary`
- Stars: always 5 (not configurable)
- Quote mark: always shown (not configurable)

## Usage

```tsx
<TestimonialCard
  name="Sarah M."
  title="7th Grade ELA Teacher"
  imageUrl="/sara.jpeg"
>
  My students actually ask to do vocabulary practice now.
</TestimonialCard>
```

With custom colors:

```tsx
<TestimonialCard
  name="Marcus T."
  title="8th Grade Science Teacher"
  imageUrl="/sara.jpeg"
  backgroundColor="color-dark"
  fontColor="color-white"
>
  BrainGenius generates a complete word set in about 30 seconds.
</TestimonialCard>
```
