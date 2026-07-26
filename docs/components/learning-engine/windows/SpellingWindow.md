# SpellingWindow

Source: `src/components/learning-engine/windows/Spelling/SpellingWindow.tsx`

## Registry and ownership

Registry key: `spelling`. Client graded spelling window. It owns temporary text, validation, and pending/retry presentation. Vocabulary/server own the hidden answer, speech reference, grading, progress, and transition.

## Props

| Prop | Type | Required |
| --- | --- | --- |
| `attemptId` | `string` | Yes |
| `badgeLabel` | `string` | Yes |
| `badgeTone` | `"primary" | "secondary"` | Yes |
| `promptLabel`, `promptText`, `inputLabel`, `submitLabel`, `replayLabel` | `string` | Yes |
| `speech` | `SpeakActionPayload` | Yes |
| `blankMessage`, `pendingMessage`, `errorMessage` | `string` | Yes |
| `correctMessage`, `incorrectMessage`, `correctionLabel` | `string` | Yes |
| `feedback` | `{ correct: true } | { correct: false; correctAnswer: string } | null` | Yes |
| `onAction` | `OnAction` | Yes |

No defaults.

## State, reset, and actions

The exported wrapper keys the internal attempt by `attemptId`, resetting typed answer, validation, and submission state for a new attempt. Submit trims outer whitespace, rejects blank input locally, then emits `onAction("submitAnswer", { attemptId, answer })`. Replay emits `onAction("speak", speech)`. Feedback unlocks Next, which emits `onAction("next")`.

Submission states are idle/pending/success/error and retain the submitted answer. A ref locks duplicate pending/success actions immediately. Failure preserves the value and Retry resubmits it explicitly. Input and submit lock while pending/success or after feedback.

## Accessibility and interaction

The input has an associated label, autofocus, autocomplete off, and spellcheck false. Form submission supports Enter; replay/Retry/Next are native buttons. Error uses `role="alert"` for submission failure; blank validation is visible but not live.

## Security boundary

Before grading, `speech` must be the opaque module speech source and `promptText` must not contain the canonical spelling. The correction appears only in confirmed incorrect feedback.

## Consumers, playground, and tests

Created by Vocabulary `spellingScreen.ts`, registered centrally, and shown in `/le-playground`. Tests prove answer hiding/reveal, strict payload, pending duplicate lock, retry, protected speech requests, and server binding.

## Usage

```tsx
<SpellingWindow
  attemptId="opaque-attempt"
  badgeLabel="Spelling practice"
  badgeTone="primary"
  promptLabel="Definition"
  promptText="to adjust"
  inputLabel="Type the word you heard"
  submitLabel="Check"
  replayLabel="Hear prompt"
  speech={{ source: { endpoint: "/api/learning/vocabulary/speech", reference: "opaque-attempt" } }}
  blankMessage="Enter a spelling."
  pendingMessage="Checking…"
  errorMessage="Try again."
  correctMessage="Correct"
  incorrectMessage="Not quite"
  correctionLabel="Correct spelling"
  feedback={null}
  onAction={onAction}
/>
```
