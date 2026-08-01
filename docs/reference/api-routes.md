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

Every route in this section first calls the shared `authorizeLearningModuleAccess("vocabulary")` boundary (`src/app/api/learning/vocabulary/<route>/route.ts` exports the wrapped handler, e.g. `handleVocabularyContentRouteRequest`, that the thin `POST` export delegates to) before any of its own content, grading, or speech behavior runs. That check independently returns `401` (no session), `403` (no current allowed tier), or `503` (unavailable/unregistered), all generic with `Cache-Control: no-store`, before content creation, capability mutation, grading, or paid TTS usage acquisition. See [Learning Module access](../architecture/security-and-server-boundaries.md#learning-module-access). Only after that check grants access does each route's own behavior below apply.

### `POST /api/learning/vocabulary/content`

- Source: `src/app/api/learning/vocabulary/content/route.ts`, delegating to `src/learning-modules/vocabulary/server/handleVocabularyContentRequest.ts`.
- Request: strict discriminated JSON. Manifest is exactly `{ contentType: "manifest", learningId }`, where `learningId` is a real `ModVocabLearning.id`; refill is exactly `{ contentType: "word-refill", lessonId }`; screen requests contain exact opaque lesson/capability fields, with `exampleIndex` for recap.
- Authorization: the manifest and every later request re-verify `ModVocabLearning.learnerUserId` against the trusted NextAuth session user ID (from the module-access grant, never the browser) through `src/learning-modules/vocabulary/server/vocabularyLearningStore.ts`. Ownership of the underlying `ModVocabList` is never required. A missing/unauthorized learning ID and another learner's learning ID return the identical `404`.
- Durable initialization: the manifest calls `initializeVocabularyLearning`, which ensures `ModVocabWordProgress` rows for every current list word (without overwriting existing progress), safely ends any prior active `ModVocabSession`, and starts a new one. Later requests bind `userId`, lesson, capability, projection type, screen step, and recap index.
- Bounded content loading: canonical `ModVocabListWord` content is hydrated for the learner's actual progress window (first five words for a new learning; every word up through the highest position with recorded progress for a resumed one), never the full list. A `word-refill` request returns exactly one next ordered word's content (or `wordId: null` at the end of the list) once server-side lesson state confirms a mastered word opened an active-pool slot; refills are idempotent.
- Success: `200` narrow projection with `Cache-Control: no-store`. A manifest includes opaque word IDs, seed, lesson, next capability, `totalWordCount`, the authoritative `progress`/panel snapshot, and a compact durable-resume hydration payload. Screen responses include only current-screen content and a rotated capability; definition/spelling practice content durably persists its `ModVocabAttempt`/`ModVocabAttemptChoice` rows before returning, using their real IDs as the public opaque attempt/choice identity. A refill response is `{ contentType: "word-refill", wordId }`.
- Errors: module access `401`/`403`/`503` (see above); malformed JSON/input `400`; invalid capability `400`; unknown/unauthorized learning or unavailable content `404`; a database failure (not a missing learning) `503`.
- Side effects: `ModVocabWordProgress`/`ModVocabSession`/`ModVocabAttempt`/`ModVocabAttemptChoice` writes are durable; the screen-scoped capability chain and small per-lesson content cache remain a disposable, bounded-lifetime, single-process cache.
- Tests: `tests/api/vocabularyContentRoute.test.ts`, `tests/vocabulary/Vocabulary.test.ts`, `tests/vocabulary/vocabularyDatabaseLoading.test.ts`, `tests/vocabulary/vocabularyListStore.integration.test.ts`, `tests/vocabulary/vocabularyLearningStore.integration.test.ts`, `tests/api/vocabularyModuleAccessGate.test.ts`, and the route integration/E2E tests.

### `POST /api/learning/vocabulary/submit-answer`

- Source: `src/app/api/learning/vocabulary/submit-answer/route.ts` plus `src/app/api/learning/vocabulary/submit-answer/handleVocabularyAnswerRequest.ts`.
- Request: strict definition `{ answerType, attemptId, selectedChoiceId }` or spelling `{ answerType, attemptId, answer }`; no unknown fields. `attemptId` is the durable `ModVocabAttempt.id`.
- Authorization: identity is the authenticated session `userId` (no anonymous cookie). Grading (`vocabularyLearningStore.commitVocabularyAnswer`) loads the durable attempt through its session/learning chain, re-verifies `ModVocabLearning.learnerUserId` against the trusted session user, and grades only from the attempt's own durably stored snapshot (never a fresh database/distractor query).
- Durable commit: a newly answered attempt updates `ModVocabAttempt`, `ModVocabWordProgress`, `ModVocabLearning` counters, `ModVocabSession` counters, and `ModVocabDailyPractice` together in one transaction. An exact-duplicate submission for an already-answered attempt replays its stored result without incrementing anything again; a modified duplicate is rejected. A failed write leaves the attempt retryable and changes nothing.
- Success: definition returns `{ answerType, correctChoiceId, progress }`; spelling returns `{ answerType, correct, progress }` and includes `correctAnswer` only after an incorrect grade. `progress` is the authoritative `VocabularyProgressSnapshot` (counters, learning status, and the full three-section panel) the browser mirrors and publishes to the module status panel.
- Errors: module access `401`/`403`/`503` (see above); malformed JSON, invalid shape, unknown/stale/cross-boundary attempt, changed duplicate, or failed grading all return the same `400` style; a database failure returns `503`.
- Side effects/cache: durable database writes as above; no explicit cache header.
- Tests: `tests/api/vocabularySubmitAnswerRoute.test.ts`, `tests/vocabulary/vocabularyProgressProjection.test.ts`, `tests/vocabulary/vocabularyLearningStore.integration.test.ts`, `tests/api/vocabularyModuleAccessGate.test.ts`, parser/module tests, integration, and E2E.

### `POST /api/learning/vocabulary/speech`

- Source: `src/app/api/learning/vocabulary/speech/route.ts`, delegating to `src/learning-modules/vocabulary/server/handleVocabularySpeechRequest.ts`.
- Auth: current Vocabulary module access (see above), then an authenticated NextAuth session plus current Stage 1 entitlement (direct or child-inherited) through the shared paid TTS usage policy in `src/lib/learning-engine/speech/ttsUsageService.ts`; requests are classified `VOCABULARY_PROTECTED`. These are two independent checks with different tier rules: module access requires `MONTHLY`/`LIFETIME`/`ADMIN`, while the downstream TTS entitlement also allows an active `FREE_TRIAL`.
- Request: exactly `{ reference: non-empty string }`; reference is the durable, still-`ACTIVE` spelling `ModVocabAttempt.id`.
- Authorization: `vocabularyLearningStore.findVocabularySpellingAttemptForSpeech` re-verifies the attempt's session/learning chain against the trusted session user ID, then resolves canonical text from the durable attempt/list-word row (never a fresh database scan for a matching word). Text metrics are computed only after server-side resolution; the text itself is never persisted.
- Success: `200 audio/mpeg`, `Cache-Control: no-store`.
- Errors: module access `401`/`403`/`503` (see above); JSON/shape/reference errors `400`; missing session `401`; missing user, no entitlement, or manual TTS suspension `403`; burst/concurrency/ten-hour emergency limits `429` with integer `Retry-After`; provider configuration `500`; upstream provider `502`; usage-accounting or auth/entitlement database boundary unavailable `503`. All error responses are generic, carry `Cache-Control: no-store`, and never contain canonical text or usage state.
- Tests: `tests/api/vocabularySpeechRoute.test.ts`, `tests/api/vocabularyModuleAccessGate.test.ts`, and speech-controller tests.

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
