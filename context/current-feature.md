# Database-Backed Vocabulary Runtime Security State

**Feature ID:** `database-backed-vocabulary-runtime-security-state`  
**Status:** `READY TO IMPLEMENT`  
**Proposed branch:** `feature/database-backed-vocabulary-runtime-security-state`

## Goal

Replace the production process-local storage used by the Vocabulary module for active lesson records, screen capabilities, and gradable attempts with shared PostgreSQL/Neon persistence through Prisma.

The learner-visible Vocabulary flow, module ownership, API contracts, answer-security model, and current fixed 30-minute lifetime must remain unchanged. A lesson created by one running copy of the web server must continue successfully when any later content, answer, refill, or protected-speech request is handled by another running copy.

This is a narrow reliability correction to the existing Vocabulary-owned architecture. It is not the future redesign that moves generic security or submission infrastructure into the shared Learning Engine.

## Current behavior and defect

`src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore.ts` currently owns three authoritative production Maps:

```ts
private readonly lessons = new Map<string, LessonRecord>();
private readonly capabilities = new Map<string, CapabilityRecord>();
private readonly attempts = new Map<string, AttemptRecord>();
```

Those Maps hold the live server-side lesson state, opaque screen-capability chain, cached public projections, active attempt bindings, protected grading snapshots, duplicate-delivery results, spelling speech references, and active-pool refill state.

The Maps are private to one running backend process. A request handled by another process cannot find records created by the first process, and a restart loses all records. The current handlers then reject a valid request as an invalid capability or invalid answer submission.

The records currently expire after `DEFAULT_LIFETIME_MS = 30 * 60 * 1_000`. The lesson expiry is fixed when the manifest is created and is not refreshed by activity. That behavior is approved for this feature and must not change.

## Approved architecture

### Ownership

- Vocabulary continues to own lesson state, content capabilities, attempts, grading snapshots, active-pool refill behavior, mastery, reviews, checkpoints, and progression.
- All new runtime persistence code remains under `src/learning-modules/vocabulary/server/` and uses the existing Prisma singleton from `src/lib/db.ts`.
- The existing Vocabulary API routes remain thin and continue delegating to module-owned handlers.
- The shared Learning Engine, Learning Windows, and shared learning contracts must not be changed.
- The browser continues to receive only the current narrow public screen projection and opaque identifiers.

### Storage shape

Add one module-owned Prisma model representing the three existing runtime record kinds rather than introducing three unrelated persistence systems:

```prisma
enum ModVocabRuntimeRecordKind {
  LESSON
  CAPABILITY
  ATTEMPT

  @@map("mod_vocab_runtime_record_kind")
}

model ModVocabRuntimeRecord {
  recordKind  ModVocabRuntimeRecordKind
  id          String
  lessonId    String
  learnerId   String
  wordListId  String
  payload     Json
  stateVersion Int                    @default(0)
  expiresAt   DateTime
  createdAt   DateTime                @default(now())
  updatedAt   DateTime                @updatedAt

  wordList ModVocabList @relation(fields: [wordListId], references: [id], onDelete: Cascade)

  @@id([recordKind, id])
  @@index([lessonId, recordKind])
  @@index([learnerId, lessonId])
  @@index([wordListId])
  @@index([expiresAt])
  @@map("mod_vocab_runtime_records")
}
```

Add the corresponding `runtimeRecords` relation to `ModVocabList`. The implementer may adjust only Prisma syntax or index names required by the installed Prisma/PostgreSQL versions, but must preserve this single-table, three-record-kind design and all listed lookup/index requirements.

The application continues generating the public `lessonId`, capability IDs, and attempt IDs with cryptographically secure UUIDs as it does now. `id` is supplied by the application; the database must not replace these public opaque identifiers with predictable values.

`learnerId` is the existing protected Vocabulary learner identifier and is not a foreign key to `User`. The current authenticated user/list ownership check remains independent and must still run at every existing content, answer, refill, and speech boundary.

### Why a runtime-record table is separate

Do not connect or redesign `ModVocabLearning`, `ModVocabWordProgress`, `ModVocabSession`, `ModVocabAttempt`, `ModVocabAttemptChoice`, or `ModVocabDailyPractice` in this feature. Those models represent the broader long-term learner-progress architecture. The current runtime route and capability chain use their existing `wordListId` and protected learner identity contracts, and the user has explicitly postponed the larger architecture redesign.

`ModVocabRuntimeRecord` is a narrowly scoped shared replacement for the three existing Maps. It must not become a second source of long-term learner history.

## Runtime snapshot contract

Create explicit, versioned, strictly parsed server-only payload types for the three record kinds. Do not serialize class instances, `Map`, `Set`, functions, or `Promise` objects directly.

