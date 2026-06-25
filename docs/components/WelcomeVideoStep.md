# WelcomeVideoStep

**Path:** `src/components/onboarding/WelcomeVideoStep.tsx`

Onboarding funnel step shown when a user's `onboardingStep` is `WELCOME_VIDEO`. Embeds the BrainGenius intro video (YouTube); "Continue" calls the `completeWelcomeVideoStep` server action and advances the user to `PROFILE`, then refreshes the parent server component.

## Props

None. Reads the current user from the server session via its server action.

## Usage

Rendered by `src/app/(auth)/(onboarding)/getting-started/page.tsx` when `onboardingStep === "WELCOME_VIDEO"`.
