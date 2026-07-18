# Coding Rules

Read `context/project-overview.md` before making or auditing code changes.

Use conventional TypeScript, React, Next.js, and dependency-specific practices. Inspect the nearest comparable implementation before editing, and preserve the project's established architecture, contracts, naming, and visual patterns.

These rules apply to implementation and audit work. Passing tests does not excuse a rule violation.

---

## 1. Scope

- Implement only the requested feature or fix.
- Do not introduce unrelated refactors, dependencies, redesigns, script changes, formatting sweeps, or new architecture.
- Use the versions and patterns already established in the repository.
- Every changed file must have a clear connection to the feature specification.
- If an unrelated change is already present in the branch, report it separately. Do not silently treat it as feature work.
- Do not change `package.json` scripts, configuration, tooling, or shared infrastructure unless the specification requires it or the user approves it.
- Do not rename a required contract, type, state value, file, or public property from the feature specification without approval. If a different name is technically necessary, stop and explain why.

---

## 2. Architecture Source of Truth

`context/project-overview.md` defines:

- How the application operates
- Which layer owns each responsibility
- How routes, the Learning Engine, learning modules, Learning Windows, and server validation work together
- Which important files own each behavior
- What each layer must never do

Implementation and audit work must follow both this file and `context/project-overview.md`.

When the two files do not answer an architecture question clearly, stop and request clarification before inventing a new pattern.

---

## 3. Learning Route

The learning route owns live React state, initializes the Learning Engine, and renders the active screen.

The learning route must not:

- Control lesson progression
- Select subject content
- Validate subject answers
- Calculate mastery
- Schedule reviews
- Decide which activity comes next
- Contain logic belonging to a learning module

The route is a React host, not a lesson controller.

---

## 4. Learning Engine

The Learning Engine owns:

- Module loading
- Generic action routing
- Registered-window resolution
- Applying `ScreenRequest` objects
- Screen changes
- Shared engine state
- Route-error handling
- Shared services such as text-to-speech

Only the engine may:

- Resolve registered Learning Windows
- Apply a `ScreenRequest`
- Directly update engine-owned state

### The Learning Engine must remain subject-neutral

The engine must work unchanged whether the active module is Vocabulary, Reading, Math, Science, Geography, or another future subject.

Shared engine code and shared engine types must not contain subject-specific concepts such as:

- `vocabulary`
- `definition`
- `spelling`
- Word mastery
- Vocabulary review timing
- Reading-question scoring
- Math-answer grading
- Subject-specific lesson completion
- Subject-specific payload parsing

Before adding code to `src/lib/learning-engine/`, ask:

> Would this code work unchanged for every learning module?

If not, it belongs in the applicable learning module.

### Module features must not silently change the Learning Engine

A feature scoped to a learning module may modify or add shared Learning Engine behavior only when:

1. The feature specification explicitly requires the shared engine capability, or
2. The developer stops, explains the need, proposes a subject-neutral contract, and receives user approval before implementing it.

This rule includes new engine files, action guards, state setters, action handlers, screen behavior, shared feedback, registries, and shared types.

Do not add a generic engine capability merely because it makes one module easier to implement.

Any approved engine expansion must be:

- Subject-neutral
- Typed
- Documented
- Tested at the engine level
- Named consistently with the approved specification
- Reusable without importing or inspecting module logic

### Engine-change checkpoint

Before completing a module feature, inspect every changed file under `src/lib/learning-engine/` and answer:

- Why did this module feature need to change the engine?
- Was the change explicitly required or approved?
- Is the change truly subject-neutral?
- Could the same result have remained inside the module using existing contracts?

If any answer is unclear, the feature is not ready.

---

## 5. Learning Modules

Learning modules own:

- Subject-specific content
- Subject-specific types
- Subject-specific payload contracts
- Attempts
- Client submission behavior
- Validation-result interpretation
- Mastery
- Review scheduling
- Content selection
- Lesson progression
- Completion rules
- Deciding which screen comes next
- Creating subject-specific `ScreenRequest` props

Modules return screen data or `ScreenRequest` objects through established contracts.

Modules may provide subject-specific React content only where an established shared-window contract supports it.

Modules must not:

- Call React setters
- Resolve Learning Windows
- Directly control the Learning Engine
- Directly update engine-owned state
- Import engine-window implementation details
- Move subject-specific validation or progression into shared engine files

Vocabulary-specific parsers, answer variants, lesson-state types, mastery logic, word selection, and review scheduling belong inside `src/learning-modules/vocabulary/` or its server-side module boundary.

---

## 6. Learning Windows

