# Feature Skill

Use this skill to implement and manage Brain Genius features.

## Commands

* `/feature implement` or `/feature i`
* `/feature audit`
* `/feature commit`

If no valid command is provided, show the available commands with a short description.

## Implement

1. Resolve Google Drive `dev-instructions/learning-engine/current-feature.md` by traversing that exact folder path live, then read the resolved file.
   - Never use, store, hard-code, or reuse a Google Drive file or folder ID from memory, history, another task, or prior tool output.
   - Do not search by filename alone. Verify the complete parent path before reading.
   - If the exact path cannot be resolved, stop and report it. Never fall back to a remembered ID or a same-named file elsewhere.
2. Read and follow `context/coding-rules.md`.
3. Get the feature name and requirements.
4. Create and switch to `feature/<kebab-case-name>`.
5. Inspect the relevant code and nearest comparable implementations.
6. Implement only the specified feature using the existing architecture and conventional TypeScript, React, Next.js, and dependency practices.
7. Stay on the feature branch.
8. Return the implementation summary to the user.

Do not automatically fix audit findings, commit, merge, complete the feature, or clear the current feature file.

## Audit

Run `/audit feature`.

## Commit

Run `/commit feature`.
