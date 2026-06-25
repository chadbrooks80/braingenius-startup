# ChildrenStep

**Path:** `src/components/onboarding/ChildrenStep.tsx`

Final onboarding funnel step shown when a user's `onboardingStep` is `CHILDREN`. Collects child names, calls `completeOnboarding`, which creates child accounts, advances the user to `COMPLETE`, and sets `onboardingCompleted`. Updates the session and navigates to `/dashboard`.

## Props

None.

## Usage

Rendered by `src/app/(auth)/(onboarding)/getting-started/page.tsx` when `onboardingStep === "CHILDREN"`.
