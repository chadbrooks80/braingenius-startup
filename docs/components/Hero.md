# Hero

Block-level landing page hero section.

## Purpose

Introduces BrainGenius.ai with a headline, description, CTA buttons, and an interactive quiz card demo. Designed to communicate value immediately and drive sign-ups.

## Props

None — all content is static.

## Structure

Single CSS grid container with five direct children placed explicitly:

| Item | Desktop | Mobile |
|------|---------|--------|
| `<Eyebrow>` | col 1, row 1 | 1st |
| `<h1>` heading | col 1, row 2 | 2nd |
| `<ExampleBlock>` quiz demo | col 2, rows 1–4 | 3rd (under heading) |
| `<p>` description | col 1, row 3 | 4th |
| CTA buttons | col 1, row 4 | 5th |

## Responsive Behavior

- **Desktop (lg+):** 2-column grid (`1.1fr 0.9fr`). Text content fills column 1; ExampleBlock spans all 4 rows in column 2.
- **Mobile:** Single-column, auto-flow. ExampleBlock appears after the heading (DOM order), never hidden.

## Notes

- `@keyframes bob` is defined in `globals.css` and drives the floating animation on the ExampleBlock.
- The flame icon color (`#f97316`) uses an inline style — there is no orange token in the theme.
- The gradient heading uses `bg-clip-text text-transparent` with `from-(--color-primary-cyan) to-(--color-secondary-lime)`.
