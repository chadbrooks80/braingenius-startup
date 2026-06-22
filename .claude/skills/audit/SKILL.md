# Audit Skill

Use this skill to audit the Brain Genius AI project code. This skill does **not** make any file changes — it only conducts an audit and provides a report.

---

## NOTE: if no option is selected below or something else is written, output a summary of the options below

## `/audit feature`

Audits only the code added or changed in the current feature branch.

### Steps

1. **Read the feature spec**
   - Open `context/current-feature.md`
   - Note everything that was supposed to be implemented

2. **Check the git diff**
   - Run `git diff main` to see exactly what code was added or changed in this branch
   - This is the only code being audited

3. **Verify the feature was completed**
   - Cross-reference the git diff against the feature spec
   - Check that everything outlined in `context/current-feature.md` was implemented

4. **Check against coding rules**
   - Open `context/coding-rules.md`
   - Review the changed code against every rule defined there

5. **Generate a report**
   - Summarize any issues found, categorized by priority:
     - 🔴 **High** — broken functionality, missing required implementation, major rule violations
     - 🟡 **Medium** — code quality issues, minor rule violations, inconsistencies
     - 🟢 **Low** — suggestions, style issues, minor improvements

> **IMPORTANT:** Do not flag issues related to features that have not been implemented yet. If a path or reference points to something unbuilt, that is expected — only audit what has already been completed.

---

## `/audit full`

Conducts a full audit of the entire codebase.

### Steps

1. **Review completed features**
   - Open `context/history.md`
   - Note all features that have been fully completed — this defines the scope of the audit

2. **Review the entire codebase**
   - Audit all relevant project files

3. **Check against coding rules**
   - Open `context/coding-rules.md`
   - Verify the entire codebase follows every rule defined there

4. **Generate a report**
   - Summarize any issues found, categorized by priority:
     - 🔴 **High** — broken functionality, missing required implementation, major rule violations
     - 🟡 **Medium** — code quality issues, minor rule violations, inconsistencies
     - 🟢 **Low** — suggestions, style issues, minor improvements

> **IMPORTANT:** Do not flag issues related to features that have not been implemented yet. Use `context/history.md` to determine which features are complete. Any paths, references, or functionality tied to unbuilt features should be ignored — only audit what has already been completed.
