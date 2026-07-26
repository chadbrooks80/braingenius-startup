# LearningSidebar

Source: `src/components/learning-engine/layout/LearningSidebar.tsx`

## Purpose and boundary

Server-compatible shared Learning Engine sidebar presentation.

## Props

No props.

## Structure and behavior

Renders an `<aside>` with static practice time/progress and three static word-status sections. All counts and timers are zero/static. It does not read module or learner state and emits no actions.

## Styling and accessibility

Uses semantic theme utilities. Emoji values come from `src/lib/emojis.ts`. The progress bar is visual only and has no progressbar semantics. Section labels are paragraphs/spans rather than navigation controls.

## Consumers and tests

Conditionally rendered by the learning route when module settings set `showSidebar`; Vocabulary currently does. No focused test exists.

## Usage

```tsx
import { LearningSidebar } from "@/components/learning-engine/layout/LearningSidebar";

<LearningSidebar />
```
