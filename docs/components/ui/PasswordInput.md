# PasswordInput

Source: `src/components/ui/PasswordInput.tsx`

## Purpose and boundary

Client password control that reuses `Input` and toggles text visibility. The client boundary is required for `visible` state and the toggle handler.

## Props

`PasswordInputProps` extends `Omit<InputHTMLAttributes<HTMLInputElement>, "type">` and adds optional `className?: string`. All standard input props except `type` are forwarded. There are no custom defaults.

## Structure and behavior

Starts hidden. The child `Input` receives `type="password"` or `"text"` and right padding. A native button toggles state; remount resets to hidden.

## Styling and accessibility

The toggle's accessible name changes between `Show password` and `Hide password`; its icon changes between Eye and EyeOff. It is `type="button"` and does not submit a surrounding form. The input still requires a caller-provided label.

## Consumers and tests

Used by `ChildrenStep`. `tests/components/themeRecipes.test.tsx` proves reuse of the shared Input recipe and the visibility-button accessible label.

## Usage

```tsx
<label htmlFor="password">Password</label>
<PasswordInput id="password" name="password" />
```
