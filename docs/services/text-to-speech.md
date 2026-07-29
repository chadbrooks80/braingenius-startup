# Text-to-Speech

## Ownership and data flow

Modules decide what to speak and whether text is public. The shared Learning Engine validates `speak`, manages queue/playback/cancellation, and calls same-origin APIs. A deterministic client-safe chunker splits long public passages into provider-safe pieces. Route handlers authenticate the caller and delegate to one shared server-owned paid-usage policy before any provider dispatch. Server provider modules validate configurations, keep credentials server-only, call Google or Lemonfox through bounded response reads, and normalize results to MP3 bytes.

Public flow:

```text
window/ScreenRequest → speak { text, tts } → chunkSpeechText() → sequential /api/tts chunks
→ auth + entitlement + suspension → paid usage acquisition → provider → completion accounting → audio blob → Audio
```

Protected spelling flow:

```text
window/ScreenRequest → speak { source: { endpoint, reference } }
→ /api/learning/vocabulary/speech
→ auth + entitlement + suspension → learner/attempt binding → server-only word resolution
→ paid usage acquisition → provider → completion accounting → audio
```

## Client playback and chunking

`SpeechPlaybackController` normalizes non-blank queue entries, splits each through `chunkSpeechText()` (`src/lib/learning-engine/speech/chunkSpeechText.ts`), and plays the resulting chunks sequentially through one reusable `Audio` element. The chunker prefers paragraph boundaries, then sentence boundaries, then whitespace, never splits a normal word, and caps each chunk at 5,000 UTF-8 bytes — the provider-call boundary, not a maximum passage length. A passage containing one uninterrupted token over that limit fails safely (`speakText` returns `false`, no request is sent) instead of producing corrupted speech.

A new request cancels the old generation, aborts the in-flight fetch, pauses audio, settles the pending promise, and revokes object URLs; cancellation between chunks stops any remaining chunk fetches. Route/screen changes call the same cancellation service. A silent one-sample WAV primes autoplay.

Fetch/non-OK/blob/playback failures stop the queue and call the completion callback; the controller does not expose a user-visible error. `isSpeaking` becomes true only when playback starts and is cleared on completion/failure.

## Shared paid-usage policy

`src/lib/learning-engine/speech/ttsUsageService.ts` is the one server-owned boundary both `/api/tts` and `/api/learning/vocabulary/speech` call before any provider dispatch:

1. **Authentication and entitlement** (`authorizePaidTtsCaller`): requires a non-empty `session.user.id`, re-reads the caller from Prisma, and evaluates entitlement through the unchanged Stage 1 evaluator (`src/lib/billing/entitlement.ts`) via the narrow resolver in `src/lib/billing/user-entitlement.ts`. A `CHILD` with no direct entitlement inherits from the first currently entitled linked parent (stable ascending parent-ID order); that parent becomes the *entitlement principal* while the child stays the *caller*. Missing session, missing database user, no entitlement, or database/evaluator failure denies before any provider call.
2. **Manual suspension**: an active `ttsSuspendedAt` on the caller *or* the entitlement principal denies generically. Suspending the principal is the deliberate way to pause TTS for an entire entitled family after review; it never happens automatically.
3. **Acquisition** (`acquirePaidTtsAttempt`): one interactive Prisma transaction per provider chunk. It locks the caller plus the caller's currently linked parents in deterministic user-ID order, locks the current `ParentStudent` relationship rows and existing subscription rows, and derives authorization again from that protected database state. Direct access requires the locked caller to be the claimed principal and to have current direct Stage 1 entitlement. Inherited access requires the caller still to be `CHILD`, the exact link still to exist, and the claimed principal still to be the first currently entitled linked parent in ascending parent-ID order. A changed role, removed link, stale/arbitrary principal pair, suspension, or entitlement failure denies before usage or provider dispatch. The same transaction deletes expired leases, then enforces in order: caller-minute burst (120 accepted attempts per fixed UTC minute), caller concurrency (10 unexpired leases), and the caller-day ten-hour cutoff (more than 90,000 accepted words denies; exactly 90,000 is allowed). Crossing more than 45,000 accepted caller words that UTC day creates one durable `FIVE_HOUR_WARNING` alert without denying. All accepted counters (requests/bytes/characters/words) and a 30-second lease are committed atomically before the provider call.
4. **Completion**: on provider success, the exact still-unexpired lease must be claimed and success/generated-audio-byte counters committed before audio can return; on failure, the exact still-unexpired lease must be claimed and failure counters committed before the provider error is translated. The first confirmed completion succeeds, while a duplicate cannot double-count. A missing, cleaned, expired, or otherwise unconfirmed lease is not proof of completion and fails closed as generic `503`; audio is never returned in that state. Accepted usage from a request that reached acquisition is never refunded, including on provider failure or a crashed invocation (an unclaimed lease expires after 30 seconds and is cleaned during completion or a later acquisition).
5. **No normal daily request/byte/character cap.** Only burst, concurrency, and the ten-hour word cutoff can deny; the five-hour warning is reporting-only and never changes the HTTP/audio response.

