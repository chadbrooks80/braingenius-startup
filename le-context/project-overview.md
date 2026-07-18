# Brain Genius Learning Engine — Project Overview

## Purpose of This File

Read this file before implementing, changing, or auditing code in this repository.

This file explains how the application operates, which layer owns each responsibility, how data moves through the system, and what must never be placed in the shared Learning Engine.

The central rule is simple:

> The Learning Engine runs learning modules. It must never become a Vocabulary engine, Reading engine, Math engine, or contain the lesson logic of any individual subject.

The system is correctly designed only when a new learning module can be added without teaching the Learning Engine the subject's vocabulary, answer format, mastery rules, review schedule, or lesson sequence.

---

## What This Repository Contains

This is a Next.js application containing:

- A shared Learning Engine
- Subject-specific learning modules
- Reusable Learning Windows
- Server-side answer validation
- Shared text-to-speech services
- A complete Vocabulary lesson flow
- Automated tests for the engine, module, endpoints, windows, and TTS

The current working Vocabulary route is:

```text
/learning/vocabulary/word_list_id
```

The current Vocabulary data is a fixture used to prove the complete lesson architecture. Authentication, database persistence, and production word-list loading may be added later. Do not invent those systems inside a feature unless the feature specification requires them.

---

## The Application's Mental Model

Every learning session follows this ownership model:

```text
Learning route
    hosts the live React session
        ↓
Learning Engine
    loads a module and coordinates generic application mechanics
        ↓
Learning module
    owns the subject, lesson state, validation request, and progression
        ↓
ScreenRequest
    asks the engine to display a registered Learning Window
        ↓
Learning Window
    renders UI and reports learner actions
        ↓
Learning Engine
    routes the action back to the module or a shared engine service
```

The module decides **what the lesson means and what should happen next**.

The engine performs **generic application mechanics**.

The window handles **presentation and local interaction**.

The server decides **whether a submitted answer is correct**.

---

## Responsibility Boundaries

### 1. Learning Route

The catch-all learning route is the React host for one running lesson.

Primary route:

```text
src/app/learning/[...learning]/
```

The route reads URL segments such as:

```text
vocabulary / word_list_id
```

The first segment identifies the module. Remaining segments are module variables.

The route owns:

- Live React state required to render the session
- Creating and initializing the Learning Engine
- Supplying approved engine state setters
- Rendering the shared page layout
- Rendering the engine's active screen

The route does not own:

- Vocabulary lesson progression
- Word selection
- Mastery rules
- Review scheduling
- Answer correctness
- Subject-specific validation
- Decisions about which learning activity comes next

The route must remain a host. It must not become a lesson controller.

---

### 2. Learning Engine

The shared engine lives under:

```text
src/lib/learning-engine/
```

The engine owns only generic capabilities shared by every learning module:

- Loading the requested learning module
- Routing actions
- Resolving registered Learning Windows
- Applying `ScreenRequest` objects
- Changing the active screen
- Managing approved shared engine state
- Resetting screen-scoped shared state during screen changes
- Injecting live engine-owned props after module-provided props
- Handling known learning-route errors
- Calling shared services such as text-to-speech

Important engine files include:

#### `LearningEngine.ts`

The main application coordinator. It initializes the active module, exposes the engine action entrypoint, and coordinates approved engine operations.

It must not contain subject decisions or inspect Vocabulary-specific values.

#### `LearningWindowRegistry.ts`

Maps a public `windowName` to a registered reusable Learning Window.

Only the engine resolves window names into React components. Modules return a `windowName`; they do not import or resolve the component themselves.

#### `createLearningEngineActionHandlers.ts`

Creates generic engine action handlers and routes module actions or shared service actions through established contracts.

It must not parse Vocabulary answers, select words, calculate mastery, schedule reviews, or decide lesson progression.

#### `changeLearningEngineScreen.ts`

Applies a `ScreenRequest`, resolves the registered window, resets screen-scoped engine state, injects live engine props, and updates the current screen.

Only the engine may directly apply a `ScreenRequest` or update engine-owned screen state.

#### `requiredLearningEngineStateSetterKeys.ts`

