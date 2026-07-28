# Security and Server Boundaries

## Authentication and accounts

NextAuth configuration, Prisma adapter wrapping, Credentials and Google providers, JWT callbacks, and session projection live in `src/auth.ts`. Passwords are bcrypt hashes. Non-child credentials users must have `emailVerified`; Google-created/linked users advance beyond email verification. Server Actions derive the active user ID from `getServerSession`.

The proxy is funnel routing, not a complete authorization layer by itself. Every protected page or mutation still needs its own server check: `/dashboard` is protected both by the proxy (anonymous redirect to `/sign-in`, authenticated onboarding-target redirect) and by `src/app/(app)/dashboard/layout.tsx` (independent `getServerSession` check covering every nested page). Remaining exceptions and weak boundaries are listed in [Application and Route Map](application-and-route-map.md).

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

Provider credentials and OAuth access tokens remain in the server provider layer. Google and Lemonfox configurations are allowlisted. Upstream calls use a 10-second timeout and return generic client errors.

The generic `/api/tts` route accepts only public text already available to the screen and limits it to 4,000 UTF-8 bytes. It currently lacks authentication, quotas, rate limits, concurrency limits, and usage tracking, so source comments explicitly prohibit exposing paid credentials publicly without those controls.

## Account token boundaries

Email verification codes are four random digits stored as SHA-256 hashes, expire after 10 minutes, allow at most five recorded mismatches, and become single-use. `src/lib/email-verification.ts` enforces all of this atomically: every wrong-attempt increment is a conditional `updateMany` that re-validates the code record, email, unused/unexpired state, and attempt count against the row's committed state at write time, so concurrent requests against the same code cannot exceed the attempt limit. A correct code is claimed inside one interactive transaction that conditionally sets `usedAt` and, only on that successful claim, conditionally updates the user (matching email, database role `PARENT`, `onboardingStep` still `VERIFY_EMAIL`, incomplete onboarding) to set `emailVerified` and advance to `WELCOME_VIDEO`. Both conditional writes must each match exactly one row; a zero-row match on either one (a missing user, a database `CHILD` account, an account already past `VERIFY_EMAIL` or completed, a superseded code, or a losing concurrent submission) rolls the whole transaction back and reports the same generic failure, so two correct submissions can never both succeed and a stale request can never silently consume a code. Resend uses a 60-second interval and invalidates prior unused codes.

Password-reset tokens are 32 random bytes rendered as hex, stored hashed, expire after one hour, and all outstanding unused tokens for the user are marked used after a successful reset. Reset-request responses remain generic to reduce account enumeration.

## Billing boundary

Checkout derives the user from the server session and selects price IDs from server environment configuration. Stripe webhooks read the raw text, verify `stripe-signature`, map only configured prices, and synchronize the Prisma `Subscription`.

Current implementation gaps:

- `checkout.session.completed` silently ignores missing user IDs, users, unpaid sessions, and unknown prices but still acknowledges the event.
- no explicit event-ID persistence provides durable webhook idempotency;
- `/getting-started?checkout=success` advances the plan step without verifying the Checkout Session or re-reading webhook-synchronized subscription state.

These are documented source facts, not guarantees.

## Error handling

Learning route errors expose only fixed learner-safe presentations. Vocabulary capability and speech failures use generic messages. TTS logs provider/configuration context server-side and returns generic 400/500/502 responses. Documentation must never copy canonical answers, credentials, raw provider payloads, or environment values.
