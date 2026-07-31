# Vocabulary Module

## Entry contract

Vocabulary is loaded for `/learning/vocabulary/<wordListId>` by `src/lib/learning-engine/initialization/loadLearningModule.ts`, where `wordListId` is a real `ModVocabList.id` owned by the authenticated session user. Exactly one module variable is required; missing, extra, unknown, or unowned list identifiers become the same learner-safe route error (a missing list and another user's list are indistinguishable to the learner).

`src/learning-modules/vocabulary/settings.json` enables the shared Learning Header and declares `"subscriptionTier": ["MONTHLY", "LIFETIME", "ADMIN"]` — the exact current tiers allowed to use Vocabulary, deliberately excluding `FREE_TRIAL` and `CANCELED`. `Vocabulary` implements the shared `ActiveModule` contract and uses browser clients for the content and answer APIs.

Vocabulary owns its module layout: `src/learning-modules/vocabulary/ModuleLayout.tsx` is the required, generically named module-layout entrypoint the Learning Engine loads and wraps around the active learning window (`<ModuleLayout><ScreenRenderer .../></ModuleLayout>`). It renders `src/learning-modules/vocabulary/module-panels/VocabularyStatusPanel.tsx` to the left of the engine-supplied `children` inside a `flex flex-1` container it owns. `VocabularyStatusPanel` is presentation-only static practice/word-status content (no props, no module state); the shared engine never imports it directly.

Vocabulary access is host-owned, not module-owned: `src/app/(app)/(learning)/learning/[...learning]/page.tsx` and all three Vocabulary HTTP boundaries independently call `authorizeLearningModuleAccess("vocabulary")` before any client engine initialization, content creation, capability mutation, grading, or paid TTS usage. See [Learning Module access](../architecture/security-and-server-boundaries.md#learning-module-access).

Vocabulary owns the structured errors for a missing list ID, an unknown list
ID, and unexpected extra route segments, including each local diagnostic code
and safe presentation. The shared engine transports and logs those errors,
treats the Vocabulary codes as opaque, and renders the supplied safe
presentation without interpreting it.

## Implementation inventory

- Module entry, `Vocabulary` class, and default export: `src/learning-modules/vocabulary/index.ts`. Configuration and shared types: `src/learning-modules/vocabulary/settings.json`, `src/learning-modules/vocabulary/types.ts`.
- Module layout and panel: `src/learning-modules/vocabulary/ModuleLayout.tsx`, `src/learning-modules/vocabulary/module-panels/VocabularyStatusPanel.tsx`.
- Module-owned route errors: `src/learning-modules/vocabulary/errors/vocabularyRouteErrors.ts`.
- Startup presentation: `src/learning-modules/vocabulary/components/Startup/VocabularyStartupContent.tsx`, `src/learning-modules/vocabulary/components/Startup/VocabularyStartupVisual.tsx`.
- Browser/server data contracts: `src/learning-modules/vocabulary/data/vocabularyContentTypes.ts`, `src/learning-modules/vocabulary/data/loadVocabularyContent.ts`, `src/learning-modules/vocabulary/data/submitVocabularyAnswer.ts`, `src/learning-modules/vocabulary/data/evaluateVocabularyAnswer.ts`, `src/learning-modules/vocabulary/data/getVocabularyPublicChoiceId.ts`, `src/learning-modules/vocabulary/data/vocabularyTts.ts`.
- Server-only grading: `src/learning-modules/vocabulary/data/getCorrectAnswer.ts` grades from the stored attempt snapshot only; it does not query the database.
- Module-owned Prisma repository: `src/learning-modules/vocabulary/server/vocabularyListStore.ts` (bounded `ModVocabList`/`ModVocabListWord` queries: ownership, count, first-five, next-after-position, distractor definitions).
- Content builder: `src/learning-modules/vocabulary/server/getVocabularyContent.ts` builds each screen projection from a small per-lesson word cache (never a fresh query per screen) and returns a server-only answer snapshot alongside the public content.
- Screen builders: `src/learning-modules/vocabulary/screens/startupScreen.tsx`, `src/learning-modules/vocabulary/screens/definitionDisplayScreen.ts`, `src/learning-modules/vocabulary/screens/definitionFunFactScreen.ts`, `src/learning-modules/vocabulary/screens/multipleChoiceScreen.ts`, `src/learning-modules/vocabulary/screens/spellingScreen.ts`, `src/learning-modules/vocabulary/screens/answerRecapScreen.ts`, `src/learning-modules/vocabulary/screens/lessonCompleteScreen.ts`, `src/learning-modules/vocabulary/screens/wordSearchCheckpointScreen.ts`.
- Lesson state: `src/learning-modules/vocabulary/state/VocabularyLessonTypes.ts`, `src/learning-modules/vocabulary/state/VocabularyLessonState.ts`, `src/learning-modules/vocabulary/state/VocabularyActiveAttempt.ts`, `src/learning-modules/vocabulary/state/createVocabularyLessonRandom.ts`, `src/learning-modules/vocabulary/state/selectVocabularyPracticeWord.ts`, `src/learning-modules/vocabulary/state/vocabularyReviewSchedule.ts`.
- Server capability and request handling: `src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore.ts`, `src/learning-modules/vocabulary/server/vocabularyLearnerSession.ts`, `src/learning-modules/vocabulary/server/parseVocabularyContentRequest.ts`, `src/learning-modules/vocabulary/server/handleVocabularyContentRequest.ts`, `src/learning-modules/vocabulary/server/handleVocabularySpeechRequest.ts`.
- Answer validation: `src/learning-modules/vocabulary/validation/parseVocabularySubmitAnswerPayload.ts`.

## Database-backed loading and the active pool

Vocabulary content comes from `ModVocabList`/`ModVocabListWord`, queried through the module-owned `vocabularyListStore.ts` repository -- never a hardcoded fixture and never a second Prisma client. A list may contain hundreds of words without changing the active pool's size or the response size of any request.

The manifest authorizes the requested list against the trusted session user (`ModVocabList.ownerUserId`), retrieves the authoritative `totalWordCount` via `COUNT`, and retrieves at most the first five complete `ModVocabListWord` records ordered by `position ASC`. Those five (or fewer, for a smaller list) become opaque lesson word IDs; a manifest also reports `totalWordCount` so lazy loading never changes lesson statistics or completion.

`VocabularyLessonState` keeps an active pool of the first five currently loaded, not-yet-spelling-mastered words, distinct from `totalWordCount`. It introduces loaded words in load order. Each introduction is:

1. `definition-display`;
2. `definition-fun-fact`;
3. graded definition practice when selected.

### Active-pool refill

When a word reaches full initial mastery (the spelling-mastery boundary below) and the database source is not yet exhausted, the module makes exactly one authorized `word-refill` content request (`{ contentType: "word-refill", lessonId }`) for the single next ordered `ModVocabListWord` whose `position` is greater than the server-held last-loaded position (positions are never assumed contiguous). The server appends the returned opaque word descriptor to both the server-authoritative and mirrored browser lesson state via `VocabularyLessonState.appendWord()`, which silently ignores a duplicate ID so a replayed or concurrent refill can never insert the same word twice. A refill triggered while the source is already exhausted returns an explicit `wordId: null`, never a placeholder. A failed/timed-out refill leaves the lesson recoverable (the same refill is retried on the next opportunity) without advancing the ordered cursor. Refills never fire for a definition-only mastery, an ordinary review completion, or a review re-mastery -- only the first time a word reaches full initial mastery, exactly matching the Word Search checkpoint's own first-mastery signal (`VocabularyLessonState.getFirstMasteryCount()`).

Once every one of `totalWordCount` word descriptors has been loaded, later words enter the five-word pool exactly as before until the list is exhausted.

## Practice, mastery, recap, and review

- Definition and spelling mastery are separate and each requires three consecutive correct answers.
- Before definition mastery, practice emits a multiple-choice attempt; afterward it emits spelling.
- Normal selection avoids immediate repetition when more than one candidate exists and weights less-presented words more heavily.
- Every confirmed graded answer is followed by `answer-recap`.
- Incorrect practice resets only the relevant streak.
- Spelling mastery schedules a delayed review exactly 30 confirmed graded answers later.
- Due reviews are ordered by due question number, then load order, and take priority over normal practice.
- A review requires a correct definition followed immediately by correct spelling. Failure resets both mastery stages and returns the word to normal learning.
- After every currently loaded word is introduced *and* `totalWordCount` word descriptors have all been loaded, the state captures a finite completion-review snapshot. Future reviews created while draining that snapshot do not prevent finite completion.

Lesson Complete is returned only after no active-pool work or required snapshot review remains, and only once the loaded word count reaches `totalWordCount` (i.e. the database source is exhausted). Stats report `totalWordCount`, not the currently loaded descriptor count, so lazy loading never changes lesson statistics. Stats are total words, confirmed correct answers, and confirmed incorrect answers.

## Word Search mastery checkpoints

After the answer that first brings a word to full initial mastery (the existing spelling-mastery boundary above), `VocabularyLessonState` records that word, once, in first-mastery order -- the same signal (`getFirstMasteryCount()`) that drives active-pool refill. It never re-adds a word that later fails a review and re-masters, so a word belongs to at most one checkpoint group for the lesson attempt.

Every time the recorded order reaches a new multiple of five, the state queues one checkpoint group. `next()` returns the normal `answer-recap` for the mastering answer first; the following `next()` call (recap's Next) returns `{ kind: "word-search-checkpoint", wordIds }` before any ordinary introduction/practice/review step, and marks that group served so it cannot repeat within the same lesson attempt. A 20-word list yields four groups (1–5, 6–10, 11–15, 16–20); the last group is followed by ordinary progression until Lesson Complete, exactly as any other served step would be.

The module fetches a narrow `word-search-checkpoint` content projection (`lessonId`/`capability` only, same shape as the other screen requests) that returns exactly `WORD_SEARCH_CHECKPOINT_GROUP_SIZE` (5) plain display word strings for that group — never canonical answer records, definitions, or unrelated content. Showing these words plainly follows the same established pattern as the recap projection's `word` field: every word shown has already been correctly spelled three times in a row, so this is not a new answer-security exception. `createWordSearchCheckpointScreenRequest` uses the subject-neutral contract at `src/lib/learning-engine/word-search/wordSearchInputContract.ts`, shared with the Window parser, to validate normalization, ASCII letters, 2–30 character lengths, duplicates, and structural compatibility before building a `word-search` `ScreenRequest`. The grid is the longest normalized word plus four cells, clamped to 8–30; valid 27–30-letter targets therefore use a 30-cell grid. Malformed, duplicate, incompatible, or missing checkpoint content throws one safe generic module error before the Window renders, and the module never fabricates or substitutes words.

The checkpoint is ungraded reinforcement: `WordSearchWindow` is rendered with `emitCompletionAction={false}`, so puzzle completion never reaches the graded `submitAnswer` parser, and finding all five words only enables the Window's own Next button. Clicking Next fires the ordinary `"next"` action, and `VocabularyLessonState` resumes exactly where it left off. Checkpoint advancement changes only checkpoint/progression state: it does not change mastery, correct/incorrect/graded stats, definition or spelling streaks, reward state (Vocabulary has none), or review stages/scheduling.

## Attempts and retry

The module keeps one active attempt. `attemptId`, answer type, offered public choice IDs, and review flag are bound at activation. It rejects stale IDs, wrong variants, unoffered choices, duplicate pending submissions, and already answered attempts.

Submission runs `idle → pending → success` or `error → explicit retry`. A transport/server failure cancels pending state but preserves the active attempt. Multiple Choice and Spelling also lock duplicate window interactions. Progress changes only after validated server feedback, and result type must match the active attempt.

## Content and answer security

The content endpoint rotates one screen-scoped capability at a time. Teaching and recap projections expose content only for the active display. Multiple-choice content includes an opaque attempt, public question, and four shuffled public choice IDs/text values built server-side from the active pool's own definitions (widened with a bounded database query only when the active pool cannot supply three eligible distractors). Spelling omits the target word and exposes only the definition plus an opaque attempt/speech reference.

The anonymous learner cookie, lesson, capability, word, projection, screen occurrence, answer type, and attempt are server-bound; list ownership is independently re-verified against the trusted session user at every content, answer, and speech boundary rather than trusted once from the initial manifest request. Exact content replay can return the recorded narrow projection. Exact duplicate answer delivery can return the recorded grade; a modified duplicate is rejected.

At content-build time the server snapshots the offered public choice IDs, the correct public choice ID (definition) or canonical spelling (spelling) into the server-only attempt record. Grading (`getCorrectAnswer.ts`) reads only that stored snapshot -- it never re-queries the database or recomputes distractors during answer submission, so exact replay and duplicate-submission grading stay stable even if the underlying list content changes mid-attempt.

Canonical word data, internal IDs, accepted spellings, and grading imports are `server-only`. Incorrect spelling feedback may reveal the correction only after confirmed grading.

## Speech

Teaching screens use the configured Google `chirp-3-hd` voice through public text requests. Spelling uses `/api/learning/vocabulary/speech` and the opaque active attempt. The server resolves the canonical word and its speech-synthesis definition from the same stored attempt snapshot used for grading (never a fresh database scan) and synthesizes audio; browser requests/responses do not include its written value before grading.

## Persistence and limitations

The browser lesson state, server capability/attempt state, and each lesson's small per-word content cache are memory-only; only `ModVocabList`/`ModVocabListWord` themselves are durable. A page refresh initializes a new authoritative lesson attempt with a new lesson ID and capability chain; it does not rehydrate or replay the prior attempt. Within one attempt, repeated reads of the same screen capability return its cached narrow projection, duplicate Next handling is locked, and served checkpoint groups remain recorded in the lesson state so capability reads or state recomputation cannot serve them again. Server restart loses capabilities, attempts, idempotency records, and progress. No Prisma model persists learning history, mastery, or session progress yet (that is deferred to a future feature using the already-created `ModVocabLearning`/`ModVocabWordProgress`/`ModVocabSession`/`ModVocabAttempt` tables). The singleton store is not suitable for multiple server instances.

## Tests

- State/progression: `tests/vocabulary/VocabularyLessonState.test.ts` (including exact first-mastery checkpoint order, served-group recomputation resistance, non-mutation, and review-failure/re-mastery behavior), `VocabularyActiveAttempt.test.ts`, `Vocabulary.test.ts` (including the checkpoint's narrow content projection, repeated capability reads, and duplicate Next handling).
- Database loading/refill: `tests/vocabulary/vocabularyDatabaseLoading.test.ts` (bounded initial load for lists of every size, no sixth-word prefetch, ownership authorization and its repetition at every boundary, database-failure-vs-not-found distinction, exactly-one/idempotent/concurrency-safe/retryable refill, end-of-list refill, no-skip/no-duplicate ordering, and completion gated on the exhausted database source) and `tests/vocabulary/vocabularyListStore.integration.test.ts` (the guarded real-Postgres boundary for the repository; skips outside an approved disposable database).
- Content/security: `tests/vocabulary/vocabularyFixture.test.ts`, API content/learner/speech/answer tests, and `tests/security/clientBundleScan.test.ts`.
- Window/submission: Learning Engine flow (including shared-contract bounds, 27–30-letter targets, malformed content, and structural compatibility validation), Multiple Choice, and Spelling test folders.
- Module layout: `tests/learning-engine/moduleLayout.test.tsx` proves the client-facing loader returns Vocabulary's `ModuleLayout`, that it renders `VocabularyStatusPanel` before the supplied children, and that a successful `LearningEngine.initialize()` selects it; `tests/learning-engine/LearningEngineRouteErrors.test.ts` proves a terminal route error clears it (`setModuleLayout(null)`) and that a stale/aborted initialization never assigns one.
- Access gating: `tests/auth/moduleAccess.test.ts`, `tests/billing/effectiveSubscriptionTier.test.ts`, and `tests/api/vocabularyModuleAccessGate.test.ts` (the last exercises all three real route handlers directly with injected access dependencies, proving unauthenticated/forbidden/database-failure denial and pass-through-on-grant for each).
- Full flow: `tests/integration/vocabularyRouteSmoke.test.ts` drives a complete lesson (including a full five-word checkpoint) through the real registered Learning Engine and real content/answer handlers without a browser or the HTTP access gate, so it is unaffected by subscription-tier access changes. `tests/e2e/vocabularyRoute.e2e.ts` now proves the anonymous access boundary against the real running application (server-side sign-in redirect before any client engine initialization, and `401` from all three direct API boundaries) rather than a full anonymous playthrough, since Vocabulary is subscription-protected. An equivalent authenticated-browser full-flow test is not implemented: it would require seeding a real signed-in, entitled database user through the real credentials UI, and this repository's disposable-database guard does not treat the currently configured `DATABASE_URL` as an approved local/test-named disposable database.
