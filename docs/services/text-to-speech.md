# Text-to-Speech

## Ownership and data flow

Modules decide what to speak and whether text is public. The shared Learning Engine validates `speak`, manages queue/playback/cancellation, and calls same-origin APIs. Server provider modules validate configurations, keep credentials server-only, call Google or Lemonfox, and normalize results to MP3 bytes.

Public flow:

```text
window/ScreenRequest → speak { text, tts } → /api/tts → provider → audio blob → Audio
```

Protected spelling flow:

```text
window/ScreenRequest → speak { source: { endpoint, reference } }
→ /api/learning/vocabulary/speech
→ learner/attempt binding → server-only word resolution → provider → audio
```

## Client playback

`SpeechPlaybackController` normalizes non-blank queue entries and plays them sequentially through one reusable `Audio` element. A new request cancels the old generation, aborts fetch, pauses audio, settles the pending promise, and revokes object URLs. Route/screen changes call the same cancellation service. A silent one-sample WAV primes autoplay.

Fetch/non-OK/blob/playback failures stop the queue and call the completion callback; the controller does not expose a user-visible error. `isSpeaking` becomes true only when playback starts and is cleared on completion/failure.

## Validation and providers

Public requests contain exactly `text` and `tts`, with non-blank text limited to 4,000 UTF-8 bytes. Supported configurations are:

- Google: `chirp-3-hd`, `en-US-Chirp3-HD-Aoede`, `en-US`;
- Lemonfox: voice `sarah`.

Google uses service-account JWT exchange and caches the access token by client email until one minute before expiry. Lemonfox uses a bearer API key. Both use 10-second upstream timeouts, validate success and non-empty MP3 content, and return typed configuration/upstream errors.

Variables: `GOOGLE_TTS_CLIENT_EMAIL`, `GOOGLE_TTS_PRIVATE_KEY`, optional `GOOGLE_TTS_PROJECT_ID`, and `LEMONFOX_API_KEY`.

## Security and limitations

Protected Vocabulary speech accepts only an opaque active spelling attempt bound to the learner cookie. Audio is `no-store`; canonical text never appears in the request or response.

The generic `/api/tts` route is unauthenticated and has no per-user rate limits, quota, concurrency guard, usage tracking, or explicit maximum response byte size. Source comments say it must not be exposed with paid credentials in production until those controls exist.

Tests cover parsing/allowlists, provider success/failure, queue order, cancellation/stale requests, object URL cleanup, protected-source request shape, and Vocabulary speech binding.
