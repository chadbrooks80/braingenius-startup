# Security and Server Boundaries

## Authentication and accounts

NextAuth configuration, Prisma adapter wrapping, Credentials and Google providers, JWT callbacks, and session projection live in `src/auth.ts`. Passwords are bcrypt hashes. Non-child credentials users must have `emailVerified`; Google-created/linked users advance beyond email verification. Server Actions derive the active user ID from `getServerSession`. Email identity is canonical (`src/lib/auth/email-normalization.ts`) and case-insensitively unique at the database boundary (`citext`); the Google `profile()` mapping fails closed on a missing/invalid provider email (throws rather than falling back to a raw value), and `attemptEmailVerification` (the owning email-verification service) normalizes its own input again rather than trusting the HTTP route already did. See [Email Identity](../services/authentication-and-accounts.md#email-identity).

The proxy makes no allow/deny or routing decision from JWT claims at all — it matches only `/dashboard/:path*` and redirects an anonymous request to `/sign-in`, nothing else. Every protected page or mutation is its own independent, database-reading server check: `/dashboard` is protected by `src/app/(app)/layout.tsx` (missing-account/`mustResetPassword` gate) and `src/app/(app)/dashboard/layout.tsx` (independent `getServerSession` check covering every nested page). Remaining exceptions and weak boundaries are listed in [Application and Route Map](application-and-route-map.md).

A `mustResetPassword` account is a further case: NextAuth still establishes a session for correct credentials, but that session is restricted. `src/app/(app)/layout.tsx`, `/getting-started`, both auth-only playground routes, `createCheckoutSession`, and `resolveTtsEntitlement` all independently re-read the database flag and deny/redirect before dashboard, onboarding, checkout, or paid TTS access. A session whose user id has no matching database row (a deleted account) is a separate, explicit "missing account" outcome at the same boundaries — it fails closed to `/sign-in` rather than falling through as if reset were not required. See [Required Password Reset](../services/authentication-and-accounts.md#required-password-reset).

## Vocabulary answer security

Canonical fixture words, internal choice IDs, accepted spellings, and grading live in modules importing `server-only`. Before grading, browser projections contain only:

- opaque lesson/word/capability/attempt identifiers;
- the current teaching screen content;
- a multiple-choice prompt and four public choice IDs/text values; or
- a spelling definition and opaque speech/attempt reference.

Public definition choice IDs are SHA-256-derived per opaque attempt. Strict parsers reject unknown, missing, or wrong-variant fields. The server binds a capability or attempt to the anonymous learner cookie, lesson, word, projection, screen occurrence, and answer type. Capabilities expire after 30 minutes by default, predecessors are retired as the chain advances, and protected responses use `Cache-Control: no-store`.

The anonymous learner cookie is a random UUID with `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Secure` for HTTPS. Identity is derived from the cookie, never a learner ID in the request body.

The current store is an in-memory singleton. Its expiration and idempotency properties do not survive process restarts and are not safe across multiple application instances.

## Protected speech

Graded spelling audio uses `{ source: { endpoint, reference } }`. `parseSpeakActionPayload` accepts only canonical same-origin paths matching `/api/learning/<module>/speech`, without query, fragment, credentials, backslash, or origin variation. The Vocabulary speech route accepts exactly `reference`, verifies an active learner-bound spelling attempt, resolves the word only on the server, and returns audio with `no-store`.

Provider credentials and OAuth access tokens remain in the server provider layer. Google and Lemonfox configurations are allowlisted. Google OAuth, Google synthesis, and Lemonfox synthesis keep a 10-second deadline active through fetch, bounded body consumption, and decoding rather than clearing it when headers arrive. Bounded response reads (`readBoundedResponseBody.ts`) reject a valid declared `Content-Length` over the limit before buffering, enforce the streamed byte count regardless of a missing/malformed/falsely-small declared length, cancel on overflow or deadline abort, and return generic client errors.

Both `/api/tts` and `/api/learning/vocabulary/speech` require an authenticated, currently entitled caller (direct Stage 1 entitlement or, for a `CHILD`, inheritance from the first currently entitled linked parent), an absence of active manual TTS suspension on the caller or entitlement principal, and an absence of a pending required password reset on the caller, enforced by `resolveTtsEntitlement` (`src/lib/billing/user-entitlement.ts`) and the shared `src/lib/learning-engine/speech/ttsUsageService.ts` boundary before any provider dispatch. Each provider chunk is limited to 5,000 UTF-8 bytes — a per-chunk boundary, not a passage limit; long public passages are chunked client-side (`chunkSpeechText.ts`) at natural boundaries. Durable PostgreSQL accounting enforces a 120-attempt-per-UTC-minute burst limit, a 10-concurrent-lease cap (30-second lease), and a 90,000-accepted-word ten-hour daily cutoff per caller (more than 45,000 words creates one reporting-only five-hour warning); there is no normal daily request/byte/character cap. The acquisition transaction locks and re-reads the caller, current parent relationships, linked parents, existing subscriptions, and suspension state; it independently derives direct or stable first-parent inherited authority and rejects a changed role, removed link, or stale/arbitrary principal pair. Audio returns only after the exact unexpired lease is claimed and success accounting commits; missing/expired or failed completion accounting maps to generic `503`. None of this authority is cached in the JWT, browser, or process memory. A server-only report and manual suspension boundary (`ttsUsageReport.ts`, `ttsAccessSuspension.ts`) support authorized abuse review; no suspension is ever automatic.

## Account token boundaries

Email verification codes are four random digits stored as SHA-256 hashes, expire after 10 minutes, allow at most five recorded mismatches, and become single-use. `src/lib/email-verification.ts` enforces all of this atomically: every wrong-attempt increment is a conditional `updateMany` that re-validates the code record, email, unused/unexpired state, and attempt count against the row's committed state at write time, so concurrent requests against the same code cannot exceed the attempt limit. A correct code is claimed inside one interactive transaction that conditionally sets `usedAt` and, only on that successful claim, conditionally updates the user (matching email, database role `PARENT`, `onboardingStep` still `VERIFY_EMAIL`, incomplete onboarding) to set `emailVerified` and advance to `WELCOME_VIDEO`. Both conditional writes must each match exactly one row; a zero-row match on either one (a missing user, a database `CHILD` account, an account already past `VERIFY_EMAIL` or completed, a superseded code, or a losing concurrent submission) rolls the whole transaction back and reports the same generic failure, so two correct submissions can never both succeed and a stale request can never silently consume a code. Resend uses a 60-second interval and invalidates prior unused codes.

Password-reset tokens are 32 random bytes rendered as hex, stored hashed, expire after one hour, and all outstanding unused tokens for the user are marked used after a successful reset; the same transaction also clears `mustResetPassword`. Reset-request responses remain generic to reduce account enumeration.

The required-password-reset mutation (`submitRequiredPasswordReset`, `src/actions/required-password-reset.ts`) is a separate, database-authoritative path for a `mustResetPassword = true` account: it re-reads the user from `getServerSession`'s ID (never a client-supplied field), requires an existing credentials password, verifies the current password, rejects a new password identical to the current one, and clears the hash and flag together in one conditional `updateMany` matched on `{ id, mustResetPassword: true }`. A zero-row match (already cleared, or a losing concurrent request) is treated as `recovery`, not success, and every security-sensitive rejection returns one identical generic result.

## Billing boundary

Checkout derives the user from the server session, selects price IDs from server environment configuration, and constructs return URLs from a trusted configured origin. The browser receives only the hosted URL and later returns an untrusted Checkout Session ID; it never supplies identity, price, tier, payment, or entitlement claims. `createCheckoutSession` denies a `mustResetPassword` caller before any Stripe call.

`src/lib/billing/stripe-state.ts` retrieves the returned session from Stripe and requires authenticated ownership, exactly one quantity-one approved price, matching mode, complete/paid state, and a qualifying monthly Subscription when applicable. It synchronizes the same Prisma `Subscription` used by raw-body, signature-verified webhooks. The onboarding page advances only after the synchronized record passes `src/lib/billing/entitlement.ts`.

The evaluator grants monthly only for the approved price, `active` or `trialing`, and a future period end; cancel-at-period-end expires at that boundary. Inactive, missing, expired, unknown, and price-mismatched state denies and clears paid tier during synchronization. Lifetime requires its approved price and explicit `paid`; administrative and unexpired free-trial access are independent allowlisted sources.

Supported webhook processing failures return non-success for retry. Duplicate current supported events converge on the same row state. No explicit event-ID ledger, stale-event ordering, or reconciliation job exists; audit #27 remains deferred.

## Error handling

Learning route errors expose only fixed learner-safe presentations. Vocabulary capability and speech failures use generic messages. TTS logs provider/configuration context server-side and returns generic 400/500/502 responses. Documentation must never copy canonical answers, credentials, raw provider payloads, or environment values.
