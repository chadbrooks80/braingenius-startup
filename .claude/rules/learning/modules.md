---
paths:
  - "src/learning-modules/**/*"
  - "src/app/api/learning/**/*"
  - "tests/{vocabulary,multiple-choice,api,integration,e2e}/**/*"
---

# Learning Modules

## Module Ownership

A learning module owns everything specific to its subject:

- Subject content and public projections.
- Subject-specific types and payload variants.
- Attempt creation and tracking.
- Client submission behavior.
- Interpreting server-validated results.
- Content selection.
- Mastery and review scheduling.
- Lesson progression and completion.
- Deciding which screen comes next.
- Creating subject-specific `ScreenRequest` props.
- Choosing subject-specific speech behavior and approved public speech content. Answer-bearing speech must use opaque references resolved by the owning server boundary.

- Keep subject logic under `src/learning-modules/<module-name>/`.
- Create a separate folder and public entrypoint for each future subject.
- Do not move subject logic into the shared engine to make one module easier to implement.

## Engine Contract

- A module implements the established `ActiveModule` contract.
- A module returns `ScreenRequest` objects or established action results.
- A module must not call React setters, resolve React components, directly update engine state, or directly apply a screen.
- A module may use shared engine services only through approved subject-neutral contracts.
- A module must not import internal window implementation details.
- Keep the engine unaware of subject payload meaning.

## State and Progression

- Keep one authoritative module state machine for progression.
- Do not duplicate progression decisions in screens, routes, endpoints, or window helpers.
- When progression depends on a submission or protected content, advance progression only after the matching server-validated result succeeds.
- Preserve the active attempt across recoverable submission failure.
- Confirm that a returned result belongs to the active attempt before applying it.
- Prevent duplicate submissions or transitions from creating duplicate progress.
- Inject deterministic randomness for state-machine behavior that requires reproducible tests.
- Derive scheduling from confirmed current state, not projected future requests.

## Content and Server Boundaries

- Return only the public projection needed by the current screen.
- Do not preload complete canonical records or future answer-bearing screens into browser state.
- Keep canonical content, answer lookup, capability state, and provider-sensitive values inside the module's server boundary.
- Keep API route files thin and delegate to module-owned handlers and parsers.
- Use strict subject-specific validation at the server boundary.
- Keep shared client-safe parsers free of server-only imports.

## Screens and Actions

- Match established action IDs and payload contracts.
- Add an action only when no existing action represents the event.
- Build screen requests through subject-owned screen helpers when that is the established pattern.
- `ScreenRequest.windowName` must name a registered shared window.
- Modules describe windows through public props; they do not resolve the component.
- Every confirmed graded answer must follow the subject's defined feedback and progression sequence.

## Failure Behavior

- A failed current-screen content request must remain recoverable and must not advance progression.
- Do not silently retry a failed state-changing submission.
- Do not manufacture success or substitute fallback subject content after an unexpected failure.
- Convert only known safe module or route failures into learner-facing messages.

## Verification

- Test state-machine transitions at exact boundaries, not only broad happy paths.
- Test success, incorrect results, request failure, retry, duplicate submission, stale result, mastery, review, replacement, and completion behavior applicable to the module.
- Test the actual module entrypoint and server handler together when full-flow behavior changes.
- Confirm the module did not require an unapproved shared-engine expansion.
