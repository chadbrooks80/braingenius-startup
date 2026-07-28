# Environment Variables

This inventory lists names only. Never place real values in documentation, source, logs, or a handoff archive.

| Variable | Owner/read timing | Classification and requirement |
| --- | --- | --- |
| `DATABASE_URL` | `prisma.config.ts` and `src/lib/db.ts` when Prisma config/client initializes | Server secret; required for database-backed application work. |
| `NEXTAUTH_SECRET` | `src/proxy.ts` per matched request; NextAuth also requires consistent signing config | Server secret; required for valid production JWT/session behavior. |
| `NEXTAUTH_URL` | Checkout action when constructing return URLs; first candidate read by `resolveAppBaseUrl()` in `src/lib/app-base-url.ts` | Server URL; optional in source with local `http://localhost:3000` fallback outside production. |
| `NEXT_PUBLIC_APP_URL` | Second candidate read by `resolveAppBaseUrl()` in `src/lib/app-base-url.ts` when building the password-reset URL | Public base URL; conditionally required for usable reset links. |
| `GOOGLE_CLIENT_ID` | `src/auth.ts` during auth configuration | Server-side provider setting; required for Google OAuth. |
| `GOOGLE_CLIENT_SECRET` | `src/auth.ts` during auth configuration | Server secret; required for Google OAuth. |
| `RESEND_API_KEY` | Lazy initialization in `src/lib/email.ts` | Server secret; required when sending verification/reset email. |
| `EMAIL_FROM` | Each email send | Server mail identity; required when Resend delivery is used. |
| `STRIPE_SECRET_KEY` | Lazy initialization in `src/lib/stripe.ts` | Server secret; required for Checkout and webhook SDK operations. |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook per request | Server secret; required to accept webhooks. |
| `STRIPE_PRICE_MONTHLY` | `src/lib/stripe.ts` module initialization | Server configuration; required to offer monthly Checkout and map events. |
| `STRIPE_PRICE_LIFETIME` | `src/lib/stripe.ts` module initialization | Server configuration; required to offer lifetime Checkout and map events. |
| `GOOGLE_TTS_CLIENT_EMAIL` | Google TTS credential read | Server credential identity; required when Google TTS is used. |
| `GOOGLE_TTS_PRIVATE_KEY` | Google TTS credential read | Server secret; required when Google TTS is used; escaped newlines are normalized in memory. |
| `GOOGLE_TTS_PROJECT_ID` | Google TTS credential read | Optional server project/billing header configuration. |
| `LEMONFOX_API_KEY` | Lemonfox synthesis call | Server secret; required only when the allowlisted Lemonfox voice is used. |
| `NODE_ENV` | Prisma singleton caching behavior | Runtime-provided environment marker; production disables global client reuse. |

No tracked `.env.example` exists. For local work, create an untracked environment file appropriate to Next.js, use test/sandbox provider credentials, and configure only the services being exercised. `.env*` files are excluded from the implementation handoff.
