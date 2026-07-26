# Input

Source: `src/components/ui/Input.tsx`

## Purpose and boundary

Server-compatible `forwardRef` wrapper around native `<input>`, with complete shared recipes for normal, verification-code, and Learning Engine answer fields.

## Props

`InputProps` combines:

| Prop | Type | Required | Default |
| --- | --- | --- | --- |
| `variant` | `"default" | "code" | "learning-answer"` | No | `"default"` |
| `className` | `string` | No | — |
| native props | `InputHTMLAttributes<HTMLInputElement>` | No | native defaults |
| `ref` | `ForwardedRef<HTMLInputElement>` | No | — |

## Structure and behavior

Renders one native input and forwards the ref/all remaining props. It owns no value state, validation, or handlers. `className` is merged after the selected recipe.

## Styling and accessibility

Every variant has semantic theme colors, outline/focus ring, and transition recipe. `learning-answer` includes disabled opacity. Callers must supply label/accessible name and correct input semantics.

## Consumers and tests

Used by auth pages, onboarding, `PasswordInput`, and `SpellingWindow`. `tests/components/themeRecipes.test.tsx` proves all three recipes and focus utilities.

## Usage

```tsx
<label htmlFor="email">Email</label>
<Input id="email" type="email" />
```
