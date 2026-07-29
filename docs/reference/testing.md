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
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/auth/oauthAdapterAtomicity.test.ts
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

`tests/auth/atomicAuthDatabase.integration.test.ts` is the real-PostgreSQL transaction harness for auth rollback, same-user serialization, one-winner resend/reset issuance/confirmation, and deadlock detection. It uses the existing `DATABASE_URL` only and skips unless the host is local and the database name unmistakably contains a test marker (`test`, `testing`, `tmp`, `temp`, or `ci`). Run it only after the target is explicitly approved as disposable; unique synthetic fixtures are removed in `finally`:

```bash
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/auth/atomicAuthDatabase.integration.test.ts
```

## Coverage by area

- `tests/api/`: TTS request handling, Vocabulary projections, learner cookie, protected speech, grading, and answer evaluator.
- `tests/auth/`: OAuth provisioning/linking atomicity; account-enumeration-resistant registration and verification routes; resend rollback/concurrency/provider failure; serialized reset issuance; exact-claim confirmation with forced rollback and same-user races; preserved required-reset/onboarding/child transactions; account/session gates; and the guarded disposable-PostgreSQL transaction harness.
- `tests/billing/`: strict entitlement time/status/price boundaries; Checkout ownership, price, mode, quantity, payment, subscription, persistence, idempotency, and transient-failure confirmation; the `createCheckoutSession` Server Action directly against a faked Stripe client, including unauthenticated/invalid-plan/missing-account/reset-required rejection with zero Stripe calls (`checkoutSession.test.ts`); real webhook signature/dispatch/failure behavior plus fail-closed subscription synchronization; and (`userEntitlement.test.ts`) the paid-TTS entitlement resolver's direct/child-inherited grants, stable multi-parent principal selection, manual-suspension denial, reset-required denial, and database-failure fail-closed behavior.
- `tests/components/`: shared Button/Input/PasswordInput/LearningWindowShell recipes, plus a `VocabularyStartupVisual` regression proving no inline `style` attribute and representative required geometry/rotation/blur classes.
- `tests/learning-engine/`: registry, screen injection/reset, generic action forwarding, route error presentation, and subject-neutral window rendering.
- `tests/vocabulary/`, `tests/multiple-choice/`, `tests/spelling/`: state machine, attempts, strict payloads, projections, answer security, retries, and window flows.
- `tests/tts/`: payload/config parsing, queue/cancellation/chunking, Google and Lemonfox adapters (including exact/overflow response bounds, absent/falsely-small length metadata, reader cancellation, and headers-then-stalled deadline cases), provider dispatch, deterministic natural-boundary text chunking (`chunkSpeechText.test.ts`), fixed policy constants/UTC-window/word math (`ttsUsagePolicy.test.ts`), and the atomic paid-usage service (`ttsUsageService.test.ts`) including warning/cutoff/burst/concurrency, transactional child-role/parent-link/stable-principal revalidation, exact unexpired lease finalization, duplicate completion, and suspension coverage, plus the server-only operational usage report (`ttsUsageReport.test.ts`).
- `tests/word-search/`: duplicate-safe prop parsing, deterministic/reseeded bounded generation, unique official occurrences, official-placement-only matching, mouse/keyboard/touch interaction, loading/reset safeguards, rendering, accessibility, and completion.
- `tests/integration/`: full Vocabulary module plus real content/answer handlers without a browser.
- `tests/security/`: marker-quality regression (excludes ambiguous standalone learner words, keeps high-confidence identifiers/phrases) plus the post-build scan for those server-only fixture markers in client chunks.
- `tests/e2e/`: real running application routes, including Vocabulary and the current `/le-playground` Word Search interaction flow.
