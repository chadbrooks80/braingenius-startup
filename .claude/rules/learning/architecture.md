---
paths:
  - "src/app/(app)/(learning)/**/*"
  - "src/app/api/learning/**/*"
  - "src/app/api/tts/**/*"
  - "src/app/le-playground/**/*"
  - "src/components/learning-engine/**/*"
  - "src/lib/learning-engine/**/*"
  - "src/learning-modules/**/*"
  - "src/types/learning.ts"
  - "tests/{learning-engine,vocabulary,multiple-choice,spelling,word-search,tts,api,integration,e2e,security}/**/*"
---

# Learning Architecture

## Core Model

The ownership model is:

```text
The route hosts.
The Learning Engine coordinates.
The module teaches and controls progression.
The server validates.
The Learning Window presents and emits actions.
```

- Keep every learning responsibility in its owning layer.
- Do not bypass an established layer because calling another layer directly appears shorter.
- If the correct owner is unclear, stop and resolve the ownership question before implementing.

## Learning Route

The live route is under:

```text
src/app/(app)/(learning)/learning/[...learning]/
```

- The route owns the live React session, approved engine state, engine initialization, shared learning layout, and rendering the active screen.
- The route reads the module name and module variables from the catch-all route.
- The route must not select subject content, validate answers, calculate mastery, schedule reviews, or decide the next activity.
- Preserve cancellation and stale-initialization protection when route segments change.
- Preserve host authentication and route-group behavior around the Learning Engine.

## Learning Engine

- The shared engine lives under `src/lib/learning-engine/`.
- It owns module loading, generic action routing, registered-window resolution, applying `ScreenRequest` objects, screen changes, approved shared state, known route errors, and shared services.
- It must remain subject-neutral.
- Only the engine resolves Learning Window names, applies a `ScreenRequest`, and directly updates engine-owned screen state.

## Learning Modules

- Subject modules live under `src/learning-modules/<module-name>/`.
- A module owns subject content, subject contracts, attempts, submission behavior, answer-result interpretation, mastery, review scheduling, progression, completion, and subject-specific screen props.
- A module returns established contracts. It must not resolve React components, call React setters, or directly operate the Learning Engine.

## Learning Windows

- Shared learner-facing windows live under `src/components/learning-engine/windows/<WindowName>/`.
- A Learning Window owns presentation, accessibility, temporary input, and local interaction state.
- A Learning Window emits established events through `onAction(actionId, payload)`.
- A window must not control progression, perform authoritative grading, access the database, call a learning module directly, operate the engine directly, or call a TTS provider.

## Server Boundaries

- Subject answer validation and protected subject content belong to the owning module's server boundary.
- Provider credentials, canonical answers, internal capabilities, and database details remain server-only.
- API route files remain thin and delegate to the owning parser, handler, store, evaluator, or provider service.
- The host owns authentication, accounts, database infrastructure, onboarding, and subscriptions. Do not embed those systems inside the shared engine.
- A learning persistence feature must explicitly define the owning module and server boundary before adding database access.

## Required Flow

```text
Window event
→ onAction(actionId, public payload)
→ Learning Engine action routing
→ module or approved shared engine service
→ result or ScreenRequest
→ Learning Engine applies the screen
```

- Do not let windows call modules directly.
- Do not let modules resolve windows or mutate route state.
- Do not let the engine interpret subject-specific payload meaning.
- Do not change screens outside the engine.

## Shared-Engine Change Checkpoint

A module-scoped feature may change shared engine code only when:

1. The active feature explicitly requires the shared capability, or
2. The need is explained, a subject-neutral contract is proposed, and the user approves it before implementation.

Every approved engine expansion must be subject-neutral, typed, documented, and tested at the engine layer.

## Documentation and Verification

- Keep `context/project-overview.md` synchronized when an approved ownership boundary or public learning contract changes.
- Inspect every changed learning file against the ownership model before completion.
- Test behavior at the layer that owns it.
- Passing tests does not excuse a misplaced responsibility or unapproved engine expansion.
