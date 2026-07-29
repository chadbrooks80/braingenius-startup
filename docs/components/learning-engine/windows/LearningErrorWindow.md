# LearningErrorWindow

Source: `src/components/learning-engine/windows/Error/LearningErrorWindow.tsx`

## Registry and ownership

Registry key: `error`. Server-compatible terminal presentation for a
learner-safe `LearningRouteError` presentation that has already been approved
by either the shared engine or the active learning module. The Window and
engine do not derive text from a module diagnostic code.

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

Only the presentation's `title` and `message` should be passed. Technical route
details remain in structured logging and are not rendered. The Window stays
subject-neutral regardless of whether the safe presentation originated in the
engine or a learning module.

## Consumers, playground, and tests

Selected by `LearningEngine.showLearningRouteError` and registered centrally.
It is not in the current playground gallery.
`tests/learning-engine/LearningErrorWindow.test.tsx` supplies an explicit safe
presentation and proves rendering, diagnostic exclusion, and Return Home
recovery without enumerating module codes.

## Usage

```tsx
<LearningErrorWindow title="Lesson Not Found" message="We could not find this lesson." />
```