Use a version field such as `schemaVersion: 1` inside each JSON payload. Every database read must parse and validate the corresponding payload before it enters domain logic. A malformed or unknown payload version must fail safely through the existing generic server-unavailable path; it must never be trusted with a TypeScript cast.

### Lesson payload

The durable lesson payload must preserve everything currently required to reconstruct `LessonRecord`, including:

- the complete `VocabularyLessonState` snapshot;
- the ordered lesson words and `totalWordCount`;
- every `VocabularyWordProgress` entry;
- active-attempt state used by the lesson state machine;
- introduction phase;
- pending recap and whether recap is visible;
- graded, correct, and incorrect counters;
- last practiced word;
- completion-review snapshot;
- first-mastery/checkpoint order, served group count, and pending checkpoint group;
- the lesson-scoped-to-canonical word-ID mapping;
- the small per-lesson `VocabularyListWordRow` cache;
- last loaded database position;
- refills fulfilled and the last settled refill result;
- the deterministic lesson-random generator's exact current state or draw position.

Add an explicit snapshot/export and restore/hydration contract to `VocabularyLessonState`. Rehydrating must reproduce the exact next transition that the uninterrupted in-memory state would have produced. Recreating the random generator from its original seed while resetting its position is prohibited because it can change later selection, recap, or checkpoint behavior.

`refillInFlight: Promise` is not serializable and must not be placed in JSON. Replace only that process-local coordination mechanism with database transaction/concurrency control while preserving the existing exactly-once, no-skip, retryable refill behavior.

### Capability payload

Preserve the current `CapabilityRecord` data:

- bound lesson and screen step;
- predecessor capability;
- next capability;
- attempt ID;
- cached narrow public content response;
- expiry.

The public projection cache must remain database-backed so an exact permitted replay returns the identical response and identical next capability even when handled by another backend process.

### Attempt payload

Preserve the current `AttemptRecord` data:

- lesson word and review binding;
- answer type;
- successor capability;
- activated status;
- active/answered status;
- original submission and recorded result for bounded idempotency;
- valid public choice IDs;
- correct public choice ID or canonical spelling snapshot;
- protected spelling speech definition;
- expiry.

Correct answers, canonical spellings, internal word mappings, protected speech text, and stored payloads remain server-only and must never be added to a response, client type, log, window prop, or browser bundle.

## Required implementation steps

1. Add `ModVocabRuntimeRecordKind` and `ModVocabRuntimeRecord` to `prisma/schema.prisma`, including the `ModVocabList` relation and required indexes.
2. Create a new additive Prisma migration for the enum/table/indexes/foreign key. Do not edit an existing migration and do not use `prisma db push`. The migration must not seed, modify, or delete user data.
3. Add a server-only runtime repository under `src/learning-modules/vocabulary/server/`, preferably `vocabularyRuntimeStore.ts`. It must expose a narrow injected interface for production Prisma access and deterministic test doubles. Do not expose the raw Prisma client to domain code.
4. Add explicit runtime snapshot types and strict parsers, preferably in `src/learning-modules/vocabulary/server/vocabularyRuntimeSnapshots.ts` or the closest established module-owned location.
5. Add snapshot and hydration support to `VocabularyLessonState` and the deterministic lesson-random source. Preserve every private progression field and the exact random position without changing any progression rule.
6. Refactor `VocabularyContentCapabilityStore` so production authoritative state is loaded from and written to the runtime repository. Remove the production `lessons`, `capabilities`, and `attempts` Maps. Temporary reconstructed `Map`/`Set` values used only inside one request are allowed; no required state may survive only in process memory between requests.
7. Make store operations asynchronous where database access requires it and update the module-owned handlers to await them. Keep all existing public request and response shapes unchanged.
8. Make every multi-record transition atomic. Manifest creation must create the lesson and first capability together. Practice activation must create/update the capability and attempt together. Answer resolution must validate and update the attempt, lesson snapshot, successor capability, and recorded idempotent result together. A failure must leave no partial transition.
9. Replace `refillInFlight` with database-safe concurrency control. Concurrent refill requests for the same due slot must still load and append at most one next ordered word, return the same settled result where the current contract requires it, and never skip a word.
10. Preserve exact content and answer retry behavior across separate `VocabularyContentCapabilityStore` instances using the same repository. Exact duplicate answer delivery may return the saved result only within the current bounded lifecycle; a changed duplicate remains rejected.
11. Preserve lazy expiration cleanup. An expired lesson must make its capability and attempt records unusable and remove or invalidate all runtime records for that lesson. The lifetime remains a fixed 30 minutes from manifest creation and must not become sliding.
12. Update module documentation to replace the memory-only limitation with the new shared-runtime persistence behavior, document that page refresh still starts a new lesson, and clearly distinguish temporary runtime records from the postponed long-term progress models.