Defines the React state setters required by the engine. Only genuinely shared engine state belongs here.

#### `loadLearningModule.ts`

Loads the requested subject module through the established module-loading contract.

Module registration is allowed here. Subject lesson logic is not.

#### `LearningRouteError.ts`

Represents known learning-route failures that may safely become learner-friendly error messages.

Unexpected programming errors must be rethrown. Internal details, stacks, database information, and credentials must never be displayed to learners.

#### Shared learning types

Shared types define subject-neutral engine contracts such as actions, `ScreenRequest`, registered window names, and the explicitly typed `AnswerFeedback` union.

Shared types must not contain properties or unions named for one subject, such as:

```text
definition
spelling
vocabulary
wordMastery
readingQuestion
mathProblem
```

Those belong in the applicable module unless they are truly generic concepts used by multiple subjects.

### The engine neutrality test

Before adding anything to `src/lib/learning-engine/`, ask:

> Could this code work unchanged if the active module were Math, Reading, Science, or Geography?

If the answer is no, it does not belong in the Learning Engine.

If a module feature appears to require a shared engine change:

1. Stop before implementing it.
2. Explain the exact engine limitation.
3. Explain why the feature cannot use the current contracts.
4. Propose a subject-neutral engine capability.
5. Obtain approval.
6. Update the architecture and tests with the approved contract.

Do not silently expand the engine while implementing a module feature.

---

### 3. Learning Modules

Subject modules live under:

```text
src/learning-modules/<module-name>/
```

The current module is:

```text
src/learning-modules/vocabulary/
```

A learning module owns everything specific to its subject:

- Subject content
- Subject-specific data contracts
- Attempt creation and tracking
- Client requests to the module's answer endpoint
- Interpreting validated answer results
- Word or question selection
- Mastery rules
- Review scheduling
- Lesson progression
- Deciding which screen comes next
- Creating subject-specific `ScreenRequest` props
- Subject-specific TTS text selection

Important Vocabulary module files include:

#### `index.ts`

The module's public entrypoint and adapter to the Learning Engine.

It receives module variables, initializes the Vocabulary lesson, accepts actions routed by the engine, calls module-owned behavior, and returns `ScreenRequest` objects.

It keeps only lesson-scoped opaque word IDs, a deterministic lesson-state seed, and one server-issued capability for the exact current screen occurrence. Each request sends the lesson ID and that capability, then replaces it with the server-issued successor. It does not import or preload the canonical fixture.

It must not directly update React state or resolve Learning Windows.

#### `VocabularyLessonState.ts`

The authoritative state machine for the Vocabulary lesson.

It owns:

- The five-word active pool
- Introduction order
- Definition and spelling practice
- Correct-streak mastery
- Word replacement after mastery
- Practice selection
- Delayed review eligibility
- Definition-review then spelling-review sequencing
- Review failure reset behavior
- Completion eligibility
- The next Vocabulary screen request

Neither the route, Learning Engine, nor Learning Windows may duplicate or override this logic.

#### `VocabularyActiveAttempt.ts`

Represents the active graded attempt and the information required to confirm a server-validated result against the current lesson state.

The state machine must advance only after the matching answer request succeeds and the result is accepted. Failed requests must be recoverable and must not silently advance the lesson.

#### `VocabularyLessonTypes.ts`

Contains Vocabulary-owned lesson-state and progression types.

Vocabulary-specific types belong here or elsewhere inside the Vocabulary module, not in shared engine types.

#### `selectVocabularyPracticeWord.ts`

Selects the next normal-practice word according to Vocabulary rules such as eligibility, least-shown weighting, and no immediate repeat.

The engine must never select a word.

#### `vocabularyReviewSchedule.ts`

Owns delayed-review calculations and review ordering.

The oldest currently due review must be selected before normal practice when required by the specification. Review timing must be calculated from the actual confirmed graded-answer count, not from a projected future batch endpoint.

#### `vocabularyTts.ts`

Builds the subject-specific speech content requested by Vocabulary screens.

The module chooses what should be spoken. The engine owns the shared mechanism that performs speech.

#### `validation/parseVocabularySubmitAnswerPayload.ts`

