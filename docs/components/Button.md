# Button

**Path:** `src/components/ui/Button.tsx`

The single canonical button component for the whole app — website and Learning Engine both use it. Renders as a `<button>` or `<a>` depending on whether `href` is provided.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"cta" \| "primary" \| "secondary" \| "oauth" \| "learning-primary" \| "learning-secondary" \| "learning-ghost" \| "learning-accent"` | `"cta"` | Visual style |
| `size` | `"default" \| "sm"` | `"default"` | Size scale; only applies to the `cta` variant |
| `href` | `string` | — | When provided, renders as an `<a>` tag |
| `className` | `string` | — | Layout-only escape hatch merged via clsx. Theme appearance should come from `variant`, not caller-supplied color classes. |
| `children` | `ReactNode` | — | Button label/content (the canonical label API — Learning Engine callers pass label text as children rather than a `label` prop) |
| `trailingIcon` | `ReactNode` | — | Optional icon/content rendered after `children` (used by StartupWindow's data-driven buttons) |
| `helperText` | `ReactNode` | — | Optional small muted text rendered after `trailingIcon` |
| `type` | `"button" \| "submit" \| "reset"` | `"button"` (non-anchor only) | Buttons without `href` default safely to `type="button"`; pass `type="submit"` explicitly for form-submit buttons |
| `...rest` | button or anchor attrs | — | Native element attributes forwarded to the rendered element |

## Website variants

- **cta** — Dark background, pill shape. Used for primary conversion actions (e.g., "Get Started Free" in the header).
- **primary** — Cyan gradient, bold display font, glow shadow. Used for high-emphasis CTAs.
- **secondary** — Transparent with muted border. Used for lower-priority actions.
- **oauth** — Same shape as `secondary` but with an opaque `bg-surface` background. Used for the Google sign-in/sign-up buttons.

## Learning Engine variants

Preserve the recipes of the former `src/learning-engine-components/UI/Button.tsx` (now deleted) exactly:

- **learning-primary** — Solid heading-color background, soft shadow.
- **learning-secondary** — Tinted secondary background with border. Used for Retry actions.
- **learning-accent** — Gradient accent background. Used for Next actions.
- **learning-ghost** — Transparent, muted text.

`StartupWindow` maps its module-supplied `StartupButtonVariant` (`"primary" | "secondary" | "ghost"`, defined in `src/types/learning.ts` and left unchanged as plain module data) to the canonical variants via an explicit typed map:

```ts
const STARTUP_BUTTON_VARIANT_MAP: Record<StartupButtonVariant, ButtonVariant> = {
  primary: "learning-primary",
  secondary: "learning-secondary",
  ghost: "learning-ghost",
};
```

## Sizes (cta variant only)

- **default** — Fluid sizing via `clamp()`, scales with viewport from medium screens up.
- **sm** — Smaller fluid sizing, intended for constrained layouts (e.g., mobile header).

## Disabled behavior

The shared base recipe owns disabled styling for every variant: `disabled:cursor-not-allowed disabled:opacity-(--alpha-surface-soft) disabled:transform-none`. Callers should not repeat these classes in `className`.

## Usage

```tsx
// Website button element
<Button variant="secondary" onClick={handleClick}>Learn More</Button>

// Website anchor element
<Button variant="cta" href="#features">Get Started Free</Button>

// Small CTA (mobile header)
<Button variant="cta" size="sm" href="#">Get Started Free</Button>

// Full-width (pass className for layout only)
<Button variant="primary" href="#" className="w-full justify-center">Start Now</Button>

// OAuth
<Button type="button" variant="oauth" onClick={handleGoogleSignIn} disabled={isGoogleSubmitting}>
  Continue with Google
</Button>

// Form submit
<Button type="submit" variant="primary" disabled={isSubmitting} className="w-full justify-center">
  Sign in
</Button>

// Learning Engine
<Button variant="learning-accent" onClick={() => onAction("next")}>Next →</Button>
<Button variant="learning-secondary" onClick={retry}>Retry</Button>
```
