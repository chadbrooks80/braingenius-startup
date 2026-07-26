---
paths:
  - "src/lib/learning-engine/**/*"
  - "src/types/learning.ts"
  - "tests/learning-engine/**/*"
---

# Shared Learning Engine

## Subject Neutrality

- The engine must work unchanged for Vocabulary, Reading, Math, Science, Geography, and future subjects.
- Before adding behavior, ask whether it works unchanged for every learning module.
- If the behavior understands a subject's content, answer type, mastery, review schedule, activity sequence, or completion rule, it belongs in that subject module.
- Do not add subject names or subject-specific variants to shared engine files or shared learning contracts.
- Module registration in the loader is allowed. Inspecting or implementing the registered module's lesson logic is not.

## Engine Ownership

The engine owns:

- Loading the requested module and validating its settings.
- Creating generic action handlers.
- Routing generic actions to the active module or approved shared services.
- Resolving registered Learning Windows.
- Applying `ScreenRequest` objects.
- Resetting screen-scoped shared state during screen changes.
- Injecting live engine-owned props after module-provided props.
- Managing approved shared engine state.
- Handling known learning-route errors.
- Coordinating shared speech mechanics.

- Only engine code may resolve a `LearningWindowName` into a React component.
- Only engine code may apply a `ScreenRequest` and directly update the active screen.
- Engine-owned live props must take precedence over stored module screen props.
- Screen-scoped feedback and transient state must reset on every applicable screen change.

## Contracts

- Keep shared contracts limited to concepts genuinely shared across subjects.
- A shared generic action payload may remain opaque to the engine, but the owning module must narrow and validate it before interpreting its meaning.
- Do not solve subject typing by adding subject fields to `ActionPayload`, `ScreenRequest`, `ActiveModule`, `AnswerFeedback`, or shared engine state.
- Keep public action IDs, window names, and engine state-setter requirements explicit and stable.
- Register a new Learning Window in `LearningWindowRegistry.ts`; modules return the registered name and never import the component.
- Preserve compile-time exhaustiveness for registries and discriminated shared contracts.

## Action and Screen Behavior

- Reuse an existing generic action when it already represents the interaction.
- Add a shared action only when it is genuinely reusable across subjects.
- Do not parse a module answer payload in the engine.
- Do not advance module state after a failed action.
- Preserve duplicate-action and stale-result protection where an action can overlap.
- Preserve route and screen cancellation for asynchronous initialization, transitions, and speech.

## Errors

- Use `LearningRouteError` only for known failures safe to present to a learner.
- Keep learner messages generic and useful.
- Rethrow unexpected programming errors so they remain observable.
- Never expose stacks, internal codes, file paths, provider credentials, database details, canonical answers, or internal capability state.
- Do not convert an unexpected failure into fake readiness or success.

## Engine-Change Checkpoint

Before completing a module feature that changed `src/lib/learning-engine/**`, answer:

1. Why was the engine change necessary?
2. Was it explicitly required or approved?
3. Is it subject-neutral?
4. Could the existing contracts have kept the behavior inside the module?
5. Are engine-level tests and documentation updated?

If any answer is unclear, the feature is not ready.

## Verification

- Test module loading, action routing, window resolution, screen changes, state reset, live-prop precedence, stale work, known errors, and approved shared services affected by the change.
- Search shared engine and shared type changes for subject-specific names and decisions.
- Verify a module feature did not silently expand the shared engine.
