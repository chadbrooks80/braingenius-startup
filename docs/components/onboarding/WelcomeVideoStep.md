# WelcomeVideoStep

Source: `src/components/onboarding/WelcomeVideoStep.tsx`

## Purpose and boundary

Client onboarding step showing a hosted introduction video and advancing the funnel. The client boundary is required for pending/error state, router refresh, and button interaction.

## Props

No props.

## Structure and behavior

Renders heading copy, a YouTube iframe, error output, and Continue button. Continue calls `completeWelcomeVideoStep`; the `recovery` (the database says the funnel is elsewhere, e.g. a stale tab) and `unauthenticated` branches are handled by the shared `handleOnboardingRecovery` helper from `src/lib/onboarding-client.ts`, which replaces to the database-authoritative route (refreshing first for `recovery`) or to `/sign-in`. Otherwise `success` refreshes the server route and `error` restores the button and shows the safe message.

## Styling and accessibility

The iframe has title `Welcome to BrainGenius.ai`, allowlisted browser features, and fullscreen enabled. The button uses the primary recipe. Error text is visible but not live.

## Consumers and tests

Rendered by `/getting-started` at `WELCOME_VIDEO`. The underlying action is covered by `tests/auth/onboardingActions.test.ts`; the shared recovery/session-refresh contract this component delegates to is covered by `tests/auth/onboardingClientRecovery.test.ts`. There is still no full DOM-rendered component-level test.

## Usage

```tsx
<WelcomeVideoStep />
```
