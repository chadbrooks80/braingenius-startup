# Stage 1 Integration Inventory

Date: 2026-07-17

Host application: repository root (`/Users/apple/apps/braingenius-startup`)

Read-only source application: `references/learning-engine`

## Status and boundary

This report inventories the migration-relevant differences between the Brain Genius startup website and the copied Learning Engine. The startup website remains the host. The Learning Engine reference was inspected in place and was not modified.

No application code has been moved. No dependencies, lockfiles, configuration, routes, styles, database files, environment files, or reference files were changed. The only Stage 1 repository addition is this report and its containing directory.

## Classification key

Every migration item below has exactly one classification:

- **Safe to copy** — can be retained or moved without a known collision after preserving its path.
- **Must be adapted** — behavior is valuable, but its path, contract, runtime boundary, security boundary, or host integration must change.
- **Version conflict** — manifests or resolved tool/runtime versions disagree.
- **Route conflict** — both applications own the same URL or route-level file.
- **Styling conflict** — global styles, tokens, utility names, or component styling violate or collide with the host design system.
- **Deferred cleanup** — not required for behavior-preserving initial migration; revisit only after parity.

## Executive findings

The largest integration risks are:

1. **Next.js `16.2.4` in the host is below the security-fixed line used by the engine.** The host uses App Router `src/proxy.ts` for signed-in-user onboarding gating. Next.js identifies `>=16.0.0 <16.2.5` as affected by a high-severity proxy bypass, and `16.2.6` includes the incomplete-fix follow-up. The version decision must be resolved before migrated learning routes are treated as protected.
2. **The root route and `/playground` are owned by both applications.** The engine root redirect must not replace the website landing page; the playgrounds must be merged or namespaced.
3. **Global theme systems are incompatible as written.** Both applications own `globals.css`, `body`, font theme tokens, and `--color-surface-*`; the engine also uses raw variables, inline styles, and default Tailwind colors that conflict with host rules.
4. **Case-only component directories cannot coexist reliably.** The host has `src/components/ui` and `src/components/blocks`; the engine imports `src/components/UI` and `src/components/Blocks`. This is especially unsafe on the current case-insensitive macOS filesystem.
5. **The engine assumes an ESM/Node 24 test toolchain.** It uses `"type": "module"`, Node `>=24.14.1 <25`, explicit `.ts` import extensions in 63 source/test files, `tsx`, and `playwright-core`; the host has no Node pin, uses `@types/node` 20, and has no test scripts.
6. **The engine's learner identity and progress are intentionally prototype-only.** It uses an anonymous `brain-genius-learner` cookie and an in-memory capability/state store, while the host owns NextAuth, Prisma, users, children, onboarding, subscriptions, and Stripe. These systems must not be conflated during initial copy, and production-user progress remains Stage 3 work.
7. **The generic `/api/tts` route is not production-safe yet.** Its source includes a TODO requiring authenticated user context, quotas, rate limits, and usage tracking before exposing paid provider credentials.

## 1. Package and lockfile inventory

### 1.1 Runtime dependencies

| Package/item | Host manifest / lock | Engine manifest / lock | Classification | Treatment |
|---|---|---|---|---|
| `next` | `16.2.4` / `16.2.4` | `16.2.9` / `16.2.9` | Version conflict | Stage 2: select one security-fixed version, update `next` and `eslint-config-next` together, regenerate the root lockfile, and run all host and engine checks. |
| `react` | `19.2.4` / `19.2.4` | `19.2.4` / `19.2.4` | Safe to copy | Keep the host version. |
| `react-dom` | `19.2.4` / `19.2.4` | `19.2.4` / `19.2.4` | Safe to copy | Keep the host version. |
| `server-only` | absent | `^0.0.1` / `0.0.1` | Must be adapted | Stage 2: add only if the migrated server-only modules retain their six marker imports; do not remove the guards without an equivalent boundary. |
| Host-only runtime set | `@auth/prisma-adapter ^1.6.0`, `@prisma/adapter-pg ^7.8.0`, `@prisma/client ^7.8.0`, `bcryptjs ^3.0.3`, `clsx ^2.1.1`, `lucide-react ^1.8.0`, `next-auth ^4.24.14`, `pg ^8.20.0`, `resend ^6.14.0`, `stripe ^22.2.3`, `zod ^4.4.3` | absent | Safe to copy | Retain in the host; the engine must not replace Auth, Prisma, email, billing, validation, icons, or utility dependencies. |

The Learning Engine has no additional runtime package besides `server-only`. Its provider calls use native `fetch`, `node:crypto`, Web Audio/HTML audio APIs, and built-in web platform types.

### 1.2 Development dependencies and exact lock resolutions

| Package | Host manifest / lock | Engine manifest / lock | Classification | Treatment |
|---|---|---|---|---|
| `@tailwindcss/postcss` | `^4` / `4.2.2` | `^4` / `4.3.1` | Version conflict | Stage 2: regenerate from one root manifest and visually verify both design systems. |
| `@types/node` | `^20` / `20.19.39` | `^24.13.3` / `24.13.3` | Version conflict | Stage 2: decide the Node runtime first; engine tests are pinned to Node 24.14.1. |
| `@types/react` | `^19` / `19.2.14` | `^19` / `19.2.17` | Version conflict | Stage 2: accept the root lock resolution and typecheck both applications' migrated code. |
| `@types/react-dom` | `^19` / `19.2.3` | `^19` / `19.2.3` | Safe to copy | Keep the host resolution. |
| `eslint` | `^9` / `9.39.4` | `^9` / `9.39.4` | Safe to copy | Keep the host resolution. |
| `eslint-config-next` | `16.2.4` / `16.2.4` | `16.2.9` / `16.2.9` | Version conflict | Stage 2: keep exactly aligned with the chosen `next` version. |
| `tailwindcss` | `^4` / `4.2.2` | `^4` / `4.3.1` | Version conflict | Stage 2: use one lock resolution and test generated utilities/tokens. |
| `typescript` | `^5` / `5.9.3` | `^5` / `5.9.3` | Safe to copy | Keep the host resolution. |
| `@types/bcrypt` | `^6.0.0` / `6.0.0` | absent | Safe to copy | Retain for host auth. |
| `prisma` | `^7.8.0` / `7.8.0` | absent | Safe to copy | Retain the host generator/migration toolchain. |
| `tsx` | absent | `^4.23.1` / `4.23.1` | Must be adapted | Stage 2: required by every engine Node test script; add it if the test suite is migrated unchanged. |
| `playwright-core` | absent | `^1.61.1` / `1.61.1` | Must be adapted | Stage 2: required by two real-browser E2E tests. Adapt the hard-coded macOS Chrome executable path for CI/other developers. |

