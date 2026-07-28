# API Routes

All request bodies are untrusted. Unless noted, handlers do not set explicit cache headers.

## Authentication and account recovery

### `GET|POST /api/auth/[...nextauth]`

- Source: `src/app/api/auth/[...nextauth]/route.ts`; delegates to `src/auth.ts`.
- Contract: NextAuth v4 endpoints for Google OAuth, Credentials sign-in, JWT sessions, callbacks, and adapter operations.
- Identity/state: Prisma adapter plus JWT session strategy. Session projection includes user ID and onboarding state, not password/provider-token fields.
- Errors/cache/tests: NextAuth owns protocol response/status behavior. There are no focused auth route tests in `tests/`.

### `POST /api/auth/password-reset/request`

- Source: `src/app/api/auth/password-reset/request/route.ts`; public endpoint that delegates URL construction to `buildPasswordResetUrl()` in `src/lib/app-base-url.ts`.
- Request: exactness is not enforced; Zod reads an `email` string. Invalid JSON/input, unknown accounts, OAuth-only accounts, rate-limited requests, and eligible requests all return `200 { success: true }`.
- Side effects: for an existing password account outside the 60-second interval, creates a SHA-256 token hash expiring in one hour and attempts Resend delivery using a reset URL built from the trusted origin resolved by `resolveAppBaseUrl()` (`NEXTAUTH_URL`, then `NEXT_PUBLIC_APP_URL`, then a non-production `localhost:3000` fallback).
- Security/cache/tests: generic response reduces enumeration; raw token exists only in the email URL. If no trusted origin resolves (only possible in production), no token is created and no email is sent, the response stays the identical generic success, and a safe configuration error is logged without the email, token, or environment value. `tests/auth/appBaseUrl.test.ts` and `tests/auth/passwordResetRequest.test.ts`.

### `POST /api/auth/password-reset/confirm`

- Source: `src/app/api/auth/password-reset/confirm/route.ts`; public endpoint.
- Request: Zod object with valid `email`, non-empty `token`, and password of at least eight characters. Extra fields are accepted by default Zod object behavior.
- Success: `200 { success: true }`; bcrypt-hashes the new password and atomically marks every unused reset token for the user used.
- Errors: malformed/invalid input or a missing, used, expired, or email-mismatched token returns `400` with a safe error.
- Tests: no focused automated route test.

### `POST /api/auth/resend-verification-code`

- Source: `src/app/api/auth/resend-verification-code/route.ts`; public endpoint.
- Request: Zod `email`; invalid input, unknown email, already-verified account, cooldown-active request, and eligible-unverified-account request all return the identical generic `200 { success: true }` with `Cache-Control: no-store`.
- Success/side effects: for an existing unverified user outside the silent 60-second cooldown, invalidates unused codes, creates a hashed four-digit code with 10-minute expiry, and attempts email delivery. The cooldown is enforced only by skipping that work; it is never revealed through status, body, or client copy.
- Security/tests: `tests/auth/emailVerificationRoutes.test.ts`.

### `POST /api/auth/verify-email-code`

- Source: `src/app/api/auth/verify-email-code/route.ts`; public endpoint that delegates to `attemptEmailVerification()` in `src/lib/email-verification.ts`.
- Request: Zod `email` and exactly four-character `code`.
- Success: for a correct, active code, one interactive transaction conditionally claims the code (`usedAt`) and, only on a successful claim, conditionally updates the user (matching email, database role `PARENT`, `onboardingStep` still `VERIFY_EMAIL`, incomplete onboarding) to set `emailVerified` and advance `VERIFY_EMAIL` to `WELCOME_VIDEO`. Both conditional writes must each match exactly one row or the whole transaction rolls back. Returns `200 { success: true }` with `Cache-Control: no-store` only when both writes committed.
- Errors: malformed input returns a distinct `400 { error: "Invalid request." }`. No active code, expiry, five prior failures, a wrong code, and a correct code that rolls back (missing user, database `CHILD` account, an account already past `VERIFY_EMAIL` or completed, a superseded code, or a duplicate submission after a prior success) all return the identical `400` learner-safe response with `Cache-Control: no-store`, so the response never reveals which one happened.
- Atomicity: every write (wrong-attempt increment, correct-code claim, user verification/advancement) is a conditional database operation that re-validates the exact code record, email, unused/unexpired state, attempt limit, and (for the user write) role/step/completion state against the row's state at write time. Concurrent requests against the same code can never push `attempts` past the maximum or let two correct submissions both succeed; an unexpected failure or a zero-row user match rolls back the code claim in the same transaction.
- Tests: `tests/auth/emailVerification.test.ts` (atomic contract, concurrency, rollback) and `tests/auth/emailVerificationRoutes.test.ts` (HTTP boundary).

