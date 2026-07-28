# Testing

## Harness

Tests use Node's built-in `node:test` runner, TypeScript execution through `tsx`, React server rendering for component tests, and `playwright-core` for two browser flows. `tests/registerServerOnly.mjs` aliases the `server-only` marker for direct Node imports.

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
- `tests/auth/`: sign-in return-path sanitization; the account-enumeration-resistant registration and email-verification/resend route contracts; database-authoritative onboarding transitions with database-role, earlier-step, later-step, and completed-account rejection for every protected onboarding Server Action, stale/duplicate/concurrent-request recovery, the two-child limit under concurrency, and username-conflict handling; the real `/getting-started` page's `checkout=success` boundary; the shared client-side recovery/session-refresh contract in `src/lib/onboarding-client.ts`; and JWT `session.update()` refresh behavior, including that browser-supplied onboarding claims are ignored.
- `tests/components/`: shared Button/Input/PasswordInput/LearningWindowShell recipes, plus a `VocabularyStartupVisual` regression proving no inline `style` attribute and representative required geometry/rotation/blur classes.
- `tests/learning-engine/`: registry, screen injection/reset, generic action forwarding, route error presentation, and subject-neutral window rendering.
- `tests/vocabulary/`, `tests/multiple-choice/`, `tests/spelling/`: state machine, attempts, strict payloads, projections, answer security, retries, and window flows.
- `tests/tts/`: payload/config parsing, queue/cancellation, Google and Lemonfox adapters, and provider dispatch.
- `tests/word-search/`: prop parsing, deterministic generation, interaction, loading, rendering, accessibility, and completion.
- `tests/integration/`: full Vocabulary module plus real content/answer handlers without a browser.
- `tests/security/`: marker-quality regression (excludes ambiguous standalone learner words, keeps high-confidence identifiers/phrases) plus the post-build scan for those server-only fixture markers in client chunks.
- `tests/e2e/`: real running Vocabulary route; mouse/keyboard/touch word-search browser flow.

## Known evidence limitation

`tests/e2e/wordSearchPlayground.e2e.ts` navigates to `/playground`, but current source renders Word Search examples at `/le-playground`. The test's intended contract and route source disagree; documentation follows current source, and verification must report the actual test result rather than treating the test name as proof.
