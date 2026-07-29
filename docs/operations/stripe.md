# Stripe Operations

Use Stripe test mode for local development and verification.

## Configuration names

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_LIFETIME`
- `NEXTAUTH_URL`, or `NEXT_PUBLIC_APP_URL` as the secondary trusted Checkout return origin

Do not put values or live account identifiers in documentation or commits.

## Checkout and webhook ownership

`src/actions/checkout.ts` creates authenticated Checkout Sessions. `src/lib/stripe.ts` owns the lazy SDK client and configured price allowlist. `src/lib/billing/stripe-state.ts` owns Checkout verification and Stripe-to-local translation. `src/app/api/webhooks/stripe/route.ts` verifies signatures over the raw body and delegates supported events to that service.

Configure the two price variables to test-mode Prices matching the intended monthly subscription and lifetime one-time payment. The application chooses mode by plan and never accepts a price ID from the browser.

## Local forwarding

Run the app with `npm run dev`, configure Stripe CLI or another approved test-mode forwarder to send events to:

```text
http://localhost:3000/api/webhooks/stripe
```

Use the signing secret produced for that forwarding session as the local `STRIPE_WEBHOOK_SECRET`. Do not reuse production secrets.

## Local source of truth and verification

Account creation writes a three-day `FREE_TRIAL` row. A successful Checkout return contains the untrusted `session_id` placeholder value. The server retrieves that session from Stripe and verifies authenticated ownership, approved quantity-one price, matching mode, complete/paid state, and monthly Subscription lifecycle before synchronizing and advancing onboarding. Webhooks remain required; return handling uses the same idempotent synchronization so delayed webhook delivery does not strand a paid user.

- paid `checkout.session.completed` and `checkout.session.async_payment_succeeded` synchronize Checkout state;
- completed-but-unpaid state remains pending and grants nothing;
- subscription update synchronizes price, Stripe Subscription status, period, cancellation, and fail-closed tier;
- subscription delete sets status and tier to `CANCELED`.

Monthly entitlement requires the configured monthly price, `active` or `trialing`, and an unexpired current period. Cancel-at-period-end remains entitled only before period end. `past_due`, `unpaid`, `incomplete`, `incomplete_expired`, `paused`, `canceled`, unknown, expired, and price-mismatched state denies. Lifetime requires the configured lifetime price plus explicit paid state.

Automated coverage verifies signature rejection, shared checkout dispatch, delayed payment, lifecycle allowlisting, unknown prices, restoration, deletion, duplicate delivery, and retryable processing failures. Test-mode integration should still verify monthly success, lifetime success, canceled return, and an inactive subscription update when a safe local Stripe setup is available.

## Deployment notes and limitations

Run database migrations with `npx prisma migrate deploy` before starting a production version that depends on new schema. Configure the deployed webhook endpoint and production signing secret separately from test mode.

The current code has no durable webhook event-ID ledger, customer portal, cancellation UI, or reconciliation job. Audit #27's full stale/out-of-order event recovery architecture remains deferred.
