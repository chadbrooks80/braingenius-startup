# ProfileStep

Source: `src/components/onboarding/ProfileStep.tsx`

## Purpose and boundary

Client onboarding form for first and optional last name. The client owns input/pending/error state; `saveProfile` owns session identity and database mutation.

## Props

No props.

## Structure and behavior

Tracks `fName`, `lName`, error, and submit pending. Submission prevents the default form action, validates with Zod, disables the button during `saveProfile`, shows safe failure, and refreshes the route on success. Blank optional last name is sent as `undefined`.

## Styling and accessibility

Uses associated labels, `Input`, semantic error color, and a submit `Button`. Error text is not an aria-live region.

## Consumers and tests

Rendered by `/getting-started` at `PROFILE`. No focused test exists.

## Usage

```tsx
<ProfileStep />
```
