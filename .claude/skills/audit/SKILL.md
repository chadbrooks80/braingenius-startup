---
name: audit
description: Audit Brain Genius feature work or the full codebase without modifying project files. Use when the user invokes /audit feature, requests an audit of the current feature, invokes /audit full, or requests a full codebase audit.
---

# Audit

Audit Brain Genius against its specifications, architecture, and complete rule stack. Report evidence and findings without fixing them.

## Commands

- `/audit feature` audits the current feature and all code connected to its behavior.
- `/audit full` audits the entire repository.

If the requested mode is missing or ambiguous, ask the user to choose `feature` or `full`.

## Non-negotiable behavior

- Remain read-only. Do not edit source, documentation, configuration, rules, specifications, or Git state.
- Do not install dependencies, run migrations, invoke auto-fix commands, or call production or paid external services.
- Verification commands may create ordinary ignored build or test artifacts, but must not intentionally modify tracked project files.
- Never repair findings during an audit. Explain the required correction instead.
- Base conclusions on inspected evidence. Mark anything that cannot be verified as a limitation.
- Separate findings introduced by the audited work from pre-existing findings.
- Do not report explicitly planned future or unimplemented features as defects.
- Read `context/project-overview.md` when it exists and is non-empty. Treat it as architectural context, not as a replacement for code or rules. If it is missing or empty, report that limitation without inventing its contents.

## Review the complete rules folder

This requirement applies to both audit modes.

1. Recursively enumerate every Markdown file under `.claude/rules/`.
2. Record the discovered file count and paths. Discover the list live; never depend on a hardcoded inventory.
3. Read every discovered rule file in full, including its frontmatter and path scope.
4. Do not rely on rules that Claude selected automatically from changed file paths. Automatic rule loading is insufficient for an audit.
5. Compare the audited code against every rule in the folder.
6. Include every discovered rule file in the report's Rule Coverage section so omission is visible.

For `/audit feature`, classify each rule as:

- `PASS` — the rule applies to the feature and the inspected implementation complies.
- `FAIL` — the rule applies and the implementation violates it.
- `NOT APPLICABLE` — the entire rule was reviewed but has no relationship to the feature, its connected flows, or responsibilities it introduces. Give a concrete reason.
- `NOT VERIFIED` — the rule may apply, but available evidence or verification was insufficient.

Do not mark a path-scoped rule `NOT APPLICABLE` solely because no directly changed file matches its path pattern. First determine whether the feature affects, calls, configures, or depends on the responsibility governed by that rule.

For `/audit full`, apply every rule to the complete codebase and its owning paths. Use `NOT APPLICABLE` only when the governed subsystem genuinely does not exist, and explain why.

If `.claude/rules/` is missing, contains no Markdown rules, or any discovered rule cannot be read, the audit is `NOT FULLY VERIFIABLE`.

## Audit the current feature

### 1. Resolve the feature specification

Use Google Drive and traverse the exact folder path:

`dev-instructions/brain-genius-startup/current-feature.md`

- Resolve the path from its folders on every audit.
- Do not cache, store, infer, or reuse a prior Drive file ID.
- Stop and report `NOT FULLY VERIFIABLE` if the exact file cannot be resolved or read.

### 2. Establish the complete change set

- Confirm the current branch and that `main` exists.
- Compute the merge base between the current branch and `main`.
- Inspect committed branch changes from that merge base.
- Also inspect staged changes, unstaged changes, and untracked files.
- If the base or complete change set cannot be established, report the limitation and use `NOT FULLY VERIFIABLE`.

### 3. Build the evidence map

- Extract every requirement, acceptance criterion, constraint, and expected user flow from the feature specification.
- Enumerate and read the complete `.claude/rules/` stack.
- Inspect every changed file in full.
- Trace connected code required to understand the feature end to end, including callers, callees, shared contracts, data boundaries, API routes, persistence, authorization, UI states, and tests.
- Inspect relevant configuration and documentation when they affect correctness or compliance.

### 4. Evaluate the implementation

Check:

- requirement and acceptance-criteria coverage;
- end-to-end action flow and failure states;
- architecture and boundary compliance;
- security, authorization, answer protection, and data exposure;
- database and schema behavior;
- frontend behavior, styling, accessibility, and theme rules;
- server/client boundaries and API behavior;
- tests and verification coverage;
- scope discipline and unintended regressions;
- documentation accuracy;
- every rule from the complete Rule Coverage inventory.

