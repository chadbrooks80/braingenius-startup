# API Routes

All request bodies are untrusted. Unless noted, handlers do not set explicit cache headers.

## Authentication and account recovery

### `GET|POST /api/auth/[...nextauth]`

- Source: `src/app/api/auth/[...nextauth]/route.ts`; delegates to `src/auth.ts`.
- Contract: NextAuth v4 endpoints for Google OAuth, Credentials sign-in, JWT sessions, callbacks, and adapter operations.
- Identity/state: Prisma adapter plus JWT session strategy. Session projection includes user ID and onboarding state, not password/provider-token fields.
- Errors/cache/tests: NextAuth owns protocol response/status behavior. There are no focused auth route tests in `tests/`.

### `POST /api/auth/password-reset/request`

- Source: `src/app/api/auth/password-reset/request/route.ts`; delegates URL construction to `buildPasswordResetUrl()` and serialized grant creation to `issuePasswordResetToken()`.
- Request: exactness is not enforced; Zod reads a canonicalized (`CanonicalEmailSchema`) `email` string. Invalid JSON/input, unknown accounts, OAuth-only accounts, rate-limited requests, and eligible requests all return `200 { success: true }`.
- Side effects: after validating the trusted origin, generates token material; for an existing password account outside the 60-second interval, a same-user locked transaction re-reads eligibility/cooldown and creates at most one SHA-256 token hash expiring in one hour. Only its winner attempts post-commit Resend delivery.
- Security/cache/tests: generic response reduces enumeration; raw token exists only in the email URL. Missing origin and transaction/provider failures create no fake success grant or sensitive log and retain the same response. `tests/auth/appBaseUrl.test.ts`, `tests/auth/passwordResetRequest.test.ts`, and the guarded real-database harness.

### `POST /api/auth/password-reset/confirm`

- Source: `src/app/api/auth/password-reset/confirm/route.ts`; public endpoint.
- Request: Zod object with a canonicalized (`CanonicalEmailSchema`) `email`, non-empty `token`, and password of at least eight characters. Extra fields are accepted by default Zod object behavior.
- Success: `200 { success: true }`; bcrypt runs before one same-user locked transaction conditionally claims the exact submitted unused/unexpired token, changes the password, clears `mustResetPassword`, and marks sibling unused tokens used.
- Errors: malformed/invalid input or a missing, used, expired, email-mismatched, duplicate, or losing concurrent token returns `400` with a safe error. Failures after claim roll the whole transaction back.
- Tests: `tests/auth/passwordResetConfirm.test.ts`.

### `POST /api/auth/resend-verification-code`

- Source: `src/app/api/auth/resend-verification-code/route.ts`; public endpoint.
- Request: canonicalized (`CanonicalEmailSchema`) Zod `email`; invalid input, unknown email, already-verified account, cooldown-active request, and eligible-unverified-account request all return the identical generic `200 { success: true }` with `Cache-Control: no-store`.
- Success/side effects: for an eligible unverified parent outside the silent cooldown, one same-user locked transaction re-checks state/cooldown, invalidates unused codes, and creates a hashed four-digit replacement. Only its winner attempts post-commit email delivery; replacement failure rolls invalidation back.
- Security/tests: transaction/provider failures preserve the generic response and fixed non-sensitive logs. `tests/auth/emailVerificationRoutes.test.ts` and the guarded real-database harness.

### `POST /api/auth/verify-email-code`

