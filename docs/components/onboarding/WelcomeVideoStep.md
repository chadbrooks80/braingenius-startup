# WelcomeVideoStep

Source: `src/components/onboarding/WelcomeVideoStep.tsx`

## Purpose and boundary

Client onboarding step showing a hosted introduction video and advancing the funnel. The client boundary is required for pending/error state, router refresh, and button interaction.

## Props

No props.

## Structure and behavior

Renders heading copy, a YouTube iframe, error output, and Continue button. Continue calls `completeWelcomeVideoStep`, stays disabled while pending, restores on failure, and refreshes the server route on success.

## Styling and accessibility

The iframe has title `Welcome to BrainGenius.ai`, allowlisted browser features, and fullscreen enabled. The button uses the primary recipe. Error text is visible but not live.

## Consumers and tests

Rendered by `/getting-started` at `WELCOME_VIDEO`. No focused test exists.

## Usage

```tsx
<WelcomeVideoStep />
```
