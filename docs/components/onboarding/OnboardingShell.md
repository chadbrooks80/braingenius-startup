# OnboardingShell

Source: `src/components/onboarding/OnboardingShell.tsx`

## Purpose and boundary

Server-compatible layout shell for authenticated onboarding steps.

## Props

| Prop | Type | Required | Meaning |
| --- | --- | --- | --- |
| `children` | `ReactNode` | Yes | Current funnel step content. |

## Structure and behavior

Renders a full-height background, centered logo header, and centered surface card. It has no state, effects, actions, or error behavior.

## Styling and accessibility

Uses semantic background/surface tokens and shared size/shadow values. Next Image supplies `alt="BrainGenius.ai"`.

## Consumers and tests

Rendered by `/getting-started` around exactly one step. No focused test exists.

## Usage

```tsx
<OnboardingShell>
  <ProfileStep />
</OnboardingShell>
```
