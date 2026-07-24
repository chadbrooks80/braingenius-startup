# WordSearchWindow

Reusable word-search puzzle window available to learning modules through the registered `"word-search"` window name. During Phase 1 it is exposed only through the playground; no learning module or engine action uses it yet.

The module supplies `gridSize` (both the row and column count) and the visible `words` the learner must find. `title`, `instructions`, and `actionLabel` are optional presentation overrides. Modules never supply rendered rows, filler letters, placement coordinates, provider details, or visual configuration.

## Public props

- `gridSize` — integer from 8 to 30 (documented safe range).
- `words` — nonempty array of up to 20 words. Words are trimmed, must contain letters only, must be at least 2 letters long, must be unique after case normalization, and must fit the grid. Matching uses uppercase; the trimmed original text is displayed. Invalid props are programmer errors and throw.
- `title?`, `instructions?`, `actionLabel?` — presentation overrides.
- `generatePuzzle?`, `initialFoundWords?`, `initialSelection?` — playground/test seams only. `generatePuzzle` defaults to the temporary `generateWordList()` boundary; the `initial*` seeds preset found-word and active-selection presentation states.

## Puzzle generation

`generateWordList()` is the temporary Phase 1 stand-in for the future AI puzzle action. It deterministically returns the response shape that action is expected to produce: a complete square array of letter rows, the requested words, and per-word placement data used to verify learner selections. The boundary is intentionally narrow so a later phase can replace the implementation without rewriting the window. A generation that resolves after unmount, a puzzle prop change, or a retry is ignored; failures show a learner-safe message with an explicit Retry.

## Important behavior

- Selections are straight lines only, in six directions: left-to-right, top-to-bottom, diagonal down-right, right-to-left, bottom-to-top, and diagonal up-left. Bent, branching, disconnected, and wrapping selections are impossible.
- Learners can drag with a mouse or touch, tap the first and last letter, or use a keyboard path (arrow keys move the roving cell focus; Enter/Space anchors and commits; Escape cancels).
- The active selection is highlighted and drawn as a faint continuous line. Selected text is compared against the remaining words in either reading direction.
- Correct selections keep their line and letter highlighting and cross the word out in the visible list (with screen-reader "(found)" text). Incorrect selections clear with neutral feedback. A found word cannot be counted twice.
- Completion happens only after every supplied word is found. On completion the window emits the established `submitAnswer` action with `{ complete: true, foundWords }` (display words in found order); the Next button stays disabled until completion and then emits `next`.
- Every cell exposes its row, column, and letter to assistive technology (`grid`/`row`/`gridcell` roles), shows a clear focus outline, and state is never conveyed by color alone. Transitions respect reduced-motion preferences.
- Large grids render inside a bounded, scrollable puzzle area with a fixed minimum cell size (36px, 40px on `sm+`) instead of shrinking letters below readability; dragging near the edge of the area auto-scrolls further cells into reach, which is also the touch path to off-screen cells mid-selection.

The window owns presentation, selection state, and local found-word state for the mounted puzzle only. Lesson progression, attempts, mastery, persistence, and authoritative validation remain with the calling module and its server boundary; the Learning Engine routes the emitted actions without understanding grids, placements, or completion rules.

Sources: `src/components/learning-engine/windows/WordSearch/`, `src/lib/learning-engine/LearningWindowRegistry.ts`, and `src/app/playground/page.tsx`.