## Vocabulary

### `POST /api/learning/vocabulary/content`

- Source: `src/app/api/learning/vocabulary/content/route.ts`, delegating to `src/learning-modules/vocabulary/server/handleVocabularyContentRequest.ts`.
- Request: strict discriminated JSON. Manifest is exactly `{ contentType: "manifest", wordListId }`; screen requests contain exact opaque lesson/capability fields, with `exampleIndex` for recap.
- Learner binding: manifest creates/reuses the `brain-genius-learner` HttpOnly cookie. Later requests bind cookie, lesson, capability, projection type, screen step, and recap index.
- Success: `200` narrow projection with `Cache-Control: no-store`. A manifest includes opaque word IDs, seed, lesson, and next capability. Screen responses include only current-screen content and a rotated capability.
- Errors: malformed JSON/input `400`; invalid capability `400`; unknown list/content `404`.
- Side effects: process-local lesson/capability/attempt state; bounded cached replay of the same content capability.
- Tests: `tests/api/vocabularyContentRoute.test.ts`, `tests/api/vocabularyLearnerSession.test.ts`, `tests/vocabulary/Vocabulary.test.ts`, and the route integration/E2E tests.

### `POST /api/learning/vocabulary/submit-answer`

- Source: `src/app/api/learning/vocabulary/submit-answer/route.ts` plus `src/app/api/learning/vocabulary/submit-answer/handleVocabularyAnswerRequest.ts`.
- Request: strict definition `{ answerType, attemptId, selectedChoiceId }` or spelling `{ answerType, attemptId, answer }`; no unknown fields.
- Learner binding: anonymous learner cookie plus active process-local attempt, lesson, word, and answer type.
- Success: definition returns only `{ answerType, correctChoiceId }`; spelling returns `{ answerType, correct }` and includes `correctAnswer` only after an incorrect grade.
- Errors: malformed JSON, invalid shape, unknown/stale/cross-boundary attempt, changed duplicate, or failed grading all return the same `400` style.
- Side effects/cache: records confirmed progress and exact duplicate result in memory; no explicit cache header.
- Tests: `tests/api/vocabularySubmitAnswerRoute.test.ts`, `tests/api/evaluateVocabularyAnswer.test.ts`, parser/module tests, integration, and E2E.

### `POST /api/learning/vocabulary/speech`

- Source: `src/app/api/learning/vocabulary/speech/route.ts`, delegating to `src/learning-modules/vocabulary/server/handleVocabularySpeechRequest.ts`.
- Request: exactly `{ reference: non-empty string }`; reference is an opaque spelling attempt.
- Learner binding: requires the matching learner cookie and active spelling attempt, then resolves canonical text on the server.
- Success: `200 audio/mpeg`, `Cache-Control: no-store`.
- Errors: JSON/shape/reference errors `400`; provider configuration `500`; upstream provider `502`; unexpected `500`, all without canonical text.
- Tests: `tests/api/vocabularySpeechRoute.test.ts` and speech-controller tests.

## Text-to-speech

### `POST /api/tts`

- Source: `src/app/api/tts/route.ts`; Node runtime.
- Auth: none currently.
- Request: strict `{ text, tts }`; text is non-blank and at most 4,000 UTF-8 bytes. Google and Lemonfox configurations must exactly match the server allowlist.
- Success: `200 audio/mpeg`, `Cache-Control: no-store`.
- Errors: malformed/invalid request `400`; missing provider config `500`; upstream failure `502`; unexpected `500`.
- Side effects/security: may call a paid provider. It has no rate limit, quota, concurrency, or usage accounting and is not production-ready with paid credentials.
- Tests: `tests/api/ttsRoute.test.ts` plus all `tests/tts/`.

## Stripe

### `POST /api/webhooks/stripe`

- Source: `src/app/api/webhooks/stripe/route.ts`.
- Auth: verifies `stripe-signature` over the raw request body with `STRIPE_WEBHOOK_SECRET`.
- Request/events: handles `checkout.session.completed`, `customer.subscription.updated`, and `customer.subscription.deleted`; ignores other verified events.
- Success: always returns `200 { received: true }` after the switch. Completed paid checkout upserts subscription/customer/price/status data; update/delete synchronizes status, period end, cancellation, price, and tier.
- Errors: missing signature/config or invalid signature returns `400`.
- Security/limitations: unknown configured price maps to no paid tier, but many missing-data/processing branches are silently acknowledged. No stored event ID provides durable idempotency.
- Tests: no focused webhook tests.
