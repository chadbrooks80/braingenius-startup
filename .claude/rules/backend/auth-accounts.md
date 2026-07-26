---
paths:
  - "src/auth.ts"
  - "src/proxy.ts"
  - "src/app/auth/**/*"
  - "src/app/(auth)/**/*"
  - "src/app/(app)/**/*"
  - "src/app/api/auth/**/*"
  - "src/actions/**/*"
  - "src/components/onboarding/**/*"
  - "src/app/playground/{restrict,users}/**/*"
  - "src/lib/{auth-tokens,email,onboarding-funnel}.ts"
  - "prisma/schema.prisma"
---

# Authentication and Accounts

## Existing Authentication Model

- Preserve the existing NextAuth v4 integration, JWT session strategy, Prisma adapter, Google provider, and Credentials provider unless the requested work explicitly changes that architecture.
- Keep the host application responsible for authentication, accounts, onboarding, and protected application access.
- Do not introduce a second session system, token system, auth middleware, or user store.
- Do not bypass authentication to make a protected flow easier to test or access.

## Trusted Identity

- Derive the active user ID, role, verification state, and onboarding state from the authenticated server session and database.
- Never trust a browser-provided user ID, role, parent ID, child ID, subscription tier, verification flag, or onboarding-completion flag.
- Confirm ownership and relationships at the server before reading or changing user-owned data.
- Keep session claims synchronized with authoritative database state through the existing callback and session-update patterns.

## Sign-Up and Sign-In

- Normalize and validate credentials before lookup or account creation.
- Hash passwords with the existing bcrypt boundary; never store, log, return, or compare plaintext passwords outside the approved hashing flow.
- Preserve the rule that non-child credential users require verified email before normal sign-in.
- Keep Google-verified email handling and account-linking behavior explicit. Do not change `allowDangerousEmailAccountLinking` or its safeguards without a focused security review.
- Account creation must leave subscription and onboarding records in a valid state or fail visibly.
- Avoid responses that reveal whether an email, username, or account exists when that knowledge creates an enumeration risk.

## Verification and Password Reset

- Verification codes and reset tokens must be short-lived, single-use, and server-validated.
- Store only their hashes when the raw value grants access.
- Enforce attempt limits, expiration, used-state checks, and invalidation of superseded credentials.
- Do not echo codes, reset tokens, password values, token hashes, or internal account state in logs or responses.
- A password reset must not silently succeed for an invalid, expired, used, or mismatched token.

## Onboarding

- Treat onboarding progression as authoritative account state, not merely a client-side stepper.
- Validate every onboarding mutation against the authenticated user and allowed current state.
- Preserve parent-child ownership when creating or modifying child accounts.
- Use transactions when multiple onboarding writes must remain consistent.
- Keep the database state and refreshed JWT/session state aligned after a completed step.

## Protected Routes

- Preserve the existing proxy, redirect, and route-group boundaries.
- Server authorization remains required even when navigation and UI already hide a protected route.
- Avoid redirect loops among sign-in, verification, onboarding, and application routes.
- Validate return paths and redirect destinations as same-origin application paths.

## Verification

- Test credential sign-in, Google sign-in, account linking, verification, password reset, session refresh, onboarding transitions, logout, and unauthorized access when those flows change.
- Test both expected rejection and successful recovery paths.
- Confirm no auth secrets, password material, provider tokens, or internal adapter records reach the browser.