Run the Learning Module Isolation Check when the feature touches learning-engine code, learning modules, shared learning contracts, or learning API flows.

### 5. Verify safely

- Inspect the repository's existing scripts and tooling before choosing checks.
- Run applicable read-only lint, type-check, test, and build commands when safe and practical.
- Never substitute command success for code inspection.
- Record the exact commands and results.
- If an important check cannot run, explain why and mark the affected conclusion `NOT VERIFIED`.

## Audit the full codebase

1. Read `context/project-overview.md` when available.
2. Read `context/history.md` when available to understand completed work, but never use history to limit audit scope.
3. Enumerate and read every Markdown file in `.claude/rules/`.
4. Inspect the entire maintained codebase, including application code, shared libraries, APIs, database/schema code, configuration, tests, and relevant documentation.
5. Apply every rule to all governed code and include every rule in Rule Coverage.
6. Trace representative end-to-end flows and inspect cross-boundary contracts rather than auditing files only in isolation.
7. Run the Learning Module Isolation Check across the complete learning system.
8. Run applicable repository-wide read-only lint, type-check, test, and build commands.
9. Report pre-existing findings normally; the full audit has no feature-diff boundary.

The full audit must not restrict itself to files mentioned in `context/history.md`, recent Git changes, or automatically loaded coding rules.

## Learning Module Isolation Check

Verify that shared learning infrastructure remains subject-neutral.

- Inspect shared Learning Engine code, shared learning components and contracts, module loaders or registries, learning modules, and relevant API routes.
- Reject module-specific answer types, fields, terminology, parsing, validation, attempt logic, or progression logic inside shared Learning Engine code or shared contracts.
- Confirm that module-specific content and behavior remain within the owning learning module.
- Permit module loader or registry changes only when they remain subject-neutral.
- For a feature audit, list every changed shared Learning Engine file and confirm that the feature specification requires the change.
- Treat module-specific behavior embedded in the shared engine as `HIGH` severity because it weakens module isolation and future extensibility.

## Findings

Assign one severity:

- `HIGH` — security or authorization failure, destructive data risk, broken core flow, major requirement failure, invalid architecture boundary, shared-engine contamination, or a defect that blocks approval.
- `MEDIUM` — meaningful correctness, reliability, accessibility, maintainability, test, or rule-compliance problem that should be fixed before approval.
- `LOW` — limited-impact issue or improvement that does not block approval by itself.

For every finding include:

- severity;
- origin: `NEW`, `PRE-EXISTING`, or `LIMITATION`;
- violated requirement or rule;
- file and precise location;
- concrete evidence and impact;
- recommended correction without implementing it.

Do not inflate speculative concerns into findings. If evidence is insufficient, record a limitation or `NOT VERIFIED`.

## Report format

Use this structure:

```markdown
# Audit Report

## Target
- Mode:
- Branch / base:
- Feature specification:
- Rule files reviewed:

## Rule Coverage
| Rule file | Status | Evidence or reason |
| --- | --- | --- |
| `.claude/rules/...` | PASS / FAIL / NOT APPLICABLE / NOT VERIFIED | ... |

## Requirements or System Flows
| Requirement or flow | Status | Evidence |
| --- | --- | --- |
| ... | PASS / FAIL / NOT VERIFIED | ... |

## Verification
- `command` — PASS / FAIL / NOT RUN: evidence or reason

## Findings
### [HIGH|MEDIUM|LOW] Finding title
- Origin:
- Requirement or rule:
- Location:
- Evidence and impact:
- Recommended correction:

## Limitations
- ...

## Verdict
READY FOR REVIEW / NEEDS FIXES / NOT FULLY VERIFIABLE
```

List every rule file separately. Do not collapse Rule Coverage into broad categories or say that rules were reviewed without showing the inventory.

## Verdict rules

- `READY FOR REVIEW` requires no `HIGH` or `MEDIUM` findings, complete rule coverage, sufficient evidence for all material requirements or system areas, and successful applicable verification.
- `NEEDS FIXES` means verified `HIGH` or `MEDIUM` findings remain.
- `NOT FULLY VERIFIABLE` means missing specifications, unreadable rules, unresolved audit scope, unavailable material evidence, or blocked essential verification prevents a reliable verdict.

Low-severity findings may accompany `READY FOR REVIEW` when they do not undermine requirements, rule compliance, or material quality.
