---
paths:
  - "tests/**/*"
  - "src/**/*.{test,spec}.{ts,tsx}"
  - "package.json"
  - ".nvmrc"
  - "eslint.config.mjs"
  - "tsconfig.json"
  - "next.config.ts"
  - "playwright.config.*"
  - "vitest.config.*"
  - "jest.config.*"
  - ".github/workflows/**/*"
---

# Tests and Verification

## Repository Truth

- Treat `package.json` as authoritative for available scripts.
- Use the repository's existing Node, TypeScript, server-only registration, and test patterns.
- Do not claim a script exists because an old document lists it.
- Do not add or change test scripts, dependencies, compiler settings, or lint configuration unless the requested work requires it.
- Do not edit production architecture merely to make a weak test easier to write.
- Place new tests under the existing `tests/` structure unless the requested work explicitly changes test organization.

## Test the Owning Layer

- Test behavior at the layer that owns it.
- State-machine rules require state-machine tests.
- Route validation requires route or handler boundary tests.
- Component interaction requires component tests.
- Shared engine behavior requires engine-level tests.
- A complete application flow requires integration or end-to-end coverage through the real application boundary.
- Do not treat several isolated unit tests as proof that the layers are connected correctly.

## Determinism and Boundaries

- Inject or seed randomness where reproducible behavior matters.
- Test exact counters, dates, transitions, and boundary values immediately before, at, and after the triggering event.
- Do not use timing delays when an explicit promise, event, fake clock, or deterministic state transition can prove the behavior.
- Keep fixtures minimal and explicit.
- Keep tests independent of execution order and shared mutable state.
- Restore modified environment variables, globals, timers, mocks, listeners, temporary files, and other process state after each test.
- Do not import protected server-only data into a browser-side test merely to make assertions convenient.
- Preserve cookies, route parsing, capabilities, validation, and real handlers in tests that claim to cover those boundaries.
- Do not add production-only exports, test-mode authentication bypasses, weakened validation, or environment branches that make protected behavior easier to test.

## External Services and Production Safety

- Normal tests must not contact production databases, Stripe, email providers, authentication providers, paid TTS services, or other production systems.
- Never require production credentials or production customer data to run repository verification.
- Use the established test mode, deterministic fake, injected dependency, fixture, or local boundary appropriate to the owning layer.
- Do not weaken signature verification, authentication, authorization, quotas, ownership checks, or server-only boundaries to make an external-service test pass.
- Do not add retries, longer sleeps, or inflated timeouts merely to hide nondeterminism or a race condition.

## Required Failure Coverage

Where applicable, test:

- Valid behavior and expected success.
- Missing, malformed, and unexpected input.
- Unauthorized and forbidden access.
- Incorrect answers or rejected domain actions.
- Pending state, duplicate actions, failure, explicit retry, and stale results.
- Provider or database failure.
- Safe error shapes and absence of protected fields.
- Cleanup, cancellation, and rollback.

## Learning Tests

- Test Vocabulary state transitions at exact graded-answer counts.
- Cover introduction, definition, spelling, recap, mastery, replacement, delayed reviews, review failure, and completion when the full lesson changes.
- Connect the real module and real answer-validation handler for full-route coverage.
- Do not replace required integration with hand-fed results, mocked fetch alone, an isolated endpoint test, or a custom harness that bypasses the route.
- For graded screens, attempt to reconstruct the answer from all browser-visible data.
- Inspect runtime requests and props in addition to scanning the client bundle.

## Honest Verification

- Report the exact command and result for every check that ran.
- Distinguish unit, component, integration, end-to-end, browser, runtime, visual, and accessibility verification.
- Do not call a test end-to-end if it mocks or bypasses a required layer.
- Do not claim the full suite passed when only selected tests ran.
- If a required boundary cannot be tested, report the limitation instead of silently omitting it.
- Passing tests do not override a scope, security, architecture, or rule violation.

## Test Quality

- Assert observable behavior and stable contracts rather than incidental implementation details.
- A regression test must fail for the defect it is intended to prevent.
- Avoid snapshots when targeted assertions explain the contract more clearly.
- Keep test names specific about the condition and expected result.
- Remove temporary diagnostics and focused-test markers before completion.
- Confirm changed tests do not accidentally exclude, skip, loosen, or weaken existing coverage.
