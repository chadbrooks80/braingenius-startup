# Application and Route Map

## Layouts and providers

| Scope | Source | Boundary and composition |
| --- | --- | --- |
| All routes | `src/app/layout.tsx` | Server layout; fonts, `globals.css`, metadata, and client `src/app/auth/Provider.tsx` (`SessionProvider`). |
| Website group | `src/app/(website)/layout.tsx` | Server layout; adds `Header` and a flexible content wrapper. |
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
| `/reset-password` | `src/app/(auth)/reset-password/page.tsx` | Client | Reads `token` and `email`, validates matching passwords, then calls reset confirmation. |
| `/getting-started` | `src/app/(auth)/(onboarding)/getting-started/page.tsx` | Server | Requires a server session and existing user, computes the authoritative onboarding route, and renders one onboarding step in `OnboardingShell`. While the user is on `PLAN`, `?checkout=success&session_id=...` triggers server-side Stripe retrieval and shared ownership/price/mode/payment/subscription verification. Only a confirmed entitled result may call the conditional `advanceParentOnboardingStep`; forged, missing, foreign, pending, inactive, or failed confirmation remains on `PLAN`. Proxy also redirects signed-in users whose funnel target differs. |
| `/dashboard` | `src/app/(app)/dashboard/page.tsx` | Server | Placeholder. Protected by two independent boundaries: the proxy redirects an anonymous request to `/sign-in` (carrying the requested path as `callbackUrl`) and redirects an authenticated user whose onboarding target is not `/dashboard`; `src/app/(app)/dashboard/layout.tsx` separately redirects a missing/invalid server session to `/sign-in`, covering this page and any future nested `/dashboard/...` page. |
| `/learning/:module/:variables*` | `src/app/(app)/(learning)/learning/[...learning]/page.tsx` | Client | Creates a route-keyed `LearningEngine`, renders optional learning layout plus `ScreenRenderer`, aborts stale initialization, and cancels speech on teardown. No source-level auth check or proxy matcher covers this URL. The working fixture is `/learning/vocabulary/word_list_id`. |

## Playground routes

| URL | Source | Purpose and access |
| --- | --- | --- |
| `/playground` | `src/app/playground/page.tsx` | Server-rendered marketing component examples; no gate. |
| `/le-playground` | `src/app/le-playground/page.tsx` | Client Learning Window gallery, including word-search states; no gate. |
| `/playground/register` | `src/app/playground/register/page.tsx` | Client `useActionState` wrapper over `registerUser`; no gate. |
| `/playground/restrict` | `src/app/playground/restrict/page.tsx` | Server page that redirects to `/sign-in` without a session. |
| `/playground/users` | `src/app/playground/users/page.tsx`, `src/app/playground/users/signInOut.tsx` | Server page gated by a server session check; redirects unauthenticated requests to `/sign-in` before querying any data, then renders only the active session identity and sign-out control. |

## Proxy-controlled paths

`src/proxy.ts` matches `/dashboard/:path*` and `/getting-started`. It reads the NextAuth JWT with `NEXTAUTH_SECRET` after resolving the request pathname. Without a token, a `/dashboard` or `/dashboard/...` path redirects to `/sign-in?callbackUrl=<sanitized-requested-path>`; every other unmatched-token path continues. With a token, it redirects according to `getOnboardingRoute`. The `/getting-started` page and the `/dashboard` route group layout both separately enforce a server session.

## API routes

There are 10 current `route.ts` files:

| Methods and URL | Source | Owner |
| --- | --- | --- |
| `GET`, `POST /api/auth/[...nextauth]` | `src/app/api/auth/[...nextauth]/route.ts` | NextAuth |
| `POST /api/auth/password-reset/request` | `src/app/api/auth/password-reset/request/route.ts` | Account recovery |
| `POST /api/auth/password-reset/confirm` | `src/app/api/auth/password-reset/confirm/route.ts` | Account recovery |
| `POST /api/auth/resend-verification-code` | `src/app/api/auth/resend-verification-code/route.ts` | Email verification |
| `POST /api/auth/verify-email-code` | `src/app/api/auth/verify-email-code/route.ts` | Email verification |
| `POST /api/learning/vocabulary/content` | `src/app/api/learning/vocabulary/content/route.ts` | Vocabulary content/capabilities |
| `POST /api/learning/vocabulary/submit-answer` | `src/app/api/learning/vocabulary/submit-answer/route.ts` | Vocabulary grading |
| `POST /api/learning/vocabulary/speech` | `src/app/api/learning/vocabulary/speech/route.ts` | Protected Vocabulary speech (authenticated, entitled, metered) |
| `POST /api/tts` | `src/app/api/tts/route.ts` | Shared public-text TTS (authenticated, entitled, metered) |
| `POST /api/webhooks/stripe` | `src/app/api/webhooks/stripe/route.ts` | Stripe synchronization |

Request/response details are in [API Routes](../reference/api-routes.md).