- Source: `src/app/api/auth/verify-email-code/route.ts`; public endpoint that delegates to `attemptEmailVerification()` in `src/lib/email-verification.ts`.
- Request: canonicalized (`CanonicalEmailSchema`) Zod `email` and exactly four-character `code`.
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
- Auth: authenticated NextAuth session plus current Stage 1 entitlement (direct or child-inherited) through the shared paid TTS usage policy in `src/lib/learning-engine/speech/ttsUsageService.ts`; requests are classified `VOCABULARY_PROTECTED`.
- Request: exactly `{ reference: non-empty string }`; reference is an opaque spelling attempt.
- Learner binding: requires the matching learner cookie and active spelling attempt, then resolves canonical text on the server. Text metrics are computed only after server-side resolution; the text itself is never persisted.
- Success: `200 audio/mpeg`, `Cache-Control: no-store`.
- Errors: JSON/shape/reference errors `400`; missing session `401`; missing user, no entitlement, or manual TTS suspension `403`; burst/concurrency/ten-hour emergency limits `429` with integer `Retry-After`; provider configuration `500`; upstream provider `502`; usage-accounting or auth/entitlement database boundary unavailable `503`. All error responses are generic, carry `Cache-Control: no-store`, and never contain canonical text or usage state.
- Tests: `tests/api/vocabularySpeechRoute.test.ts` and speech-controller tests.

## Text-to-speech

### `POST /api/tts`

- Source: `src/app/api/tts/route.ts`, delegating to `src/lib/learning-engine/speech/handleTtsSynthesisRequest.ts`; Node runtime.
- Auth: authenticated NextAuth session plus current Stage 1 entitlement (direct or child-inherited), manual-suspension checks, and durable usage accounting through the shared paid TTS usage policy; requests are classified `PUBLIC_TEXT`.
- Request: strict `{ text, tts }`; text is non-blank and at most 5,000 UTF-8 bytes per provider chunk. This is a chunk boundary, not a passage limit — the client splits long public teaching passages into sequential provider-safe chunks. Google and Lemonfox configurations must exactly match the server allowlist.
- Success: `200 audio/mpeg`, `Cache-Control: no-store`.
- Errors: malformed/invalid request or an oversized chunk `400`; missing session `401`; missing user, no entitlement, or manual TTS suspension `403`; more than 120 accepted attempts per UTC minute, an eleventh concurrent attempt, or usage beyond an estimated ten hours (90,000 words) in one UTC day `429` with integer `Retry-After`; missing provider config `500`; upstream failure (including oversized provider responses) `502`; usage accounting unavailable `503`. All error responses are generic with `Cache-Control: no-store`.
- Side effects/security: paid provider calls happen only after atomic PostgreSQL paid-attempt acquisition (transactionally re-derived direct/stable-parent entitlement, caller-minute/caller-day/entitlement-principal-day counters, and a 30-second concurrency lease). Audio returns only after the exact unexpired lease is claimed and success/generated-byte accounting commits; missing, expired, or unavailable completion accounting returns generic `503`. Crossing an estimated five hours (45,000 words) in a UTC day records one durable warning without changing the response. There is no normal daily request/byte cap. No spoken text or audio is stored.
- Tests: `tests/api/ttsRoute.test.ts` plus all `tests/tts/`.

## Stripe

### `POST /api/webhooks/stripe`

- Source: `src/app/api/webhooks/stripe/route.ts`.
- Auth: verifies `stripe-signature` over the raw request body with `STRIPE_WEBHOOK_SECRET`.
- Request/events: handles `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `customer.subscription.updated`, and `customer.subscription.deleted`; ignores other verified events.
- Success: returns `200 { received: true }` after a supported event synchronizes or an unsupported verified event is ignored. Checkout events retrieve authoritative Stripe state through the shared billing service. Expected completed-but-unpaid state stays pending without mutation.
- Errors: missing signature/config or invalid signature returns `400`; unexpected provider/database failure while processing a supported event returns `500 { error: "Webhook processing failed" }` so Stripe can retry.
- Security/limitations: monthly status is the Stripe Subscription status, not Checkout payment status. Unknown prices and inactive/expired states clear paid tier. Responses contain no protected Stripe identifiers or payloads. No stored event ID or full out-of-order reconciliation exists; audit #27 remains deferred.
- Tests: `tests/billing/stripeWebhook.test.ts` plus shared service coverage in the other billing tests.