### 1.3 Do the engine-only packages remain necessary?

| Package | Evidence | Verdict | Classification | Treatment |
|---|---|---|---|---|
| `server-only` | Imported by canonical vocabulary data, correct-answer resolution, content capability storage, learner-session code, and server projection code. The test hook aliases the marker under plain Node. | Yes, if these boundaries are copied unchanged. | Must be adapted | Stage 2: add the package and preserve guards; later replacement needs an explicit server-boundary audit. |
| `tsx` | All engine test scripts use `node --import tsx`; 34 test files also use explicit TypeScript-extension imports. | Yes for the current test runner. | Must be adapted | Stage 2: add it or deliberately port the whole test harness to another already-approved runner. |
| `playwright-core` | Imported directly by `tests/e2e/vocabularyRoute.e2e.ts` and `tests/e2e/wordSearchPlayground.e2e.ts`. | Yes for current E2E coverage. | Must be adapted | Stage 2: retain it and make browser discovery portable, or approve an equivalent browser harness. |

### 1.4 Packages and techniques with overlapping jobs

| Overlap | Owner and files | Classification | Exact risk and treatment |
|---|---|---|---|
| Zod versus engine hand-written parsers | Host: `src/actions/*.ts` and auth API routes. Engine: vocabulary and TTS `validation/*.ts`. | Deferred cleanup | Rewriting proven strict parsers during copy could weaken unknown-field/variant rejection. Stage 3: consider convergence only after equivalent tests exist. |
| `clsx` versus engine template strings/style objects | Host: `src/components/ui/Button.tsx` and other presentation components. Engine: `src/components/UI/Button.tsx` and Learning Windows. | Deferred cleanup | Utility normalization would mix migration with refactoring. Stage 3: normalize only after UI parity. |
| Lucide icons versus engine emoji/text glyphs | Host: Lucide-importing components. Engine: `src/lib/emojis.ts`, `Blocks/Sidebar.tsx`, and vocabulary Startup components. | Deferred cleanup | Replacing the presentation can change accessibility/layout. Preserve first; revisit in Stage 3. |
| NextAuth identity versus anonymous learner cookie | Host: `src/auth.ts`, `src/app/auth/Provider.tsx`, `src/proxy.ts`. Engine: `vocabulary/server/vocabularyLearnerSession.ts`. | Must be adapted | The two identities are not interchangeable and progress cannot be trusted from a browser claim. Stage 2 preserves anonymous behavior; Stage 3 designs the authenticated bridge. |
| Prisma/PostgreSQL versus in-memory capability store | Host: `prisma/schema.prisma`, `prisma.config.ts`, `src/lib/db.ts`. Engine: `vocabulary/server/VocabularyContentCapabilityStore.ts`. | Must be adapted | In-memory state is lost on restart and not shared across instances; putting Prisma in the engine would violate ownership. Stage 3 designs application-owned persistence. |

### 1.5 Lockfile comparison

Both lockfiles are npm lockfile version 3. The host lock has 562 package-path entries and root name `bg-test`; the engine lock has 466 entries and root name `learning_engine`. Normalized by package name, the union contains 568 packages: 121 appear only in the host graph, 37 only in the engine graph, 290 are shared with the same version set, and 120 are shared with different resolved version sets.

The engine-only graph is mainly `tsx`/`esbuild` platform packages, `playwright-core`, and `server-only`. The host-only graph is mainly Auth, Prisma/database, billing/email, icon, and validation dependencies. Shared drift includes the Next/SWC packages, Tailwind/PostCSS, Node/React types, Babel, TypeScript-ESLint, browser-compatibility data, and resolver packages.

| Lockfile action | Classification | Treatment |
|---|---|---|
| Combining or copying lockfile sections | Must be adapted | Stage 2: edit only the root manifest after approval, then let npm regenerate `package-lock.json`; never splice the engine lock into the host lock. |
| Existing engine lock as provenance | Safe to copy | Keep it read-only under `references/learning-engine` for comparison until migration verification is complete. |

## 2. Next.js 16.2.4 versus 16.2.9 risk

This is not a feature-level API incompatibility; it is a patch-line security and correctness conflict:

