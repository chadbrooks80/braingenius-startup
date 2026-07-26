# Database Schema

`prisma/schema.prisma` is the current model source. Migrations under `prisma/migrations/` establish the deployed evolution. The datasource is PostgreSQL; the generated client is under `src/generated/prisma/` and is excluded from maintained documentation.

## Enums

| Enum | Values | Owner |
| --- | --- | --- |
| `UserRole` | `PARENT`, `TEACHER`, `STUDENT`, `CHILD`, `ADMIN` | Accounts and parent/child relationships |
| `SubscriptionTier` | `FREE_TRIAL`, `MONTHLY`, `LIFETIME`, `ADMIN`, `CANCELED` | Billing/access record |
| `OnboardingStep` | `VERIFY_EMAIL`, `WELCOME_VIDEO`, `PROFILE`, `PLAN`, `CHILDREN`, `COMPLETE` | Account funnel |

## Models

### `User`

Primary key `id` is a cuid. Optional identity/profile fields include `isOwner`, `name`, `fName`, `lName`, unique nullable `email`, unique nullable `username`, `image`, bcrypt `password`, and `role`. Funnel fields are `onboardingCompleted` (default false), `onboardingStep` (default `VERIFY_EMAIL`), and `mustResetPassword` (default false). `createdAt` defaults now and `updatedAt` is automatic.

Relations: accounts, sessions, parent/student join rows, optional one-to-one subscription, and password-reset tokens. Deleting a user cascades through all foreign-key relations.

### `ParentStudent`

Composite primary key `(parentId, studentId)`, `createdAt`, and two named relations to `User`. Both foreign keys cascade on user deletion. Source logic uses it to enforce parent ownership and a two-child onboarding cap; the schema itself does not encode roles or that count.

### `Account`

NextAuth provider account with cuid `id`, required `userId`, provider/type identifiers, and optional OAuth token metadata. `(provider, providerAccountId)` is unique. User deletion cascades.

### `Session`

NextAuth database session model with cuid `id`, unique `sessionToken`, `userId`, and expiry. The configured application session strategy is JWT, but the adapter model remains. User deletion cascades.

### `Subscription`

One row per user: cuid `id`, unique `userId`, optional tier/trial dates, unique nullable Stripe customer and subscription IDs, price/status/period fields, `cancelAtPeriodEnd` default false, and timestamps. User deletion cascades. Application sign-up creates a free-trial row; verified Stripe events update paid lifecycle fields.

### `VerificationToken`

NextAuth adapter token model with `identifier`, unique `token`, and `expires`; composite uniqueness on `(identifier, token)`. It has no relation.

### `EmailVerificationCode`

Cuid `id`, email, `codeHash`, expiry, optional used time, attempts default zero, and created time. It has a non-unique index on email. Account flows store only the code hash and query the most recent unused row.

### `PasswordResetToken`

Cuid `id`, `userId`, unique `tokenHash`, expiry, optional used time, and created time. `userId` is indexed and cascades on user deletion. Successful reset marks all unused tokens for that user used.

## Migration workflow

Use `npx prisma migrate dev --name <name>` for approved local schema changes, review generated SQL, then run `npx prisma generate`. Do not edit applied migrations or use `db push` as a migration substitute. Production uses `npx prisma migrate deploy`; no repository deployment wrapper is currently present.
