# OnboardingShell

**Path:** `src/components/onboarding/OnboardingShell.tsx`

Layout wrapper shared by every onboarding funnel step rendered on `/getting-started`. Renders the logo header and a centered card.

## Props

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | The step component to render inside the card |

## Usage

```tsx
<OnboardingShell>
  <ProfileStep />
</OnboardingShell>
```
