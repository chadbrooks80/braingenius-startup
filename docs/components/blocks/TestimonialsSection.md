# TestimonialsSection

Source: `src/components/blocks/TestimonialsSection.tsx`

## Purpose and boundary

Client homepage section that renders six static testimonial cards with reveal effects. The client boundary is required for refs and `IntersectionObserver`.

## Props

No props.

## Structure and behavior

Renders `#testimonials`, heading copy, and a responsive grid from the module-local `TESTIMONIALS` array. Each wrapper receives a staggered inline transition delay. Intersecting wrappers get `reveal-visible`; cleanup disconnects the observer.

## Styling and accessibility

Uses `Eyebrow` and `TestimonialCard` contracts. All current entries reuse `/sara.jpeg`. There are no controls, loading, or error states.

## Consumers and tests

Rendered by the homepage. No focused test exists.

## Usage

```tsx
<TestimonialsSection />
```
