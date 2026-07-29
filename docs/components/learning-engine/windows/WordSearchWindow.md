# WordSearchWindow

Source: `src/components/learning-engine/windows/WordSearch/WordSearchWindow.tsx`

## Registry and ownership

Registry key: `word-search`. Client Learning Window for locally generating and solving a word-search puzzle. It is registered and demonstrated in `/le-playground`, and the Vocabulary module returns it for its ungraded five-word mastery checkpoint (see `docs/modules/vocabulary.md`).

## Public props

| Prop | Type | Required | Default |
| --- | --- | --- | --- |
| `gridSize` | `number` | Yes | — |
| `words` | `string[]` | Yes | — |
| `title` | `string` | No | `"Word Search"` |
| `instructions` | `string` | No | Built-in pointer/tap/keyboard instructions |
| `actionLabel` | `string` | No | `"Next →"` |
| `onAction` | `OnAction` | Yes | — |
| `emitCompletionAction` | `boolean` | No | `true` |
| `generatePuzzle` | `GenerateWordSearchPuzzle` | No | local `generateWordList` |
| `initialFoundWords` | `string[]` | No | — |
| `initialSelection` | `{ start: WordSearchCell; end: WordSearchCell }` | No | — |

The final three props are playground/test seams; learning modules do not supply them.

## Validation, state, and reset

The public, subject-neutral validation contract lives at `src/lib/learning-engine/word-search/wordSearchInputContract.ts`. The Window parser delegates normalization, bounds, deduplication, and structural compatibility to that contract; subject modules may use the same contract without importing the component or its internal parser.

Props throw programmer errors unless grid size is an integer 8–30 and there are 1–20 deduplicated, letters-only, trimmed words of length 2 through `gridSize`. Matching normalizes to uppercase while the first supplied word's trimmed display text is preserved. Case-insensitive duplicates are removed before the count bound is checked. After mount, one safe console diagnostic lists only the duplicate normalized targets; render and equivalent parent re-renders remain side-effect free, while each separate puzzle instance or changed duplicate event reports once. Duplicate input therefore continues through loading instead of becoming a learner-facing failure.

Validation also rejects a target set before asynchronous generation when a shorter target would be forced to appear more than once inside one longer target, or when multiple containing targets cannot align their one shared shorter occurrence without conflicting letters. Compatible parent/substring pairs, reverse pairs, and palindromic overlaps remain supported. This narrow compatibility boundary prevents structurally impossible requests from entering a permanent generation-and-Retry loop without weakening the exact-one-visible-occurrence rule.

The wrapper keys the session by grid size, normalized and display words, and the duplicate event, resetting loading, selection, found-word, completion, and per-puzzle diagnostic state when meaningful props change. Load state tracks loading attempt, error, or ready; retry increments attempt identity, passes it into local generation as a deterministic reseed, and ignores stale results. Interaction tracks idle/dragging/anchored phase, endpoints, found words, last outcome, and completion. Seed validation also throws programmer errors.

## Local generation and official placements

`generateWordList` runs entirely in the application with no AI, provider, endpoint, key, or new dependency. It uses deterministic seeded placement with longest-word ordering, overlap preference, bounded backtracking, and up to 32 bounded rebuilds. Once filler letters are added, the generator scans horizontal, vertical, and supported diagonal lines in both readings. Every target must have exactly one visible occurrence matching its returned official placement.

An accidental occurrence is repaired only through an unprotected filler cell. Every replacement is deterministic, rescanned against every target, and accepted only when it removes the selected occurrence without creating another. A collision made entirely from official-placement cells abandons that candidate and triggers a bounded rebuild. If no valid candidate is found, generation rejects into the safe Retry UI.

The enforced request bounds are:

- `gridSize`: integer 8–30.
- word count: 1–20 after case-insensitive trimming/deduplication.
- characters: ASCII letters `A`–`Z`/`a`–`z` only.
- word length: 2 through `gridSize`, inclusive.

## Actions and completion

When a learner completes the puzzle and `emitCompletionAction` is not explicitly `false` (the default), the component emits exactly once:

```ts
onAction("submitAnswer", { complete: true, foundWords: string[] })
```

