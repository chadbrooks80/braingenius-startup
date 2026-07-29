# Vocabulary Module

## Entry contract

Vocabulary is loaded for `/learning/vocabulary/<wordListId>` by `src/lib/learning-engine/initialization/loadLearningModule.ts`. The current fixture URL is `/learning/vocabulary/word_list_id`. Exactly one module variable is required; missing, extra, or unknown list identifiers become learner-safe route errors.

`src/learning-modules/vocabulary/settings.json` enables the shared Learning Header and Sidebar. `Vocabulary` implements the shared `ActiveModule` contract and uses browser clients for the content and answer APIs.

## Implementation inventory

- Module entry, `Vocabulary` class, and default export: `src/learning-modules/vocabulary/index.ts`. Configuration and shared types: `src/learning-modules/vocabulary/settings.json`, `src/learning-modules/vocabulary/types.ts`.
- Startup presentation: `src/learning-modules/vocabulary/components/Startup/VocabularyStartupContent.tsx`, `src/learning-modules/vocabulary/components/Startup/VocabularyStartupVisual.tsx`.
- Browser/server data contracts: `src/learning-modules/vocabulary/data/vocabularyContentTypes.ts`, `src/learning-modules/vocabulary/data/loadVocabularyContent.ts`, `src/learning-modules/vocabulary/data/submitVocabularyAnswer.ts`, `src/learning-modules/vocabulary/data/evaluateVocabularyAnswer.ts`, `src/learning-modules/vocabulary/data/getVocabularyPublicChoiceId.ts`, `src/learning-modules/vocabulary/data/vocabularyTts.ts`.
- Server-only content and resolution: `src/learning-modules/vocabulary/data/getWordList.ts`, `src/learning-modules/vocabulary/data/getCorrectAnswer.ts`.
- Screen builders: `src/learning-modules/vocabulary/screens/startupScreen.tsx`, `src/learning-modules/vocabulary/screens/definitionDisplayScreen.ts`, `src/learning-modules/vocabulary/screens/definitionFunFactScreen.ts`, `src/learning-modules/vocabulary/screens/multipleChoiceScreen.ts`, `src/learning-modules/vocabulary/screens/spellingScreen.ts`, `src/learning-modules/vocabulary/screens/answerRecapScreen.ts`, `src/learning-modules/vocabulary/screens/lessonCompleteScreen.ts`, `src/learning-modules/vocabulary/screens/wordSearchCheckpointScreen.ts`.
- Lesson state: `src/learning-modules/vocabulary/state/VocabularyLessonTypes.ts`, `src/learning-modules/vocabulary/state/VocabularyLessonState.ts`, `src/learning-modules/vocabulary/state/VocabularyActiveAttempt.ts`, `src/learning-modules/vocabulary/state/createVocabularyLessonRandom.ts`, `src/learning-modules/vocabulary/state/selectVocabularyPracticeWord.ts`, `src/learning-modules/vocabulary/state/vocabularyReviewSchedule.ts`.
- Server capability and request handling: `src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore.ts`, `src/learning-modules/vocabulary/server/vocabularyLearnerSession.ts`, `src/learning-modules/vocabulary/server/parseVocabularyContentRequest.ts`, `src/learning-modules/vocabulary/server/getVocabularyContent.ts`, `src/learning-modules/vocabulary/server/handleVocabularyContentRequest.ts`, `src/learning-modules/vocabulary/server/handleVocabularySpeechRequest.ts`.
- Answer validation: `src/learning-modules/vocabulary/validation/parseVocabularySubmitAnswerPayload.ts`.

## Current fixture and active pool

The canonical server-only fixture in `data/getWordList.ts` contains 20 complete word records. This count is a fixture fact, not a generic module constraint. A manifest gives the browser only 20 opaque lesson word IDs, a random seed, lesson ID, and the capability for the first screen.

`VocabularyLessonState` keeps an active pool of the first five not-yet-spelling-mastered words. It introduces those words in fixture order. Each introduction is:

1. `definition-display`;
2. `definition-fun-fact`;
3. graded definition practice when selected.

Once a word is spelling-mastered, later words enter the five-word pool until all 20 are introduced.

## Practice, mastery, recap, and review

- Definition and spelling mastery are separate and each requires three consecutive correct answers.
- Before definition mastery, practice emits a multiple-choice attempt; afterward it emits spelling.
- Normal selection avoids immediate repetition when more than one candidate exists and weights less-presented words more heavily.
- Every confirmed graded answer is followed by `answer-recap`.
- Incorrect practice resets only the relevant streak.
- Spelling mastery schedules a delayed review exactly 30 confirmed graded answers later.
- Due reviews are ordered by due question number, then fixture order, and take priority over normal practice.
- A review requires a correct definition followed immediately by correct spelling. Failure resets both mastery stages and returns the word to normal learning.
- After every word is introduced, the state captures a finite completion-review snapshot. Future reviews created while draining that snapshot do not prevent finite completion.

Lesson Complete is returned only after no active-pool work or required snapshot review remains. Stats are total words, confirmed correct answers, and confirmed incorrect answers.

## Word Search mastery checkpoints

