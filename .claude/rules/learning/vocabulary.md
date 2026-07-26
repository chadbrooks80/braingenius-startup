---
paths:
  - "src/learning-modules/vocabulary/**/*"
  - "src/app/api/learning/vocabulary/**/*"
  - "tests/vocabulary/**/*"
  - "tests/api/vocabulary*.test.ts"
  - "tests/api/evaluateVocabularyAnswer.test.ts"
  - "tests/integration/vocabulary*.test.ts"
  - "tests/e2e/vocabulary*.e2e.ts"
  - "tests/multiple-choice/multipleChoiceScreen.test.ts"
  - "tests/multiple-choice/submitVocabularyAnswer.test.ts"
---

# Vocabulary Module

## Current Lesson Contract

- Vocabulary is the first complete learning module.
- The current fixture route is `/learning/vocabulary/word_list_id`.
- Treat `word_list_id` as a fixture identifier passed through the normal module route contract, not as a special route that should be hardcoded elsewhere.
- The current server fixture contains 20 words. That fixture length is not a universal requirement for future database-backed word lists.
- The current lesson contract uses an active learning pool of five words.
- Treat the approved feature specification identified through `context/current-feature.md` as the source of truth when it intentionally changes a lesson rule below. Do not silently change these rules as incidental implementation cleanup.

## Introduction and Practice

- Introduce active words in the required order before graded practice for those words.
- Keep definition and spelling as separate attempt types with separate mastery state.
- Follow each confirmed graded answer with the required Answer Recap screen.
- Select normal practice using the existing eligibility, weighting, and no-immediate-repeat rules.
- Keep random selection deterministic under tests by using the module's injected or seeded random source.
- Replace a mastered word according to the current lesson rules until the full list has been introduced.
- Keep Vocabulary content selection and progression inside the Vocabulary module.

## Attempts and Submission

- Maintain one authoritative active attempt.
- Definition attempts must accept only valid public choice IDs for that exact attempt.
- Spelling attempts must not expose the canonical written answer before grading.
- Begin pending submission state before the request and confirm the matching result before applying progress.
- On a recoverable failure, cancel pending submission state without losing the active attempt.
- Do not advance, count an answer, reveal recap, or change mastery until server validation succeeds.
- Prevent duplicate delivery from recording progress twice.

## Mastery

- Preserve the configured correct-streak rules.
- Keep definition mastery and spelling mastery separate where the lesson contract requires both.
- Apply confirmed results exactly once.
- Reset or continue streaks according to the authoritative state machine.
- Do not calculate mastery in a Learning Window, route, endpoint, or shared engine file.

## Delayed Reviews

- When a delayed review is currently due, select the oldest due review before normal practice when required by the lesson contract.
- Do not insert normal practice ahead of an already-due review merely for variety or spacing.
- Calculate review timing from the actual confirmed graded-answer count at the moment the triggering answer succeeds.
- Do not schedule from a projected batch, future estimate, or unconfirmed submission.
- Preserve the required definition-review then spelling-review sequence.
- Apply the approved reset behavior after a failed review.
- When completion processing freezes a finite set of outstanding reviews, use an explicit completion-time snapshot so newly scheduled future reviews are not mistaken for reviews already due.

## Completion

Do not show Lesson Complete while any required work remains, including:

- An unintroduced required word.
- Incomplete definition or spelling mastery.
- A currently due review.
- A partially completed definition-then-spelling review.
- A failed review that must be repeated.
- A pending or failed submission.
- A required confirmation that has not succeeded.

- Determine completion from authoritative current state after all confirmed answers are applied.
- The route, engine, and windows must not override module completion.

## Vocabulary Content Chain

- Keep the browser limited to lesson-scoped opaque identifiers, the current screen's narrow projection, and the capability for the exact authorized screen occurrence.
- Do not return a complete canonical word record or preload future answer-bearing screens.
- Rotate capabilities only after the current authorized transition succeeds.
- Keep practice successors unavailable until the current attempt is graded.
- Keep duplicate-answer retry behavior bounded and idempotent.
- Keep learner, lesson, word, projection, screen occurrence, and attempt binding server-authoritative.

## Verification

- Test active-pool size, introduction order, definition and spelling mastery, replacement, least-shown selection, no immediate repeat, review scheduling, oldest-due priority, review sequencing, review failure, exact graded-answer boundaries, pending failure, retry, duplicate delivery, long-running lesson paths, and completion.
- Run the full Vocabulary route through the real module and real answer handler when complete lesson behavior changes.
- Do not substitute hand-fed state results or a mocked endpoint for required integration coverage.
