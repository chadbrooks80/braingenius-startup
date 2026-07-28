# MultipleChoiceWindow

Source: `src/components/learning-engine/windows/MultipleChoice/MultipleChoiceWindow.tsx`

## Registry and ownership

Registry key: `multiple-choice`. Client graded-choice window. It owns temporary selection/submission presentation; the module/server own offered choices, authoritative grade, progress, and next screen.

## Props

| Prop | Type | Required |
| --- | --- | --- |
| `attemptId` | `string` | Yes |
| `badgeLabel` | `string` | Yes |
| `badgeTone` | `"primary" | "secondary"` | Yes |
| `prompt`, `question`, `replayLabel`, `correctMessage`, `incorrectMessage` | `string` | Yes |
| `choices` | `{ id: string; text: string }[]` | Yes |
| `tts` | `TtsConfiguration | null` | Yes |
| `feedback` | `{ correctChoiceId: string } | null` | Yes |
| `onAction` | `OnAction` | Yes |

No defaults.

## State, reset, and actions

The exported wrapper keys `MultipleChoiceAttempt` by `attemptId`, so a new attempt resets selection and submission state. State is `idle`, `pending`, `success`, or `error`, retaining the selected public choice ID.

- Selecting emits `onAction("submitAnswer", { attemptId, selectedChoiceId })`.
- If `tts` is non-null, pronunciation emits `onAction("speak", { text: question, tts })`; with null TTS, the replay control is omitted.
- After feedback, Next emits `onAction("next")`.

Pending/success/feedback lock all choices; a ref closes the duplicate-click race before React state renders. Failure keeps the chosen ID and exposes explicit Retry. Feedback identifies the correct public choice and styles both the correct row and an incorrect selected row.

The exported `ChoiceRow` (used internally, also exported for direct pure-render testing the way `WordSearchWindowView` is) renders visible, non-color feedback once `answered` is true: every correct-choice row shows a decorative check icon plus visible "Correct" text, and the selected incorrect row shows a decorative X icon plus visible "Your answer — incorrect" text; every other row shows neither. `isCorrect`/`isSelected` come only from the already-graded `feedback` prop and local selection, never from choice text, and the indicators render only when `answered` is true, so nothing here can leak correctness before grading.

## Accessibility and interaction

Choices, replay, Retry, and Next are native buttons with keyboard/pointer support. Replay has `replayLabel`; choices use visible text. Error container has `role="alert"`. Pending/feedback text is visible. Post-grade feedback icons are `aria-hidden="true"`; the adjacent visible text ("Correct" / "Your answer — incorrect") carries the accessible and non-color meaning, with the existing success/danger colors kept as supplemental reinforcement. No number-key shortcuts are implemented.

## Security boundary

Pre-grade props must contain only public choice IDs/text and an opaque attempt. No correctness flag or canonical answer is accepted. Correct public choice is injected only after validated grading.

## Consumers, playground, and tests

Created by Vocabulary `multipleChoiceScreen.ts`, registered centrally, and shown with Vocabulary/math examples in `/le-playground`. Tests cover action payloads/TTS disablement, choice shuffling, pending duplicate lock, failure/retry, cross-subject rendering, and server result validation. `tests/multiple-choice/choiceRowFeedback.test.tsx` covers the non-color feedback contract directly against the exported `ChoiceRow`: no indicator before grading (even when the row happens to be the eventual correct/selected one), the correct row identified after a wrong submission, the selected-incorrect row's icon/text, no indicator on unrelated rows, and that feedback is carried by visible text rather than color alone.

## Usage

```tsx
<MultipleChoiceWindow
  attemptId="opaque-attempt"
  badgeLabel="Definition practice"
  badgeTone="primary"
  prompt="Choose one"
  question="adapt"
  choices={[{ id: "opaque-choice", text: "to adjust" }]}
  tts={null}
  replayLabel="Hear"
  correctMessage="Correct"
  incorrectMessage="Not quite"
  feedback={null}
  onAction={onAction}
/>
```
