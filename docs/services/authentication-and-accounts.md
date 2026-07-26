# Authentication and Accounts

## Ownership and entrypoints

`src/auth.ts` owns NextAuth configuration. HTTP protocol entry is `/api/auth/[...nextauth]`; UI entrypoints are `/sign-in`, `/sign-up`, and onboarding/account-recovery routes. `src/proxy.ts` and `src/lib/onboarding-funnel.ts` own the current funnel redirects. Prisma models are documented in [Database Schema](../reference/database-schema.md).

## Providers and session

- Google OAuth uses `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, maps Google verification to `emailVerified`, and enables same-email account linking.
- Credentials accepts email or username plus password. It uses bcrypt and rejects non-child users without verified email.
- NextAuth uses the Prisma adapter and JWT session strategy.
- JWT/session callbacks project user ID, `onboardingCompleted`, and `onboardingStep`. A client session `update` is accepted for those two funnel claims; server mutations remain responsible for database truth.

The adapter wrapper creates a free-trial subscription and moves newly created Google users to `WELCOME_VIDEO`. Linking Google to an unverified credentials user marks the email verified and advances the same step.

## Account creation and children

Credentials sign-up validates email/password, hashes the password, creates a `PARENT` and free-trial subscription, then creates/sends a verification code. Onboarding collects profile data, plan selection, and up to two children.

Child creation requires the parent session, checks the unique lowercase-alphanumeric username and current relation count, hashes the child password, and transactionally creates a `CHILD` plus `ParentStudent`. The optional `mustResetPassword` flag is stored, but no source currently enforces a password-change screen at child sign-in.

## Funnel and route gating

Order is `VERIFY_EMAIL → WELCOME_VIDEO → PROFILE → PLAN → CHILDREN → COMPLETE`. `getOnboardingRoute` maps verified incomplete users to `/getting-started` and completed users to `/dashboard`.

`/getting-started` performs a server session/user check and verifies the calculated target route. The proxy redirects signed-in `/getting-started` or `/dashboard` requests whose target differs. It does not reject requests with no token, and the dashboard page does not independently authenticate. The learning route is not in the proxy matcher.

## Validation, side effects, and errors

Zod validates browser forms and server mutations, while server session checks establish identity. User-facing failures are generally safe result objects. Some server logs include action names and raw unexpected error objects; they do not intentionally log passwords.

## Tests and limitations

There are no focused automated tests for Credentials/Google sign-in, adapter callbacks, JWT refresh, onboarding actions, proxy redirects, or parent-child authorization. Playground routes include a separately session-checked page and an ungated user-list page. See [Application and Route Map](../architecture/application-and-route-map.md).
