# PasswordInput

**Path:** `src/components/ui/PasswordInput.tsx`

A password `<input>` with a show/hide toggle using `Eye`/`EyeOff` icons from `lucide-react`. Renders the shared [Input](./Input.md) component (`variant="default"`) internally instead of requiring callers to supply the input recipe themselves.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | — | Additional classes merged onto the rendered `Input` (applied after the built-in `pr-10` right padding reserved for the toggle button) |
| `...rest` | input attrs (excluding `type`) | — | Native input attributes forwarded to the rendered `Input` |

## Usage

```tsx
<PasswordInput
  id="password"
  name="password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
/>
```
