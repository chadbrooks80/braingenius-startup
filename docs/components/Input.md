# Input

**Path:** `src/components/ui/Input.tsx`

A shared, ref-forwarding `<input>` wrapper with typed visual variants. Forwards all native input attributes.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `"default" \| "code" \| "learning-answer"` | `"default"` | Visual recipe |
| `className` | `string` | — | Additional classes merged via clsx |
| `...rest` | input attrs | — | Native input attributes forwarded to the rendered `<input>` |

## Variants

- **default** — The standard authentication/onboarding text-input recipe.
- **code** — Centered verification-code recipe (`text-lg`, `tracking-(--tracking-label)`).
- **learning-answer** — The Spelling Learning Window answer-input recipe (disabled opacity, `rounded-xl`, flex-friendly `min-w-0 flex-1`).

All three variants share the same Batch 4 focus treatment: `focus:border-focus focus-visible:ring-2 focus-visible:ring-focus/(--alpha-medium)`.

## Usage

```tsx
<Input id="email" name="email" type="email" value={email} onChange={...} />

<Input variant="code" id="code" inputMode="numeric" maxLength={4} value={code} onChange={...} />

<Input variant="learning-answer" value={answer} disabled={locked} onChange={...} />
```

## Related

- `PasswordInput` renders `Input` internally (`variant="default"`) with an added visibility toggle. See [PasswordInput](./PasswordInput.md).
