---
paths:
  - "src/app/api/**/*"
  - "src/actions/**/*"
  - "src/auth.ts"
  - "src/proxy.ts"
  - "src/lib/{auth-tokens,db,email,onboarding-funnel,stripe,subscription}.ts"
  - "src/lib/billing/**/*"
  - "src/learning-modules/**/server/**/*"
  - "src/learning-modules/**/validation/**/*"
  - "src/lib/learning-engine/speech/providers/**/*"
  - "src/lib/learning-engine/speech/validation/**/*"
---

# Server Boundaries

## Boundary Selection

- Keep route handlers and Server Actions thin. They should authenticate, parse input, call the owning service or domain function, and translate the result into the established response contract.
- Keep business, progression, evaluation, and persistence rules in the layer that owns them rather than duplicating them in a route.
- Use a route handler when the browser, a webhook, or an external system requires an HTTP boundary.
- Use a Server Action or direct server-side function when that is the existing and appropriate application boundary.
- Do not create a new endpoint merely to call server code from other server code.

## Input Validation

- Treat request bodies, URL segments, search parameters, headers, cookies, webhook payloads, and provider responses as untrusted.
- Validate and normalize external input before it enters domain state or persistence.
- Use Zod where the surrounding feature already uses it. Preserve strict custom parsers where they encode an established security-sensitive contract.
- Reject missing required fields, invalid values, and unexpected fields when the contract is strict.
- Do not trust browser-provided user IDs, roles, prices, ownership claims, answer keys, redirect destinations, file paths, or provider configuration.
- Parse URLs canonically before validating their origin, path, or protocol. Reject backslashes, encoded path confusion, and unsupported protocols where a URL is accepted.

## Authentication and Authorization

- Authenticate at the server boundary before accessing user-owned or protected data.
- Authorize the requested resource independently of merely confirming that a session exists.
- Derive user identity and trusted account state from the authenticated server session or database.
- Do not rely on hidden UI, disabled controls, client redirects, or client validation as authorization.

## Secrets and Server-Only Data

- Keep credentials, token hashes, provider keys, canonical answers, internal mappings, database details, and raw upstream errors server-only.
- Use `server-only` for modules whose accidental client import would expose protected behavior or data.
- Never serialize secrets or server-only records into HTML, Client Component props, route responses, logs returned to users, or browser bundles.
- Do not echo rejected sensitive input in an error response.

## Responses and Errors

- Preserve the established typed response contract used by the caller.
- Return only fields the caller needs.
- Use learner-safe or user-safe messages for expected failures.
- Log enough server-side context to diagnose failures without logging credentials, passwords, tokens, canonical answers, or unnecessary personal data.
- Rethrow or surface unexpected programming failures through the existing observability path. Do not convert them into fake success.
- Do not expose stack traces, internal error codes, filesystem paths, SQL details, provider payloads, or exception messages to users.

## External Services

- Keep provider calls behind an owning server service.
- Apply timeouts or abort signals where the existing provider boundary supports them.
- Verify response status, content type, and required response shape before trusting upstream data.
- Treat retries and idempotency as explicit design decisions. Do not silently retry a state-changing request.
- Never allow the client to select arbitrary provider credentials, endpoints, models, products, or prices.

## Verification

- Test valid input, malformed input, missing fields, unexpected fields, unauthorized access, forbidden access, and safe error shapes.
- Test failure behavior at the actual route or action boundary when that boundary is part of the requested behavior.
- Confirm the browser response contains no server-only fields.
- Confirm unexpected failures remain observable and do not create partial success.