A Learning Window is a reusable learner-facing React component controlled by the Learning Engine.

Learning Windows belong under:

```text
src/components/LearningWindows/<WindowName>/
```

When creating or changing a Learning Window:

- Inspect the nearest comparable Learning Window.
- Follow its public-prop and `onAction` patterns.
- Register new windows in `src/lib/learning-engine/LearningWindowRegistry.ts`.
- Add or update relevant tests.
- Add or update relevant component documentation.

Learning Windows receive public props and emit events through:

```text
onAction(actionId, payload)
```

Learning Windows own only:

- Presentation
- Local interaction state
- Temporary input state
- Focus, animation, and UI behavior

Learning Windows must not:

- Control lesson progression
- Calculate mastery
- Schedule reviews
- Authoritatively validate answers
- Directly call learning modules
- Directly call the Learning Engine
- Directly call databases or provider APIs
- Use React setters owned by the route or engine
- Bypass the established action and module contracts

---

## 7. Screen and Action Flow

The required flow is:

```text
Window event
→ onAction(actionId, payload)
→ Learning Engine action handler
→ module or approved engine service
→ result or ScreenRequest
→ Learning Engine updates the UI
```

Rules:

- Match existing action IDs, payloads, return contracts, and handlers.
- Add a new action only when no existing action represents the event.
- `ScreenRequest.windowName` must reference a registered Learning Window.
- Engine-owned live state takes precedence over stored screen props.
- Screen-scoped engine feedback must reset during every screen change.
- Do not bypass the engine to change screens.
- Do not let a module resolve React components.
- Do not let a window call a module directly.

### Explicit public and shared contracts

Public and shared contracts must have explicit compile-time types. Do not use `unknown` as a finished contract type or defer its meaning to consumers.

`unknown` is allowed only at an untrusted boundary, such as parsed JSON or an external response, and must be narrowed immediately before the value enters route state, engine state, module state, component props, or another public contract.

---

## 8. Answer Submission and Validation

Correct-answer data must remain server-only before submission.

### Critical rule: minimum browser data

The browser receives only the minimum public data required to render the current screen and accept the current interaction.

For a graded multiple-choice screen, send only the public question content, the choices required for that question, and an opaque attempt ID. Do not send the full internal word, question, lesson, or answer record merely because the client may need another field on a different screen.

Correct answers must never be sent to the browser:

- Directly as an answer ID, answer value, correctness flag, or server record
- Indirectly through exact text equality with another public field
- Indirectly through array position, sorting, identifiers, naming, metadata, or predictable generation
- Indirectly through a second public object, cached lesson record, serialized state, hidden prop, browser bundle, or earlier bulk response that can be mechanically joined to the choices

Security must be evaluated across all browser-visible data together. Hiding the answer field is not sufficient when another public field allows code to reconstruct the answer.

Teaching content may be sent only when the current teaching screen needs it. Do not preload or retain an entire answer-bearing lesson record in client state when the current screen requires only a smaller public projection.

Every graded question type must have a regression test that attempts to derive the correct answer using all browser-visible fields. The test must fail if any deterministic comparison, join, ordering rule, or metadata pattern reveals the answer.

An indirect browser-answer leak is a High-severity security finding and blocks completion.

The browser receives only:

- Public question or lesson data
- Public choices where applicable
- An opaque attempt ID

The browser must not receive or be able to infer:

- Correct choice IDs
- Authoritative spelling answers
- Hidden correctness flags
- Ordering tricks that reveal correctness
- Provider credentials
- Database or internal server details

### Audio-based graded questions

Some graded questions must speak the answer to the learner — for example, a
spelling exercise that says the word aloud. The sound is the lesson; the
written form is the graded answer.

- Required audio may intentionally communicate a word or answer by sound.
- The canonical written answer must remain server-only before grading.
- Never send the answer as TTS input text, hidden props, HTML or accessibility
  attributes, action payloads, identifiers, metadata, filenames, URLs, caches,
  serialized state, or client bundles.
- When the spoken content itself is the graded answer, use an opaque
  server-resolved speech reference: the browser sends only the reference to a
  module-owned server endpoint and receives audio bytes. The reference must
  not contain or deterministically encode the answer.
- The module's server boundary resolves the reference to the canonical text
  and calls the shared server-side TTS service. Provider credentials, canonical
  text, provider errors, and internal mappings remain server-only.
- Invalid, stale, mismatched, or unsupported references fail with the existing
  generic learner-safe error style, without echoing answer data.
- Intentionally displayed teaching content (introduction and recap screens) is
  public. That never justifies re-sending the answer as machine-readable data
  inside the active graded-question screen, its props, or its requests.
