# Application and Route Map

## Layouts and providers

| Scope | Source | Boundary and composition |
| --- | --- | --- |
| All routes | `src/app/layout.tsx` | Server layout; fonts, `globals.css`, metadata, and client `src/app/auth/Provider.tsx` (`SessionProvider`). |
| Website group | `src/app/(website)/layout.tsx` | Server layout; adds `Header` and a flexible content wrapper. |
| App group | `src/app/(app)/layout.tsx` | Server layout; database-authoritative account gate shared by dashboard and the learning group (both nest under it). Fails a signed-in session whose `User` row no longer exists closed to `/sign-in`, and redirects a signed-in `mustResetPassword` session to `/required-password-reset`, before either group renders; takes no action for an anonymous request, so public learning stays public. |
| Learning group | `src/app/(app)/(learning)/layout.tsx` | Server layout; adds Learning Engine metadata and `.learning-shell`. |
| Dashboard group | `src/app/(app)/dashboard/layout.tsx` | Server layout; redirects to `/sign-in` when `getServerSession(authOptions)` has no session user, independently of the proxy, and applies to every current and future nested `/dashboard/...` page. |

Route-group names do not create URLs and do not themselves prove authentication.

## User-facing routes

| URL | Source | Boundary | Access and composition proven by source |
| --- | --- | --- | --- |
| `/` | `src/app/(website)/page.tsx` | Server | Public marketing composition: `Hero`, trust, features, process, word-generator, testimonials, CTA. |
| `/blog` | `src/app/(website)/blog/page.tsx` | Server | Public placeholder text. |
| `/sign-up` | `src/app/(auth)/(onboarding)/sign-up/page.tsx` | Client | Credentials registration and inline email-code verification, or Google sign-in; no page-level redirect. |
| `/sign-in` | `src/app/(auth)/sign-in/page.tsx` | Client | Credentials or Google sign-in. The supplied `callbackUrl` is sanitized once through `src/lib/auth-return-path.ts` before use; every rejected, missing, or unsafe value falls back to `/dashboard`. |
| `/verify-email` | `src/app/(auth)/verify-email/page.tsx` | Client | Reads `email` from search parameters and calls verification/resend APIs. |
| `/forgot-password` | `src/app/(auth)/forgot-password/page.tsx` | Client | Requests a reset through a generic-response API. |
| `/reset-password` | `src/app/(auth)/reset-password/page.tsx` | Client | Reads `token` and `email`, validates matching passwords, then calls reset confirmation, which also clears `mustResetPassword`. |
| `/required-password-reset` | `src/app/(auth)/required-password-reset/page.tsx`, `.../RequiredPasswordResetForm.tsx` | Server + Client | Requires a server session and existing user; renders the reset form only while the database still says `mustResetPassword` is true and a credentials password exists, otherwise redirects to the account's current authoritative destination (or `/sign-in`). The form calls `submitRequiredPasswordReset`, then `session.update()` before navigating to the returned destination. |
| `/getting-started` | `src/app/(auth)/(onboarding)/getting-started/page.tsx` | Server | Requires a server session and existing user (redirecting a missing session or a missing `User` row to `/sign-in`), computes the authoritative destination through `getAccountAccessRoute` (reset-required wins over onboarding), and renders one onboarding step in `OnboardingShell`. While the user is on `PLAN`, `?checkout=success&session_id=...` triggers server-side Stripe retrieval and shared ownership/price/mode/payment/subscription verification. Only a confirmed entitled result may call the conditional `advanceParentOnboardingStep`; forged, missing, foreign, pending, inactive, or failed confirmation remains on `PLAN`. The proxy no longer participates in this route's redirect decision — the page alone re-reads the database and redirects. |
| `/dashboard` | `src/app/(app)/dashboard/page.tsx` | Server | Placeholder. Protected by three independent boundaries: the proxy redirects only an anonymous request to `/sign-in` (carrying the requested path as `callbackUrl`); `src/app/(app)/layout.tsx` redirects a database-confirmed missing account to `/sign-in` and a `mustResetPassword` session to `/required-password-reset`; `src/app/(app)/dashboard/layout.tsx` separately redirects a missing/invalid server session to `/sign-in`, covering this page and any future nested `/dashboard/...` page. |
| `/learning/:module/:variables*` | `src/app/(app)/(learning)/learning/[...learning]/page.tsx` (Server wrapper) + `src/components/learning-engine/LearningRouteClient.tsx` (Client host) | Server + Client | The Server Component wrapper calls `authorizeLearningModuleAccess(moduleName)` before any client Learning Engine initialization: an unregistered module (`MODULE_NOT_FOUND`) renders `LearningRouteClient` unchanged so the existing client-owned "module not found" presentation stays authoritative; malformed module settings resolve to `unavailable` and render the generic `LearningModuleAccessUnavailable`; an anonymous request to a registered, subscription-protected module redirects to `/sign-in?callbackUrl=<this route>`; an authenticated caller without an allowed current tier (`forbidden` or `unavailable`) renders `LearningModuleAccessUnavailable`; a granted caller renders `LearningRouteClient`. `LearningRouteClient` preserves the exact prior route-keyed `LearningEngine` creation, learning layout/`ScreenRenderer` rendering, and the one current `{ requestId }` speech-failure notice unchanged — it renders `SpeechPlaybackFailureBanner` once above the learning header/content, uses request-ID-safe dismissal so stale timers cannot clear newer failures, aborts stale initialization, and cancels speech on teardown. Screen replacement clears the old notice; successful playback clears an existing notice. No proxy matcher covers this URL, but `src/app/(app)/layout.tsx` redirects a signed-in missing-account or `mustResetPassword` session before this page renders. The server always re-resolves current database entitlement before granting access; the JWT/session `subscriptionTier` claim is context only. The Vocabulary route ID is a real `ModVocabList.id` owned by the signed-in user, currently requiring `MONTHLY`, `LIFETIME`, or `ADMIN`. See [Learning Module access](security-and-server-boundaries.md#learning-module-access). |

## Playground routes

| URL | Source | Purpose and access |
| --- | --- | --- |
| `/playground` | `src/app/playground/page.tsx` | Server-rendered marketing component examples; no gate. |
| `/le-playground` | `src/app/le-playground/page.tsx` | Client Learning Window gallery, including word-search states; no gate. |
| `/playground/register` | `src/app/playground/register/page.tsx` | Client `useActionState` wrapper over `registerUser`; no gate. |
| `/playground/restrict` | `src/app/playground/restrict/page.tsx` | Server page gated by the same database-authoritative account gate as the `(app)` layout (`resolveSessionAccountAccess`): redirects an anonymous or missing-account session to `/sign-in` and a reset-required session to `/required-password-reset` before rendering. |
| `/playground/users` | `src/app/playground/users/page.tsx`, `src/app/playground/users/signInOut.tsx` | Server page gated the same way: redirects an anonymous request to `/sign-in?callbackUrl=%2Fplayground%2Fusers`, a missing-account session to `/sign-in`, and a reset-required session to `/required-password-reset`, before querying any data or rendering the active session identity and sign-out control. |

## Proxy-controlled paths

`src/proxy.ts` matches only `/dashboard/:path*` and makes no allow/deny or routing decision from JWT claims such as `mustResetPassword` or onboarding state — a stale token can neither grant protected content nor send a database-required account away from the reset page, so it can't form a two-way redirect loop against the database-authoritative pages underneath. It reads the NextAuth JWT with `NEXTAUTH_SECRET` only to decide whether a request is anonymous; without a token, a `/dashboard` or `/dashboard/...` path redirects to `/sign-in?callbackUrl=<sanitized-requested-path>`, and every other request (including an authenticated one, and any request to `/getting-started` or `/required-password-reset`, which are no longer in the matcher) passes through untouched. The `/getting-started` page, `src/app/(app)/layout.tsx`, the `/dashboard` route group layout, and both auth-only playground pages all separately re-read the database and are the actual authority for account existence and reset state.

## API routes

There are 10 current `route.ts` files:

| Methods and URL | Source | Owner |
| --- | --- | --- |
| `GET`, `POST /api/auth/[...nextauth]` | `src/app/api/auth/[...nextauth]/route.ts` | NextAuth |
| `POST /api/auth/password-reset/request` | `src/app/api/auth/password-reset/request/route.ts` | Account recovery |
| `POST /api/auth/password-reset/confirm` | `src/app/api/auth/password-reset/confirm/route.ts` | Account recovery |
| `POST /api/auth/resend-verification-code` | `src/app/api/auth/resend-verification-code/route.ts` | Email verification |
| `POST /api/auth/verify-email-code` | `src/app/api/auth/verify-email-code/route.ts` | Email verification |
| `POST /api/learning/vocabulary/content` | `src/app/api/learning/vocabulary/content/route.ts` | Vocabulary content/capabilities (module-access gated) |
| `POST /api/learning/vocabulary/submit-answer` | `src/app/api/learning/vocabulary/submit-answer/route.ts` | Vocabulary grading (module-access gated) |
| `POST /api/learning/vocabulary/speech` | `src/app/api/learning/vocabulary/speech/route.ts` | Protected Vocabulary speech (module-access gated, then authenticated, entitled, metered) |
| `POST /api/tts` | `src/app/api/tts/route.ts` | Shared public-text TTS (authenticated, entitled, metered) |
| `POST /api/webhooks/stripe` | `src/app/api/webhooks/stripe/route.ts` | Stripe synchronization |

Request/response details are in [API Routes](../reference/api-routes.md).