## Transaction and concurrency requirements

- Use database transactions whenever one logical operation reads or changes more than one runtime record.
- Use `stateVersion` or an equivalent database compare-and-swap/row-serialization mechanism so two backend processes cannot both advance the same lesson from the same state.
- A concurrency loser must re-read the committed record and follow the existing duplicate/replay contract; it must not create a second successor, attempt, refill, or progress update.
- Do not rely on timing, local locks, module singletons, or process-local promises for correctness.
- A database error must follow the existing generic unavailable response. It must not be converted to not-found, invalid-answer success, or fabricated content.
- Unknown, expired, cross-learner, cross-lesson, wrong-screen, wrong-answer-type, consumed, and altered references must remain rejected with the existing safe response behavior.

## Expected file scope

### Modify

- `prisma/schema.prisma`
- `src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore.ts`
- `src/learning-modules/vocabulary/server/handleVocabularyContentRequest.ts`
- `src/learning-modules/vocabulary/server/handleVocabularySpeechRequest.ts`
- `src/app/api/learning/vocabulary/submit-answer/route.ts` only if awaiting the new store contract requires a narrow change
- `src/learning-modules/vocabulary/state/VocabularyLessonState.ts`
- `src/learning-modules/vocabulary/state/createVocabularyLessonRandom.ts`
- `docs/modules/vocabulary.md`
- `docs/modules/vocabulary-persistence-schema.md`
- affected Vocabulary API, state, database, security, and integration tests

### Create

- one new migration under `prisma/migrations/<timestamp>_add_mod_vocab_runtime_records/migration.sql`
- `src/learning-modules/vocabulary/server/vocabularyRuntimeStore.ts`
- `src/learning-modules/vocabulary/server/vocabularyRuntimeSnapshots.ts` if snapshot parsing is not kept cohesively in the runtime store
- a deterministic shared-runtime-store test double under `tests/vocabulary/`
- focused runtime persistence/concurrency tests under `tests/vocabulary/` and/or `tests/api/`

### Do not modify

- `src/lib/learning-engine/**`
- `src/types/learning.ts`
- `src/components/learning-engine/**`
- Vocabulary Learning Windows or screen UI
- authentication, subscription, billing, or TTS provider infrastructure
- existing applied migration files

If the current repository has moved one of the confirmed module-owned handlers without changing its responsibility, follow the current location and document that difference. Do not use that as permission to broaden the feature.

## Behavior that must remain unchanged

- Vocabulary continues owning security records and answer submission for now.
- Route parameters, learner-cookie behavior, authentication, list ownership checks, and subscription gating remain unchanged.
- Browser content/answer/speech request and response shapes remain byte-for-byte contract compatible.
- Capability IDs, lesson IDs, attempt IDs, and public choice IDs remain opaque and unguessable.
- The active pool remains five words.
- Definition/spelling progression, delayed reviews, recap sequence, word refill, Word Search checkpoints, and lesson completion rules remain unchanged.
- `DEFINITION_MASTERY_STREAK` and `SPELLING_MASTERY_STREAK` remain at their current values; do not restore or otherwise alter them in this feature.
- The fixed 30-minute lifetime remains unchanged and non-sliding.
- Page refresh continues starting a new authoritative lesson rather than resuming the previous runtime lesson.
- Existing safe 400/404/503 response contracts remain unchanged.

## Explicitly out of scope

- Moving generic security, capability creation, or answer submission into the Learning Engine.
- Creating a generic cross-module learning-attempt service.
- Connecting the long-term `ModVocabLearning`, progress, session, attempt, attempt-choice, or daily-practice models.
- Changing the route from `wordListId` to `learningId` or changing learner/account ownership.
- Adding lesson resume after refresh, deployment, or expiration.
- Changing or extending the 30-minute lifetime.
- Adding an expiration message, toast, automatic restart, or other UI behavior.
- Changing mastery thresholds or making them user-configurable.
- Changing content selection, grading, progression, word ordering, refill order, review timing, checkpoints, or TTS behavior.
- New packages, external caches, Redis, hosting-specific behavior, deployment changes, or environment variables.
- Unrelated findings, dead-code cleanup, styling, documentation cleanup, or refactoring.

## Prohibited shortcuts