- Audit all browser-visible data and network requests together across the
  lesson, not one response at a time.
- Every graded question type requires its own adversarial
  answer-reconstruction test against all browser-visible fields.
- A client-bundle scan alone does not replace runtime network and prop
  inspection; keep both.
- Any discovered answer leak is a blocking finding.

### Validation ownership

- Learning Windows collect input and emit actions.
- The Learning Engine routes actions without understanding the subject payload.
- The learning module submits and interprets its subject attempt.
- The module-owned server parser validates the exact payload shape.
- The server-only answer store provides the authoritative answer.
- The evaluator calculates correctness.
- The module state machine decides what the result means for progression.

Do not place a subject-specific request parser in the Learning Engine.

### Strict discriminated payloads

Every answer variant must:

- Require all fields belonging to that variant
- Reject invalid values
- Reject unknown fields
- Reject fields belonging only to another variant
- Normalize values only as specified
- Return a safe validation error without internal details

Definition and spelling payloads must remain separate discriminated variants. A permissive shared parser is not acceptable.

### Submission state

Answer submissions must support recoverable states such as:

```text
idle → pending → success
             ↘ error → explicit retry
```

Rules:

- Do not advance the lesson until the server confirms the attempt.
- Do not silently retry a failed request.
- Do not lose the active attempt after a recoverable failure.
- Prevent duplicate clicks from creating duplicate submissions or progress.
- Confirm that a returned result belongs to the currently active attempt before applying it.

---

## 9. Vocabulary State-Machine Rules

The Vocabulary module owns all Vocabulary lesson logic.

### Practice and mastery

- Preserve the configured active-pool size.
- Preserve the required introduction order.
- Keep definition and spelling mastery separate when the specification requires it.
- Select normal practice using the specified eligibility, weighting, and no-repeat rules.
- Replace mastered words according to the feature specification.
- Follow every graded answer with the required recap screen.

### Delayed-review priority

When a delayed review is currently due, select the oldest due review before normal practice whenever required by the specification.

Do not deliberately insert normal practice ahead of an already-due review for contrast, spacing, variety, or convenience unless the specification explicitly says to do so.

### Delayed-review timing

Schedule or reschedule a review from the actual confirmed graded-answer count at the moment the triggering answer succeeds.

Do not calculate review timing from:

- A projected future batch endpoint
- An assumed number of upcoming answers
- A completion estimate
- An unconfirmed client submission

If completion processing schedules new future reviews, use an explicit completion-time snapshot or another documented design that prevents newly scheduled future work from being mistaken for work that was already due.

### Completion

Do not show Lesson Complete while any required work remains, including:

- A currently due review
- A partially completed definition-then-spelling review sequence
- A failed review that must be repeated
- A required confirmation that has not succeeded

Completion must be based on the actual current state after all confirmed answers are applied.

---

## 10. Text-to-Speech

- Provider credentials and provider integrations remain server-side.
- Learning modules use declarative `ScreenRequest.speak` data for subject speech.
- Learning Windows use the engine's shared `speak` action.
- Learning Windows and modules must not call Google, Lemonfox, or another provider directly.
- Validate provider responses before treating them as audio.
- Return the correct server error when a provider returns invalid or unusable audio.
- Cancel stale speech when the active route or screen changes.

---

## 11. Security and Errors

- Known learning-route failures use `LearningRouteError` and learner-friendly messages.
- Unexpected programming errors are rethrown.
- Never expose stacks, internal codes, file paths, credentials, database details, or technical messages to learners.
- Never convert an unexpected failure into fake success.
- Never expose answer keys or provider credentials in browser bundles, HTML, public props, or client fixtures.

---

## 12. Interface Consistency

- Reuse existing components, windows, design tokens, and project utilities before creating alternatives.
- Production UI emojis come from `src/lib/emojis.ts`.
- Follow the nearest comparable component's layout, public props, action pattern, loading state, error state, and accessibility behavior.
- Do not create a duplicate component or contract when an established one already fits.

---

## 13. Required Test Coverage

Tests must prove the behavior at the layer that owns it.

### State-machine tests

Complex state machines require deterministic tests that cover:

- Exact counter boundaries
- Due-review priority
- Definition-to-spelling review sequencing
- Failure and reset behavior
- Mastery and replacement
- Completion eligibility
- Long-running lesson paths
- Conditions where multiple items become due close together

For scheduling logic, test the exact graded-answer number where the event becomes due and the actions immediately before and after it.

A broad happy-path test is not enough.

### Validation and endpoint tests

Test:

