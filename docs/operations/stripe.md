# Stripe Operations

Use Stripe test mode for local development and verification.

## Configuration names

- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_MONTHLY`
- `STRIPE_PRICE_LIFETIME`
- `NEXTAUTH_URL` for Checkout return URLs

Do not put values or live account identifiers in documentation or commits.

## Checkout and webhook ownership

`src/actions/checkout.ts` creates authenticated Checkout Sessions. `src/lib/stripe.ts` owns the lazy SDK client and configured price allowlist. `src/app/api/webhooks/stripe/route.ts` verifies webhook signatures and updates the Prisma `Subscription`.

Configure the two price variables to test-mode Prices matching the intended monthly subscription and lifetime one-time payment. The application chooses mode by plan and never accepts a price ID from the browser.

## Local forwarding

Run the app with `npm run dev`, configure Stripe CLI or another approved test-mode forwarder to send events to:

```text
http://localhost:3000/api/webhooks/stripe
```

Use the signing secret produced for that forwarding session as the local `STRIPE_WEBHOOK_SECRET`. Do not reuse production secrets.

## Local source of truth and verification

Account creation writes a three-day `FREE_TRIAL` row. Paid state changes only through the verified webhook:

- paid `checkout.session.completed` upserts identifiers, price, status, and mapped tier;
- subscription update synchronizes status/period/cancellation;
- subscription delete sets `CANCELED`.

Verify in test mode that an invalid signature makes no database change, a paid supported price maps to the expected tier, and update/delete events find the stored subscription ID. There are currently no automated Stripe tests, so this is manual integration verification.

## Deployment notes and limitations

Run database migrations with `npx prisma migrate deploy` before starting a production version that depends on new schema. Configure the deployed webhook endpoint and production signing secret separately from test mode.

The current code has no durable webhook event-ID ledger, customer portal, cancellation UI, or retry/reconciliation job. The onboarding page also advances the plan step from `checkout=success` without first validating Stripe state; do not treat that query value as proof of entitlement.
