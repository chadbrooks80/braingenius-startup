---
paths:
  - "**/*"
---

# Code Baseline

## Scope and Existing Work

- Implement only the requested feature, fix, or documentation change.
- Every changed file must have a clear connection to the requested work.
- Do not add unrelated refactors, redesigns, formatting sweeps, cleanup, dependencies, scripts, configuration changes, or architecture changes.
- Preserve existing user changes. Never discard, overwrite, or reformat unrelated work.
- Before creating or editing a file, inspect the nearest comparable implementation and follow its established naming, contracts, placement, and behavior.
- If the requested work requires expanding scope or changing an established contract, stop and explain why before proceeding.

## Sources of Truth

- Treat `package.json` as authoritative for installed packages and available npm scripts.
- Treat `.nvmrc`, `package.json`, and the repository configuration files as authoritative for runtime and tool versions.
- Do not assume a dependency exists because it is common in similar projects.
- Do not install, remove, or upgrade a dependency unless the task requires it and the user approves it.
- Follow documentation for the installed dependency version. When Next.js behavior matters and local dependency documentation is available, consult `node_modules/next/dist/docs/` rather than assuming behavior from another version.
- Follow the current repository architecture instead of introducing another framework, ORM, authentication system, state library, validation library, or styling system.

## Rule Routing and New Files

- Before creating a file, determine which existing architectural area owns its responsibility and place it according to that area's established structure.
- Any work involving theme or styling, components, global CSS, server boundaries, authentication, accounts, Prisma, database records, billing, webhooks, the Learning Engine, Learning Windows, learning modules, answer security, TTS, or tests must follow the applicable specialized rule file even when a new file does not yet match its configured paths.
- Before creating or changing code outside an already-covered path, read the applicable rule directly from `.claude/rules/` and follow it throughout the change.
- Do not create a new authentication, database, billing, provider, theme, learning, or server boundary in an unrelated folder merely because no current rule path covers it.
- When a change creates a new architectural folder, moves an owning boundary, or introduces a new file pattern, update the applicable `.claude/rules` path configuration in the same change.
- When multiple rule files apply, follow all of them. A specialized rule adds constraints and does not replace this baseline.
- If ownership is unclear or two rules appear to conflict, stop and resolve the boundary with the user before implementing.
- Path-specific rules provide contextual guidance; they are not a substitute for server authorization, validation, tests, hooks, or security audits.

## TypeScript

- Keep strict TypeScript behavior intact.
- Never use `any`. Use a precise type or `unknown` at an untrusted boundary and narrow it before use.
- Public props, shared contracts, API responses, state values, and domain models must have explicit, meaningful types.
- Prefer inference for obvious local values and explicit types where they clarify a boundary.
- Do not use casts, non-null assertions, `@ts-ignore`, or disabled lint rules to hide an unresolved type or design problem.
- Exhaustively handle discriminated unions. Use an unreachable branch only when it proves the union is complete.
- Preserve server-only and client-safe type boundaries.

## React and Next.js

- Use functional React components.
- Prefer Server Components. Add `"use client"` only when the component needs browser APIs, event handlers, effects, or client-owned state.
- Keep the client boundary as narrow as practical.
- Keep business and domain logic out of presentational components.
- Use Server Actions, route handlers, and direct server-side calls according to the existing boundary for that feature; do not move logic merely to follow a generic preference.
- Preserve App Router conventions and the current route-group structure.
- Do not create duplicate state, effects, endpoints, or components when an existing contract already owns the behavior.

## Code Quality

- Use PascalCase for components and public types, camelCase for functions and variables, and SCREAMING_SNAKE_CASE for true constants.
- Match a component file to its component name. Use established folder and file naming for non-component modules.
- Remove unused imports, variables, dead branches, and debug output introduced by the change.
- Do not leave commented-out code.
- Add comments only for non-obvious behavior, security requirements, concurrency handling, or architectural constraints. Explain why, not what the syntax does.
- Production UI emojis must come from `src/lib/emojis.ts`; do not add inline emoji characters to application UI.
- Keep changes readable and cohesive. Do not split code into tiny abstractions that obscure the behavior.

## Files and Tooling

- Do not edit generated files such as `src/generated/prisma/**`, `next-env.d.ts`, or `*.tsbuildinfo`.
- Do not edit `package-lock.json` manually.
- Do not create `tailwind.config.*`; this project uses Tailwind CSS v4 configuration in CSS.
- Do not change package scripts, compiler settings, lint configuration, deployment configuration, or environment-variable contracts unless the task explicitly requires it.
- Never add `Co-authored-by` or similar AI attribution to commits.
- Do not commit, merge, push, publish, or deploy unless the user explicitly requests that action.

## Completion Standard

- Run only checks that exist in the current repository and are relevant to the changed behavior.
- Report exactly which checks ran and their results.
- Do not claim browser, runtime, integration, accessibility, or visual verification that was not actually performed.
- Passing checks does not excuse an architecture, security, or scope violation.
