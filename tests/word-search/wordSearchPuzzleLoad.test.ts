import assert from "node:assert/strict";
import test from "node:test";
import {
  INITIAL_WORD_SEARCH_PUZZLE_LOAD_STATE,
  applyWordSearchPuzzleLoadFailure,
  applyWordSearchPuzzleLoadSuccess,
  retryWordSearchPuzzleLoad,
} from "../../src/components/learning-engine/windows/WordSearch/wordSearchPuzzleLoad";
import type { WordSearchPuzzleResponse } from "../../src/components/learning-engine/windows/WordSearch/wordSearchTypes";

const PUZZLE: WordSearchPuzzleResponse = {
  gridSize: 8,
  rows: [],
  words: ["CAT"],
  placements: [
    { word: "CAT", start: { row: 0, col: 0 }, direction: "left-to-right" },
  ],
};

const NEWER_PUZZLE: WordSearchPuzzleResponse = { ...PUZZLE, words: ["DOG"] };

test("the initial load is pending attempt zero", () => {
  assert.deepEqual(INITIAL_WORD_SEARCH_PUZZLE_LOAD_STATE, {
    status: "loading",
    attempt: 0,
  });
});

test("a matching success becomes ready and a matching failure becomes error", () => {
  assert.deepEqual(
    applyWordSearchPuzzleLoadSuccess(
      INITIAL_WORD_SEARCH_PUZZLE_LOAD_STATE,
      0,
      PUZZLE
    ),
    { status: "ready", attempt: 0, puzzle: PUZZLE }
  );
  assert.deepEqual(
    applyWordSearchPuzzleLoadFailure(INITIAL_WORD_SEARCH_PUZZLE_LOAD_STATE, 0),
    { status: "error", attempt: 0 }
  );
});

test("retry restarts loading with the next attempt number", () => {
  const failed = applyWordSearchPuzzleLoadFailure(
    INITIAL_WORD_SEARCH_PUZZLE_LOAD_STATE,
    0
  );

  assert.deepEqual(retryWordSearchPuzzleLoad(failed), {
    status: "loading",
    attempt: 1,
  });
});

test("stale generation results are ignored after a retry", () => {
  const retried = retryWordSearchPuzzleLoad(
    applyWordSearchPuzzleLoadFailure(INITIAL_WORD_SEARCH_PUZZLE_LOAD_STATE, 0)
  );

  // The original attempt resolves late: both outcomes must be ignored.
  assert.deepEqual(
    applyWordSearchPuzzleLoadSuccess(retried, 0, PUZZLE),
    retried
  );
  assert.deepEqual(applyWordSearchPuzzleLoadFailure(retried, 0), retried);

  // The active attempt still applies.
  assert.deepEqual(applyWordSearchPuzzleLoadSuccess(retried, 1, NEWER_PUZZLE), {
    status: "ready",
    attempt: 1,
    puzzle: NEWER_PUZZLE,
  });
});

test("results never overwrite an already ready puzzle", () => {
  const ready = applyWordSearchPuzzleLoadSuccess(
    INITIAL_WORD_SEARCH_PUZZLE_LOAD_STATE,
    0,
    PUZZLE
  );

  assert.deepEqual(
    applyWordSearchPuzzleLoadSuccess(ready, 0, NEWER_PUZZLE),
    ready
  );
  assert.deepEqual(applyWordSearchPuzzleLoadFailure(ready, 0), ready);
});
