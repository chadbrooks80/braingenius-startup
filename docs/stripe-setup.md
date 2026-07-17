# Stripe Test-Mode Setup

This project uses Stripe Checkout (test mode) for paid plan upgrades. The free trial does not
require Stripe — it's created automatically on signup.

## Environment Variables

Set these in `.env` (test-mode keys, from the Stripe Dashboard in test mode):

| Variable | Description |
|---|---|
| `STRIPE_SECRET_KEY` | Test-mode secret key (`sk_test_...`) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for the `/api/webhooks/stripe` endpoint (`whsec_...`) |
| `STRIPE_PRICE_MONTHLY` | Price ID for the monthly plan |
| `STRIPE_PRICE_LIFETIME` | Price ID for the lifetime plan |
| `STRIPE_PRICE_MONTHLY_CHILD` | Price ID for the monthly additional-child add-on |
| `STRIPE_PRICE_LIFETIME_CHILD` | Price ID for the lifetime additional-child add-on |

## Creating Test Products/Prices

In the Stripe Dashboard (test mode), create:

1. **Monthly** — recurring price, $3.99/month (use a 3-month introductory phase or a coupon for
   the first 3 months in Stripe, then $9.99/month).
2. **Lifetime** — one-time price, $149.99.
3. **Monthly additional child** — recurring price, $0.99/month for 3 months then $3.99/month.
4. **Lifetime additional child** — one-time price, $69.99.

Copy each price ID into the matching env var above.

## Webhook

Point a Stripe CLI listener or Dashboard webhook at `/api/webhooks/stripe` for these events:

- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Local testing:

```sh
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The webhook handler updates the local `Subscription` record (`tier`, `stripeCustomerId`,
`stripeSubscriptionId`, `stripePriceId`, `stripeStatus`, `currentPeriodEnd`). The app reads
subscription access from this local record — it does not call Stripe on every page load.

## Checkout Flow

`src/actions/checkout.ts` (`createCheckoutSession`) creates a Stripe Checkout Session for the
signed-in user and returns its URL. It's called from the plan step of `/getting-started`. If the
relevant price env var isn't set, it returns an error instead of throwing, so onboarding can
continue on the free trial without Stripe configured.