Strictly parses Vocabulary answer payloads with one shared, pure parser used at both boundaries.

`parseVocabularyAnswerSubmission` validates the full discriminated submission and is called independently by the module (early rejection of window payloads) and by the server answer endpoint (the security boundary), so the per-variant field rules cannot drift. It owns the Vocabulary discriminated request variants and rejects missing, invalid, or unknown fields. It does not belong in `src/lib/learning-engine/` because the shared engine must not understand `definition` or `spelling` payload shapes, and it imports no server-only fixtures so browser code may safely use it.

---

### 4. Learning Windows

Reusable learner-facing components live under:

```text
src/components/LearningWindows/<WindowName>/
```

Current important windows include:

- Startup
- Definition Display
- Definition Fun Fact
- Multiple Choice
- Spelling
- Answer Recap
- Lesson Complete
- Route Error

A Learning Window owns:

- Rendering its public props
- Local UI interaction state
- Temporary input state
- Buttons, focus, animations, and presentation
- Emitting established actions through `onAction(actionId, payload)`

A Learning Window does not own:

- Lesson progression
- Mastery
- Review scheduling
- Authoritative answer validation
- Database access
- Server route calls that bypass the module contract
- Learning Engine state setters
- Direct Learning Engine calls
- Provider credentials or provider API calls

Windows may perform harmless client-side input preparation for usability, but the server remains authoritative.

Example:

```text
SpellingWindow collects text
    ↓
SpellingWindow emits the established answer action
    ↓
Learning Engine routes the action
    ↓
Vocabulary module submits the attempt
    ↓
Vocabulary server endpoint validates it
```

The window never decides that the spelling is correct.

---

### 5. Server Vocabulary Content Endpoint

Vocabulary screen content is requested from:

```text
/api/learning/vocabulary/content
```

The canonical 20-word fixture is a server-only module. The manifest creates an anonymous learner-bound lesson and returns lesson-scoped word IDs, a deterministic state seed, and only the capability for the exact first screen occurrence. It does not group future screen capabilities under a word. Subsequent requests contain only the lesson ID, projection name, and current capability; reusable canonical word handles are not accepted. A synchronized server-side instance of the module-owned lesson state binds each successor capability to the exact learner, lesson, word, projection, screen occurrence, and attempt before returning one narrow projection. It never returns a complete answer-bearing word record.

Every successful projection response returns the single successor in the authorized lesson chain. A response may be retried only until that successor is consumed, and all lesson capabilities have a bounded lifetime. Practice successors remain unusable until the current attempt is graded. Practice projections receive a new learner- and lesson-bound opaque attempt ID for each screen occurrence. Exact duplicate answer delivery has a bounded idempotent retry window; changed submissions are rejected, and the retry closes when the recap capability is consumed.

The spelling projection contains only that attempt ID and a spelling-prompt definition that is deliberately distinct from every exact introduction definition. It never contains the target word or an exact machine-readable join back to an introduction `{ word, definition }` pair: the canonical written spelling is the graded answer and stays server-only. The active attempt ID doubles as the opaque speech reference for the Vocabulary speech endpoint below and becomes invalid immediately after grading.

### Server Vocabulary Speech Endpoint

Spelling-prompt audio is requested from:

```text
/api/learning/vocabulary/speech
```

The learner must hear the word without the browser ever receiving its written form. The module's server boundary (`server/handleVocabularySpeechRequest.ts`) strictly parses `{ reference }`, verifies that the reference is a spelling attempt owned by the learner cookie, resolves it to the canonical word server-side, builds the spoken text, and calls the shared server-side TTS service. The browser receives audio bytes or a generic learner-safe error — never the canonical text. Invalid, cross-learner, mismatched (for example a definition attempt ID), or unknown references all fail with the same generic 400-style error.

The module must not preload content for later screens. A failed current-screen request remains recoverable and must not advance progression.

### 6. Server Answer Endpoint

Vocabulary answers are submitted to:

```text
/api/learning/vocabulary/submit-answer
```

Important server files include:

#### `route.ts`

The thin Next.js route boundary.

It reads the HTTP request, calls the Vocabulary request handler, and converts known validation outcomes into the appropriate HTTP response.

