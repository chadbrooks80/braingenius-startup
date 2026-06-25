# ProfileStep

**Path:** `src/components/onboarding/ProfileStep.tsx`

Onboarding funnel step shown when a user's `onboardingStep` is `PROFILE`. Collects first/last name, calls the `saveProfile` server action, which saves the profile and advances the user to `PLAN`, then refreshes the parent server component.

## Props

None.

## Usage

Rendered by `src/app/(auth)/(onboarding)/getting-started/page.tsx` when `onboardingStep === "PROFILE"`.