After the answer that first brings a word to full initial mastery (the existing spelling-mastery boundary above), `VocabularyLessonState` records that word, once, in first-mastery order. It never re-adds a word that later fails a review and re-masters, so a word belongs to at most one checkpoint group for the lesson attempt.

Every time the recorded order reaches a new multiple of five, the state queues one checkpoint group. `next()` returns the normal `answer-recap` for the mastering answer first; the following `next()` call (recap's Next) returns `{ kind: "word-search-checkpoint", wordIds }` before any ordinary introduction/practice/review step, and marks that group served so it cannot repeat within the same lesson attempt. With the current 20-word fixture this yields four groups (1–5, 6–10, 11–15, 16–20); the fourth is followed by ordinary progression until Lesson Complete, exactly as any other served step would be.

The module fetches a narrow `word-search-checkpoint` content projection (`lessonId`/`capability` only, same shape as the other screen requests) that returns exactly `WORD_SEARCH_CHECKPOINT_GROUP_SIZE` (5) plain display word strings for that group — never canonical answer records, definitions, or unrelated content. Showing these words plainly follows the same established pattern as the recap projection's `word` field: every word shown has already been correctly spelled three times in a row, so this is not a new answer-security exception. `createWordSearchCheckpointScreenRequest` uses the subject-neutral contract at `src/lib/learning-engine/word-search/wordSearchInputContract.ts`, shared with the Window parser, to validate normalization, ASCII letters, 2–30 character lengths, duplicates, and structural compatibility before building a `word-search` `ScreenRequest`. The grid is the longest normalized word plus four cells, clamped to 8–30; valid 27–30-letter targets therefore use a 30-cell grid. Malformed, duplicate, incompatible, or missing checkpoint content throws one safe generic module error before the Window renders, and the module never fabricates or substitutes words.

The checkpoint is ungraded reinforcement: `WordSearchWindow` is rendered with `emitCompletionAction={false}`, so puzzle completion never reaches the graded `submitAnswer` parser, and finding all five words only enables the Window's own Next button. Clicking Next fires the ordinary `"next"` action, and `VocabularyLessonState` resumes exactly where it left off. Checkpoint advancement changes only checkpoint/progression state: it does not change mastery, correct/incorrect/graded stats, definition or spelling streaks, reward state (Vocabulary has none), or review stages/scheduling.

## Attempts and retry

The module keeps one active attempt. `attemptId`, answer type, offered public choice IDs, and review flag are bound at activation. It rejects stale IDs, wrong variants, unoffered choices, duplicate pending submissions, and already answered attempts.

Submission runs `idle → pending → success` or `error → explicit retry`. A transport/server failure cancels pending state but preserves the active attempt. Multiple Choice and Spelling also lock duplicate window interactions. Progress changes only after validated server feedback, and result type must match the active attempt.

## Content and answer security

The content endpoint rotates one screen-scoped capability at a time. Teaching and recap projections expose content only for the active display. Multiple-choice content includes an opaque attempt, public question, and four shuffled public choice IDs/text values. Spelling omits the target word and exposes only the definition plus an opaque attempt/speech reference.

The anonymous learner cookie, lesson, capability, word, projection, screen occurrence, answer type, and attempt are server-bound. Exact content replay can return the recorded narrow projection. Exact duplicate answer delivery can return the recorded grade; a modified duplicate is rejected.

Canonical word data, internal IDs, accepted spellings, and grading imports are `server-only`. Incorrect spelling feedback may reveal the correction only after confirmed grading.

## Speech

Teaching screens use the configured Google `chirp-3-hd` voice through public text requests. Spelling uses `/api/learning/vocabulary/speech` and the opaque active attempt. The server resolves and synthesizes the canonical word; browser requests/responses do not include its written value before grading.

## Persistence and limitations

Both the browser lesson state and server capability/attempt state are memory-only. A page refresh initializes a new authoritative lesson attempt with a new lesson ID and capability chain; it does not rehydrate or replay the prior attempt. Within one attempt, repeated reads of the same screen capability return its cached narrow projection, duplicate Next handling is locked, and served checkpoint groups remain recorded in the lesson state so capability reads or state recomputation cannot serve them again. Server restart loses capabilities, attempts, idempotency records, and progress. No Prisma model persists learning history. The singleton store is not suitable for multiple server instances.

## Tests

- State/progression: `tests/vocabulary/VocabularyLessonState.test.ts` (including exact first-mastery checkpoint order, served-group recomputation resistance, non-mutation, and review-failure/re-mastery behavior), `VocabularyActiveAttempt.test.ts`, `Vocabulary.test.ts` (including the checkpoint's narrow content projection, repeated capability reads, and duplicate Next handling).
- Content/security: `tests/vocabulary/vocabularyFixture.test.ts`, API content/learner/speech/answer tests, and `tests/security/clientBundleScan.test.ts`.
- Window/submission: Learning Engine flow (including shared-contract bounds, 27–30-letter targets, malformed content, and structural compatibility validation), Multiple Choice, and Spelling test folders.
- Full flow: `tests/integration/vocabularyRouteSmoke.test.ts` and `tests/e2e/vocabularyRoute.e2e.ts` (both drive at least one complete five-word checkpoint through the registered Learning Engine and Word Search Window; the E2E route also proves refresh creates a new lesson ID).
