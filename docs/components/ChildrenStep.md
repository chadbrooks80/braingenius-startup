# ChildrenStep

**Path:** `src/components/onboarding/ChildrenStep.tsx`

Final onboarding funnel step shown when a user's `onboardingStep` is `CHILDREN`. Renders up to two child slots; each opens a `Modal` with a form (first/last name, username with availability checking via `checkUsernameAvailability`/`suggestUsernames`, `PasswordInput`, and a "must reset password" checkbox) that calls `createChildAccount` to create a loginable child `User` + `ParentStudent` row immediately on submit. The second slot unlocks once the first child is created. "Skip for now" and "Finish setup" both call `finishChildrenStep`, which advances the user to `COMPLETE`, then update the session and navigate to `/dashboard`.

## Props

None.

## Usage

Rendered by `src/app/(auth)/(onboarding)/getting-started/page.tsx` when `onboardingStep === "CHILDREN"`.
