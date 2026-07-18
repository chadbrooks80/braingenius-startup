# Commit Skill

Use this skill to finalize and publish a completed Brain Genius feature.

---

## Commands

- `/commit feature`

If no valid command is provided, show the available commands with a short description.

---

## `/commit feature`

1. Confirm the current branch is a `feature/*` branch.
   - Never commit feature work directly from the default branch.

2. Resolve Google Drive `dev-instructions/learning-engine/current-feature.md` by traversing that exact folder path live, then read it.
   - Never use, store, hard-code, or reuse a Google Drive file or folder ID from memory, history, another task, or prior tool output.
   - Do not search by filename alone. Verify the complete parent path.
   - If the exact path cannot be resolved, stop and report it. Never fall back to a remembered ID or a same-named file elsewhere.

3. Inspect the repository status and complete feature diff.
   - Confirm the changes belong to the active feature.
   - Identify unrelated, accidental, generated, or sensitive files.
   - Do not stage unrelated changes.

4. Run `/audit feature` as the final read-only verification.

5. Review the audit and verification results.
   - Stop if required checks fail.
   - Stop if critical or high-severity findings remain unresolved.
   - Other findings must be resolved or explicitly accepted by the user before continuing.
   - Do not automatically fix findings.

6. Append a concise completion entry to `context/history.md`.

History format:

## YYYY-MM-DD HH:MM

- Completed work
- Key decisions or integrations
- Verification passed

7. Stage only the intended feature changes and create a concise commit describing the completed feature.

8. Switch to the repository's default branch, synchronize it safely, merge the feature branch, and push the result.

9. Only after the merge and push succeed:
   - Delete the feature branch locally.
   - Delete the remote feature branch if it exists.
   - Resolve Google Drive `dev-instructions/learning-engine/current-feature.md` again by its complete path and clear that resolved file. Do not reuse an ID captured earlier in the workflow.

10. Return a concise summary containing:
   - Commit created
   - Branch merged
   - Audit and verification results
   - History update
   - Branch and feature-file cleanup

---

## Guardrails

- Do not force-push.
- Do not discard uncommitted changes.
- Do not commit unrelated files.
- Do not automatically resolve merge conflicts.
- Do not clear the current feature file unless the complete commit, merge, and push workflow succeeds.
- If any step fails, stop and report the exact failure without continuing cleanup.
