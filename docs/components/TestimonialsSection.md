# TestimonialsSection

**Path:** `src/components/blocks/TestimonialsSection.tsx`

A full-page section displaying a grid of testimonial cards with an animated reveal on scroll. Uses `Eyebrow` and `TestimonialCard` components.

## Props

None — all testimonial data is defined internally.

## Usage

```tsx
<TestimonialsSection />
```

## Notes

- Cards animate in via IntersectionObserver with staggered `transitionDelay`
- All avatar images use `/sara.jpeg` from the public folder
- Section id is `testimonials` (matches landing page nav anchor)
- Layout: 1 col mobile → 2 col sm → 3 col lg