It should not contain lesson progression or duplicate the handler's business logic.

#### `handleVocabularyAnswerRequest.ts`

Coordinates one Vocabulary answer request.

It parses the request through the module-owned parser, retrieves the server-only answer data, evaluates the attempt, and returns only the feedback required by the client.

#### `parseVocabularySubmitAnswerPayload.ts`

Validates the exact request shape for each Vocabulary answer type. The endpoint calls the module-owned shared parser (`parseVocabularyAnswerSubmission`) directly; browser-side validation never substitutes for this server call.

Definition and spelling variants may require different fields. Each variant must reject fields that do not belong to it. Spelling normalization such as trimming belongs in this validation path when specified.

#### `getCorrectAnswer.ts`

Retrieves the authoritative answer from server-only data by opaque attempt ID.

Correct answers must never be included in browser fixtures, public props, client module data, or HTML sent before submission.

#### `evaluateVocabularyAnswer.ts`

Compares the submitted attempt to the authoritative server answer and produces the allowed result.

It evaluates correctness. It does not control the lesson screen or mastery state.

#### `submitVocabularyAnswer.ts`

Represents the module-side submission path to the Vocabulary endpoint.

It must preserve recoverable request states, prevent duplicate submissions, expose failure for explicit retry, and never advance the lesson until the server confirms the attempt.

---

## Public Data and Secret Answer Data

Vocabulary fixture data is intentionally split.

### Browser-safe data may include, only for the current screen

- Lesson-scoped opaque word IDs and only the capability for the exact current screen occurrence
- Display word when appropriate for the current exercise
- Definition content used for instruction
- Example sentences
- Interesting fact
- Multiple-choice options
- Opaque attempt ID
- An opaque server-resolved speech reference

### Browser data must not include before submission

- The correct choice ID
- The correct spelling answer used for grading, in any machine-readable form (content responses, props, speech text, action payloads, identifiers, metadata, caches, or bundles)
- A field, ordering trick, or flag that reveals correctness
- Server credentials
- Provider keys
- Internal database information

The browser must never receive a complete canonical word record or the whole answer-bearing lesson fixture. Public projections, the canonical fixture, and server answer keys remain separate even when they describe the same lesson.

### Teaching content versus graded-answer data

- Intentionally displayed teaching content (introduction and recap screens) is public.
- Spoken pronunciation required by a spelling exercise is intentionally perceivable as audio; the learner is supposed to hear the word.
- The canonical written spelling must not be included in the browser's active graded-question data before submission.
- Hidden props, speech text, metadata, IDs, bundles, and exact machine-readable mappings are not acceptable substitutes for server-only answer data.
- After a confirmed incorrect submission, revealing `correctAnswer` in feedback is allowed because grading has already occurred.

---

## Complete Vocabulary Lesson Flow

The current Vocabulary module teaches a 20-word fixture through a five-word active pool.

The high-level flow is:

```text
Load word list
    ↓
Introduce the active words
    ↓
Definition instruction and fun fact
    ↓
Definition multiple choice
    ↓
Server validates answer
    ↓
Answer recap
    ↓
Spelling practice
    ↓
Server validates answer
    ↓
Answer recap
    ↓
Update Vocabulary mastery state
    ↓
Replace mastered words and continue normal practice
    ↓
Run delayed definition review, then delayed spelling review when due
    ↓
Complete only after all required learning and reviews are resolved
```

Important lesson rules:

- The active pool contains five words.
- Words are introduced before graded practice.
- Definition and spelling are distinct attempt types.
- Every graded answer is validated by the server.
- Every graded answer is followed by Answer Recap.
- Mastery is based on the configured correct-streak rules.
- A mastered word is replaced until the full list has been taught.
- Normal-practice selection follows the module's eligibility, weighting, and no-repeat rules.
- Delayed reviews become due according to confirmed graded-answer counts.
- A due definition review occurs before its spelling review.
- Failed review attempts reset the applicable review state as specified.
- Currently due reviews take priority when required by the feature specification.
- Successful spelling reviews reschedule from the actual confirmed answer count. Until every word is introduced, a rescheduled review remains eligible when its date becomes due. Once all words are introduced, a completion-time snapshot freezes the outstanding review instances required for the finite lesson; dates created by completing those instances are future work.
- Lesson Complete may appear only when all words and all required reviews are actually complete.

