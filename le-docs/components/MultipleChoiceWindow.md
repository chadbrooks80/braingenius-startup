# MultipleChoiceWindow

Reusable multiple-choice interaction used by learning modules through the registered `"multiple-choice"` window name.

The module supplies an opaque attempt ID, badge copy/tone, prompt, question, choices, feedback messages, replay label, and either a valid TTS configuration or `null`. The engine injects opaque live module feedback and the shared `onAction` callback after module props so engine-owned state wins.

## Important behavior

- Selecting a choice emits the generic multiple-choice interaction payload `{ attemptId, selectedChoiceId }`. The active module interprets that payload and constructs any subject-specific API request.
- Submission state is explicit: idle, pending, success, or error. Choices lock only while pending or after success.
- A failed, timed-out, or invalid submission leaves the learner on the same question, shows learner-safe feedback, and offers Retry for the same answer.
- Confirmed feedback reveals the correct choice and enables `next`.
- Badge wording and tone are module props, so practice/review or another subject’s labels do not require component changes.
- When TTS is enabled, the speaker control emits `speak` with the same module-owned configuration. `null` disables both automatic and manual pronunciation without changing answer behavior.

Local interaction state belongs to the window; subject-specific answer parsing, validation, feedback interpretation, and lesson progression remain in the active module. The shared Learning Engine forwards the payload and stores feedback opaquely.

Sources: `src/components/LearningWindows/MultipleChoice/`, `src/learning-modules/vocabulary/screens/multipleChoiceScreen.ts`, and `src/app/playground/page.tsx`.
