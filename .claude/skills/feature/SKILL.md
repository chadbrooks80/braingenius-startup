# Feature Skill

Use this skill to implement or complete a feature for the Brain Genius AI project.

---

## NOTE: if no option is selected below or something else is written, output a summary of the options below

## `/feature implement` OR '/feature i'

### Steps:

1. **Read the current feature file**
   - Use the Google Drive MCP to read `dev-instructions/brain-genius-startup/current-feature.md`
   - Read the full contents of that file to understand the feature name and implementation instructions

2. **Create a new Git branch**
   - Extract the feature name from `dev-instructions/brain-genius-startup/current-feature.md` on Google Drive
   - Create a new branch named after the feature (use kebab-case, e.g. `feature/auth-setup`)
   - Switch to that branch before doing anything else

3. **Implement the feature**
   - Follow all instructions defined in `dev-instructions/brain-genius-startup/current-feature.md` on Google Drive
   - Stay on the new branch throughout the entire implementation

---

## `/feature complete`

### Steps:

1. **Log the completed work**
   - Open `context/history.md`
   - Append a new entry at the end of the file using the format below
   - Include a timestamp (date and time)
   - Write a short, concise summary of what was implemented
   - Only log work that has been fully completed — do not log incomplete, rejected, or in-progress work

### History Entry Format:

```md
## YYYY-MM-DD HH:MM

- Brief summary of what was completed
- Any key decisions or integrations worth noting
- Verification steps passed (if applicable)

```

### Example:

```md
## 2026-04-17 14:32

- Completed auth setup with Google login
- Added protected dashboard routing
- Verified login, logout, and session persistence
- Passed audit and user review
```

2. **Output the completion message**
   - At the end, output exactly:

```text
EVERYTHING COMPLETE PLEASE EMPTY THE current-feature.md CONTENTS
```
