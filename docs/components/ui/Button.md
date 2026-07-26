# Button

Source: `src/components/ui/Button.tsx`

## Purpose and boundary

Server-compatible polymorphic shared control. It renders an anchor when `href` is present and otherwise a native button. It owns website, auth, and Learning Engine visual/state recipes.

## Props

Base props:

| Prop | Type | Required | Default |
| --- | --- | --- | --- |
| `variant` | `ButtonVariant` | No | `"cta"` |
| `size` | `"default" | "sm"` | No | `"default"` |
| `className` | `string` | No | — |
| `children` | `ReactNode` | No | — |
| `trailingIcon` | `ReactNode` | No | — |
| `helperText` | `ReactNode` | No | — |

`ButtonVariant` is `cta`, `primary`, `secondary`, `oauth`, `learning-primary`, `learning-secondary`, `learning-ghost`, or `learning-accent`.

With `href: string`, props also use `AnchorHTMLAttributes<HTMLAnchorElement>`. Without `href`, props use `ButtonHTMLAttributes<HTMLButtonElement>` and `type` defaults to `"button"`. Only the `cta` recipe uses `size`.

## Structure and behavior

Class recipes are combined with `clsx`. `trailingIcon` is wrapped in `aria-hidden="true"`; helper text is a visible nested span. The component has no local state. Native disabled behavior applies only to the button branch.

## Styling and accessibility

All variants use semantic theme utilities. Shared disabled styling reduces opacity, prevents transforms, and changes cursor. `className` is intended for caller-owned layout integration. Anchor consumers must provide link semantics; `disabled` does not disable anchors.

## Consumers and tests

Used throughout marketing/header, auth pages, onboarding, and Learning Windows. `tests/components/themeRecipes.test.tsx` proves element selection, default/explicit button type, every variant recipe, sizes represented by CTA tests, and disabled classes.

## Usage

```tsx
<Button variant="primary" type="submit">Save</Button>
<Button variant="cta" href="/sign-up">Join</Button>
```
