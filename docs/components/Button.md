# Button

**Path:** `src/components/ui/Button.tsx`

A polymorphic button component that renders as a `<button>` or `<a>` depending on whether `href` is provided.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"cta" \| "primary" \| "secondary"` | `"cta"` | Visual style |
| `size` | `"default" \| "sm"` | `"default"` | Size scale; only applies to the `cta` variant |
| `href` | `string` | — | When provided, renders as an `<a>` tag |
| `className` | `string` | — | Additional classes merged via clsx |
| `children` | `ReactNode` | — | Button label/content |
| `...rest` | button or anchor attrs | — | Native element attributes forwarded to the rendered element |

## Variants

- **cta** — Dark background, pill shape. Used for primary conversion actions (e.g., "Get Started Free" in the header).
- **primary** — Cyan gradient, bold display font, glow shadow. Used for high-emphasis CTAs.
- **secondary** — Transparent with muted border. Used for lower-priority actions.

## Sizes (cta variant only)

- **default** — Fluid sizing via `clamp()`, scales with viewport from medium screens up.
- **sm** — Smaller fluid sizing, intended for constrained layouts (e.g., mobile header).

## Usage

```tsx
// Button element
<Button variant="secondary" onClick={handleClick}>Learn More</Button>

// Anchor element
<Button variant="cta" href="#features">Get Started Free</Button>

// Small CTA (mobile header)
<Button variant="cta" size="sm" href="#">Get Started Free</Button>

// Full-width (pass className)
<Button variant="primary" href="#" className="w-full justify-center">Start Now</Button>
```