Durable state lives in three Prisma models (`TtsUsageBucket`, `TtsUsageAlert`, `TtsRequestLease`) plus narrow `ttsSuspendedAt`/`ttsSuspensionReasonCode` fields on `User` — see [Database Schema](../reference/database-schema.md). `src/lib/learning-engine/speech/ttsUsagePolicy.ts` holds the fixed numeric policy and injectable-time UTC window math; `src/lib/learning-engine/speech/ttsUsageReport.ts` is a server-only (non-browser) authorized aggregation query for operator review; `src/lib/learning-engine/speech/ttsAccessSuspension.ts` is the narrow manual suspend/lift boundary.

Both `/api/tts` (`handleTtsSynthesisRequest.ts`) and the Vocabulary speech handler classify their requests as `PUBLIC_TEXT` or `VOCABULARY_PROTECTED` respectively and share identical HTTP status/typed-denial translation (`ttsDenialResponse`, `paidTtsFailureResponse`).

## Validation and providers

Each provider chunk (public or server-resolved protected text) contains exactly `text` and `tts`, with non-blank text limited to 5,000 UTF-8 bytes — a per-chunk boundary, not a passage limit. Supported configurations are:

- Google: `chirp-3-hd`, `en-US-Chirp3-HD-Aoede`, `en-US`;
- Lemonfox: voice `sarah`.

Google uses service-account JWT exchange and caches the access token by client email until one minute before expiry. Lemonfox uses a bearer API key. Google OAuth, Google synthesis, and Lemonfox synthesis each keep a fixed 10-second upstream deadline active from request dispatch through bounded body consumption and decoding; receiving response headers does not clear the deadline. The provider layer validates success, content type, and non-empty MP3 content and returns typed configuration/upstream errors. The 10-second operation deadline remains strictly inside the 30-second database lease.

Provider responses are read through `readBoundedResponseBody()` (`src/lib/learning-engine/speech/providers/readBoundedResponseBody.ts`): a valid declared `Content-Length` over the limit is rejected before any buffering, and the body is otherwise streamed with a running byte count that cancels the reader and throws as soon as the limit is exceeded — a missing, malformed, or falsely small declared length can never bypass this. Limits: Google synthesis JSON at most 7,100,000 bytes (validated as `application/json`), Google OAuth token JSON at most 65,536 bytes, decoded/raw MP3 at most 5 MiB per provider response chunk. Google additionally rejects a base64 `audioContent` string whose maximum possible decoded size exceeds 5 MiB before decoding.

Variables: `GOOGLE_TTS_CLIENT_EMAIL`, `GOOGLE_TTS_PRIVATE_KEY`, optional `GOOGLE_TTS_PROJECT_ID`, and `LEMONFOX_API_KEY`. No new environment variables were added for usage limits — the numeric policy is fixed in code, not configurable.

## Security and limitations

Protected Vocabulary speech accepts only an opaque active spelling attempt bound to the learner cookie; canonical text is resolved server-side and passed transiently into the shared usage/provider service without being persisted, reported, or logged. Both routes' audio is `no-store`.

A server-only report and manual suspension boundary exist for authorized operational review (`ttsUsageReport.ts`, `ttsAccessSuspension.ts`); there is no browser-visible admin or learner-facing usage UI, and no permanent suspension is ever applied automatically.

A future saved-audio cache is intentionally not implemented: the codebase documents (but does not build) a cache-lookup seam after authentication/entitlement/suspension/text-resolution and before paid-attempt acquisition, so a later approved feature can bypass paid accounting only on a verified cache hit.

Tests cover parsing/allowlists, provider success/failure/oversized and stalled-body responses, absent/falsely-small length streaming guards and reader cancellation, queue order/chunking, cancellation/stale requests, object URL cleanup, protected-source request shape, Vocabulary speech binding, authentication/entitlement/suspension boundaries, transactional role/link/stable-parent revalidation, exact lease completion/expiry, deterministic word/byte accounting, warning/cutoff/burst/concurrency boundaries (including concurrent-race safety), and durable reporting — see `tests/tts/`, `tests/api/ttsRoute.test.ts`, `tests/api/vocabularySpeechRoute.test.ts`, and `tests/billing/userEntitlement.test.ts`.
