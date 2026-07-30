# Learning Engine and Module Boundaries

The current ownership rule is: the route hosts, the Learning Engine coordinates, the module teaches and controls progression, the server validates, and a Learning Window presents and emits actions.

## Route-owned session

`src/app/(app)/(learning)/learning/[...learning]/page.tsx` is a Server Component that owns the pre-initialization authorization boundary: it calls the host-owned `authorizeLearningModuleAccess()` (see [Security and Server Boundaries](../architecture/security-and-server-boundaries.md#learning-module-access)) before any client engine work, and renders `src/components/learning-engine/LearningRouteClient.tsx` only once access is granted (or the module is unregistered, deferring to the engine's own existing "not found" ownership).

`LearningRouteClient` reads the catch-all segments passed as a prop, remounts by joined route key, and owns React state for the active screen, header/sidebar visibility, answer feedback, speech status, and the one current speech-failure notice. It creates one `LearningEngine`, passes its setters, shows the startup screen after successful initialization, renders the shared failure banner above the learning header/content, aborts stale route work, and cancels shared speech on teardown. Notice dismissal is request-ID guarded so an old timer or X callback cannot clear a newer failure.

## Engine-owned work

`src/lib/learning-engine/` owns:

- the `LearningEngine` lifecycle;
- the allowlisted module loader and settings validation;
- generic `next`, `submitAnswer`, and `speak` action routing;
- the typed `LearningWindowRegistry`;
- converting `ScreenRequest` into an `ActiveScreen`;
- resetting feedback, speech, and any old speech-failure notice when screens change;
- injecting live `onAction`, feedback, and speech state;
- the subject-neutral route-error envelope, structured logging, terminal
  rendering, recovery, and engine-generic safe presentations;
- shared speech parsing, playback, typed client-failure classification, bounded
  diagnostics, cancellation, and providers.

Only the registry resolves a `LearningWindowName` to React. Only `changeLearningEngineScreen` applies a `ScreenRequest`. The engine does not interpret Vocabulary answer payloads.

Learning modules own their diagnostic codes, route-failure meaning, and
learner-safe module-specific presentations. A module error travels through the
shared `LearningRouteError` envelope, but the engine treats its code as opaque:
it logs the neutral classification and technical details, then renders the
already-approved presentation without deriving text or branching on the code.

## Module access (subscription tier)

Every registered module's `settings.json` must declare a required, non-empty `subscriptionTier` array using the shared client-safe `LearningSubscriptionTier` contract (`src/types/learning.ts`). The shared engine only loads and structurally validates this field through `validateModuleSettings()`; it does not interpret Stripe state, query accounts, or select parents. The host (`src/lib/auth/module-access.ts`, `src/lib/billing/effective-subscription-tier.ts`) owns comparing a caller's current effective tier against the module's declared list and is the only place that authorizes access. See [Security and Server Boundaries](../architecture/security-and-server-boundaries.md#learning-module-access).

## Module-owned work

`src/learning-modules/vocabulary/` implements `ActiveModule`. It owns:

- the list route variable and initial manifest request;
- Vocabulary route-error codes and safe presentations for missing, unknown,
  and structurally invalid list routes;
- subject-specific public projections and strict answer variants;
- the `VocabularyLessonState` state machine;
- the active five-word pool, introductions, attempt activation, mastery streaks, recaps, delayed reviews, and completion;
- the subject screen builders;
- browser clients for the content and answer endpoints;
- the module server handlers, capability/attempt bindings, canonical fixture, answer evaluation, and protected speech resolution.

The module returns registered window names and public props. It does not import window implementations, mutate route React state, or own speech-failure diagnostics, notice state, learner copy, or timers. Every current and future module receives the same failure behavior by emitting the generic `speak` action.

## Window-owned work

`src/components/learning-engine/windows/` owns rendering, semantic controls, local input/selection state, pending and retry presentation, and emitting `onAction(actionId, payload)`. Windows do not grade, select the next activity, update mastery, access Prisma, resolve protected content, or call providers.

Registry keys are `startup`, `multiple-choice`, `definition-display`, `definition-fun-fact`, `spelling`, `answer-recap`, `lesson-complete`, `word-search`, and `error`.

## Implementation inventory

The shared engine implementation is divided by responsibility:

- Lifecycle and registry: `src/lib/learning-engine/LearningEngine.ts`, `src/lib/learning-engine/LearningWindowRegistry.ts`.
- Generic actions: `src/lib/learning-engine/actions/createLearningEngineActionHandlers.ts`.
- Route and synthesis errors: `src/lib/learning-engine/errors/LearningRouteError.ts`, `src/lib/learning-engine/errors/learningEngineRouteErrors.ts`, `src/lib/learning-engine/errors/TtsSynthesisError.ts`, `src/lib/learning-engine/errors/logLearningRouteError.ts`, `src/lib/learning-engine/errors/logTtsSynthesisError.ts`.
- Module loading/settings: `src/lib/learning-engine/initialization/loadLearningModule.ts` (also exports `loadLearningModuleSettings`, a settings-only loader reused by the host-owned Learning Module access boundary so it never needs to import a module's client-facing implementation), `src/lib/learning-engine/initialization/validateModuleSettings.ts` (also validates the required, non-empty, deduplicated `subscriptionTier` array against the shared `LearningSubscriptionTier` contract in `src/types/learning.ts`).
- Screen application: `src/lib/learning-engine/screens/changeLearningEngineScreen.ts`, `src/lib/learning-engine/screens/withSharedScreenProps.ts`.
- State-setter validation: `src/lib/learning-engine/validation/requiredLearningEngineStateSetterKeys.ts`, `src/lib/learning-engine/validation/validateLearningEngineStateSetters.ts`.
- Playback and client orchestration: `src/lib/learning-engine/speech/SpeechPlaybackController.ts`, `src/lib/learning-engine/speech/normalizeSpeechQueue.ts`, `src/lib/learning-engine/speech/runSpeakRequest.ts`, `src/lib/learning-engine/speech/silentAudioDataUri.ts`, `src/lib/learning-engine/speech/speechPlaybackService.ts`.
- Playback failure contract and diagnostics: `src/lib/learning-engine/speech/speechPlaybackFailure.ts`, `src/lib/learning-engine/speech/logSpeechPlaybackFailure.ts`.
- Shared learner notification: `src/components/learning-engine/SpeechPlaybackFailureBanner.tsx`, hosted once by the learning route.
- Speech parsing: `src/lib/learning-engine/speech/validation/parseSpeakActionPayload.ts`, `src/lib/learning-engine/speech/validation/parseTtsConfiguration.ts`, `src/lib/learning-engine/speech/validation/parseTtsSynthesisRequest.ts`.
- Provider policy and dispatch: `src/lib/learning-engine/speech/supportedTtsConfigurations.ts`, `src/lib/learning-engine/speech/providers/types.ts`, `src/lib/learning-engine/speech/providers/synthesizeTts.ts`.
- Provider transport: `src/lib/learning-engine/speech/providers/fetchUpstreamOrThrow.ts`, `src/lib/learning-engine/speech/providers/fetchWithTimeout.ts`, `src/lib/learning-engine/speech/providers/google.ts`, `src/lib/learning-engine/speech/providers/googleAuth.ts`, `src/lib/learning-engine/speech/providers/lemonfox.ts`.

Vocabulary-specific route errors are defined only in
`src/learning-modules/vocabulary/errors/vocabularyRouteErrors.ts`.

Window barrel files and local mechanics remain inside the window boundary:

- Barrels: `src/components/learning-engine/windows/AnswerRecap/index.ts`, `src/components/learning-engine/windows/DefinitionDisplay/index.ts`, `src/components/learning-engine/windows/DefinitionFunFact/index.ts`, `src/components/learning-engine/windows/Error/index.ts`, `src/components/learning-engine/windows/LessonComplete/index.ts`, `src/components/learning-engine/windows/MultipleChoice/index.ts`, `src/components/learning-engine/windows/Spelling/index.ts`, `src/components/learning-engine/windows/Startup/index.ts`, `src/components/learning-engine/windows/WordSearch/index.ts`.
- Graded interaction helpers: `src/components/learning-engine/windows/MultipleChoice/answerSubmissionFlow.ts`, `src/components/learning-engine/windows/MultipleChoice/getMultipleChoiceActions.ts`, `src/components/learning-engine/windows/Spelling/spellingSubmissionFlow.ts`.
- Word Search implementation: `src/components/learning-engine/windows/WordSearch/generateWordList.ts`, `src/components/learning-engine/windows/WordSearch/parseWordSearchWindowProps.ts`, `src/components/learning-engine/windows/WordSearch/wordSearchDirections.ts`, `src/components/learning-engine/windows/WordSearch/wordSearchInteraction.ts`, `src/components/learning-engine/windows/WordSearch/wordSearchPuzzleLoad.ts`, `src/components/learning-engine/windows/WordSearch/wordSearchTypes.ts`.

## Action and transition flow

1. A window emits `next`, `submitAnswer`, or `speak`.
2. `LearningEngine.action` selects the generic handler.
3. `next` delegates to the active module; `submitAnswer` delegates and stores returned feedback; `speak` delegates to shared speech.
4. A module transition returns a `ScreenRequest`.
5. The engine cancels old speech, clears feedback and the old speech-failure notice, resolves the window, injects `onAction`, sets the screen, and starts any declarative speech.
6. `ScreenRenderer` spreads stored props first, then injects current `feedback` and `isSpeaking`, so live engine state wins.

## Vocabulary content and attempt flow

The initial manifest creates a learner-scoped server lesson, opaque lesson word IDs, a deterministic random seed, and one next-screen capability. Each successful content transition rotates to a new capability. Practice projections create an opaque attempt and expose only the current prompt/choices or definition. The answer endpoint binds learner cookie, lesson, word, type, attempt, and submission before grading. Exact duplicate answer delivery can return the recorded result; a changed duplicate fails.

The browser-side module maintains a matching lesson state and does not advance a failed submission. This mirrors the process-local server capability state. Neither is persisted across process restarts.

## Speech

Public teaching text uses the generic `speak` payload and `/api/tts`. Spelling uses an opaque attempt as a source reference to `/api/learning/vocabulary/speech`; only that server handler resolves the canonical written word. Both paths share the singleton `SpeechPlaybackController`, typed failure contract, bounded diagnostic reporter, and `runSpeakRequest` state bridge.

The route stores only the active failure's request ID. `SpeechPlaybackFailureBanner` owns the fixed learner-safe copy, accessible X, and 12-second timer; it does not receive or render diagnostic fields. A newer failure replaces the one notice, a successful retry clears it, and screen replacement clears a notice from the old screen. Windows and modules receive no failure-notice prop. Cancellation, replacement, screen changes, and route teardown make late controller results silent and revoke object URLs/remove listeners as applicable.

See [Vocabulary](../modules/vocabulary.md), [Text-to-Speech](../services/text-to-speech.md), and the Learning Window component documents.
