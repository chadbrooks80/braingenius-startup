---
paths:
  - "src/components/learning-engine/windows/**/*"
  - "src/components/learning-engine/LearningWindowShell.tsx"
  - "src/components/learning-engine/ScreenRenderer.tsx"
  - "src/lib/learning-engine/LearningWindowRegistry.ts"
  - "src/app/le-playground/**/*"
  - "tests/{learning-engine,multiple-choice,spelling,word-search}/**/*"
---

# Learning Windows

## Placement and Registration

- Place each reusable window under `src/components/learning-engine/windows/<WindowName>/`.
- Follow the nearest comparable window's folder, index export, prop naming, action, pending, feedback, and test patterns.
- Reuse `LearningWindowShell` and shared learning layout components where their contracts fit.
- Register a new window in `src/lib/learning-engine/LearningWindowRegistry.ts`.
- Keep the registry's public name stable and typed.
- Do not let a module import or resolve the window component.

## Window Ownership

A Learning Window may own:

- Rendering public props.
- Temporary input and local interaction state.
- Focus, keyboard behavior, selection, animation, drag, and other UI mechanics.
- Pending and retry presentation.
- Emitting established actions through `onAction(actionId, payload)`.

A Learning Window must not:

- Decide which lesson activity comes next.
- Calculate mastery, review timing, scoring, or completion.
- Authoritatively decide whether an answer is correct.
- Call a learning module or the Learning Engine directly.
- Call a database, protected content store, answer store, or provider API.
- Receive or invoke route-owned or engine-owned React setters.
- Change the active Learning Window outside `onAction`.

## Props and Payloads

- Define explicit public prop types.
- Send only the minimum public payload required by the action contract.
- Never include canonical answers, internal lesson records, credentials, internal database IDs, or unrestricted reusable server identifiers in props, DOM attributes, accessibility text, action payloads, filenames, URLs, caches, or logs.
- Only opaque, purpose-scoped, learner-bound, short-lived references explicitly approved by the server contract may cross the browser boundary, such as an authorized attempt ID.
- Treat injected engine feedback as display data. Do not recompute authoritative correctness from it.
- Keep subject payload interpretation in the owning module.

## Submission Behavior

- Prevent duplicate clicks while the current submission or transition is pending.
- Keep recoverable input available after a recoverable failure.
- Expose an explicit retry path where the established flow requires it.
- Do not advance or reset the interaction as though it succeeded until the owning module confirms success.
- Ignore or reject stale results that no longer belong to the active attempt or screen occurrence.

## Accessibility and Interaction

- Use semantic controls and keyboard-accessible interactions.
- Provide accessible names and instructions without exposing protected answer data.
- Preserve visible focus, selected, pending, correct, incorrect, retry, and disabled states.
- Do not make required instructions available only through animation, hover, color, or audio.
- For complex pointer interaction, provide the established keyboard or alternate interaction when applicable.

## Documentation and Verification

- Update existing Learning Window documentation when public props, action IDs, interaction states, or accessibility behavior changes.
- Test emitted action IDs and payloads, local state, pending behavior, duplicate clicks, retry, feedback, and relevant keyboard behavior.
- Use the playground for visual isolation when helpful, but do not treat a playground check as proof of the complete learning route.
- Verify the real engine-module-window flow when the change affects integration.
