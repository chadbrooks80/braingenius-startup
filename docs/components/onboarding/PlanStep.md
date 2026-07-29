# PlanStep

Source: `src/components/onboarding/PlanStep.tsx`

## Purpose and boundary

Client onboarding plan screen. It presents fixed trial/paid plan copy, starts server-owned Stripe Checkout, or advances with the existing free trial.

## Props

| Prop | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `checkoutFeedback` | `"canceled" \| "unconfirmed" \| null` | Yes | — | Seeds neutral canceled or not-yet-confirmed Checkout feedback. |

## Structure and behavior

Local state tracks free-trial error/pending and paid-plan feedback/current loading plan. Initial feedback says only that Checkout was canceled or could not yet be confirmed; it never claims payment succeeded or exposes a Stripe identifier. `handleUpgrade` calls `createCheckoutSession`, clears feedback, displays safe failure, or assigns `window.location.href`. While any paid Checkout is loading, both paid buttons are disabled. `handleFreeTrial` calls `continueWithFreeTrial`; the `recovery` and `unauthenticated` branches are handled by the shared `handleOnboardingRecovery` helper from `src/lib/onboarding-client.ts` (replace to the database-authoritative destination and refresh, or replace to `/sign-in`); otherwise `success` refreshes the route so server funnel state selects the next step and `error` restores the button and shows the safe message.

The cards and displayed prices/benefits are fixed in component source rather than loaded from Stripe.

## Styling and accessibility

Uses `Eyebrow`, `CheckBadge`, and `Button`. Visible text identifies plans and pending/error states. Error paragraphs are not live regions.

## Consumers and tests

Rendered by `/getting-started` at `PLAN`, with safe feedback derived from server return handling. The underlying free-trial action is covered by `tests/auth/onboardingActions.test.ts`; shared recovery/session-refresh is covered by `tests/auth/onboardingClientRecovery.test.ts`; checkout verification and the real page boundary are covered by `tests/billing/checkoutConfirmation.test.ts` and `tests/auth/gettingStartedPage.test.ts`. There is still no full DOM-rendered component-level test.

## Ownership and limitation

The browser never supplies a price ID, identity, payment state, or entitlement claim. The Server Action maps the plan. The page treats `checkout` and `session_id` as untrusted, retrieves authoritative Stripe state through the shared billing service, and advances `PLAN → CHILDREN` through the conditional database-authoritative write only after ownership, approved price, mode, payment, subscription lifecycle, persistence, and entitlement all confirm. Replays from `CHILDREN` cannot advance again.

## Usage

```tsx
<PlanStep checkoutFeedback={null} />
```
