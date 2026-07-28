# ProfileStep

Source: `src/components/onboarding/ProfileStep.tsx`

## Purpose and boundary

Client onboarding form for first and optional last name. The client owns input/pending/error state; `saveProfile` owns session identity and database mutation.

## Props

No props.

## Structure and behavior

Tracks `fName`, `lName`, error, and submit pending. Submission prevents the default form action, validates with Zod, and disables the button during `saveProfile`. The `recovery` and `unauthenticated` branches are handled by the shared `handleOnboardingRecovery` helper from `src/lib/onboarding-client.ts` (replace to the database-authoritative destination and refresh, or replace to `/sign-in`); otherwise `success` refreshes the route and `error` restores the button and shows the safe message. Blank optional last name is sent as `undefined`.

## Styling and accessibility

Uses associated labels, `Input`, semantic error color, and a submit `Button`. Error text is not an aria-live region.

## Consumers and tests

Rendered by `/getting-started` at `PROFILE`. The underlying action is covered by `tests/auth/onboardingActions.test.ts` and `tests/auth/onboardingFunnel.test.ts`; the shared recovery/session-refresh contract this component delegates to is covered by `tests/auth/onboardingClientRecovery.test.ts`. There is still no full DOM-rendered component-level test.

## Usage

```tsx
<ProfileStep />
```