- The official advisory for [GHSA-267c-6grr-h53f](https://github.com/vercel/next.js/security/advisories/GHSA-267c-6grr-h53f) lists Next `>=16.0.0 <16.2.5` as affected by an App Router middleware/proxy authorization bypass. The host is `16.2.4` and relies on `src/proxy.ts` for signed-in-user onboarding routing at `/dashboard` and `/getting-started`. Its current proxy explicitly allows requests with no token, so it is not by itself an unauthenticated-access guard.
- [Next 16.2.5](https://github.com/vercel/next.js/releases/tag/v16.2.5) contains the first security backports. [Next 16.2.6](https://github.com/vercel/next.js/releases/tag/v16.2.6) includes an incomplete-fix follow-up plus additional proxy, Server Component, cache, route-handler, XSS, SSRF, image, and denial-of-service fixes.
- [Next 16.2.7](https://github.com/vercel/next.js/releases/tag/v16.2.7) adds relevant correctness fixes for dropped `FormData` entries, `"type": "module"` with standalone/adapters, a `playwright-core` request-failure hang, dev hydration, and server-action forwarding with middleware rewrites. FormData and proxy/server-action behavior are relevant to the host; ESM and Playwright are relevant to the engine.
- [Next 16.2.8](https://github.com/vercel/next.js/releases/tag/v16.2.8) and [16.2.9](https://github.com/vercel/next.js/releases/tag/v16.2.9) are empty releases used to repair npm distribution tags. Therefore the behavioral delta from 16.2.7 to 16.2.9 is not an application change, but `16.2.9` still carries all earlier fixes.

| Item | Classification | Treatment |
|---|---|---|
| Host `next@16.2.4` and `eslint-config-next@16.2.4` | Version conflict | Stage 2: upgrade together to one vetted security-fixed patch, preferably the engine-tested `16.2.9` or a later explicitly approved patch, then rerun auth/proxy, FormData actions, API routes, build, and E2E tests. |

## 3. Configuration inventory

| Area | Host | Engine | Classification | Treatment and files |
|---|---|---|---|---|
| `next.config.ts` | Empty typed config | Byte-for-byte equivalent empty typed config | Safe to copy | Keep the host file; no engine settings need merging. |
| `postcss.config.mjs` | Tailwind PostCSS plugin | Identical | Safe to copy | Keep the host file. |
| `tailwind.config.*` | absent, as required by Tailwind v4 project rules | absent | Safe to copy | Keep CSS-based configuration; do not create a JavaScript Tailwind config. |
| `prisma.config.ts` | Host-only Prisma schema/migration paths and `DATABASE_URL` datasource | absent | Safe to copy | Preserve the host file and Prisma ownership; the engine has no database config to merge. |
| TypeScript base | strict, bundler resolution, `@/* -> ./src/*` | Same | Safe to copy | Preserve the host base. |
| Explicit TS imports | Host does not enable them | Engine enables `allowImportingTsExtensions`; 63 source/test files use `.ts`/`.tsx` import suffixes | Must be adapted | Stage 2: either enable the option intentionally or normalize all migrated imports and test them. Files: `tsconfig.json`, engine `src/lib`, `src/learning-modules`, and `tests`. |
| TypeScript exclusions | Host excludes only `node_modules` | Engine excludes `node_modules` and its own `references` | Must be adapted | Stage 2: exclude the top-level read-only `references` directory from host typechecks before treating checks as authoritative. |
| ESLint exclusions | Host ignores generated Prisma, not `references` | Engine ignores `references`, not generated Prisma | Must be adapted | Stage 2: preserve `src/generated/**` and add `references/**`; do not lint the immutable reference as host source. |
| Path alias | Both use `@/*` for their own `src` root | Same spelling, different source root before copy | Must be adapted | Stage 2: moved files may use the host alias, but case-colliding `@/components/UI` and `@/components/Blocks` imports must be resolved. |
| Package module mode | No package `type` | `"type": "module"` | Must be adapted | Stage 2: decide package-wide ESM deliberately; verify Prisma config, Next config, scripts, and standalone deployment. Files: both `package.json` files plus `prisma.config.ts` and `next.config.ts`. |
| Node version | No `.nvmrc` or `engines`; `@types/node` 20 | `.nvmrc` 24.14.1, `engines >=24.14.1 <25`, `@types/node` 24 | Version conflict | Stage 2: pin one supported runtime and align types. The inspection shell is Node 24.14.1, but the host does not declare that requirement. |
| Development server | `next dev --webpack` | `next dev` (Next default) | Must be adapted | Stage 2: preserve host Webpack dev behavior unless a deliberate Turbopack migration is approved; verify engine UI under the chosen dev bundler. |
| Build/start | `next build`, `next start` | Identical | Safe to copy | Keep host scripts. |
| Postinstall | `prisma generate` | none | Safe to copy | Preserve host database client generation. |
| Typecheck/test scripts | No `typecheck` or tests | `typecheck`, full Node test, E2E, multiple-choice, TTS scripts | Must be adapted | Stage 2: add engine checks without replacing host scripts; account for `tsx`, `server-only` hook, build-before-E2E, and portable Chrome. |
| Test configuration files | None | No framework config; `tests/registerServerOnly.mjs` supplies the Node import hook and E2E files launch `playwright-core` directly | Must be adapted | Engine owns the harness files. Risk: copying scripts without the hook/browser setup breaks tests or server-only imports. Stage 2: migrate the hook and make browser launch portable. |
| CI/deployment files | None found | None found | Deferred cleanup | Stage 3: add CI/deployment automation only when requested; do not invent it during copy. |
| Environment validation | Lazy checks/non-null assertions in host helpers; no central schema | Strict request parsers and lazy provider credential checks; no central env schema | Must be adapted | Stage 2: preserve each service's current failure behavior; Stage 3 may centralize validation without exposing values. |
| `.gitignore` environment rule | `.env*` ignores every environment file, including `.env.example`; also ignores root `references`, `Archive.zip`, and generated Prisma | `.env*` plus `!.env.example`; also ignores its nested `references`, archive, and local Claude override | Must be adapted | Stage 2: preserve host reference/archive/generated-client ignores. If a host example is approved, add an explicit `!.env.example`; otherwise the proposed example cannot be committed. |
| Middleware/proxy | `src/proxy.ts`, matcher for `/dashboard/:path*` and `/getting-started`; redirects signed-in users according to onboarding state but passes unauthenticated requests through | none | Must be adapted | Stage 2: keep host proxy ownership. `/learning` remains outside the matcher until an access policy is explicitly approved; do not describe the current proxy as a complete authentication guard. |

## 4. Application and route inventory

### 4.1 Host-owned routes to preserve

| Host route | Owner/purpose | Classification |
|---|---|---|
| `/` | Marketing landing page under `(website)` and website Header layout | Safe to copy |
| `/blog` | Public website page | Safe to copy |
| `/sign-up`, `/sign-in`, `/verify-email`, `/forgot-password`, `/reset-password` | Host authentication and recovery | Safe to copy |
| `/getting-started` | Host onboarding funnel; the page calls `getServerSession()` and redirects users with no session | Safe to copy |
| `/dashboard` | Host placeholder account destination; its page has no session guard, and `src/proxy.ts` passes unauthenticated requests through | Safe to copy |
| `/playground` | Host component playground root | Route conflict |
| `/playground/register`, `/playground/restrict`, `/playground/users` | Host-only component/auth playground children | Safe to copy |
| `/api/auth/[...nextauth]`, `/api/auth/verify-email-code`, `/api/auth/resend-verification-code`, `/api/auth/password-reset/request`, `/api/auth/password-reset/confirm` | Host Auth/verification/recovery APIs | Safe to copy |
| `/api/webhooks/stripe` | Host Stripe webhook | Safe to copy |

### 4.2 Engine routes

| Engine route/file | Behavior | Collision/risk | Classification | Treatment |
|---|---|---|---|---|
| `src/app/page.tsx` -> `/` | Redirects to `/learning/vocabulary/word_list_id` | Directly replaces the marketing home page | Route conflict | Stage 2: do not copy this file; expose learning through host navigation or an explicitly approved entry point. |
| `src/app/playground/page.tsx` -> `/playground` | Renders all Learning Window states and Word Search fixtures | Exact host route collision | Route conflict | Stage 2: merge into the host playground or place at `/playground/learning`; update the Word Search E2E route. |
| `src/app/learning/[...learning]/page.tsx` | Client host for Learning Engine state, module initialization, Header/Sidebar, screen renderer, and speech cancellation | No host route exists; must inherit host root layout/provider | Must be adapted | Stage 2: copy under `/learning`, preserve client boundary and keyed teardown, and test inside the host AuthProvider/body layout. |
| `/api/learning/vocabulary/content` | Creates/continues anonymous learner manifest and narrow content projections | No exact route collision; in-memory state and cookie identity | Must be adapted | Stage 2: preserve prototype behavior and Node runtime; Stage 3: design authenticated/persistent ownership. |
| `/api/learning/vocabulary/speech` | Resolves opaque spelling speech reference and synthesizes audio | No collision; depends on TTS credentials and anonymous attempt ownership | Must be adapted | Stage 2: keep server-side answer secrecy and provider boundary; Stage 3: connect identity/quotas. |
| `/api/learning/vocabulary/submit-answer` | Resolves capability-bound server answer and returns feedback | No collision; in-memory state and learner cookie | Must be adapted | Stage 2: preserve exact validation/security behavior; Stage 3: connect persistence without moving subject logic into engine. |
| `/api/tts` | Generic validated Google/Lemonfox synthesis route | No current path collision, but generic public paid-service endpoint | Must be adapted | Stage 2: copy only with existing validation and Node runtime; before public exposure add host auth, quotas, rate limits, and usage tracking. |

There are no engine Server Actions. All engine mutations use client actions routed through the Learning Engine and HTTP route handlers. The host's three Server Action files (`src/actions/register.ts`, `onboarding.ts`, and `checkout.ts`) remain host-owned.

### 4.3 Layouts, providers, and fonts

| Item | Difference | Classification | Treatment |
|---|---|---|---|
| Root layout | Host root owns metadata, Auth `SessionProvider`, flex body, and global styles. Engine root owns prototype metadata and a bare body. | Route conflict | Stage 2: retain `src/app/layout.tsx`; never copy the engine root layout over it. |
| Website nested layout | Host `(website)/layout.tsx` adds the public Header only to public website pages. Engine has no route groups. | Safe to copy | Preserve; `/learning` should not enter the website route group. |
| Auth provider | Host wraps all routes with `SessionProvider`; engine has no provider. | Must be adapted | Stage 2: verify the learning client tree under the existing provider; do not add a second root provider. |
| Font families | Both use Plus Jakarta Sans (`--font-jakarta`) and Baloo 2 (`--font-baloo`). Engine pins selected weights; host uses its existing loader config with `display: swap`. | Must be adapted | Reuse host font variables; do not duplicate `next/font` declarations. Verify the engine's 700/800 display and 400/500/600 body weights visually. |
| Metadata | Host describes BrainGenius AI; engine describes a prototype. | Must be adapted | Keep host global metadata; add learning-specific metadata later only if requested. |

The host route-group topology is also authoritative:

| Route group | Current contents | Classification | Treatment |
|---|---|---|---|
| `(website)` | `/` and `/blog`; owns `src/app/(website)/layout.tsx` and the marketing Header | Safe to copy | Preserve unchanged. |
| `(auth)` | Sign-up/sign-in, verification/recovery, and the nested `(onboarding)` group | Safe to copy | Preserve URL-neutral grouping and existing client boundaries. |
| `(auth)/(onboarding)` | `/sign-up` and `/getting-started`; no additional layout file | Safe to copy | Preserve onboarding ownership and page-level session check at `/getting-started`. |
| `(app)` | `/dashboard`; no nested layout file and no page-level session guard | Safe to copy | Preserve as host-owned; do not infer that learning migration makes it protected. |
| Engine | No route groups | Must be adapted | Stage 2: add `/learning` at the app root so it inherits only the host root layout, not `(website)` or `(auth)`. File: engine `src/app/learning/[...learning]/page.tsx`. |

### 4.4 Application ownership and source groups

| Source group | Current responsibility | Classification | Stage 2/3 treatment |
|---|---|---|---|
| `references/learning-engine/src/lib/learning-engine/` core initialization/actions/screens/errors/validation | Subject-neutral module loading, action routing, window resolution, screen changes, route errors, shared state | Must be adapted | Stage 2: move as a coherent namespace, resolve explicit extensions and imports, preserve subject neutrality and error behavior. |
| `src/lib/learning-engine/speech/` | Browser playback, cancellation, provider dispatch, Google service-account OAuth, Lemonfox, validation | Must be adapted | Stage 2: preserve browser/server split, Node runtime, allowlists, stale-request protection, and credential isolation; integrate host endpoint security separately. |
| `src/learning-modules/vocabulary/` state/screens/data/validation | Complete 20-word fixture lesson, attempts, mastery, delayed review, screen construction | Must be adapted | Stage 2: preserve logic/tests, source extensions, and module ownership. Do not move subject logic into shared engine. |
| `src/learning-modules/vocabulary/server/` and server-only data | Anonymous learner, capabilities, canonical fixture, narrow projections, answer/speech resolution | Must be adapted | Stage 2: keep server-only guards and in-memory prototype behavior. Stage 3: redesign identity/persistence with host users. |
| `src/types/learning.ts` | Shared subject-neutral contracts for engine state, screens, actions, TTS, speech sources | Safe to copy | Copy into an approved non-colliding host type path and keep it subject-neutral. |
| `src/lib/random/normalizedRandom.ts` | Pure normalized random helper | Safe to copy | Copy with the vocabulary state logic. |
| Word Search pure helpers (`generateWordList`, parser, directions, interaction, puzzle-load, types) | Puzzle generation fixture, validation, geometry, state transitions | Safe to copy | Keep beside the Learning Window and retain tests. |
| Learning Window React components | Startup, definition, fun fact, multiple choice, spelling, recap, complete, Word Search, route error | Styling conflict | Stage 2: preserve behavior/contracts while mapping or namespacing theme dependencies; do not redesign. |
| Engine layout blocks | Static lesson Header, Sidebar, ScreenRenderer | Must be adapted | Stage 2: rename/nest away from host generic names and case-only directories; preserve ScreenRenderer live-prop precedence. |
| Engine `components/UI/Button.tsx` | Learner button with a label-driven contract and four variants | Must be adapted | Stage 2: keep as a distinctly named learning component or deliberately adapt all consumers; do not overwrite host Button. |
| Engine tests (38 files) | API, engine, security, integration, TTS, vocabulary, Word Search, two E2E flows | Must be adapted | Stage 2: migrate with route/path changes, Node/tsx/server-only setup, and portable browser launch. |
| Engine component docs (13 files) | Current public contracts | Must be adapted | Stage 2: copy with renamed paths/contracts; merge the colliding `Button.md` intentionally. |

### 4.5 Client/server boundaries

The host has 19 explicit client files:

- Auth/pages/providers: `src/app/(auth)/(onboarding)/sign-up/page.tsx`, all four remaining interactive auth pages (`forgot-password`, `reset-password`, `sign-in`, `verify-email`), `src/app/auth/Provider.tsx`, `src/app/playground/register/page.tsx`, and `src/app/playground/users/signInOut.tsx`.
- Website/layout UI: `CTASection.tsx`, `FeatureSection.tsx`, `TestimonialsSection.tsx`, `WordGeneratorSection.tsx`, and `HeaderNav.tsx`.
- Onboarding/UI: `ChildrenStep.tsx`, `PlanStep.tsx`, `ProfileStep.tsx`, `WelcomeVideoStep.tsx`, `Modal.tsx`, and `PasswordInput.tsx`.

The engine has ten explicit client files: the `/learning` route, the playground, seven interactive Learning Windows, and the learning Button. Header, Sidebar, ScreenRenderer, registry, module state, pure helpers, and most screen builders are not marked client; some become part of the client graph through the client route/module imports. Six source files use `server-only` markers to prevent canonical answers and server capability data from entering that graph.

| Boundary | Classification | Treatment |
|---|---|---|
| Host's 19 existing client boundaries | Safe to copy | Preserve; the engine migration must not turn unrelated host server components into clients. |
| Existing `"use client"` placement | Safe to copy | Preserve initially; avoid widening the client graph. |
| Existing `server-only` markers and opaque speech/answer flow | Must be adapted | Engine owner/files: `data/getCorrectAnswer.ts`, `getVocabularyPublicChoiceId.ts`, `getWordList.ts`, `server/VocabularyContentCapabilityStore.ts`, `getVocabularyContent.ts`, and `vocabularyLearnerSession.ts`. Risk: canonical answers/capabilities could enter the client graph if guards drift. Stage 2: add the marker dependency and rerun `tests/security/clientBundleScan.test.ts`. |
| Host AuthProvider above learning route | Must be adapted | Host owner/file: `src/app/auth/Provider.tsx` through `src/app/layout.tsx`; engine file: `src/app/learning/[...learning]/page.tsx`. Risk: a second provider or widened client boundary can change session/rendering behavior. Stage 2: retain one provider and verify the migrated route. |

## 5. Database, auth, state, and external services

### 5.1 Database and authentication ownership

The host owns Prisma/PostgreSQL and migrations for `User`, parent/child relationships, Auth accounts/sessions/tokens, subscriptions, verification, password reset, and onboarding. It also owns NextAuth Google/Credentials login, JWT session callbacks, the Prisma adapter, and onboarding proxy behavior.

The corresponding host boundaries are `src/auth.ts`, `src/app/api/auth/[...nextauth]/route.ts`, `src/app/auth/Provider.tsx`, `src/lib/auth-tokens.ts`, `src/lib/db.ts`, `src/lib/onboarding-funnel.ts`, `src/actions/register.ts`, `src/actions/onboarding.ts`, and `src/proxy.ts`. The engine's only identity helper is `src/learning-modules/vocabulary/server/vocabularyLearnerSession.ts`, backed by `VocabularyContentCapabilityStore.ts`; it is not an alternative host authentication system.

The engine has no Prisma dependency, schema, migration, database client, NextAuth helper, or user model. Its lesson/capability state is an in-process `VocabularyContentCapabilityStore`; identity is a secure-on-HTTPS, HttpOnly, SameSite=Strict UUID cookie named `brain-genius-learner`. Process restarts and multi-instance deployment do not share that state.

| Item | Classification | Treatment |
|---|---|---|
| Host Prisma schema/migrations/client | Safe to copy | Preserve unchanged through Stage 2. |
| Engine in-memory learner/capability state | Must be adapted | Preserve for behavior parity in Stage 2; Stage 3 must address persistence, horizontal scaling, expiration, and production-user linkage. |
| Learning progress tied to production users | Deferred cleanup | Explicitly deferred until Stage 3; do not invent models or writes during initial integration. |
| Engine static Header username/logout controls | Must be adapted | Stage 2: keep visually if required for parity but do not present fake account actions as functional; Stage 3: integrate host account UI deliberately. |

### 5.2 External services

| Service | Owner and files | Other application | Classification | Exact risk and treatment |
|---|---|---|---|---|
| PostgreSQL/Neon via Prisma adapter | Host: `prisma.config.ts`, `prisma/schema.prisma`, `src/lib/db.ts` | Engine does not use it | Safe to copy | Host retains ownership. |
| Google OAuth login | Host: `src/auth.ts` | Engine does not use it | Safe to copy | Host retains ownership. |
| Resend | Host: `src/lib/email.ts` and auth flows | Engine does not use it | Safe to copy | Host retains ownership. |
| Stripe | Host: `src/lib/stripe.ts`, `src/actions/checkout.ts`, webhook route | Engine does not use it | Safe to copy | Host retains ownership. |
| YouTube embed | Host: `src/components/onboarding/WelcomeVideoStep.tsx` | Engine does not use it | Safe to copy | Preserve and verify it is unaffected by learning-route CSP/layout changes. |
| Merriam-Webster Dictionary API | Host documentation: `context/tech-stack.md`; no package, env name, or source call found | Engine does not use it | Deferred cleanup | It is documented but not implemented; inventing a call during migration would expand scope. Revisit only in an approved later feature. |
| Google Cloud Text-to-Speech | Engine: `speech/providers/googleAuth.ts`, `google.ts`, `supportedTtsConfigurations.ts`, and `/api/tts` | Host does not use it | Must be adapted | Credentials and canonical speech must remain server-only; public unmetered use would spend paid quota. Stage 2: preserve provider validation and add names-only config docs; secure the route before exposure. |
| Lemonfox Text-to-Speech | Engine: `speech/providers/lemonfox.ts`, `supportedTtsConfigurations.ts`, and `/api/tts` | Host does not use it | Must be adapted | The bearer key and paid synthesis route require server isolation, authentication, quotas, and rate limits before public use. |

## 6. Environment inventory (names only)

No secret values were read into this report or recorded.

### 6.1 Host environment names

The host private environment file declares:

`DATABASE_URL`, `EMAIL_FROM`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `NEXT_PUBLIC_APP_URL`, `RESEND_API_KEY`, `STRIPE_PRICE_LIFETIME`, `STRIPE_PRICE_LIFETIME_CHILD`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_MONTHLY_CHILD`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.

The two `*_CHILD` Stripe price names are present but not referenced by current host source. The host has no committed `.env.example`.

Host source also reads the standard runtime name `NODE_ENV`; it is not a project secret or a private-file declaration.

### 6.2 Engine environment names

The engine source references only:

`GOOGLE_TTS_CLIENT_EMAIL`, `GOOGLE_TTS_PRIVATE_KEY`, `GOOGLE_TTS_PROJECT_ID`, `LEMONFOX_API_KEY`.

Its committed `.env.example` lists those same four names. Its ignored private `.env` also contains legacy/unreferenced names: `API_KEY_HASH_SECRET`, `DATABASE_URL`, `JWT_SIGNING_KEY`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `OAUTH_CLIENT_ID`, and `OAUTH_CLIENT_SECRET`.

### 6.3 Environment collisions

| Item | Conflict | Classification | Treatment |
|---|---|---|---|
| `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` | Appear in host `.env` and engine `.env`, but engine source does not use them | Must be adapted | Host owns their meanings through `prisma.config.ts`, `src/auth.ts`, and host services. Copying the engine private file risks secret replacement. Stage 2: retain host meanings and never copy the engine `.env`. |
| Google login versus Google TTS names | Distinct names and services | Safe to copy | Add TTS names without renaming host OAuth variables. |
| Unified environment documentation | Host lacks `.env.example`; engine `.env.example` is TTS-only; host `.gitignore` currently ignores examples | Must be adapted | Files: host `.gitignore` and engine `.env.example`. Stage 2: if approved, add `!.env.example` and create a names/placeholders-only host example; otherwise do not claim it can be committed. |
| Provider credential validation | Host lazily validates in `src/lib/stripe.ts` and `email.ts` while `src/auth.ts`, `db.ts`, and `prisma.config.ts` use non-null/optional reads; engine validates in `speech/providers/googleAuth.ts` and `lemonfox.ts` | Must be adapted | Owners remain their respective application service boundaries. Risk: centralizing carelessly can change startup/request failure timing or expose missing-variable details. Stage 2: preserve current safe client messages; Stage 3 may unify validation. |

## 7. Styling, theme, and font collision inventory

### 7.1 Global CSS ownership

Both applications have `src/app/globals.css`, import Tailwind, define global font tokens, and style `body`.

| Collision | Exact difference | Classification | Owner, files, risk, and treatment |
|---|---|---|---|
| Global file and `body` selector | Host body uses a cyan-to-cream gradient and host text token; engine uses a solid cyan page background and `--ink` | Styling conflict | Both apps own their `src/app/globals.css`. Copying the engine file would replace every host page background. Stage 2: keep host globals and scope learning background to a learning layout/container. |
| `--color-surface-soft` | Host resolves to `rgba(255,255,255,0.45)`; engine maps to raw `--surface-soft` at `0.72` | Styling conflict | Both `src/app/globals.css` files define the exact token. Overwrite would change host glass surfaces. Stage 2: namespace/map the engine meaning. |
| `--color-surface-strong` | Both resolve to `rgba(255,255,255,0.82)` | Safe to copy | Reuse host token after visual verification. |
| `--font-sans`, `--font-display` | Same names and intended font variables | Safe to copy | Reuse host theme tokens. |
| Engine raw variables | `--cyan`, `--lime`, `--navy`, `--ink`, `--muted`, tints, borders, shadows, page background | Styling conflict | Engine owns them in `src/app/globals.css`; `src/components/**` consumes them. They are undefined under host CSS. Stage 2: add a scoped compatibility mapping or convert to approved host tokens while preserving appearance. |
| Engine Tailwind theme aliases | `@theme inline` creates utilities such as `bg-navy`, `text-muted`, `border-hairline` | Styling conflict | Engine `src/app/globals.css` owns the aliases and engine components consume them. Omitting them drops styles; global merge can collide. Stage 2: merge through CSS-based Tailwind v4 only; never add `tailwind.config.*`. |
| Inline styles | Engine Button and nearly every Learning Window use style objects/raw CSS variables | Styling conflict | Engine files: `src/components/UI/Button.tsx`, `LearningWindows/**/*.tsx`, and vocabulary `components/Startup/*.tsx`. They violate host rules. Stage 2: make the minimum rule-compliant adaptation without redesign. |
| Default Tailwind colors | Engine uses examples such as `text-white` and `border-white/60` | Styling conflict | Engine files include `Blocks/Header.tsx`, `Sidebar.tsx`, and multiple Learning Windows. They violate host theme-only rules. Stage 2: map to host tokens before acceptance. |

The host additionally defines `bob` and `progressFill` keyframes plus `.reveal-item`; the engine defines no global selectors besides `:root` and `body`. There are no same-name keyframe/class collisions today.

### 7.2 Component naming and directory casing

| Collision | Evidence | Classification | Treatment |
|---|---|---|---|
| `components/ui` versus `components/UI` | Same case-folded directory name | Must be adapted | Stage 2: use host lowercase conventions or a distinct learning namespace; update every engine import. |
| `components/blocks` versus `components/Blocks` | Same case-folded directory name | Must be adapted | Stage 2: place engine blocks under a distinct learning/layout namespace. |
| `Button.tsx` | Host polymorphic children/anchor contract with `cta/primary/secondary`; engine label-driven button contract with `primary/secondary/ghost/accent` | Must be adapted | Stage 2: keep both under distinct names or adapt all engine consumers. Never overwrite host Button. |
| `Header.tsx` | Host responsive marketing navigation; engine static lesson/status header | Must be adapted | Stage 2: rename the engine component (for example, learning header) and keep route ownership separate. |
| `Block` | No exact `Block.tsx` exists in either app; host has `ExampleBlock`, engine has a `Blocks` directory | Deferred cleanup | No action unless a future generic Block is introduced. |
| `emojis.ts` | Host file exists but is empty; engine file exports six required constants | Must be adapted | Stage 2: merge the six exports into the host-owned file, preserving the no-inline-emoji rule. |
| Component docs `Button.md` | Exact doc path collision with incompatible contracts | Must be adapted | Stage 2: retain host doc and create a distinct learning-button doc if both components remain. |

## 8. Public assets and generated/local artifacts

| Item | Evidence | Classification | Treatment |
|---|---|---|---|
| `public/logo.png` | Same name and identical SHA-256 in both apps | Safe to copy | Keep the host asset; no copy is necessary. |
| `src/app/favicon.ico` | Same route-level filename but different SHA-256 | Route conflict | Preserve the host favicon unless a product decision explicitly replaces it. |
| `public/person.jpeg`, `public/sara.jpeg` | Host-only | Safe to copy | Retain. |
| Engine `Archive.zip`, `.DS_Store`, `tsconfig.tsbuildinfo` | Local/generated artifacts, not runtime source | Deferred cleanup | Never migrate; remove from a future source package only if requested. |
| Generated Prisma client | Host-only and gitignored/generated | Safe to copy | Preserve the generation process, not copied generated bytes. |

## 9. Complete collision ledger

This ledger covers every collision named in the feature specification. It does not assign classifications a second time; the canonical classified row is linked in the last column.

| Required collision | Owner and files | Exact risk and later treatment | Canonical inventory |
|---|---|---|---|
| Root pages | Host `src/app/(website)/page.tsx`; engine `src/app/page.tsx` | Both resolve `/`. Stage 2: host home wins; omit the engine redirect. | Section 4.2 engine routes |
| Duplicate `/playground` | Host and engine `src/app/playground/page.tsx`; engine `tests/e2e/wordSearchPlayground.e2e.ts` | Both resolve the same URL. Stage 2: merge or namespace and update E2E expectations. | Sections 4.1 and 4.2 |
| Learning routes under `/learning` | Engine `src/app/learning/[...learning]/page.tsx`; no host equivalent | The route must inherit host root/provider behavior without entering a host route group. Stage 2: copy at app root and verify teardown/rendering. | Sections 4.2 and 4.3 |
| API route names | Engine `src/app/api/learning/vocabulary/**/route.ts` and `src/app/api/tts/route.ts`; host `src/app/api/**` | No exact path collision, but generic TTS is an unmetered paid boundary. Stage 2: preserve namespaced routes and secure TTS. | Section 4.2 |
| `components/ui` versus `components/UI` | Host `src/components/ui`; engine `src/components/UI` | Case-only paths collide on macOS. Stage 2: rename/nest engine UI and rewrite imports. | Section 7.2 |
| `components/blocks` versus `components/Blocks` | Host `src/components/blocks`; engine `src/components/Blocks` | Case-only paths collide. Stage 2: use a learning-specific layout namespace. | Section 7.2 |
| Generic `Button` | Both `components/[ui\|UI]/Button.tsx`; both `docs/components/Button.md` | Incompatible props and variants would break callers/docs. Stage 2: retain distinct learning name or adapt every consumer. | Section 7.2 |
| Generic `Header` | Host `components/layout/header/Header.tsx`; engine `components/Blocks/Header.tsx` | Marketing and lesson/account responsibilities differ. Stage 2: rename the engine Header. | Section 7.2 |
| Generic `Block` | Host `components/blocks/ExampleBlock.tsx`; engine `components/Blocks/` directory; no exact `Block.tsx` | No current collision. Monitor if a generic Block is later introduced. | Section 7.2 |
| Global selectors | Both `src/app/globals.css` files own `body` | Copying engine globals changes every host page. Stage 2: host body wins; scope learning background. | Section 7.1 |
| Theme variables | Both global CSS files; four exact overlapping names | `--color-surface-soft` differs while the other three are compatible. Stage 2: map the soft token and reuse compatible tokens. | Section 7.1 |
| Font declarations | Both `src/app/layout.tsx` and global CSS files | Duplicate `next/font` ownership/loading options can change generated fonts. Stage 2: host loader wins; verify weights. | Sections 4.3 and 7.1 |
| Environment names | Both private `.env` files; host service files; engine TTS providers | Three stale engine names overlap active host meanings. Stage 2: never copy private engine env; retain host meanings. | Section 6.3 |
| Path aliases | Both `tsconfig.json` files use `@/* -> ./src/*` | After move, aliases target host source and expose case/name collisions. Stage 2: rewrite affected imports. | Section 3 |
| Public asset names | Both `public/logo.png` and both `src/app/favicon.ico` files | Logo is identical; favicon differs at the same route asset. Reuse host logo and favicon. | Section 8 |
| TypeScript/ESLint configuration | Both `tsconfig.json` and `eslint.config.mjs` files | Reference inclusion and explicit extensions make checks unreliable/failing. Stage 2: exclude references and choose one import policy. | Section 3 |
| Package module mode | Both `package.json` files; `prisma.config.ts`, `next.config.ts` | ESM semantics can change config/deployment loading. Stage 2: decide intentionally and verify. | Section 3 |
| Node pin/types | Both `package.json` files; engine `.nvmrc`; both lockfiles | Runtime/type mismatch can break engine test APIs. Stage 2: choose and declare one line. | Sections 1.2 and 3 |
| Scripts | Both `package.json` files | Dev bundlers and tests differ, while host postinstall must survive. Stage 2: preserve host build/start/postinstall and add tests deliberately. | Section 3 |
| `.gitignore`/environment example | Both `.gitignore` files; engine `.env.example` | Host currently cannot commit an example. Stage 2: add an exception only with an approved host example. | Sections 3 and 6.3 |

## 10. Architecture decisions that must survive migration

| Decision | Classification | Required preservation |
|---|---|---|
| Startup website is the host | Safe to copy | Root layout, home, Auth, Prisma, onboarding, subscriptions, Stripe, public/account routes remain host-owned. |
| Learning remains namespaced | Safe to copy | Runtime UI stays under `/learning`; do not move engine root redirect. |
| Engine remains subject-neutral | Safe to copy | Shared engine coordinates; vocabulary module teaches and owns progression; server validates; windows present. |
| Preserve behavior before improvement | Safe to copy | Migrate module/state/security tests with the code; avoid opportunistic refactors. |
| No component consolidation in Stage 1 | Safe to copy | This report recommends later treatment only; no components were merged. |
| No styling redesign in Stage 1 | Safe to copy | This report records collisions only. |
| No production-user progress integration yet | Deferred cleanup | Stage 3 design item; no schema or database writes now. |
| Reference remains immutable | Safe to copy | `references/learning-engine` is comparison evidence, not a writable source tree. |

## 11. Recommended staged treatment

### Stage 2 — behavior-preserving host integration

1. Resolve Next/ESLint, Node/types, Tailwind/PostCSS, ESM, `server-only`, `tsx`, and `playwright-core` decisions; regenerate one root lockfile.
2. Exclude `references/**` from host TypeScript and ESLint checks.
3. Move only namespaced `/learning` and engine API routes; omit the engine root page.
4. Namespace or rename case-colliding UI/Blocks, Button, Header, and docs; merge emoji exports.
5. Reuse the host root layout, fonts, AuthProvider, metadata, Prisma generation, proxy, and website routes.
6. Add a scoped learning-theme compatibility layer without changing host body/theme semantics or redesigning the engine.
7. Preserve server-only answer data, opaque capabilities, strict parsers, speech cancellation, and learner-safe errors.
8. Merge or namespace the engine playground; update and run all unit, integration, security, and E2E tests.
9. Keep anonymous/in-memory learning behavior until Stage 3, while preventing generic paid TTS from being publicly exploitable.

### Stage 3 — product integration and cleanup

1. Design the authenticated host-user/child-to-learning-session boundary.
2. Design persistent, multi-instance lesson progress/capability storage in an application-owned layer without contaminating the shared engine with Prisma or subject logic.
3. Add TTS quotas, rate limits, usage tracking, and authorization.
4. Replace static engine account/header placeholders with host-owned account UI.
5. Consolidate validation/style utilities only after parity and security tests remain green.
6. Add deployment/CI automation and unified environment documentation if approved.

## 12. Verification of Stage 1 boundaries

- Inspected both `package.json` files and both lockfiles without installing, removing, or upgrading packages.
- Inspected both Next, TypeScript, ESLint, PostCSS, Tailwind/global CSS, route, layout, provider, API, source, test, docs, environment-name, and public-asset structures.
- Confirmed the engine has no Prisma/database implementation and no middleware/proxy.
- Confirmed the host retains all Auth, Prisma, onboarding, subscription, Stripe, public-page, and account ownership.
- Confirmed `references/learning-engine` was not modified.
- Confirmed no application code, dependencies, configuration, lockfiles, or environment files were changed.

## Final verdict

`INVENTORY COMPLETE`
