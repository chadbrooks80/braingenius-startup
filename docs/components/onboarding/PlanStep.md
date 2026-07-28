# PlanStep

Source: `src/components/onboarding/PlanStep.tsx`

## Purpose and boundary

Client onboarding plan screen. It presents fixed trial/paid plan copy, starts server-owned Stripe Checkout, or advances with the existing free trial.

## Props

| Prop | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `checkoutCanceled` | `boolean` | Yes | — | Seeds the initial canceled-checkout message. |

## Structure and behavior

Local state tracks free-trial error/pending and paid-plan error/current loading plan. `handleUpgrade` calls `createCheckoutSession`, clears pending, displays safe failure, or assigns `window.location.href`. While any paid Checkout is loading, both paid buttons are disabled. `handleFreeTrial` calls `continueWithFreeTrial`; the `recovery` and `unauthenticated` branches are handled by the shared `handleOnboardingRecovery` helper from `src/lib/onboarding-client.ts` (replace to the database-authoritative destination and refresh, or replace to `/sign-in`); otherwise `success` refreshes the route so server funnel state selects the next step and `error` restores the button and shows the safe message.

The cards and displayed prices/benefits are fixed in component source rather than loaded from Stripe.

## Styling and accessibility

Uses `Eyebrow`, `CheckBadge`, and `Button`. Visible text identifies plans and pending/error states. Error paragraphs are not live regions.

## Consumers and tests

Rendered by `/getting-started` at `PLAN`, with cancellation derived from search params. The underlying action is covered by `tests/auth/onboardingActions.test.ts`; the shared recovery/session-refresh contract this component delegates to is covered by `tests/auth/onboardingClientRecovery.test.ts`. There is still no full DOM-rendered component-level test.

## Ownership and limitation

The browser never supplies a price ID; the Server Action maps the plan. The page's separate `checkout=success` behavior is server-route logic; it advances `PLAN → CHILDREN` through the same conditional database-authoritative write as the free-trial path, so a stale or manipulated `checkout=success` request cannot move the funnel again, but it does not itself verify the Checkout Session or subscription state. This boundary, including the earlier-step, later-step, completed-account, missing-account, and unauthenticated recovery cases, is covered by `tests/auth/gettingStartedPage.test.ts`.

## Usage

```tsx
<PlanStep checkoutCanceled={false} />
```
