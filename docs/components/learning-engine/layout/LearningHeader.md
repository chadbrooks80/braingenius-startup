# LearningHeader

Source: `src/components/learning-engine/layout/LearningHeader.tsx`

## Purpose and boundary

Server-compatible shared Learning Engine header presentation.

## Props

No props.

## Structure and behavior

Renders a sticky header with logo and four static spans: New Word List, Calendar Progress, Username, and Log out. None is a link or button and no real user/progress/session data is consumed.

## Styling and accessibility

Uses semantic surface/heading/secondary tokens. The logo has `alt="BrainGenius"` and priority loading. The text that resembles controls is non-interactive and has no control semantics.

## Consumers and tests

Conditionally rendered by the learning route when module settings set `showHeader`; Vocabulary currently does. No focused test exists.

## Usage

```tsx
import { LearningHeader } from "@/components/learning-engine/layout/LearningHeader";

<LearningHeader />
```