Words are in found order using module-supplied display text. A puzzle seeded complete does not emit learner completion. Next remains disabled until complete and then always emits `onAction("next")` regardless of `emitCompletionAction`.

Set `emitCompletionAction={false}` for an ungraded reinforcement use (e.g. Vocabulary's mastery checkpoint) so puzzle completion never reaches a graded `submitAnswer` handler. Advancing still happens only through the Next button's separate `"next"` action once every word is found; no engine or Learning Window change is otherwise required for an ungraded consumer.

## Pointer, touch, and keyboard

Pointer capture supports mouse/pen drag, and explicit touch start/move/end handling supports touch drag even when a browser does not continue a Pointer Events stream after touch `pointerdown`; near-edge dragging auto-scrolls the bounded area. A tap anchors the first cell and a second aligned tap commits. Roving tab index keeps one grid cell focusable. Arrow keys move/preview, Enter or Space anchors/commits, and Escape cancels. Only horizontal, vertical, and down-right/up-left diagonal lines (and their reverses) are supported by current directions. A selection counts only when its cells equal the target's official placement in forward or reverse order; matching text at any other location is rejected.

## Accessibility

The puzzle uses `role="grid"`, row/gridcell roles, per-cell row/column/letter/state labels, `aria-selected`, visible focus, an atomic polite status region, an accessible word-list label, line-through found words, and screen-reader “found” text. Error uses `role="alert"`. Selection lines are aria-hidden; selected and found states are not conveyed by color alone. Tailwind's `touch-none` utility owns the selection gesture, while the bounded, overscroll-contained area keeps large grids and controls usable on narrow screens without an inline style.

## Ownership and security

The window validates public props and owns local mechanics only. It does not authoritatively grade a subject or calculate module progress; a consuming module interprets/validates the completion payload, or (as Vocabulary does) sets `emitCompletionAction={false}` and relies solely on the Next button's `"next"` action for an ungraded reinforcement activity. Current local generation is deterministic and not an AI/server action.

## Playground and tests

`/le-playground` includes normal play, duplicate input, loading, deterministic failure/retry, active, partial, completed, large, long-word, and narrow examples. It remains a development gallery rather than a production lesson route. `tests/e2e/wordSearchPlayground.e2e.ts` exercises that actual route at desktop and narrow viewports with mouse/pointer drag, touch drag, keyboard selection, focus visibility, invalid selection, found-state clarity, completion gating, duplicate recovery, Retry, bounded scrolling, and route correctness.

The exact focused test files that remain are:

- `tests/word-search/generateWordList.test.ts` — deterministic/reseeded bounded generation, unique occurrence scanning, safe repair, protected-cell rejection, replacement rescanning, and dense supported input.
- `tests/word-search/parseWordSearchWindowProps.test.ts` — prop validation, normalization, deduplication, diagnostics, and post-deduplication bounds.
- `tests/word-search/wordSearchPuzzleLoad.test.ts` — loading, failure, retry, and stale-result handling.
- `tests/word-search/wordSearchInteraction.test.ts` — mouse/pointer, touch, and keyboard interaction across all supported directions, found-word persistence, and duplicate prevention.
- `tests/word-search/wordSearchCompletionGate.test.ts` — the completion-emission gate shared with `WordSearchPuzzleSession`, proving `onAction("submitAnswer", { complete: true, foundWords: [...] })` fires exactly once on learner completion, never before completion, never again on a repeated render, and never for a puzzle seeded as already complete.
- `tests/word-search/wordSearchWindow.test.tsx` — registry resolution, loading/error/ready rendering, accessible grid and word list, and Next disabled-before/enabled-after completion.
- `tests/e2e/wordSearchPlayground.e2e.ts` — current `/le-playground` route interaction and narrow-screen browser coverage.

The exact route-level command is:

```bash
node --import ./tests/registerServerOnly.mjs --import tsx --test tests/e2e/wordSearchPlayground.e2e.ts
```

## Usage

```tsx
<WordSearchWindow
  gridSize={8}
  words={["cat", "dog"]}
  onAction={onAction}
/>
```