- Do not keep the production Maps as a fallback or cache required for correctness.
- Do not add sticky-session, single-process, hosting-vendor, or environment assumptions.
- Do not serialize `VocabularyLessonState` with `JSON.stringify` and cast it back. Its private Maps, Sets, random function, and class invariants require an explicit typed snapshot/hydration contract.
- Do not store a `Promise`, function, raw Prisma object, or unvalidated arbitrary JSON as lesson state.
- Do not recompute a protected answer, distractor set, or canonical spelling during submission; grade from the persisted attempt snapshot.
- Do not reset deterministic randomness when hydrating a lesson.
- Do not weaken capability binding, ownership verification, expiration, one-time use, exact-replay bounds, or strict submission parsing.
- Do not expose database records or protected payloads to the browser.
- Do not modify production architecture merely to simplify a test.
- Do not install a dependency, commit, push, deploy, or run a production migration.

## Required tests

Add regression coverage that would fail with the current Map implementation:

1. Create a manifest with store/service instance A and successfully authorize its next content with separately constructed instance B backed by the same test repository.
2. Create a practice attempt through one instance and successfully grade it, retrieve protected spelling speech, and advance the successor through other instances.
3. Reconstruct the service between every request in a complete representative lesson flow and prove progression remains identical to an uninterrupted instance.
4. Verify the exact next selection remains deterministic after snapshot/hydration, including random draw position, recap example choice, no-immediate-repeat behavior, and checkpoint order.
5. Verify exact content replay across instances returns the identical cached public projection, next capability, and attempt ID.
6. Verify exact duplicate answer delivery across instances returns the recorded result while a changed duplicate is rejected.
7. Verify cross-learner, cross-lesson, wrong-screen, wrong-answer-type, unknown, consumed, and altered identifiers remain rejected.
8. Verify protected answer snapshots and canonical spelling remain absent from every browser-visible response and client bundle.
9. Verify fixed expiry immediately before, at, and after 30 minutes without real sleeps; expiry must not refresh on activity.
10. Verify concurrent content authorization creates only one successor/attempt, concurrent answer submission applies progress once, and concurrent refill loads one ordered word without skip or duplication.
11. Verify transaction failure rolls back every part of manifest creation, attempt activation, answer resolution, and refill mutation.
12. Verify database failures retain the existing safe unavailable response and do not manufacture success.
13. Extend the Prisma schema/migration test to verify the new enum, table, indexes, foreign key, and absence of destructive or seed statements.

Normal automated tests must use the injected deterministic runtime-store double and must not contact a production database. A real PostgreSQL integration test may run only against the repository's approved disposable test-database guard and must self-skip otherwise.

## Verification commands

Use the installed Node/TypeScript test pattern; no `npm test` script exists.

Run at minimum:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx tsc --noEmit
node --import ./tests/registerServerOnly.mjs --import tsx --test \
  tests/api/vocabularyContentRoute.test.ts \
  tests/api/vocabularySubmitAnswerRoute.test.ts \
  tests/api/vocabularySpeechRoute.test.ts \
  tests/vocabulary/Vocabulary.test.ts \
  tests/vocabulary/VocabularyLessonState.test.ts \
  tests/vocabulary/vocabularyDatabaseLoading.test.ts \
  tests/vocabulary/vocabularyPersistenceSchema.test.ts \
  tests/integration/vocabularyRouteSmoke.test.ts
npm run lint
npm run build
npx prisma migrate status
git diff --check
```

Also run every new focused test created for runtime persistence, concurrency, rollback, hydration, and cross-instance behavior. If an approved disposable database is unavailable, report the guarded integration test as skipped rather than using the configured production/development database.

## Acceptance criteria

The feature is complete only when all of the following are true:

- Production `VocabularyContentCapabilityStore` contains no authoritative process-local lesson, capability, or attempt Map.
- Every request can reconstruct and continue the current lesson solely from the database-backed runtime records and trusted request/session identity.
- A manifest created in one backend process can be used for content, answer, refill, and protected-speech requests in another process.
- Lesson state, capability rotation, attempt grading, exact replay, idempotency, and refill behavior remain correct under concurrent requests.
- The complete Vocabulary progression contract and browser/API shapes remain unchanged.
- The fixed 30-minute expiration remains unchanged and non-sliding.
- No protected answer, canonical spelling, speech text, internal mapping, or runtime payload reaches the browser.
- No shared Learning Engine file or contract is modified.
- The migration is additive, reviewed, reproducible, and contains no seed/destructive statements.
- Required focused tests, TypeScript, lint, build, Prisma validation/generation/status, and diff checks pass, with any guarded database test skip reported honestly.

## Completion response

In the normal completion response, report:

- changed and created files;
- how the three former Map record kinds are represented in the database;
- how atomicity and concurrent duplicate handling were implemented;
- confirmation that the engine, public APIs, 30-minute lifetime, mastery settings, and UI behavior were unchanged;
- exact verification commands and results;
- any skipped guarded database test or known limitation.

Do not commit unless the user explicitly authorizes it.
