# Testing

## Harness

Tests use Node's built-in `node:test` runner, TypeScript execution through `tsx`, React server rendering for component tests, and `playwright-core` for browser flows. `tests/registerServerOnly.mjs` aliases the `server-only` marker for direct Node imports.

`package.json` has no `test` or `typecheck` script. Do not use or document `npm test`, `npm run test`, or `npm run typecheck` as repository commands.

## Commands

Core repository checks:

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Direct Node tests can be run by passing explicit files:

```bash
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/api/*.test.ts
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/auth/*.test.ts
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/auth/emailNormalization.test.ts tests/auth/credentialsSignIn.test.ts tests/auth/requiredPasswordReset.test.ts tests/auth/passwordResetConfirm.test.ts tests/auth/accountAccessRouting.test.ts tests/auth/googleProfileMapping.test.ts tests/auth/appLayoutAccountGate.test.ts tests/auth/playgroundAccountGate.test.ts tests/auth/proxyRouting.test.ts
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/billing/*.test.ts tests/auth/gettingStartedPage.test.ts
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/billing/entitlement.test.ts tests/billing/userEntitlement.test.ts tests/api/ttsRoute.test.ts tests/api/vocabularySpeechRoute.test.ts
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/components/*.test.tsx tests/learning-engine/*.test.ts tests/learning-engine/*.test.tsx
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/multiple-choice/*.test.ts tests/spelling/*.test.ts
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/tts/*.test.ts
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/vocabulary/*.test.ts tests/integration/*.test.ts
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/word-search/*.test.ts tests/word-search/*.test.tsx
```

After a successful production build, the security bundle scan is:

```bash
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/security/clientBundleScan.test.ts
```

Browser tests launch the locally installed Google Chrome, start their own Next process on a reserved port, and allow up to 180 seconds:

```bash
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/e2e/vocabularyRoute.e2e.ts
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/e2e/wordSearchPlayground.e2e.ts
```

## Coverage by area

- `tests/api/`: TTS request handling, Vocabulary projections, learner cookie, protected speech, grading, and answer evaluator.
- `tests/auth/`: sign-in return-path sanitization; the account-enumeration-resistant registration and email-verification/resend route contracts; database-authoritative onboarding transitions with database-role, earlier-step, later-step, and completed-account rejection for every protected onboarding Server Action, stale/duplicate/concurrent-request recovery, the two-child limit under concurrency, and username-conflict handling; the real `/getting-started` page's `checkout=success` boundary and its reset-required redirect; the shared client-side recovery/session-refresh contract in `src/lib/onboarding-client.ts`; JWT `session.update()` refresh behavior, including that browser-supplied onboarding/reset claims are ignored; canonical email normalization (`emailNormalization.test.ts`); Credentials `authorize()` casing/whitespace-variant sign-in and username-path isolation (`credentialsSignIn.test.ts`); the Google `profile()` mapping's canonicalization and fail-closed rejection of a missing/malformed provider email (`googleProfileMapping.test.ts`); the atomic required-password-reset mutation, including eligibility short-circuit, generic security rejection, server-enforced `confirmNewPassword` matching, role-based post-reset routing, and concurrency (`requiredPasswordReset.test.ts`); the password-reset-confirmation route directly, including casing-variant token-owner matching and the `mustResetPassword`-clearing transaction (`passwordResetConfirm.test.ts`); the shared reset-required/role-aware routing decision (`accountAccessRouting.test.ts`); the database-authoritative account gate at the real `(app)` layout and both auth-only playground routes, including missing-account fail-closed behavior (`appLayoutAccountGate.test.ts`, `playgroundAccountGate.test.ts`); and the proxy's reduced, loop-free routing decision against a real `NextRequest` with a faked JWT (`proxyRouting.test.ts`).
- `tests/billing/`: strict entitlement time/status/price boundaries; Checkout ownership, price, mode, quantity, payment, subscription, persistence, idempotency, and transient-failure confirmation; the `createCheckoutSession` Server Action directly against a faked Stripe client, including unauthenticated/invalid-plan/missing-account/reset-required rejection with zero Stripe calls (`checkoutSession.test.ts`); real webhook signature/dispatch/failure behavior plus fail-closed subscription synchronization; and (`userEntitlement.test.ts`) the paid-TTS entitlement resolver's direct/child-inherited grants, stable multi-parent principal selection, manual-suspension denial, reset-required denial, and database-failure fail-closed behavior.
- `tests/components/`: shared Button/Input/PasswordInput/LearningWindowShell recipes, plus a `VocabularyStartupVisual` regression proving no inline `style` attribute and representative required geometry/rotation/blur classes.
- `tests/learning-engine/`: registry, screen injection/reset, generic action forwarding, route error presentation, and subject-neutral window rendering.
- `tests/vocabulary/`, `tests/multiple-choice/`, `tests/spelling/`: state machine, attempts, strict payloads, projections, answer security, retries, and window flows.
- `tests/tts/`: payload/config parsing, queue/cancellation/chunking, Google and Lemonfox adapters (including exact/overflow response bounds, absent/falsely-small length metadata, reader cancellation, and headers-then-stalled deadline cases), provider dispatch, deterministic natural-boundary text chunking (`chunkSpeechText.test.ts`), fixed policy constants/UTC-window/word math (`ttsUsagePolicy.test.ts`), and the atomic paid-usage service (`ttsUsageService.test.ts`) including warning/cutoff/burst/concurrency, transactional child-role/parent-link/stable-principal revalidation, exact unexpired lease finalization, duplicate completion, and suspension coverage, plus the server-only operational usage report (`ttsUsageReport.test.ts`).
- `tests/word-search/`: duplicate-safe prop parsing, deterministic/reseeded bounded generation, unique official occurrences, official-placement-only matching, mouse/keyboard/touch interaction, loading/reset safeguards, rendering, accessibility, and completion.
- `tests/integration/`: full Vocabulary module plus real content/answer handlers without a browser.
- `tests/security/`: marker-quality regression (excludes ambiguous standalone learner words, keeps high-confidence identifiers/phrases) plus the post-build scan for those server-only fixture markers in client chunks.
- `tests/e2e/`: real running application routes, including Vocabulary and the current `/le-playground` Word Search interaction flow.
