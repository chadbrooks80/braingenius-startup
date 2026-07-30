# Vocabulary Persistence Schema

Phase 1 of `mod-vocab-database-tables` adds the Prisma/PostgreSQL persistence
structure for the Vocabulary learning module: eight tables, six enums, their
indexes, constraints, and foreign keys. It does not seed data, connect the
running Vocabulary module to Prisma, or create the separate Dictionary
database. `VocabularyLessonState` and the current fixture (`getWordList.ts`)
are unchanged and remain memory-only.

## Tables and ownership

Every physical table created by this phase is prefixed `mod_vocab_` to mark
it as owned by the Vocabulary module, distinct from host tables such as
`User`, `Subscription`, or the Tts* tables. No table in this migration uses
any other prefix, and no implicit Prisma many-to-many join table is created.

| Table | Prisma model | Ownership |
| --- | --- | --- |
| `mod_vocab_lists` | `ModVocabList` | Reusable list, owned by its creator |
| `mod_vocab_list_words` | `ModVocabListWord` | List-specific content snapshot |
| `mod_vocab_learnings` | `ModVocabLearning` | Learner-specific assignment/enrollment |
| `mod_vocab_word_progress` | `ModVocabWordProgress` | Per-word progress within one learning record |
| `mod_vocab_sessions` | `ModVocabSession` | One learner visit within a learning record |
| `mod_vocab_attempts` | `ModVocabAttempt` | One durable definition or spelling attempt |
| `mod_vocab_attempt_choices` | `ModVocabAttemptChoice` | Durable choice snapshots for a definition attempt |
| `mod_vocab_daily_practice` | `ModVocabDailyPractice` | Daily study-time/answer totals per learner |

## Reusable lists vs. learner-specific learnings

`ModVocabList` and `ModVocabListWord` model a reusable, ordered list owned by
its creator (a parent, teacher, administrator, or other authorized user).
`ModVocabLearning` is the separate learner-specific assignment/enrollment
record — the future `learningId` in `/learning/vocabulary/:learningId`. A
list has no unique constraint tying it to one learner: the same list can be
assigned to more than one learner, and a single learner can receive the same
list again as a second, independent `ModVocabLearning` row. All progress,
sessions, attempts, and counters live under the learning record, never under
the list, so every learner's progress stays independent even when the list
content is shared.

List order is explicit: `ModVocabListWord.position` is a required integer
with a unique `(listId, position)` constraint, so ordering never depends on
insertion order or record ID. A unique `(listId, normalizedWord)` constraint
prevents case/whitespace-equivalent duplicate words inside one list.

## Editable content snapshots and the Dictionary fill-missing-fields flow

Every `ModVocabListWord` stores a complete, list-specific content snapshot:
`word`, `definition`, `spellingDefinition`, three example sentences, and
`interestingFact`. Only `word` is required — every other content field is
optional so a list item can start as word-only and still be a valid record.
`contentSource` (`WORD_ONLY`, `DICTIONARY`, `TEACHER`, `MIXED`) and
`contentResolvedAt` record how and when the snapshot was completed.

A future Dictionary integration will look up the optional, non-foreign-key
`dictionaryEntryId` provenance field, fetch missing content, and fill in only
the fields the teacher left blank. Teacher-provided content is authoritative:
the fill step must never overwrite a nonblank teacher value. `dictionaryEntryId`
is intentionally not a foreign key — Dictionary is a separate database, so
Brain Genius stores only its external identifier as provenance, not a
relational reference.

## Active-five ordering source

The active learning pool will eventually use the first five unfinished words
for a `ModVocabLearning`, ordered by `ModVocabListWord.position` (indexed via
`mod_vocab_list_words_listId_position_idx`) and filtered by
`ModVocabWordProgress.spellingMastered` (indexed via
`mod_vocab_word_progress_learningId_spellingMastered_idx`). Phase 1 creates
only this durable ordering and progress data; the runtime Vocabulary module
still uses its in-memory fixture order.

