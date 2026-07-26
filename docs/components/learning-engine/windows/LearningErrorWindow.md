# LearningErrorWindow

Source: `src/components/learning-engine/windows/Error/LearningErrorWindow.tsx`

## Registry and ownership

Registry key: `error`. Server-compatible terminal presentation for known `LearningRouteError` codes. The engine selects it and fixed error mappings supply safe text.

## Props

| Prop | Type | Required |
| --- | --- | --- |
| `title` | `string` | Yes |
| `message` | `string` | Yes |

No defaults and no `onAction`.

## Structure and behavior

Renders a center-aligned shell, heading/message, and Next `Link` to `LEARNING_ROUTE_ERROR_HOME_PATH` (`/`). There is no state, retry action, pending behavior, attempt identity, or module callback.

## Accessibility and interaction

Uses `<h1>`, paragraph, and keyboard-accessible Next Link. The safe message is visible and not conveyed only by styling.

## Security boundary

Only fixed learner-safe presentations should be passed. Technical route error details remain in server/console logging and are not rendered.

## Consumers, playground, and tests

Selected by `LearningEngine.showLearningRouteError` and registered centrally. It is not in the current playground gallery. `tests/learning-engine/LearningErrorWindow.test.tsx` proves safe presentation and Return Home recovery.

## Usage

```tsx
<LearningErrorWindow title="Lesson Not Found" message="We could not find this lesson." />
```
