---
paths:
  - "prisma/**/*"
  - "prisma.config.ts"
  - "src/generated/prisma/**/*"
  - "src/lib/db.ts"
  - "src/auth.ts"
  - "src/actions/**/*"
  - "src/app/api/auth/**/*"
  - "src/app/api/webhooks/**/*"
  - "src/app/(auth)/**/*"
  - "src/app/playground/users/**/*"
  - "src/lib/{onboarding-funnel,subscription}.ts"
---

# Database and Prisma

## Canonical Data Layer

- Use Prisma ORM with the existing PostgreSQL/Neon configuration.
- Reuse the singleton Prisma client from `src/lib/db.ts`.
- Never instantiate an additional application Prisma client in a feature file.
- Never import Prisma or the generated client into browser code or a Client Component.
- Keep `DATABASE_URL` and database connection details server-only.

## Schema Changes

- Treat `prisma/schema.prisma` as the source of truth for the application data model.
- Use Prisma migrations for schema changes. Do not use `prisma db push` as a substitute.
- Never rewrite, delete, reorder, or edit an already-applied migration to make a new change appear older.
- Create a new migration for a new schema change.
- Do not edit `src/generated/prisma/**` manually.
- Regenerate the Prisma client after an approved schema change.
- Check migration status before declaring migration work complete.
- Production migration execution must use the repository's approved deployment path; do not run production migrations or change deployment behavior without explicit authorization.

## Safety and Integrity

- Obtain explicit approval before a destructive schema change, irreversible data conversion, table or column removal, or a change that can invalidate existing records.
- Plan data backfills and constraint tightening so existing production data remains valid.
- Preserve unique constraints, foreign keys, cascade behavior, optionality, and defaults unless the requested work intentionally changes them.
- Use a transaction when multiple writes must succeed or fail as one operation.
- Prevent duplicate records through database constraints and idempotent server logic rather than timing assumptions.
- Do not trust client-supplied relationship IDs or ownership fields.

## Query Design

- Select only the fields required by the caller, especially around authentication, tokens, subscriptions, and children.
- Avoid unbounded queries in request paths.
- Use indexed lookup fields for repeated authentication, token, ownership, and relationship queries.
- Avoid N+1 query patterns when a clear Prisma relation query or batch operation fits.
- Keep persistence logic out of presentational components.
- Keep learning progression out of shared database utilities. A new persistence feature for learning must identify the owning module and server boundary explicitly.

## Authentication and Tokens

- Store passwords only as strong hashes.
- Store verification and reset tokens as hashes when possession of the raw token grants access.
- Enforce expiration, one-time use, attempt limits, and revocation behavior at the server and database boundaries.
- Do not include password hashes, token hashes, provider tokens, or unnecessary account records in sessions or responses.

## Verification

- Review the generated migration SQL before treating a migration as safe.
- Verify the generated Prisma client succeeds after schema changes.
- Test transaction rollback and duplicate-request behavior where atomicity or idempotency matters.
- Confirm database work does not expose server records to Client Components or responses.
- Report any migration or production-data risk explicitly.
