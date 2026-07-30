# LearningModuleAccessUnavailable

Source: `src/components/learning-engine/LearningModuleAccessUnavailable.tsx`

## Ownership

Route-local safe-state presentation rendered by the Server Component learning
route wrapper (`src/app/(app)/(learning)/learning/[...learning]/page.tsx`)
when `authorizeLearningModuleAccess()` resolves `forbidden` or `unavailable`
for an authenticated caller. It is not a registered Learning Window, is not
driven by a `ScreenRequest`, and is rendered before any client Learning
Engine initialization.

## Props

None. The component takes no props and renders one fixed, generic message.

## Structure and behavior

Renders a center-aligned `LearningWindowShell` with a heading, one fixed
message, and a Next `Link` to `LEARNING_ROUTE_ERROR_HOME_PATH` (`/`). There is
no state, retry action, or module callback.

## Accessibility and interaction

Uses `<h1>`, a paragraph, and a keyboard-accessible Next `Link`. The message
is visible and not conveyed only by styling.

## Security boundary

The message is deliberately generic and fixed: it never reveals whether the
denial is caused by the caller's own tier, a parent's entitlement, Stripe
status, price configuration, expiration, or a particular required tier. No
diagnostic, tier, or account data is passed to or rendered by this
component.

## Consumers and tests

Rendered only by the learning route wrapper for `forbidden`/`unavailable`
access results. It is not in the current playground gallery. Covered
indirectly by the service-level access-result classification tests in
`tests/auth/moduleAccess.test.ts` — those tests exercise
`authorizeLearningModuleAccess()` directly, not the route wrapper; the route
wrapper itself is a Server Component and is exercised through its
authorization dependency, not a dedicated component-render test.

## Usage

```tsx
<LearningModuleAccessUnavailable />
```
