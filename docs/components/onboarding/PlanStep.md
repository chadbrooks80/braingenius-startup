# PlanStep

Source: `src/components/onboarding/PlanStep.tsx`

## Purpose and boundary

Client onboarding plan screen. It presents fixed trial/paid plan copy, starts server-owned Stripe Checkout, or advances with the existing free trial.

## Props

| Prop | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `checkoutCanceled` | `boolean` | Yes | — | Seeds the initial canceled-checkout message. |

## Structure and behavior

Local state tracks free-trial error/pending and paid-plan error/current loading plan. `handleUpgrade` calls `createCheckoutSession`, clears pending, displays safe failure, or assigns `window.location.href`. While any paid Checkout is loading, both paid buttons are disabled. `handleFreeTrial` calls `continueWithFreeTrial`; success refreshes the route so server funnel state selects the next step.

The cards and displayed prices/benefits are fixed in component source rather than loaded from Stripe.

## Styling and accessibility

Uses `Eyebrow`, `CheckBadge`, and `Button`. Visible text identifies plans and pending/error states. Error paragraphs are not live regions.

## Consumers and tests

Rendered by `/getting-started` at `PLAN`, with cancellation derived from search params. No focused test exists.

## Ownership and limitation

The browser never supplies a price ID; the Server Action maps the plan. The page's separate `checkout=success` behavior is server-route logic and currently advances onboarding without subscription verification.

## Usage

```tsx
<PlanStep checkoutCanceled={false} />
```
