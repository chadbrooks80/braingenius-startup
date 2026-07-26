# Billing and Subscriptions

## Ownership

- `src/lib/stripe.ts`: lazy Stripe client, paid-plan type, configured price map, and reverse price mapping.
- `src/actions/checkout.ts`: authenticated Checkout Session creation.
- `src/app/api/webhooks/stripe/route.ts`: signature verification and subscription synchronization.
- `src/lib/subscription.ts`: three-day free-trial dates.
- `src/components/onboarding/PlanStep.tsx`: client plan UI and redirect to Stripe.
- Prisma `Subscription`: local application record.

## Checkout flow

`createCheckoutSession("MONTHLY" | "LIFETIME")` derives user identity from the server session and selects `STRIPE_PRICE_MONTHLY` or `STRIPE_PRICE_LIFETIME`. Monthly uses Stripe `subscription` mode; lifetime uses `payment`. Existing `stripeCustomerId` is reused; otherwise customer email is supplied. Success/cancel URLs use `NEXTAUTH_URL` or the local fallback and return to `/getting-started`.

The action returns a safe error or a hosted URL. `PlanStep` locks both paid buttons while a Checkout request is pending and uses `window.location.href` on success.

## Local subscription state

Every new credentials or OAuth user receives one `FREE_TRIAL` subscription with three-day start/end dates. The database is the application's local state; verified Stripe events update Stripe lifecycle fields.

On `checkout.session.completed`, the webhook requires `payment_status === "paid"`, an existing referenced user, and reads the first line-item price. It upserts customer/subscription/price/status and maps only configured prices to `MONTHLY` or `LIFETIME`.

Subscription update/delete events update the row matched by Stripe subscription ID. Deletion sets tier `CANCELED`; update maps the configured price, status, current period end, and `cancelAtPeriodEnd`.

## Validation and failures

The webhook requires `stripe-signature` and `STRIPE_WEBHOOK_SECRET` and calls `constructEvent` on the raw text. Invalid/missing signatures return `400`. Unsupported verified event types are acknowledged without mutation.

Current limitations:

- no focused billing/webhook automated tests;
- no durable event-ID idempotency table;
- missing metadata, unpaid completion, missing user, or unknown prices are silently skipped and acknowledged;
- the UI displays fixed prices/benefits that are not derived from Stripe configuration;
- `/getting-started?checkout=success` advances onboarding without verifying the Checkout Session or re-reading webhook-synchronized subscription state;
- no cancellation/customer-portal UI is present.

Variable names and setup are in [Stripe Operations](../operations/stripe.md).
