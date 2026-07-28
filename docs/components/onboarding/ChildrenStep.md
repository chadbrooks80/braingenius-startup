# ChildrenStep

Source: `src/components/onboarding/ChildrenStep.tsx`

## Purpose and boundary

Client onboarding step for adding up to two child accounts or completing setup. It owns form interaction state; server actions own validation, session identity, password hashing, ownership, and persistence.

## Props

No public props. Internal `AddChildForm` receives `onCreated: (child: ChildSummary) => void`, `childCount: number`, `maxChildren: number`, and `router` (the parent's `useRouter()` instance, used for recovery/unauthenticated redirects).

## Structure and behavior

The main step keeps created child summaries, active slot, finish pending state, and error. Slot two is disabled until slot one is created. A completed slot shows child name/username. Both Skip and Finish call `finishChildrenStep` through the shared `completeChildrenStep` helper (`src/lib/onboarding-client.ts`), which handles every result branch: `success` calls `session.update()` with no arguments (a refresh-only signal — it sends no onboarding claims; the server already advanced the database) and pushes `/dashboard`; `recovery` replaces to the database-authoritative destination and refreshes; `unauthenticated` replaces to `/sign-in`. Only the `error` branch is handled locally, restoring the buttons and showing the safe message.

`Modal` remounts `AddChildForm` when a slot is active; the router is passed down so the form can apply the same recovery/unauthenticated handling through the shared `handleOnboardingRecovery` helper. The form tracks names, username, password, reset flag, availability state, suggestions, submit state, and error. It can request suggestions, check username on blur, select a suggestion, validate with Zod, and call `createChildAccount`; a non-`success` result is either an inline error or a redirect, not a silent no-op.

The username-blur check is the one flow that makes two server calls: `checkUsernameAvailability()`, and, only when the name is taken, a follow-up `suggestUsernames()` to populate alternatives. Both calls are routed through the shared `checkUsernameAvailabilityAndSuggest()` orchestration helper (`src/lib/onboarding-client.ts`), so a `recovery` or `unauthenticated` result from *either* call navigates through `handleOnboardingRecovery()` instead of being silently dropped or treated as a fresh "taken" result; the manual "Auto Generate" button calls `suggestUsernames()` directly and applies `handleOnboardingRecovery()` itself. Duplicate create/finish actions are disabled while pending.

## Styling and accessibility

Uses Button/Input/Modal/PasswordInput recipes and semantic status colors. Labels are associated with inputs. Availability/error text is visible; it is not an aria-live region. The checkbox has a visible label. The Add Child dialog's accessibility contract (dialog semantics, focus containment, initial focus, and focus restoration to the trigger that opened it) is owned by `Modal` and documented in [Modal](../ui/Modal.md).

## Consumers and tests

Conditionally rendered by `/getting-started` at `OnboardingStep.CHILDREN`. The underlying actions (username availability/suggestions, child creation, step completion, and the two-child limit under concurrency) are covered by `tests/auth/onboardingActions.test.ts`; the shared `completeChildrenStep`/`handleOnboardingRecovery`/`checkUsernameAvailabilityAndSuggest` contracts this component delegates to -- including that a successful completion calls `session.update()` with no arguments, that recovery/unauthenticated results only navigate and never retry, and that a `recovery`/`unauthenticated` result from the taken-username follow-up `suggestUsernames()` call navigates instead of being reported as a suggestion list -- is covered by `tests/auth/onboardingClientRecovery.test.ts`. There is still no full DOM-rendered component-level test.

## Usage

```tsx
import ChildrenStep from "@/components/onboarding/ChildrenStep";

<ChildrenStep />
```
