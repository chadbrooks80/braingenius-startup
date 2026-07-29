# Billing and Subscriptions

## Ownership

- `src/lib/stripe.ts`: lazy Stripe client, paid-plan type, and configured price map.
- `src/lib/billing/entitlement.ts`: pure allowlisted entitlement evaluation.
- `src/lib/billing/stripe-state.ts`: server-only Checkout verification and shared Stripe-to-local synchronization.
- `src/actions/checkout.ts`: authenticated Checkout Session creation.
- `src/app/api/webhooks/stripe/route.ts`: signature verification and delegation to shared synchronization.
- `src/lib/subscription.ts`: three-day free-trial dates.
- `src/components/onboarding/PlanStep.tsx`: client plan UI and redirect to Stripe.
- Prisma `Subscription`: local application record.

## Checkout flow

`createCheckoutSession("MONTHLY" | "LIFETIME")` derives user identity from the server session and selects `STRIPE_PRICE_MONTHLY` or `STRIPE_PRICE_LIFETIME`. Monthly uses Stripe `subscription` mode; lifetime uses `payment`. Existing `stripeCustomerId` is reused; otherwise customer email is supplied, and lifetime Checkout creates a customer so the successful one-time state can retain its Stripe customer reference. Return URLs use the trusted origin from `resolveAppBaseUrl()`. The success URL is `/getting-started?checkout=success&session_id={CHECKOUT_SESSION_ID}` and the cancel URL is `/getting-started?checkout=canceled`.

The action returns a safe error or a hosted URL. `PlanStep` locks both paid buttons while a Checkout request is pending and uses `window.location.href` on success.

The success query and session ID are untrusted navigation input. While the database user is still on `PLAN`, the server retrieves the session from Stripe, requires the authenticated user to match `client_reference_id`, requires exactly one quantity-one approved price, checks the plan's mode, complete/paid state, and (for monthly) the actual Stripe Subscription lifecycle. It advances through `advanceParentOnboardingStep()` only after synchronization produces a positive entitlement result. Missing, forged, foreign, incomplete, unpaid, inactive, or failed confirmation stays on `PLAN` with neutral feedback.

## Local state and entitlement

Every new credentials or OAuth user receives one `FREE_TRIAL` subscription with three-day start/end dates. The database is the application's local state; verified Stripe events update Stripe lifecycle fields.

Access is evaluated by one strict allowlist:

- `ADMIN` grants without Stripe state.
- `FREE_TRIAL` grants only while `trialEndsAt` is strictly in the future.
- `LIFETIME` grants only with the configured lifetime price and local Stripe status `paid`.
- `MONTHLY` grants only with the configured monthly price, Stripe Subscription status `active` or `trialing`, and `currentPeriodEnd` strictly in the future. `cancelAtPeriodEnd` retains access only through that boundary.
- `past_due`, `unpaid`, `incomplete`, `incomplete_expired`, `paused`, `canceled`, missing, unknown, expired, and price-mismatched monthly state denies access. Null/unknown/canceled tiers also deny.

Tier or status alone never grants access. Unknown future values fail closed.

`checkout.session.completed` and `checkout.session.async_payment_succeeded` use the same idempotent Checkout synchronization as the return page. Monthly synchronization stores Stripe Subscription status—not Checkout payment status—plus customer/subscription/price/period/cancellation state. Lifetime stores explicit paid one-time state and clears monthly-only lifecycle fields. Expected delayed payment remains pending and mutates nothing.

Subscription updates persist current Stripe state and retain `MONTHLY` only when the shared entitlement policy grants; inactive or unapproved state clears paid tier. A later qualifying update restores it. Deletion stores `CANCELED`. Supported processing failures return non-success so Stripe can retry.

## Validation and failures

The webhook requires `stripe-signature` and `STRIPE_WEBHOOK_SECRET` and calls `constructEvent` on the raw text. Invalid/missing signatures return `400`. Unsupported verified event types are acknowledged without mutation.

Focused automated coverage lives in `tests/billing/entitlement.test.ts`, `tests/billing/checkoutConfirmation.test.ts`, `tests/billing/stripeWebhook.test.ts`, and the real page boundary in `tests/auth/gettingStartedPage.test.ts`.

Current limitations:

- no durable event-ID idempotency table;
- durable out-of-order event handling and reconciliation remain deferred under audit #27;
- the UI displays fixed prices/benefits that are not derived from Stripe configuration;
- no cancellation/customer-portal UI is present.

Variable names and setup are in [Stripe Operations](../operations/stripe.md).
