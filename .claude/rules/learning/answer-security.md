---
paths:
  - "src/app/(app)/(learning)/**/*"
  - "src/app/api/learning/**/*"
  - "src/app/api/tts/**/*"
  - "src/components/learning-engine/windows/**/*"
  - "src/lib/learning-engine/**/*"
  - "src/learning-modules/**/*"
  - "src/types/learning.ts"
  - "tests/{security,api,integration,e2e,vocabulary,multiple-choice,spelling,tts}/**/*"
---

# Learning Answer Security

## Minimum Browser Data

- Before grading, the browser may receive only the minimum public data needed to render the current screen and submit the current interaction.
- For a graded multiple-choice screen, send only the public prompt, choices for that question, and an opaque attempt ID.
- For a spelling screen, send the public prompt and opaque attempt or speech reference without the canonical written answer.
- Do not preload or retain a complete answer-bearing lesson record for later screens.
- Intentionally displayed teaching and recap content may be public only when the active screen needs it.

## No Correctness Leakage

Before submission, the browser must not receive or deterministically infer:

- A correct choice ID, canonical spelling, answer value, correctness flag, or server answer record.
- Correctness through array position, sorting, naming, IDs, metadata, timestamps, filenames, URLs, cache keys, serialized state, hidden props, DOM attributes, accessibility text, or predictable generation.
- Correctness by joining choices to another public object, earlier bulk response, teaching projection, client fixture, or browser bundle.
- Provider credentials, internal capability mappings, database records, or server implementation details.

- Evaluate security across all browser-visible props, responses, requests, bundles, caches, and prior lesson data together.
- Removing an explicit `correctAnswer` field is insufficient when another deterministic join reveals it.
- Revealing the correct answer after a confirmed incorrect grade is allowed only through the approved feedback contract.

## Opaque Capabilities and Attempts

- Opaque IDs must be unguessable and capability-scoped.
- Bind a capability or attempt to the authenticated or anonymous learner, lesson, subject item, projection, screen occurrence, and answer type required by that operation.
- Enforce a bounded lifetime and retire capabilities when replaced, expired, or no longer needed. An exact replay of the same authorized content request may return its cached public projection only within the explicitly bounded retry contract.
- Do not expose reusable canonical record IDs when a screen-scoped capability can authorize the exact operation.
- Reject cross-learner, cross-lesson, cross-screen, wrong-answer-type, stale, consumed, unknown, and altered references.
- Return a generic safe failure without revealing which binding failed.
- Exact duplicate answer delivery may be idempotent only within the explicitly bounded retry contract. A changed duplicate must be rejected.
- Derive learner identity from the authenticated server session or a server-issued protected learner cookie, never from a learner ID supplied in the request payload.
- Anonymous learner cookies must use cryptographically random identifiers and appropriate `HttpOnly`, `SameSite`, path, and production `Secure` attributes.
- Do not rely on process-local memory for production capability, attempt, or idempotency guarantees when requests may reach different server instances. Use an approved shared store before relying on those guarantees in a multi-instance deployment.

## Strict Submission Validation

- The owning module defines the discriminated answer variants.
- The server independently invokes the authoritative module parser; browser validation never replaces server validation.
- Each variant must require all of its fields and reject unknown fields, wrong-variant fields, invalid values, and malformed opaque IDs.
- Definition and spelling submissions must remain distinct variants.
- Normalize only the fields and normalization behavior approved for that variant.
- Retrieve canonical answers only after learner, lesson, attempt, type, and capability validation succeeds.

## Audio-Based Answers

- Required pronunciation may intentionally reveal an answer by sound while the canonical written value remains server-only.
- Never send the canonical answer as TTS text, hidden content, metadata, an action payload, filename, URL, accessibility string, identifier, cache value, or serialized state.
- Use an opaque server-resolved speech reference for a graded spelling prompt.
- The module server resolves the reference to canonical text and calls the shared server-side TTS service.
- The browser receives audio bytes or a generic safe error, never the resolved canonical text.

## URLs and Requests

- A module-provided speech or content endpoint must be an approved same-origin application endpoint.
- Parse URLs canonically before validation.
- Reject unsupported schemes, origins, credentials, fragments, backslashes, encoded path confusion, and paths outside the approved endpoint family.
- Send only the opaque reference required by that endpoint.
- State-changing requests authenticated through cookies must preserve the established same-origin and CSRF protections.

## Submission State

Use recoverable submission behavior:

```text
idle → pending → success
             ↘ error → explicit retry
```

- Do not advance on a failed request.
- Do not silently retry a state-changing answer submission.
- Preserve the active attempt after a recoverable failure.
- Prevent duplicate clicks from creating duplicate progress.
- Apply a response only when it belongs to the active attempt and screen occurrence.

## Security Verification

- Every graded question type requires an adversarial test that attempts to reconstruct the answer from all browser-visible data.
- Inspect runtime network requests and public props; a client-bundle scan alone is not enough.
- Keep a client-bundle scan for accidental server-data imports.
- Exercise the real route and real server handler for required integration security tests.
- Do not replace the application boundary with a custom test harness that bypasses cookies, capabilities, parsing, or routing.
- Treat any pre-submission answer leak as blocking.
