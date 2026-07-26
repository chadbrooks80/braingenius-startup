# LearningWindowShell

Source: `src/components/learning-engine/LearningWindowShell.tsx`

## Purpose and boundary

Server-compatible shared visual shell for card-style Learning Windows. It owns centering, width, alignment, surface, border, shadow, and optional backdrop blur; it owns no learning state.

## Props

| Prop | Type | Required | Default |
| --- | --- | --- | --- |
| `size` | `"standard" | "wide"` | No | `"standard"` |
| `align` | `"start" | "center"` | No | `"start"` |
| `backdrop` | `boolean` | No | `true` |
| `children` | `ReactNode` | Yes | — |

`standard` is `max-w-lg`; `wide` is `max-w-2xl`. Center alignment adds text centering. `backdrop={false}` removes glass blur only.

## Structure and behavior

Renders a flex centering wrapper and one surface card. There are no effects, actions, pending states, or remount behavior.

## Styling and accessibility

Uses semantic `surface`/`heading` theme utilities and shared blur tokens. It adds no semantic role; each window supplies its own headings/controls. There is no `className` escape hatch.

## Consumers and tests

Used by every registered window except `StartupWindow`. `tests/components/themeRecipes.test.tsx` proves standard/wide, start/center, backdrop, and no-backdrop recipes.

## Usage

```tsx
<LearningWindowShell size="wide" align="center">
  <h1>Practice</h1>
</LearningWindowShell>
```
