# Database Schema

`prisma/schema.prisma` is the current model source. Migrations under `prisma/migrations/` establish the deployed evolution. The datasource is PostgreSQL; the generated client is under `src/generated/prisma/` and is excluded from maintained documentation.

## Enums

| Enum | Values | Owner |
| --- | --- | --- |
| `UserRole` | `PARENT`, `TEACHER`, `STUDENT`, `CHILD`, `ADMIN` | Accounts and parent/child relationships |
| `SubscriptionTier` | `FREE_TRIAL`, `MONTHLY`, `LIFETIME`, `ADMIN`, `CANCELED` | Billing/access record |
| `OnboardingStep` | `VERIFY_EMAIL`, `WELCOME_VIDEO`, `PROFILE`, `PLAN`, `CHILDREN`, `COMPLETE` | Account funnel |
| `TtsUsageScope` | `CALLER_MINUTE`, `CALLER_DAY`, `ENTITLEMENT_DAY` | Paid TTS usage window |
| `TtsRequestKind` | `PUBLIC_TEXT`, `PROTECTED_TEXT` | Paid TTS request classification |
| `TtsProvider` | `GOOGLE`, `LEMONFOX` | Paid TTS provider |
| `TtsUsageAlertKind` | `FIVE_HOUR_WARNING`, `TEN_HOUR_CUTOFF` | Paid TTS abuse alert |

## Models

### `User`

Primary key `id` is a cuid. Optional identity/profile fields include `isOwner`, `name`, `fName`, `lName`, unique nullable `email` (`citext`, case-insensitive, with a database check constraint requiring the stored value to already equal its own trimmed-lowercase form — see [Email Identity](../services/authentication-and-accounts.md#email-identity)), unique nullable `username`, `image`, bcrypt `password`, and `role`. Funnel fields are `onboardingCompleted` (default false) and `onboardingStep` (default `VERIFY_EMAIL`); `getOnboardingRoute` treats a `CHILD` role as always `/dashboard` regardless of these defaults. `mustResetPassword` (default false) is enforced end-to-end — see [Required Password Reset](../services/authentication-and-accounts.md#required-password-reset). Nullable `ttsSuspendedAt`/`ttsSuspensionReasonCode` hold narrow manual paid-TTS suspension state, set only through an authorized operator boundary (`src/lib/learning-engine/speech/ttsAccessSuspension.ts`), never automatically by usage enforcement. `createdAt` defaults now and `updatedAt` is automatic.

Relations: accounts, sessions, parent/student join rows, optional one-to-one subscription, password-reset tokens, and paid-TTS usage buckets/alerts/leases (as subject, caller, and entitlement principal). Deleting a user cascades through all foreign-key relations.

### `ParentStudent`

Composite primary key `(parentId, studentId)`, `createdAt`, and two named relations to `User`. Both foreign keys cascade on user deletion. Source logic uses it to enforce parent ownership and a two-child onboarding cap; the schema itself does not encode roles or that count.

### `Account`

NextAuth provider account with cuid `id`, required `userId`, provider/type identifiers, and optional OAuth token metadata. `(provider, providerAccountId)` is unique. User deletion cascades. Google account insertion and the required transition for an eligible existing credentials parent share one adapter-owned transaction.

### `Session`

NextAuth database session model with cuid `id`, unique `sessionToken`, `userId`, and expiry. The configured application session strategy is JWT, but the adapter model remains. User deletion cascades.

### `Subscription`

One row per user: cuid `id`, unique `userId`, optional tier/trial dates, unique nullable Stripe customer and subscription IDs, price/status/period fields, `cancelAtPeriodEnd` default false, and timestamps. User deletion cascades. Application sign-up creates a free-trial row; verified Stripe events update paid lifecycle fields.

### `VerificationToken`

NextAuth adapter token model with `identifier`, unique `token`, and `expires`; composite uniqueness on `(identifier, token)`. It has no relation.

### `EmailVerificationCode`

Cuid `id`, `citext` email (same canonical-storage check constraint as `User.email`), `codeHash`, expiry, optional used time, attempts default zero, and created time. It has a non-unique index on email. Account flows store only the code hash and query the most recent unused row.

### `PasswordResetToken`

Cuid `id`, `userId`, unique `tokenHash`, expiry, optional used time, and created time. `userId` is indexed and cascades on user deletion. Issuance serializes cooldown on the owning user row. Confirmation locks that owner, conditionally claims the exact submitted unused/unexpired token, changes the password/required-reset flag, and marks sibling unused tokens used in one transaction.

### `TtsUsageBucket`

Durable per-window paid TTS usage counters, one row per `(subjectUserId, scope, windowStart, provider, requestKind)` (unique constraint, plus an index on `(subjectUserId, scope, windowStart)`). Counts accepted requests/bytes/characters/words, successes, failures, three bounded rejection categories (burst/concurrency/extreme), and generated audio bytes (`BigInt`). Enforcement sums rows across provider/requestKind for one subject+scope+window; the split keeps provider/request-kind breakdowns reportable. No spoken text or audio is ever stored. User deletion cascades.

### `TtsUsageAlert`

At most one row per `(callerUserId, dayStart, kind)` (unique constraint; indexed on `(entitlementPrincipalUserId, dayStart)`), recording `FIVE_HOUR_WARNING` or `TEN_HOUR_CUTOFF` with the observed word count at the crossing. Created only inside the atomic acquisition transaction, never automatically escalated to suspension. Both `caller` and `entitlementPrincipal` relations cascade on user deletion.

### `TtsRequestLease`

One row per in-flight paid provider attempt: caller/principal IDs, provider, request kind, exact input bytes/characters/words, the caller-minute/caller-day/principal-day window starts it belongs to, and `expiresAt` (30 seconds from acquisition). Indexed on `(callerUserId, expiresAt)` and `(entitlementPrincipalUserId, expiresAt)` so concurrency queries count only unexpired rows without a table scan. Completion can claim (delete) the exact lease once only while it is still unexpired; the first claim records completion, a duplicate cannot double-count, and a missing/expired lease fails closed rather than authorizing audio. An abandoned lease expires and is cleaned during completion or a later acquisition. Stores only numeric completion metadata, never spoken content. Both relations cascade on user deletion.

## Migration workflow

Use `npx prisma migrate dev --name <name>` for approved local schema changes, review generated SQL, then run `npx prisma generate`. Do not edit applied migrations or use `db push` as a migration substitute. Production uses `npx prisma migrate deploy`; no repository deployment wrapper is currently present.

`normalize_auth_emails` enables the PostgreSQL `citext` extension (`extensions = [citext]` in the `datasource` block, requiring the `postgresqlExtensions` preview feature on the `client` generator), converts `User.email` and `EmailVerificationCode.email` to `citext`, canonicalizes existing non-null values with `LOWER(BTRIM(...))`, and adds a check constraint on each column requiring the stored value to already equal its own trimmed-lowercase form (compared as `text`, since `citext` equality is itself case-insensitive and would otherwise never actually reject a differently-cased value). It is forward-only and does not touch any other table.