## Progress, review, and checkpoint persistence

`ModVocabWordProgress` is unique per `(learningId, listWordId)` and stores
introduction state, separate definition/spelling mastery streaks and
timestamps, a weighted `practicePresentationCount`, `reviewStage` (`IDLE`,
`DEFINITION_PENDING`, `SPELLING_PENDING`) with `nextReviewQuestionNumber` for
delayed reviews, and running `totalCorrect`/`totalIncorrect` counters.

`initialMasterySequence` and `firstMasteredAt` record the first time a word
ever reaches full mastery. They are set once and are never cleared by a
later review failure, and `(learningId, initialMasterySequence)` is unique
(PostgreSQL allows multiple NULLs for words not yet mastered). This lets the
existing five-word Word Search checkpoint groups be reconstructed durably
from first-mastery order without ever placing one word into two groups.

## Attempt answer security

`ModVocabSession` and the opaque, UUID-keyed `ModVocabAttempt` /
`ModVocabAttemptChoice` rows give the future server boundary durable storage
for the same answer-security model the in-memory implementation already
follows: attempts and public choice IDs are unguessable UUIDs, and
`ModVocabAttempt.correctAnswerSnapshot` / `submittedAnswer` are server-only
columns that must never appear in a public lesson projection.
`correctAnswerSnapshot` exists so an in-flight spelling attempt stays gradable
even if the list content is edited mid-attempt. `ModVocabAttemptChoice` rows
are unique per `(attemptId, position)` and per `(attemptId, sourceListWordId)`
when the source word is set, giving durable, server-authoritative choice
snapshots; deleting the source list word sets `sourceListWordId` to null so
historical attempt evidence survives independently of the current list
content. A future feature will enforce exactly four unique choices and one
correct choice in application logic — this phase adds no triggers or stored
procedures.

## Daily-practice ownership, study time, and answer totals

`ModVocabDailyPractice` is a module-owned, per-learner-per-day aggregate
(`goalSeconds`, `secondsStudied`, `questionsAnswered`, `correctAnswers`,
`goalReachedAt`), unique per `(learnerUserId, practiceDate)`. It rolls up a
learner's Vocabulary practice across all of that learner's lists and learning
records for one calendar date; per-learning/session detail remains available
from `ModVocabSession` and `ModVocabAttempt`. Daily incorrect answers are
derived as `questionsAnswered - correctAnswers` rather than stored, and a
database check constraint enforces `correctAnswers <= questionsAnswered`.

## Constraints not expressible in Prisma schema syntax

The installed Prisma version (7.8.0) has no schema-level nonnegative or
cross-column check constraint. The migration
(`prisma/migrations/20260730181054_add_mod_vocab_tables/migration.sql`) adds
hand-written `ALTER TABLE ... ADD CONSTRAINT ... CHECK (...)` statements after
the generated DDL for every counter field listed in the feature spec
(`dailyGoalSeconds`, the answer/checkpoint counters on `ModVocabLearning` and
`ModVocabSession`, the progress counters and nullable
`nextReviewQuestionNumber`/`initialMasterySequence` on `ModVocabWordProgress`,
`position` on `ModVocabAttemptChoice`, and the daily-practice counters plus
the `correctAnswers <= questionsAnswered` consistency check). These
statements were applied to the development database and are part of the
tracked migration; `tests/vocabulary/vocabularyPersistenceSchema.test.ts`
verifies their exact text is present in `migration.sql`.

## What this phase does not do

Phase 1 creates persistence structure only. It does not seed a list,
learning record, word, progress row, session, attempt, or daily-practice
row; does not create the separate Dictionary database or a second Prisma
datasource/client; does not implement Dictionary lookup or field-merge
logic; and does not connect `VocabularyLessonState`, the Vocabulary API
routes, or the current `getWordList.ts` fixture to Prisma. Those remain
memory-only, exactly as described in the "Persistence and limitations"
section of [`vocabulary.md`](./vocabulary.md).
