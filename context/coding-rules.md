# Coding Rules

## General

- Always follow the docs for the version installed in `package.json`
- This is NOT standard Next.js — read docs in `node_modules/next/dist/docs/` before coding
- Do not assume latest-version behavior
- Do not use packages that are not installed
- Do not suggest or install new dependencies unless explicitly approved by the user
- DO NOT add "Co-authored by Claude" to commit messages. This is non-negotiable

## Project Constraints

- All emojis must be imported from `src/lib/emojis.ts` — no inline emoji usage allowed
- Use only theme colors — no hardcoded colors, no Tailwind default colors (e.g., `bg-red-500`), and no custom color values
- All reusable components must have documentation in `docs/components/[ComponentName].md`
- Use comments only for non-obvious logic, behavior, or important constraints

## TypeScript

- Strict mode enabled
- Never use `any` — use proper typing or `unknown`
- Define types/interfaces for props, API responses, and models
- Prefer inference when obvious, explicit types when helpful

## React

- Functional components only
- Use hooks for state and effects
- One responsibility per component
- Extract reusable logic into custom hooks

## Next.js

- Server components by default
- Only use `"use client"` when necessary
- Use Server Actions for forms and simple mutations
- Use API routes ONLY when required (webhooks, uploads, external endpoints, etc.)
- Otherwise fetch directly in server components
- Use dynamic routes where appropriate

## API / Server Rules

- Prefer server-side logic over API routes when possible
- Validate all external input (Zod)
- Keep response shapes consistent and typed
- Keep business logic OUT of UI components
- Only create endpoints when truly needed

## Components

- Important: All Components and utilities added it should be documented in @docs/ under the appropriate subfolder.
- All components should be manipulated with props NOT classes!

## Database

- Use Prisma ORM
- Use PostgreSQL (Neon)
- Always run `prisma generate` after schema changes
- Use `prisma migrate dev` — do NOT use `db push`
- Use migrations — no ad hoc schema changes

## Styling

- Tailwind CSS v4 only
- Do not create or use `tailwind.config.*`
- Use theme tokens only
- No hardcoded or default Tailwind colors
- Reuse design system consistently

## Tailwind CSS v4

CRITICAL: We are using Tailwind CSS v4, which uses CSS-based configuration.

DO NOT create tailwind.config.ts or tailwind.config.js files (those are for v3)
All theme configuration must be done in CSS using the @theme directive in src/app/globals.css
Use CSS custom properties for colors, spacing, etc.
No JavaScript-based config allowed
Example v4 configuration:

@import "tailwindcss";

@theme {
--color-primary: oklch(50% 0.2 250);
}

## File Organization

- Components: `src/components/[feature]/ComponentName.tsx` [feature] = /ui /blocks
- Pages: `src/app/[route]/page.tsx`
- Server Actions: `src/actions/[feature].ts`
- Types: `src/types/[feature].ts`
- Lib/Utils: `src/lib/[utility].ts`

## Naming

- Components: PascalCase (`ItemCard.tsx`)
- Files: Match component name or kebab-case
- Functions: camelCase
- Constants: SCREAMING_SNAKE_CASE
- Types/Interfaces: PascalCase (no prefix)

## Styling

- Tailwind CSS for all styling
- Use shadcn/ui components where applicable
- No inline styles
- Dark mode first, light mode as option

## Database

- Use Prisma ORM for all database operations
- Always use `prisma migrate dev` for schema changes (not `db push`)
- Run `prisma migrate status` before committing to verify migrations are in sync
- Production deployments must run `prisma migrate deploy` before the app starts

## Data Fetching

- Server components fetch directly with Prisma
- Client components use Server Actions
- Validate all inputs with Zod

## Error Handling

- Use try/catch in Server Actions
- Return `{ success, data, error }` pattern from actions
- Display user-friendly error messages via toast

## Code Quality

- No commented-out code unless specified
- No unused imports or variables
- Keep functions under 50 lines when possible
