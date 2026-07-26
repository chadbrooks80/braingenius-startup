# LessonCompleteWindow

Source: `src/components/learning-engine/windows/LessonComplete/LessonCompleteWindow.tsx`

## Registry and ownership

Registry key: `lesson-complete`. Server-compatible terminal summary window. The owning module decides completion and supplies stats.

## Props

| Prop | Type | Required |
| --- | --- | --- |
| `title` | `string` | Yes |
| `message` | `string` | Yes |
| `stats` | `Array<{ label: string; value: string | number }>` | Yes |

No defaults.

## Structure and behavior

Renders a no-backdrop shell, heading/message, and three-column `<dl>` of supplied stats. It does not enforce exactly three items. There are no actions, state, retry, attempt, reset, or navigation controls.

## Accessibility and interaction

Uses `<h1>`, paragraph, `<dl>`, `<dt>`, and `<dd>`. It is non-interactive.

## Security boundary

Stats must be safe public aggregate values. The window does not calculate mastery/completion or inspect canonical answers.

## Consumers, playground, and tests

Created by Vocabulary `lessonCompleteScreen.ts`, registered centrally, and shown with Vocabulary/non-Vocabulary examples in `/le-playground`. Learning Engine flow tests prove neutral cross-subject rendering.

## Usage

```tsx
<LessonCompleteWindow
  title="Lesson complete"
  message="Practice is finished."
  stats={[{ label: "Correct", value: 10 }]}
/>
```
