# PasswordInput

**Path:** `src/components/ui/PasswordInput.tsx`

A password `<input>` with a show/hide toggle using `Eye`/`EyeOff` icons from `lucide-react`.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | — | Additional classes merged onto the input |
| `...rest` | input attrs (excluding `type`) | — | Native input attributes forwarded to the rendered `<input>` |

## Usage

```tsx
<PasswordInput
  id="password"
  name="password"
  value={password}
  onChange={(e) => setPassword(e.target.value)}
  className={inputClass}
/>
```
