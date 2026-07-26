# WordSearchWindow

Source: `src/components/learning-engine/windows/WordSearch/WordSearchWindow.tsx`

## Registry and ownership

Registry key: `word-search`. Client Learning Window for locally generating and solving a word-search puzzle. No current subject module returns this window; it is registered and demonstrated in `/le-playground`.

## Public props

| Prop | Type | Required | Default |
| --- | --- | --- | --- |
| `gridSize` | `number` | Yes | — |
| `words` | `string[]` | Yes | — |
| `title` | `string` | No | `"Word Search"` |
| `instructions` | `string` | No | Built-in pointer/tap/keyboard instructions |
| `actionLabel` | `string` | No | `"Next →"` |
| `onAction` | `OnAction` | Yes | — |
| `generatePuzzle` | `GenerateWordSearchPuzzle` | No | local `generateWordList` |
| `initialFoundWords` | `string[]` | No | — |
| `initialSelection` | `{ start: WordSearchCell; end: WordSearchCell }` | No | — |

The final three props are playground/test seams; learning modules do not supply them.

## Validation, state, and reset

Props throw programmer errors unless grid size is an integer 8–30 and there are 1–20 unique, letters-only, trimmed words of length 2 through `gridSize`. Matching normalizes to uppercase while display text is preserved.

The wrapper keys the session by grid size plus normalized words, resetting load/interaction state when the requested puzzle changes. Load state tracks loading attempt, error, or ready; retry increments attempt identity and stale results are ignored. Interaction tracks idle/dragging/anchored phase, endpoints, found words, last outcome, and completion. Seed validation also throws programmer errors.

## Actions and completion

When a learner completes the puzzle, the component emits exactly once:

```ts
onAction("submitAnswer", { complete: true, foundWords: string[] })
```

Words are in found order using module-supplied display text. A puzzle seeded complete does not emit learner completion. Next remains disabled until complete and then emits `onAction("next")`.

## Pointer, touch, and keyboard

Pointer capture supports mouse drag and touch; near-edge dragging auto-scrolls the bounded area. A tap anchors the first cell and a second aligned tap commits. Roving tab index keeps one grid cell focusable. Arrow keys move/preview, Enter or Space anchors/commits, and Escape cancels. Only horizontal, vertical, and down-right/up-left diagonal lines (and their reverses) are supported by current directions.

## Accessibility

The puzzle uses `role="grid"`, row/gridcell roles, per-cell row/column/letter labels, `aria-selected`, visible focus, a polite status region, an accessible word-list label, and screen-reader “found” text. Error uses `role="alert"`. Selection lines are aria-hidden; status is not conveyed by color alone.

## Ownership and security

The window validates public props and owns local mechanics only. It does not authoritatively grade a subject or calculate module progress; a future module must interpret/validate the completion payload. Current local generation is deterministic and not an AI/server action.

## Playground and tests

`/le-playground` includes loading, failure/retry, active, partial, completed, large, long-word, and narrow examples. Unit/component tests cover parsing, deterministic placement, all interaction modes, stale loads, accessibility rendering, and completion. The browser E2E currently targets `/playground` instead of the source gallery route, a known test/source mismatch.

## Usage

```tsx
<WordSearchWindow
  gridSize={8}
  words={["cat", "dog"]}
  onAction={onAction}
/>
```
