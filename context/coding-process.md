# Coding Process

## Core Rule

Every feature, fix, or task must follow this process unless the user explicitly says otherwise.

The current task being worked on is stored in Google Drive at `dev-instructions/brain-genius-startup/current-feature.md`. Access it using the Google Drive MCP.

When a feature or fix is fully approved, a timestamped summary of the completed work must be added to `@context/history.md`.

---

## Standard Workflow

1. Use the Google Drive MCP to read `dev-instructions/brain-genius-startup/current-feature.md`
2. Create a branch for the current feature
3. Implement the requested change
4. Run self-checks and testing
5. Refine the work
6. Run a 3rd-party audit
7. Fix audit findings
8. User performs visual/functional review
9. If approved, log the completed feature in `@context/history.md`

---

## Detailed Process

### 1. Read Current Feature

* Always begin by using the Google Drive MCP to read `dev-instructions/brain-genius-startup/current-feature.md`
* Treat it as the source of truth for the current task
* Do not work on a different feature unless the user explicitly updates it
* Use the contents of `dev-instructions/brain-genius-startup/current-feature.md` from Google Drive to determine:

  * the branch name
  * the scope of work
  * what should be implemented
  * what should be reviewed

### 2. Create Branch

* Create a new branch for every feature, fix, or task
* Base the branch name on the feature described in `dev-instructions/brain-genius-startup/current-feature.md` on Google Drive
* Use a clear descriptive branch name
* Examples:

  * `feature/auth-setup`
  * `feature/reading-dashboard`
  * `fix/navbar-mobile-overflow`
  * `chore/update-seed-data`

### 3. Implement

* Build only the requested feature or fix from `dev-instructions/brain-genius-startup/current-feature.md` on Google Drive
* Follow all rules in `docs/coding-rules.md`
* Keep the scope tightly focused
* Do not make unrelated changes
* Do not add unapproved dependencies
* Do not refactor unrelated code unless required for the task

### 4. Self-Check and Test

Before asking for audit or approval:

* verify the feature works as intended
* run the app and check actual behavior
* fix build errors
* fix lint/type errors related to the task
* check for obvious UI or logic issues
* confirm no unrelated files were changed unnecessarily

### 5. Refine

* Make only the updates needed based on testing results
* Keep changes minimal and focused
* Do not start unrelated cleanup or architecture changes
* Do not expand the scope without approval

### 6. 3rd-Party Audit

A separate auditor must review the work after implementation and testing.

The audit should check for:

* rule violations
* unnecessary complexity
* weak patterns
* poor structure
* duplicated logic
* typing issues
* server/client misuse
* bad state management
* missing edge-case handling
* maintainability problems

### 7. Fix Audit Findings

* Address all meaningful audit findings before calling the task complete
* Ignore low-quality audit feedback only if there is a clear reason
* Keep fixes scoped to the task
* Re-test after fixes are made

### 8. User Visual / Functional Audit

* The user reviews the feature visually and functionally
* The task is not complete until the user approves it
* If the user requests changes, return to the refine/test/audit loop as needed

### 9. Log Completed Work

Once the feature is fully approved:

* add a new entry to `@context/history.md`
* include a timestamp
* include a short summary of what was completed
* keep entries concise and easy to scan
* do not log incomplete, rejected, or in-progress work

Example format:

```md
## 2026-04-17 14:32

- Completed auth setup with Google login
- Added protected dashboard routing
- Verified login, logout, and session persistence
- Passed audit and user review
```