The Learning Engine must not know any of these rules.

---

## Detailed Answer Flow

```text
1. A Learning Window collects the learner's action.
2. The window emits an established action ID and public payload.
3. The Learning Engine routes the action through its generic handler.
4. The Vocabulary module confirms that the action is valid for its current state.
5. The module submits the attempt to the Vocabulary API route.
6. The server strictly parses the Vocabulary payload.
7. The server verifies that the opaque attempt ID belongs to the learner cookie and looks up the correct answer.
8. The server evaluates the attempt.
9. The server returns limited answer feedback.
10. The module confirms that the response belongs to the active attempt.
11. The Vocabulary state machine updates mastery, review, and progression state.
12. The module returns an Answer Recap `ScreenRequest`.
13. The Learning Engine applies that request and renders the registered window.
```

No layer may skip around this flow for convenience.

---

## Screen and Action Contracts

A module requests a screen by returning a `ScreenRequest`:

```ts
{
  windowName: "registered-window-name",
  props: {
    // public props required by that window
  },
  speak: {
    // optional declarative speech request
  }
}
```

Rules:

- `windowName` must be registered in `LearningWindowRegistry.ts`.
- A module describes the screen; it does not resolve the React component.
- A module must not call React setters.
- A window emits an action; it does not directly call the module.
- The engine routes actions; it does not interpret subject meaning.
- Live engine-owned props override stored module props when the screen is rendered.
- Screen-scoped engine feedback must reset on every screen change.
- Subject-specific feedback remains typed and interpreted by the owning module.

---

## Text-to-Speech Ownership

Text-to-speech has two separate responsibilities.

The module owns:

- What should be spoken
- When the requested screen should speak it
- Subject-specific pronunciation or instructional wording

The engine owns:

- The generic `speak` service/action
- Speech queue behavior
- Cancellation when screens or routes change
- Shared client-side speech state
- Calling the server TTS boundary
- Playing audio for an opaque server-resolved speech source (`{ source: { endpoint, reference } }`): the engine posts only the reference to the module-supplied same-origin endpoint and plays the returned audio. The engine never knows what the reference means.

The module owns (server side):

- Resolving an opaque speech reference to its canonical text
- Deciding which references are valid for which exercise
- Calling the shared server-side TTS service with the resolved text

The server owns:

- Provider selection
- Provider credentials
- Provider request validation
- Validating the returned audio
- Returning an appropriate server error when audio is invalid

Learning Windows must not call Google, Lemonfox, or another provider directly.

When the spoken content is itself the graded answer (for example the spelling prompt), the module must use the server-resolved speech source instead of `speak` text, so the canonical written answer never appears in browser data.

---

## Error Ownership

Known route failures use `LearningRouteError` and learner-friendly messages.

Examples include:

- Unknown module
- Missing or invalid module variable
- Missing word list
- Known module initialization failure that is safe to describe

Unexpected errors are programming errors. They must be rethrown so they remain observable during development and monitoring.

Never display:

- Stack traces
- Internal error codes
- File paths
- Database details
- API keys
- Provider credentials
- Technical exception messages

Do not silently convert unexpected errors into fake success or a misleading learner message.

---

## Tests and Verification

Tests must prove behavior at the layer where that behavior is owned.

### Module/state tests

Must cover:

- Active-pool behavior
- Introduction order
- Definition and spelling streak mastery
- Least-shown selection
- No immediate repeat
- Replacement after mastery
- Review scheduling and ordering
- Review failure reset
- Completion conditions
- Deterministic edge cases at exact graded-answer counts

### Endpoint tests

Must cover:

- Valid definition submission
- Valid spelling submission
- Strict required fields
- Rejection of unknown fields
- Variant-specific field rejection
- Opaque attempt lookup
- Correct and incorrect evaluation
- Safe response shape

### Engine/window tests

Must cover:

- Action routing
- Screen resolution
- Engine-state reset on screen change
- Live prop injection order
- Module-owned duplicate-action protection
- Window event payloads
- Local UI state and retry behavior