- Every valid request variant
- Missing required fields
- Unknown fields
- Fields from the wrong variant
- Invalid opaque attempt IDs
- Correct and incorrect answers
- Safe response shapes
- Duplicate submissions where applicable
- Failure and retry behavior

### Engine and window tests

Test:

- Action routing
- Window resolution
- Screen-state reset
- Live engine-prop precedence
- Approved duplicate-action protection
- Window payloads
- Loading, error, retry, and duplicate-click behavior

### Required end-to-end integration or smoke test

When the feature specification requires the full learning route, isolated unit tests are not enough.

The test for the complete Vocabulary lesson must connect the real module and real answer-validation handler through:

```text
/learning/vocabulary/word_list_id
```

It must cover:

- Introductions
- Definition exercise
- Spelling exercise
- Real answer-handler validation
- Answer recap
- Mastery
- Word replacement
- Delayed definition review
- Delayed spelling review
- Lesson completion

A state-machine test with hand-fed results does not replace this integration test.

A module test with mocked fetch does not replace this integration test.

An endpoint test in isolation does not replace this integration test.

If the required test cannot be implemented, stop and report the limitation. Do not silently omit it or declare the test plan complete.

---

## 14. Verification

Run all commands required by the current repository and feature specification, including when applicable:

```bash
npm test
npm run typecheck
npm run lint
npm run test:multiple-choice
npm run test:tts
npm run build
git diff --check
```

Rules:

- Do not omit `build` when it is required by the test plan.
- Report the exact result of every required command.
- Do not claim browser or runtime verification when only unit tests were run.
- Do not claim end-to-end coverage when the module, endpoint, or route was mocked or bypassed.
- Passing verification does not make an architecture violation acceptable.

---

## 15. Documentation

- Update documentation when an approved window, route, action, contract, shared state value, or ownership boundary changes.
- Documentation must describe current behavior, not planned or removed behavior.
- Component documentation must match the current public props and action IDs.
- Do not use documentation updates to legitimize an unapproved architecture change after it has already been implemented.
- When implementation intentionally differs from the feature specification, obtain approval and document the decision.
- An approved architecture deviation must be written into the active feature specification itself, not merely discussed in conversation. An audit must be able to trace every implemented contract to spec text.

---

## 16. Audit Requirements

An audit must check both behavior and placement.

The auditor must:

1. Read `context/project-overview.md`.
2. Read this entire file.
3. Read the complete feature specification.
4. Inspect the full branch diff against its merge base.
5. Account for every changed file.
6. Identify the owning layer for every changed file.
7. Compare every changed responsibility against the documented ownership rules.
8. Inspect every Learning Engine change for subject-specific logic or an unapproved shared capability.
9. Inspect every shared type for subject-specific fields or variants.
10. Verify strict server-side answer validation and browser-safe data.
11. Verify the complete required test plan, including integration coverage.
12. Run adversarial deterministic probes for complex scheduling and state-machine behavior.
13. Flag unrelated branch changes.
14. Report verification limitations honestly.

The auditor must not rely only on:

- Passing tests
- Matching filenames
- A happy-path walkthrough
- The developer's implementation summary
- The existence of separate unit tests

### Audit severity

- A subject-specific leak into the shared Learning Engine is a blocking architecture finding.
- An unapproved Learning Engine expansion during a module feature is a blocking process and architecture finding until reviewed.
- Missing required end-to-end coverage is at least Medium and blocks completion when the specification requires it.
- A state-machine behavior that contradicts the specification is at least Medium and blocks completion.
- Unknown-field acceptance at a server boundary is a validation finding and blocks completion when strict payloads are required.
- Unrelated branch changes must be reported and removed or explicitly approved.

An audit verdict must be `NEEDS FIXES` when any blocking rule above is violated, even if all automated checks pass.

---

## 17. Rule Improvement After Failures

When implementation or audit reveals a problem:

1. Fix the code defect.
2. Identify why the defect was allowed to happen.
3. Add or strengthen a reusable rule in this file.
4. Add a deterministic test when the rule can be enforced automatically.
5. Update the audit checklist so future audits verify the rule.
6. Update `context/project-overview.md` when the failure exposed a missing or unclear ownership boundary.

Do not create a narrow rule that mentions only one incident. Write the general rule that prevents the entire class of failure.

Keep this file current. Remove or revise rules when the architecture intentionally changes so developers and auditors are never instructed to follow stale behavior.

---

## Final Rule

The route hosts. The Learning Engine coordinates. The module teaches and controls progression. The server validates. The Learning Window presents and emits actions.

If code does not fit that sentence, stop and determine the correct owner before implementing it.
