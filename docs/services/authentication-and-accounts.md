# Authentication and Accounts

## Ownership and entrypoints

`src/auth.ts` owns NextAuth configuration. HTTP protocol entry is `/api/auth/[...nextauth]`; UI entrypoints are `/sign-in`, `/sign-up`, and onboarding/account-recovery routes. `src/proxy.ts` and `src/lib/onboarding-funnel.ts` own the current funnel redirects. Prisma models are documented in [Database Schema](../reference/database-schema.md).

## Providers and session

- Google OAuth uses `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, maps Google verification to `emailVerified`, and enables same-email account linking.
- Credentials accepts email or username plus password. It uses bcrypt and rejects non-child users without verified email.
- NextAuth uses the Prisma adapter and JWT session strategy.
- JWT/session callbacks project user ID, `onboardingCompleted`, and `onboardingStep`. A client `session.update()` call only triggers a refresh: the JWT callback re-reads both fields from the database for the signed token's user ID and ignores any onboarding values a caller places on the `session` payload.

The adapter wrapper creates a free-trial subscription and moves newly created Google users to `WELCOME_VIDEO`. Linking Google to an unverified credentials user marks the email verified and advances the same step.

## Account creation and children

Credentials sign-up validates email/password, hashes the password, creates a `PARENT` and free-trial subscription, then creates/sends a verification code. Onboarding collects profile data, plan selection, and up to two children.

Child creation requires the signed-in database `PARENT` to still be on the `CHILDREN` step with incomplete onboarding, hashes the password, then opens a transaction that takes a Postgres row lock on the parent (`lockUserRow` in `src/lib/db.ts`) before re-checking role/step/completion and the two-child limit and creating the `CHILD` plus `ParentStudent` together. The lock serializes concurrent requests for the same parent so two simultaneous creations cannot both pass the limit check. The optional `mustResetPassword` flag is stored, but no source currently enforces a password-change screen at child sign-in.

## Sign-in return path

`src/lib/auth-return-path.ts` exports `sanitizeReturnPath`, a pure helper that turns the untrusted `callbackUrl` search parameter on `/sign-in` into a safe, root-relative, same-origin path. It rejects absolute and protocol-relative URLs, non-HTTP schemes, raw and percent-encoded backslash/slash/dot-segment confusion, control characters, malformed percent-encoding, and self-referential `/sign-in` destinations, falling back to `/dashboard` for anything rejected, missing, or blank. `/sign-in` reads the parameter once and uses the single sanitized result for Google `signIn`, Credentials `signIn`, and the successful `router.push`.

## Funnel and route gating

Order is `VERIFY_EMAIL → WELCOME_VIDEO → PROFILE → PLAN → CHILDREN → COMPLETE`. `getOnboardingRoute` maps verified incomplete users to `/getting-started` and completed users to `/dashboard`.

Every parent onboarding transition is database-authoritative: `advanceParentOnboardingStep` in `src/lib/onboarding-funnel.ts` performs one conditional `updateMany` matched on the signed-in user ID, database role `PARENT`, the action's required stored step, and `onboardingCompleted = false`. A caller-supplied or JWT-cached step is never enough on its own — only a row that still matches all four conditions advances, and profile fields are written by the same conditional call as the `PROFILE → PLAN` transition so they succeed or fail together. A zero-row match returns a typed `recovery` result carrying the caller's actual current-state destination (`resolveRecoveryRoute`) instead of advancing; `requireParentAtStep` provides the equivalent read-only gate for username lookup, suggestion, and child creation. This makes duplicate submissions, stale tabs, concurrent requests, and completed accounts all safe: at most one of two concurrent requests from the same step can succeed, and a rejected request never moves the funnel.

`/getting-started` performs a server session/user check and verifies the calculated target route. The proxy redirects signed-in `/getting-started` or `/dashboard` requests whose target differs. An anonymous `/dashboard` or `/dashboard/...` request is redirected to `/sign-in` with the requested path sanitized into the existing `callbackUrl` return-path contract, before any further onboarding-route check runs. `src/app/(app)/dashboard/layout.tsx` independently redirects a missing/invalid session to `/sign-in`, so the boundary holds even for a nested dashboard page reached outside the proxy matcher. The learning route is not in the proxy matcher.

## Validation, side effects, and errors

Zod validates browser forms and server mutations, while server session checks establish identity. User-facing failures are generally safe result objects. Some server logs include action names and raw unexpected error objects; they do not intentionally log passwords.

Registration (`registerUser`) and the two email-verification routes (`/api/auth/verify-email-code`, `/api/auth/resend-verification-code`) return identical public responses regardless of whether the target email belongs to an existing, verified, unverified, rate-limited, or absent account; only syntax validation (malformed email, short password, malformed request body) is distinguishable. See [Server Actions](../reference/server-actions.md) and [API Routes](../reference/api-routes.md).

## Tests and limitations

`tests/auth/onboardingFunnel.test.ts` and `tests/auth/onboardingActions.test.ts` cover the conditional transitions, database-role rejection, and stale/earlier-step/later-step/completed-account/duplicate/concurrent-request recovery for every protected onboarding Server Action, plus the two-child limit under concurrency and username-conflict handling. `tests/auth/gettingStartedPage.test.ts` covers the real `/getting-started` page boundary, including that `?checkout=success` advances only from a database-authoritative `PLAN` step and that a repeated, earlier-step, later-step, completed-account, missing-account, or unauthenticated request never advances it. `tests/auth/onboardingClientRecovery.test.ts` covers the shared `handleOnboardingRecovery`/`completeChildrenStep` contract in `src/lib/onboarding-client.ts` that every onboarding client component delegates to, including that a `recovery` result only navigates (it never re-invokes the rejected mutation) and that children-step completion calls `session.update()` with no arguments. `tests/auth/sessionRefresh.test.ts` covers the JWT `update`-trigger refresh, including that browser-supplied onboarding claims are ignored. `tests/auth/emailVerification.test.ts` covers the atomic email-verification attempt-check/increment race and the atomic, database-parent-authoritative correct-code claim (rollback on a missing user, child-role account, later-step/completed account, superseded code, and concurrent-request races). `tests/e2e/dashboardProtection.e2e.ts` exercises the real anonymous `/dashboard` and nested-dashboard proxy redirects and confirms `/sign-in` itself does not loop, against a real running application in a browser. There are still no focused automated tests for Credentials/Google sign-in itself or adapter callbacks. Eligible signed-in dashboard access and unchanged signed-in onboarding routing are not covered by a browser test: there is no test database or seeded-user fixture this suite is authorized to use to establish a real NextAuth session, and adding one would require either contacting a real database or a test-only authentication bypass, both excluded by this project's testing rules; `tests/auth/sessionRefresh.test.ts` and `tests/auth/gettingStartedPage.test.ts` cover that routing at the unit level instead. Both playground diagnostic routes (`/playground/restrict` and `/playground/users`) now perform their own server session check and redirect unauthenticated requests to `/sign-in`. See [Application and Route Map](../architecture/application-and-route-map.md).
