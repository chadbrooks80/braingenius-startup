# Eyebrow

**Path:** `src/components/ui/Eyebrow.tsx`

A small pill label used above section headings. Uppercase, bold, tight letter-spacing. Replaces `.hero-badge` and `.section-label` from the landing page design.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bgColor` | `string` | `"--color-primary-cyan"` | CSS variable name for background color (applied at 15% opacity) |
| `textColor` | `string` | `"--color-text-primary"` | CSS variable name for text and border color |
| `children` | `ReactNode` | — | Label content — text, icons, etc. |

## Notes

- Background is always the `bgColor` at 15% opacity
- Border is always the `textColor` at 40% opacity
- No `className` prop — all styling is controlled via `bgColor` and `textColor`
- Pass CSS variable names without `var()`, e.g. `"--color-accent-lime"` not `"var(--color-accent-lime)"`

## Usage

```tsx
// Default (cyan)
<Eyebrow>AI-Powered Vocabulary Learning</Eyebrow>

// With icon
<Eyebrow>
  <StarIcon size={12} />
  Features
</Eyebrow>

// Custom colors
<Eyebrow bgColor="--color-accent-lime" textColor="--color-dark">Word Generator</Eyebrow>
<Eyebrow bgColor="--color-accent-indigo" textColor="--color-accent-indigo">Testimonials</Eyebrow>
```
