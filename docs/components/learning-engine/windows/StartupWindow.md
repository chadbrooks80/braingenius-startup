# StartupWindow

Source: `src/components/learning-engine/windows/Startup/StartupWindow.tsx`

## Registry and ownership

Registry key: `startup`. Client window composing module-owned React content/visual panels with generic startup buttons. The client boundary is needed for button event handlers.

## Props

`StartupWindowProps` is `StartupScreenData & { onAction: OnAction }`:

| Prop | Type | Required |
| --- | --- | --- |
| `contentPanel` | `ReactNode` | Yes |
| `visualPanel` | `ReactNode` | Yes |
| `actionPanel.buttons` | `StartupButtonConfig[]` | Yes |
| `onAction` | `OnAction` | Yes |

Each button has `id`, `actionId`, `label`, variant `"primary" | "secondary" | "ghost"`, and optional string `trailingIcon`/`helperText`.

## Structure, behavior, and actions

Renders a two-panel responsive shell: visual first on mobile, content/actions first on desktop. Button variants map to shared `learning-primary`, `learning-secondary`, and `learning-ghost`. A click emits `onAction(button.actionId)` with no payload. There is no local state, pending lock, retry, attempt identity, or reset behavior.

## Accessibility and interaction

Buttons are native and keyboard accessible. `Button` hides trailing icons from accessibility but leaves helper text visible. Module-owned panels own their own semantics.

## Security boundary

Startup panels must be client-safe. The current Vocabulary content/visual are static and include no canonical answer store.

## Consumers, playground, and tests

Vocabulary `startupScreen.tsx` supplies panels and one `next` button. Registered centrally and shown in `/le-playground`. Flow tests resolve all Vocabulary window keys and verify startup/screen builder contracts.

## Usage

```tsx
<StartupWindow
  contentPanel={<h1>Lesson</h1>}
  visualPanel={<div aria-hidden="true" />}
  actionPanel={{ buttons: [{ id: "start", actionId: "next", label: "Start", variant: "primary" }] }}
  onAction={onAction}
/>
```
