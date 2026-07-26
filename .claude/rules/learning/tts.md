---
paths:
  - "src/app/(app)/(learning)/**/*"
  - "src/lib/learning-engine/speech/**/*"
  - "src/lib/learning-engine/{actions,screens}/**/*"
  - "src/lib/learning-engine/errors/*Tts*.ts"
  - "src/app/api/tts/**/*"
  - "src/app/api/learning/**/speech/**/*"
  - "src/learning-modules/**/*"
  - "src/components/learning-engine/windows/**/*"
  - "src/types/learning.ts"
  - "tests/tts/**/*"
  - "tests/**/*{Tts,tts,Speech,speech}*.{ts,tsx}"
---

# Text-to-Speech

## Ownership

The learning module owns:

- What subject content should be spoken.
- When its requested screen should speak.
- Subject-specific pronunciation and instructional wording.
- Resolving its opaque protected speech references on the server.

The shared Learning Engine owns:

- The generic `speak` action and declarative speech contract.
- Speech queue behavior.
- Client playback state.
- Cancellation when the route or active screen changes.
- Posting opaque references to approved same-origin module endpoints.
- Playing returned audio without interpreting the reference.

The server provider layer owns:

- Validating requested providers, models, voices, and languages against the approved supported configuration.
- Dispatching only validated configurations to the selected provider.
- Provider credentials and authentication.
- Request validation and timeouts.
- Validating upstream status and returned audio.
- Translating provider failures into safe server errors.

## Client Safety

- Keep Google and Lemonfox credentials and provider code server-only.
- Learning Windows and browser modules must not call providers directly.
- Do not expose provider error payloads, credentials, access tokens, canonical protected text, or internal mappings to the browser.
- Validate `SpeakActionPayload` before using it.
- A text speech request may contain only content already approved to be public for the active screen.
- When spoken content is the graded answer, use `{ source: { endpoint, reference } }` rather than browser-visible text.

## Opaque Speech Sources

- The reference must not contain, reveal, or deterministically encode the canonical answer.
- Bind it to the learner, lesson, exercise, answer type, and active attempt.
- Invalidate it when the attempt is graded, expires, or is replaced.
- Validate the endpoint as an approved same-origin path after canonical URL parsing.
- Reject cross-learner, wrong-type, stale, malformed, and unknown references with the same generic safe error style.
- The module server resolves the text and calls the shared server provider service; the shared client engine never learns what the reference means.
- Protected audio responses must use `Cache-Control: no-store` and must not expose the answer through headers, filenames, URLs, or metadata.

## Playback and Concurrency

- Cancel stale audio and pending speech when the route or active screen changes.
- Prevent a slower earlier request from starting playback after a newer screen or request becomes active.
- Keep `isSpeaking` synchronized with the active request and clear it on completion, cancellation, and failure.
- Preserve the established queue behavior for arrays of public text.
- Repeated clicks must not create overlapping playback outside the approved controller behavior.
- Use abort signals and stale-request identity checks where supported.
- Revoke temporary audio object URLs on completion, cancellation, replacement, and failure.

## Cost and Abuse Controls

- Before exposing paid synthesis publicly in production, require an authenticated Brain Genius user or an explicitly approved anonymous-trial policy with strict limits.
- Apply per-user or per-learner rate limits, quotas, concurrency limits, and usage tracking appropriate to the provider's cost.
- Enforce approved request-body, text-byte, queue-length, and generated-audio limits.
- Never allow the browser to select an arbitrary provider, model, voice, language, endpoint, or credential outside the server allowlist.
- Do not silently retry a paid synthesis request when doing so could create duplicate provider charges.
- Fail closed when authentication, quota enforcement, supported configuration, or required provider credentials are unavailable.

## Provider Responses

- Apply an explicit timeout to upstream requests.
- Check response status before reading audio.
- Validate content type and ensure the response contains usable audio bytes.
- Enforce an approved response-size limit before buffering unbounded provider audio.
- Treat malformed or empty provider output as an upstream error.
- Log provider failures server-side without credentials, protected canonical text, or full sensitive payloads.
- Return the established safe status and response shape to the client.

## Verification

- Test payload parsing, supported and unsupported configurations, provider errors, timeouts, invalid audio, cancellation, queue order, stale requests, overlapping requests, route changes, screen changes, and state cleanup.
- Test authentication, quotas, request limits, concurrency limits, and usage tracking when production access controls are introduced or changed.
- Test opaque speech references for valid ownership and every invalid binding.
- Confirm no canonical graded answer appears in browser requests, props, URLs, logs, or bundles.
