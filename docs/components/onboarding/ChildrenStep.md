# ChildrenStep

Source: `src/components/onboarding/ChildrenStep.tsx`

## Purpose and boundary

Client onboarding step for adding up to two child accounts or completing setup. It owns form interaction state; server actions own validation, session identity, password hashing, ownership, and persistence.

## Props

No public props. Internal `AddChildForm` receives `onCreated: (child: ChildSummary) => void`, `childCount: number`, and `maxChildren: number`.

## Structure and behavior

The main step keeps created child summaries, active slot, finish pending state, and error. Slot two is disabled until slot one is created. A completed slot shows child name/username. Both Skip and Finish call `finishChildrenStep`, update NextAuth session funnel claims, and push `/dashboard`.

`Modal` remounts `AddChildForm` when a slot is active. The form tracks names, username, password, reset flag, availability state, suggestions, submit state, and error. It can request suggestions, check username on blur, select a suggestion, validate with Zod, and call `createChildAccount`. Duplicate create/finish actions are disabled while pending.

## Styling and accessibility

Uses Button/Input/Modal/PasswordInput recipes and semantic status colors. Labels are associated with inputs. Availability/error text is visible; it is not an aria-live region. The checkbox has a visible label. Modal limitations are documented in [Modal](../ui/Modal.md).

## Consumers and tests

Conditionally rendered by `/getting-started` at `OnboardingStep.CHILDREN`. There are no focused component/action tests.

## Usage

```tsx
import ChildrenStep from "@/components/onboarding/ChildrenStep";

<ChildrenStep />
```
