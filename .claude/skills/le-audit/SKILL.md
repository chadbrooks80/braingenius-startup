# Audit Skill

Audit Brain Genius without modifying the project.

## Commands

- `/audit feature`: Resolve Google Drive `dev-instructions/learning-engine/current-feature.md` by traversing that exact folder path live, then audit the current feature branch against it. Never use, store, hard-code, or reuse a Drive ID from memory, history, another task, or prior tool output. Verify the complete parent path; if it cannot be resolved, stop instead of falling back to a remembered ID or same-named file.
- `/audit full`: Audit the current codebase and documentation.

If no valid command is provided, show the available commands.

## Rules

- Read `context/coding-rules.md` before auditing and verify the implementation against its architecture, security, error-handling, and interface rules.
- Remain read-only. Do not edit files, change Git state, install dependencies, run migrations, generate output, or use automatic fixes.
- Inspect the code directly and support findings with concrete evidence.
- Follow established project architecture and conventional TypeScript, React, Next.js, and dependency practices.
- Do not report unspecified future work as a defect.
- Separate issues introduced by the current changes from pre-existing issues and verification limitations.

## Learning Module Isolation Check

- Verify that no module-specific answer types, fields, terminology, parsing, validation, attempts, or progression were added to the Learning Engine or shared learning contracts.
- List every changed Learning Engine file and confirm that each change was explicitly required by the feature specification.
- Confirm that approved module-loader and Learning Window registry changes contain no module-specific logic.
- Report module-specific behavior inside the shared Learning Engine as a high-severity architecture violation.

## Feature Audit

1. Read the active feature specification.
2. Determine the feature branch diff from its merge base with `main`, including untracked files.
3. Inspect the changed code and relevant connected flows.
4. Check requirement coverage, architecture, action flow, security boundaries, scope, and affected documentation.
5. Run applicable read-only checks that already exist in the project.
6. Return the audit report. Do not fix findings.

If the feature specification, `main`, or a valid merge base is unavailable, report the audit as not fully verifiable.

## Full Audit

1. Inspect the current codebase, project documentation, configuration, and major implemented flows.
2. Check architecture, contracts, security boundaries, stale documentation, dependency changes, and meaningful maintenance risks.
3. Run applicable read-only checks that already exist in the project.
4. Return the audit report. Do not fix findings.

## Findings

Report only concrete, actionable findings.

Each finding should include:

- Severity: high, medium, or low
- Origin: new, pre-existing, or limitation
- File and location
- Evidence and impact
- Recommended correction

Severity guidance:

- **High:** Broken requirement, blocked behavior, security or data risk, or major architecture violation.
- **Medium:** Contract mismatch, incomplete behavior, relevant verification failure, scope issue, or meaningful maintenance risk.
- **Low:** Minor consistency, documentation, or optional improvement.

## Report

```text
Audit Report — [feature or full]

Target
- Branch, base, and files or areas audited

Requirements or flows
- PASS / FAIL / NOT VERIFIED with evidence

Verification
- Commands run, results, warnings, and limitations

Findings
- High
- Medium
- Low
- Pre-existing
- Limitations

Verdict: READY FOR REVIEW / NEEDS FIXES / NOT FULLY VERIFIABLE
Conclusion: [one sentence]
```

Use `READY FOR REVIEW` only when the requested behavior is supported by evidence and no unresolved high or medium findings remain.