### End-to-end integration or smoke test

The complete route must be tested through:

```text
/learning/vocabulary/word_list_id
```

The test must connect the real module and real answer handler through introductions, both exercise types, word replacement, delayed review, recap, and Lesson Complete. Testing each layer separately does not prove that the complete application is wired together correctly.

### Standard verification

Run the repository's current commands, including:

```bash
npm test
npm run typecheck
npm run lint
npm run test:multiple-choice
npm run test:tts
npm run build
git diff --check
```

Passing tests do not override a violated architecture rule.

---

## Non-Negotiable Rules

### Never put module logic in the Learning Engine

The Learning Engine must not contain:

- Vocabulary answer types
- Definition or spelling payload parsing
- Vocabulary mastery rules
- Word selection
- Review scheduling
- Vocabulary completion conditions
- Reading comprehension rules
- Math grading rules
- Any subject-specific lesson sequence

### Never silently change the engine for a module feature

A feature scoped to a learning module may modify shared engine code only when:

- The feature specification explicitly requires the shared capability, or
- The need is reported and the user approves the engine change first

An engine change must remain subject-neutral, be documented, and have engine-level tests.

### Never expose correctness before submission

The browser receives public question data and an opaque attempt ID. Authoritative correctness stays on the server.

### Never let UI control progression

Routes and Learning Windows render and report events. The active learning module owns lesson progression.

### Never let modules operate the engine directly

Modules return contracts. Only the engine resolves windows, applies screen requests, and updates engine-owned state.

### Never duplicate validation

Subject payload parsing and authoritative evaluation belong in the module's server validation path. A route should remain thin, and the engine should remain unaware of the payload shape.

### Never advance after a failed submission

Submission failure must be visible and recoverable. Retry must be explicit. Duplicate clicks must not create duplicate progress.

### Never add unrelated work to a feature branch

Do not add unrelated refactors, dependencies, script changes, formatting sweeps, or architecture changes.

### Never treat documentation as optional

When an approved contract, window, route, or ownership boundary changes, update the documentation in the same work.

---

## Implementation Checklist

Before coding:

1. Read this file.
2. Read `context/coding-rules.md`.
3. Read the complete feature specification.
4. Inspect the nearest comparable implementation.
5. Identify which layer owns every requested behavior.
6. List any required shared-engine changes.
7. Stop for approval if the specification did not explicitly authorize those engine changes.

While coding:

1. Keep subject logic inside its module.
2. Keep routes thin.
3. Keep authoritative validation server-side.
4. Keep Learning Windows presentational and event-driven.
5. Use established actions, requests, errors, and registries.
6. Add tests at the owning layer.
7. Avoid unrelated changes.

Before reporting completion:

1. Compare every changed file to its documented ownership.
2. Search shared engine changes for subject-specific terms and decisions.
3. Confirm correct answers are absent from browser data.
4. Confirm failures do not advance lesson state.
5. Confirm required integration coverage exists.
6. Run all verification commands.
7. Report any limitation honestly.

---

## Audit Checklist

An audit must not only ask whether the feature works. It must ask whether the feature was placed in the correct layer.

For every changed file:

1. State which layer owns the file.
2. State what responsibility was added or changed.
3. Compare that responsibility to this document and `context/coding-rules.md`.
4. Flag any subject behavior placed in shared engine code.
5. Flag any shared engine capability added without specification or approval.
6. Verify validation occurs at the correct server/module boundary.
7. Verify the browser cannot infer correct answers.
8. Verify tests cover the actual integration, not only isolated pieces.
9. Perform adversarial deterministic probes for complex state machines.
10. Treat an architecture violation as a real finding even when every test passes.

---

## Final Design Principle

The Learning Engine should know:

```text
which module is active
which registered window to display
which generic action occurred
which shared service was requested
which shared engine state must change
```

The Learning Engine should never know:

```text
which vocabulary word is being mastered
whether a definition or spelling answer is correct
when a vocabulary review is due
how a reading question is scored
how a math problem is graded
what lesson activity a subject should choose next
```

The module teaches. The server validates. The window presents. The route hosts. The engine coordinates.
