---
name: feature
description: Implement or complete the current Brain Genius feature. Use when the user invokes /feature implement, /feature i, or /feature complete.
---

# Feature

## Commands

- `/feature implement` or `/feature i`
- `/feature complete`

If no valid command is provided, show these commands with a short description.

## `/feature implement`

1. Read the exact file path:

   `./context/current-feature.md`

   - Stop if the file cannot be resolved, read, or is empty.

2. Read:

   - `context/project-overview.md`
   - `context/coding-process.md`

3. Get the feature name and requirements from `current-feature.md`.

4. Create and switch to `feature/<kebab-case-name>`.
   - If already on the matching feature branch, continue there.
   - If another feature branch is active, stop and ask the user before continuing.

5. Inspect the relevant code and nearest comparable implementations.

6. Implement only the specified feature.
   - Stay within the approved scope.
   - Do not make unrelated changes or add unapproved dependencies.

7. Run the appropriate existing tests, lint, type-check, and build checks.
   - Fix problems caused by the implementation.
   - Report checks that could not be run.

8. Create the complete implementation handoff required by `current-feature.md`.
   - Always create both the required `implementation-report.md` and feature handoff ZIP before stopping.
   - Upload `implementation-report.md` to the Drive destination required by `current-feature.md`.
   - Do not upload the feature handoff ZIP to Google Drive. When the environment supports file clipboard operations, copy the completed ZIP file to the clipboard automatically using the same behavior as `/compress` and confirm that it succeeded.
   - If clipboard access is unavailable, leave the completed ZIP on disk and report its exact path. Do not shrink, rebuild, or otherwise deviate from the ZIP requirements.
   - Follow the exact filenames, report fields, ZIP contents, exclusions, and checksums required by `current-feature.md`.
   - Treat handoff creation and upload as a mandatory part of `/feature implement`, not as feature completion.
   - Do not ask whether the handoff should be produced when `current-feature.md` requires it.

9. Stay on the feature branch and summarize:
   - what was implemented;
   - important files changed;
   - verification performed;
   - the uploaded report and clipboard-ready handoff ZIP;
   - anything remaining.

Do not automatically audit, approve, commit, merge, complete, close the feature, or clear `current-feature.md`. This restriction does not prohibit or postpone the mandatory implementation handoff in step 8.

## `/feature complete`

Use this only after the feature is fully implemented, verified, and approved by the user.

1. Append a concise entry to `context/history.md`:

```markdown
## YYYY-MM-DD HH:MM

- Completed work
- Key decisions or integrations
- Verification passed
```

2. Log only completed work. Do not log rejected, incomplete, or in-progress work.

3. Empty the contents of `context/current-feature.md` (the file must exist afterward but contain no feature content).

4. Report:
   - that `context/current-feature.md` has been emptied;
   - that `context/history.md` has been appended;
   - the exact entry that was appended to `context/history.md`.



## `/feature audit`
- run /audit feature

## `/feature commit`
- run /commit feature