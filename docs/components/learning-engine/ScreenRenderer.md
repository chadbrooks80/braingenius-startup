# ScreenRenderer

Source: `src/components/learning-engine/ScreenRenderer.tsx`

## Purpose and boundary

Server-compatible engine presentation adapter. It renders the component resolved by the Learning Engine and injects live engine feedback/speech state.

## Props

| Prop | Type | Required | Meaning |
| --- | --- | --- | --- |
| `screen` | `ActiveScreen` | Yes | Resolved `WindowComponent` plus stored public props. |
| `answerFeedback` | `AnswerFeedback | null` | Yes | Current engine-owned grading feedback. |
| `isSpeaking` | `boolean` | Yes | Current shared speech state. |

## Structure and behavior

It spreads `screen.props` first, then passes `feedback={answerFeedback}` and `isSpeaking={isSpeaking}`. Live engine values therefore override same-named stored props. It does not resolve registry keys, handle errors, change screens, or own state.

## Styling and accessibility

No DOM or styling is added; the active window owns both.

## Consumers and tests

Rendered by the catch-all learning route. `tests/learning-engine/vocabularyWindowFlow.test.tsx` proves live-prop precedence and feedback reset across screen changes.

## Usage

```tsx
<ScreenRenderer
  screen={activeScreen}
  answerFeedback={feedback}
  isSpeaking={false}
/>
```
