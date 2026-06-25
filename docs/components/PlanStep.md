# PlanStep

**Path:** `src/components/onboarding/PlanStep.tsx`

Onboarding funnel step shown when a user's `onboardingStep` is `PLAN`. Lets the user start a Stripe checkout (monthly/lifetime) or continue with the free trial. "Continue with free trial" calls `continueWithFreeTrial`, advancing the user to `CHILDREN`. Paid checkout redirects to Stripe; on success the user is sent back to `/getting-started?checkout=success`, which advances `PLAN` -> `CHILDREN` server-side.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `checkoutCanceled` | `boolean` | Shows a "Checkout was canceled" message when the user backed out of Stripe checkout |

## Usage

Rendered by `src/app/(auth)/(onboarding)/getting-started/page.tsx` when `onboardingStep === "PLAN"`.
