import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWordSearchCompletionPayload,
  createWordSearchInteractionState,
  dragWordSearchToCell,
  pressWordSearchCell,
  releaseWordSearchPress,
  type WordSearchInteractionState,
} from "../../src/components/learning-engine/windows/WordSearch/wordSearchInteraction";
import { shouldEmitWordSearchCompletion } from "../../src/components/learning-engine/windows/WordSearch/wordSearchCompletionGate";
import type {
  WordSearchCell,
  WordSearchPuzzleResponse,
} from "../../src/components/learning-engine/windows/WordSearch/wordSearchTypes";

// Mirrors tests/word-search/wordSearchInteraction.test.ts: one word per
// supported direction and neutral "Q" filler so no word appears by accident.
const PUZZLE: WordSearchPuzzleResponse = {
  gridSize: 8,
  rows: [
    ["C", "A", "T", "Q", "Q", "Q", "Q", "Q"],
    ["Q", "Q", "Q", "Q", "Q", "Q", "Q", "Q"],
    ["Q", "Q", "Q", "Q", "D", "Q", "Q", "Q"],
    ["S", "Q", "Q", "Q", "O", "N", "Q", "Q"],
    ["Q", "U", "Q", "E", "G", "Q", "E", "Q"],
    ["Q", "Q", "N", "C", "Q", "Q", "Q", "T"],
    ["Q", "Q", "Q", "I", "Q", "Q", "Q", "Q"],
    ["Q", "Q", "Q", "Q", "Q", "P", "A", "M"],
  ],
  words: ["CAT", "DOG", "SUN", "MAP", "ICE", "TEN"],
  placements: [
    { word: "CAT", start: { row: 0, col: 0 }, direction: "left-to-right" },
    { word: "DOG", start: { row: 2, col: 4 }, direction: "top-to-bottom" },
    { word: "SUN", start: { row: 3, col: 0 }, direction: "diagonal-down-right" },
    { word: "MAP", start: { row: 7, col: 7 }, direction: "right-to-left" },
    { word: "ICE", start: { row: 6, col: 3 }, direction: "bottom-to-top" },
    { word: "TEN", start: { row: 5, col: 7 }, direction: "diagonal-up-left" },
  ],
};

const WORDS = [
  { display: "cat", normalized: "CAT" },
  { display: "dog", normalized: "DOG" },
  { display: "sun", normalized: "SUN" },
  { display: "map", normalized: "MAP" },
  { display: "ice", normalized: "ICE" },
  { display: "ten", normalized: "TEN" },
];

const FIND_ALL_SELECTIONS: WordSearchCell[][] = [
  [{ row: 0, col: 0 }, { row: 0, col: 2 }],
  [{ row: 2, col: 4 }, { row: 4, col: 4 }],
  [{ row: 3, col: 0 }, { row: 5, col: 2 }],
  [{ row: 7, col: 7 }, { row: 7, col: 5 }],
  [{ row: 6, col: 3 }, { row: 4, col: 3 }],
  [{ row: 5, col: 7 }, { row: 3, col: 5 }],
];

function dragAcross(
  state: WordSearchInteractionState,
  cells: WordSearchCell[]
): WordSearchInteractionState {
  let next = pressWordSearchCell(state, cells[0]);

  for (const cell of cells.slice(1)) {
    next = dragWordSearchToCell(next, cell);
  }

  return releaseWordSearchPress(next, PUZZLE);
}

// Reproduces exactly what WordSearchWindow's completion effect does each
// render: gate the decision, then emit through the same payload builder.
function runCompletionEffect(
  emittedRef: { current: boolean },
  activeInteraction: WordSearchInteractionState,
  initialInteraction: WordSearchInteractionState,
  onAction: (actionId: string, payload: unknown) => void
) {
  if (
    !shouldEmitWordSearchCompletion({
      activeComplete: activeInteraction.complete,
      initiallyComplete: initialInteraction.complete,
      alreadyEmitted: emittedRef.current,
    })
  ) {
    return;
  }

  emittedRef.current = true;
  onAction("submitAnswer", buildWordSearchCompletionPayload(WORDS, activeInteraction));
}

test("the gate withholds emission while the puzzle is incomplete", () => {
  assert.equal(
    shouldEmitWordSearchCompletion({
      activeComplete: false,
      initiallyComplete: false,
      alreadyEmitted: false,
    }),
    false
  );
});

test("the gate withholds emission once already emitted", () => {
  assert.equal(
    shouldEmitWordSearchCompletion({
      activeComplete: true,
      initiallyComplete: false,
      alreadyEmitted: true,
    }),
    false
  );
});

test("the gate withholds emission for a puzzle seeded as already complete", () => {
  assert.equal(
    shouldEmitWordSearchCompletion({
      activeComplete: true,
      initiallyComplete: true,
      alreadyEmitted: false,
    }),
    false
  );
});

test("the gate allows emission for learner-driven completion", () => {
  assert.equal(
    shouldEmitWordSearchCompletion({
      activeComplete: true,
      initiallyComplete: false,
      alreadyEmitted: false,
    }),
    true
  );
});

test("learner completion emits submitAnswer with the exact payload exactly once", () => {
  const initial = createWordSearchInteractionState(PUZZLE);
  const emittedRef = { current: false };
  const calls: { actionId: string; payload: unknown }[] = [];
  const onAction = (actionId: string, payload: unknown) => {
    calls.push({ actionId, payload });
  };

  let state = initial;

  // No emission on the initial incomplete render.
  runCompletionEffect(emittedRef, state, initial, onAction);
  assert.equal(calls.length, 0);

  // No emission for any of the intermediate finds either.
  for (const selection of FIND_ALL_SELECTIONS.slice(0, -1)) {
    state = dragAcross(state, selection);
    assert.equal(state.complete, false);
    runCompletionEffect(emittedRef, state, initial, onAction);
    assert.equal(calls.length, 0);
  }

  // The final word completes the puzzle and triggers exactly one emission.
  state = dragAcross(state, FIND_ALL_SELECTIONS[FIND_ALL_SELECTIONS.length - 1]);
  assert.equal(state.complete, true);
  runCompletionEffect(emittedRef, state, initial, onAction);

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    actionId: "submitAnswer",
    payload: {
      complete: true,
      foundWords: ["cat", "dog", "sun", "map", "ice", "ten"],
    },
  });

  // A repeated render of the same completed state must not emit again.
  runCompletionEffect(emittedRef, state, initial, onAction);
  runCompletionEffect(emittedRef, state, initial, onAction);
  assert.equal(calls.length, 1);
});

test("a puzzle seeded as already complete never emits a learner completion action", () => {
  const seededComplete = createWordSearchInteractionState(PUZZLE, {
    foundWords: PUZZLE.words,
  });
  const emittedRef = { current: false };
  const calls: { actionId: string; payload: unknown }[] = [];

  runCompletionEffect(emittedRef, seededComplete, seededComplete, (actionId, payload) => {
    calls.push({ actionId, payload });
  });
  runCompletionEffect(emittedRef, seededComplete, seededComplete, (actionId, payload) => {
    calls.push({ actionId, payload });
  });

  assert.equal(calls.length, 0);
});
