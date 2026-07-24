# SpellingWindow

Reusable typed-response interaction registered as `"spelling"`.

The active module supplies all visible copy, badge wording/tone, prompt content, an opaque `speech` payload for the engine `speak` action, and generic `{ correct, correctAnswer? }` interaction feedback. The window autofocuses the input, accepts Enter or the supplied submit label, rejects blank input with the supplied message, locks duplicate submissions, and offers Retry after request failure.

The `speech` prop is passed through to `onAction("speak", speech)` unchanged for manual replay; the window never inspects it. When the spoken content is itself the graded answer, the module supplies a server-resolved speech source (`{ source: { endpoint, reference } }`) so the canonical written answer never reaches the browser as text — the browser exchanges the opaque reference for audio.

Submission emits `{ attemptId, answer }` without a vocabulary answer discriminant. The active module owns parsing, attempt validation, API communication, and feedback interpretation. Vocabulary configures the interaction as spelling; the target word is absent from all browser-visible screen data before confirmed feedback and appears only in post-grading `correctAnswer` feedback.

Sources: `src/components/learning-engine/windows/Spelling/`, `src/learning-modules/vocabulary/screens/spellingScreen.ts`, and `src/app/playground/page.tsx`.
