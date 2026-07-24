import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWordSearchCompletionPayload,
  cancelWordSearchSelection,
  createWordSearchInteractionState,
  dragWordSearchToCell,
  getActiveWordSearchSelectionCells,
  pressWordSearchCell,
  previewWordSearchFocus,
  releaseWordSearchPress,
  toggleWordSearchAnchor,
  type WordSearchInteractionState,
} from "../../src/components/learning-engine/windows/WordSearch/wordSearchInteraction";
import { getWordSearchCellsBetween } from "../../src/components/learning-engine/windows/WordSearch/wordSearchDirections";
import type {
  WordSearchCell,
  WordSearchPuzzleResponse,
} from "../../src/components/learning-engine/windows/WordSearch/wordSearchTypes";

// A hand-built puzzle with one word per supported direction and neutral "Q"
// filler so no word appears by accident.
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

function startState(): WordSearchInteractionState {
  return createWordSearchInteractionState(PUZZLE);
}

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

test("a left-to-right mouse drag finds a word and keeps its cells", () => {
  const state = dragAcross(startState(), [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
  ]);

  assert.equal(state.lastOutcome, "found");
  assert.equal(state.phase, "idle");
  assert.deepEqual(state.foundWords, [
    {
      word: "CAT",
      cells: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
        { row: 0, col: 2 },
      ],
    },
  ]);
  assert.equal(state.complete, false);
});

test("dragging through unaligned cells keeps the last straight selection", () => {
  let state = pressWordSearchCell(startState(), { row: 0, col: 0 });
  state = dragWordSearchToCell(state, { row: 0, col: 1 });
  state = dragWordSearchToCell(state, { row: 2, col: 1 });

  assert.deepEqual(state.focus, { row: 0, col: 1 });

  state = dragWordSearchToCell(state, { row: 0, col: 2 });
  state = releaseWordSearchPress(state, PUZZLE);

  assert.equal(state.lastOutcome, "found");
  assert.equal(state.foundWords[0].word, "CAT");
});

test("a reverse drag over a placed word still finds it", () => {
  const state = dragAcross(startState(), [
    { row: 0, col: 2 },
    { row: 0, col: 0 },
  ]);

  assert.equal(state.lastOutcome, "found");
  assert.equal(state.foundWords[0].word, "CAT");
});

test("vertical selections work in both directions", () => {
  const downward = dragAcross(startState(), [
    { row: 2, col: 4 },
    { row: 4, col: 4 },
  ]);
  assert.equal(downward.foundWords[0]?.word, "DOG");

  const upward = dragAcross(startState(), [
    { row: 4, col: 4 },
    { row: 2, col: 4 },
  ]);
  assert.equal(upward.foundWords[0]?.word, "DOG");
});

test("supported diagonal selections find their words", () => {
  const downRight = dragAcross(startState(), [
    { row: 3, col: 0 },
    { row: 5, col: 2 },
  ]);
  assert.equal(downRight.foundWords[0]?.word, "SUN");

  const upLeft = dragAcross(startState(), [
    { row: 5, col: 7 },
    { row: 3, col: 5 },
  ]);
  assert.equal(upLeft.foundWords[0]?.word, "TEN");
});

test("right-to-left and bottom-to-top placements are selectable", () => {
  const rightToLeft = dragAcross(startState(), [
    { row: 7, col: 7 },
    { row: 7, col: 5 },
  ]);
  assert.equal(rightToLeft.foundWords[0]?.word, "MAP");

  const bottomToTop = dragAcross(startState(), [
    { row: 6, col: 3 },
    { row: 4, col: 3 },
  ]);
  assert.equal(bottomToTop.foundWords[0]?.word, "ICE");
});

test("the unsupported diagonal cannot be selected", () => {
  assert.equal(
    getWordSearchCellsBetween({ row: 0, col: 2 }, { row: 2, col: 0 }),
    null
  );

  let state = pressWordSearchCell(startState(), { row: 0, col: 2 });
  state = dragWordSearchToCell(state, { row: 2, col: 0 });

  assert.deepEqual(state.focus, { row: 0, col: 2 });
});

test("an incorrect selection clears with neutral feedback and no progress", () => {
  const state = dragAcross(startState(), [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
  ]);

  assert.equal(state.lastOutcome, "no-match");
  assert.equal(state.phase, "idle");
  assert.equal(state.anchor, null);
  assert.equal(state.focus, null);
  assert.deepEqual(state.foundWords, []);
  assert.equal(state.complete, false);
});

test("a found word cannot be counted twice", () => {
  let state = dragAcross(startState(), [
    { row: 0, col: 0 },
    { row: 0, col: 2 },
  ]);
  state = dragAcross(state, [
    { row: 0, col: 0 },
    { row: 0, col: 2 },
  ]);

  assert.equal(state.lastOutcome, "already-found");
  assert.equal(state.foundWords.length, 1);
  assert.equal(state.complete, false);
});

test("tap the first and last letter selects a word", () => {
  let state = dragAcross(startState(), [{ row: 0, col: 0 }]);
  assert.equal(state.phase, "anchored");

  state = dragAcross(state, [{ row: 0, col: 2 }]);

  assert.equal(state.lastOutcome, "found");
  assert.equal(state.foundWords[0].word, "CAT");
});

test("tapping the anchored cell again cancels the tap selection", () => {
  let state = dragAcross(startState(), [{ row: 0, col: 0 }]);
  state = dragAcross(state, [{ row: 0, col: 0 }]);

  assert.equal(state.phase, "idle");
  assert.equal(state.anchor, null);
  assert.deepEqual(state.foundWords, []);
});

test("tapping an unaligned cell re-anchors the selection there", () => {
  let state = dragAcross(startState(), [{ row: 0, col: 0 }]);
  state = dragAcross(state, [{ row: 2, col: 1 }]);

  assert.equal(state.phase, "anchored");
  assert.deepEqual(state.anchor, { row: 2, col: 1 });
});

test("keyboard anchoring, preview, and commit find a word", () => {
  let state = toggleWordSearchAnchor(startState(), { row: 0, col: 0 }, PUZZLE);
  assert.equal(state.phase, "anchored");

  state = previewWordSearchFocus(state, { row: 0, col: 1 });
  assert.deepEqual(getActiveWordSearchSelectionCells(state), [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
  ]);

  state = previewWordSearchFocus(state, { row: 2, col: 1 });
  assert.deepEqual(getActiveWordSearchSelectionCells(state), [
    { row: 0, col: 0 },
  ]);

  state = toggleWordSearchAnchor(state, { row: 0, col: 2 }, PUZZLE);
  assert.equal(state.lastOutcome, "found");
  assert.equal(state.foundWords[0].word, "CAT");
});

test("keyboard selection can be cancelled or toggled off", () => {
  const anchored = toggleWordSearchAnchor(
    startState(),
    { row: 0, col: 0 },
    PUZZLE
  );

  const cancelled = cancelWordSearchSelection(anchored);
  assert.equal(cancelled.phase, "idle");
  assert.equal(cancelled.anchor, null);

  const toggledOff = toggleWordSearchAnchor(
    anchored,
    { row: 0, col: 0 },
    PUZZLE
  );
  assert.equal(toggledOff.phase, "idle");
  assert.equal(toggledOff.anchor, null);
});

test("completion happens exactly when the final word is found", () => {
  const selections: WordSearchCell[][] = [
    [
      { row: 0, col: 0 },
      { row: 0, col: 2 },
    ],
    [
      { row: 2, col: 4 },
      { row: 4, col: 4 },
    ],
    [
      { row: 3, col: 0 },
      { row: 5, col: 2 },
    ],
    [
      { row: 7, col: 7 },
      { row: 7, col: 5 },
    ],
    [
      { row: 6, col: 3 },
      { row: 4, col: 3 },
    ],
  ];

  let state = startState();

  for (const selection of selections) {
    state = dragAcross(state, selection);
    assert.equal(state.lastOutcome, "found");
    assert.equal(state.complete, false);
  }

  assert.equal(state.foundWords.length, 5);

  state = dragAcross(state, [
    { row: 5, col: 7 },
    { row: 3, col: 5 },
  ]);

  assert.equal(state.lastOutcome, "found");
  assert.equal(state.foundWords.length, 6);
  assert.equal(state.complete, true);
});

test("the completion payload reports display words in found order", () => {
  let state = dragAcross(startState(), [
    { row: 2, col: 4 },
    { row: 4, col: 4 },
  ]);
  state = dragAcross(state, [
    { row: 0, col: 0 },
    { row: 0, col: 2 },
  ]);

  const payload = buildWordSearchCompletionPayload(
    [
      { display: "Cat", normalized: "CAT" },
      { display: "dog", normalized: "DOG" },
    ],
    state
  );

  assert.deepEqual(payload, {
    complete: true,
    foundWords: ["dog", "Cat"],
  });
});

test("seeded found words use the puzzle placements", () => {
  const state = createWordSearchInteractionState(PUZZLE, {
    foundWords: ["cat", " DOG "],
  });

  assert.deepEqual(
    state.foundWords.map((found) => found.word),
    ["CAT", "DOG"]
  );
  assert.deepEqual(state.foundWords[0].cells, [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 0, col: 2 },
  ]);
  assert.equal(state.complete, false);

  const complete = createWordSearchInteractionState(PUZZLE, {
    foundWords: PUZZLE.words,
  });
  assert.equal(complete.complete, true);
});

test("invalid seeds are programmer errors", () => {
  assert.throws(
    () =>
      createWordSearchInteractionState(PUZZLE, { foundWords: ["missing"] }),
    /not in the puzzle/
  );
  assert.throws(
    () =>
      createWordSearchInteractionState(PUZZLE, {
        selection: { start: { row: 0, col: 2 }, end: { row: 2, col: 0 } },
      }),
    /straight/
  );
});

// A puzzle whose word list contains a reversed pair: STAR at row 0 reads
// RATS backwards, and RATS has its own separate placement at row 2.
const REVERSED_PAIR_PUZZLE: WordSearchPuzzleResponse = {
  gridSize: 8,
  rows: [
    ["S", "T", "A", "R", "Q", "Q", "Q", "Q"],
    ["Q", "Q", "Q", "Q", "Q", "Q", "Q", "Q"],
    ["R", "A", "T", "S", "Q", "Q", "Q", "Q"],
    ["Q", "Q", "Q", "Q", "Q", "Q", "Q", "Q"],
    ["Q", "Q", "Q", "Q", "Q", "Q", "Q", "Q"],
    ["Q", "Q", "Q", "Q", "Q", "Q", "Q", "Q"],
    ["Q", "Q", "Q", "Q", "Q", "Q", "Q", "Q"],
    ["Q", "Q", "Q", "Q", "Q", "Q", "Q", "Q"],
  ],
  words: ["STAR", "RATS"],
  placements: [
    { word: "STAR", start: { row: 0, col: 0 }, direction: "left-to-right" },
    { word: "RATS", start: { row: 2, col: 0 }, direction: "left-to-right" },
  ],
};

function dragAcrossPuzzle(
  state: WordSearchInteractionState,
  puzzle: WordSearchPuzzleResponse,
  cells: WordSearchCell[]
): WordSearchInteractionState {
  let next = pressWordSearchCell(state, cells[0]);

  for (const cell of cells.slice(1)) {
    next = dragWordSearchToCell(next, cell);
  }

  return releaseWordSearchPress(next, puzzle);
}

test("reversed pairs can both be found when the forward word is found first", () => {
  let state = createWordSearchInteractionState(REVERSED_PAIR_PUZZLE);

  state = dragAcrossPuzzle(state, REVERSED_PAIR_PUZZLE, [
    { row: 0, col: 0 },
    { row: 0, col: 3 },
  ]);
  assert.equal(state.lastOutcome, "found");
  assert.equal(state.foundWords[0].word, "STAR");

  state = dragAcrossPuzzle(state, REVERSED_PAIR_PUZZLE, [
    { row: 2, col: 0 },
    { row: 2, col: 3 },
  ]);
  assert.equal(state.lastOutcome, "found");
  assert.deepEqual(
    state.foundWords.map((found) => found.word),
    ["STAR", "RATS"]
  );
  assert.equal(state.complete, true);
});

test("reversed pairs can both be found when the reversed word is found first", () => {
  let state = createWordSearchInteractionState(REVERSED_PAIR_PUZZLE);

  // Selecting the STAR cells backwards spells the still-missing word RATS,
  // and the exact forward reading must win over the reversed one.
  state = dragAcrossPuzzle(state, REVERSED_PAIR_PUZZLE, [
    { row: 0, col: 3 },
    { row: 0, col: 0 },
  ]);
  assert.equal(state.lastOutcome, "found");
  assert.equal(state.foundWords[0].word, "RATS");

  state = dragAcrossPuzzle(state, REVERSED_PAIR_PUZZLE, [
    { row: 0, col: 0 },
    { row: 0, col: 3 },
  ]);
  assert.equal(state.lastOutcome, "found");
  assert.deepEqual(
    state.foundWords.map((found) => found.word),
    ["RATS", "STAR"]
  );
  assert.equal(state.complete, true);
});

test("re-selecting a completed reversed pair reports already-found", () => {
  let state = createWordSearchInteractionState(REVERSED_PAIR_PUZZLE, {
    foundWords: ["STAR", "RATS"],
  });

  state = dragAcrossPuzzle(state, REVERSED_PAIR_PUZZLE, [
    { row: 0, col: 0 },
    { row: 0, col: 3 },
  ]);

  assert.equal(state.lastOutcome, "already-found");
  assert.equal(state.foundWords.length, 2);
});

test("a reversed re-selection of a found word reports already-found", () => {
  let state = dragAcross(startState(), [
    { row: 0, col: 0 },
    { row: 0, col: 2 },
  ]);

  state = dragAcross(state, [
    { row: 0, col: 2 },
    { row: 0, col: 0 },
  ]);

  assert.equal(state.lastOutcome, "already-found");
  assert.equal(state.foundWords.length, 1);
});

test("a seeded selection renders as an anchored straight line", () => {
  const state = createWordSearchInteractionState(PUZZLE, {
    selection: { start: { row: 1, col: 1 }, end: { row: 1, col: 4 } },
  });

  assert.equal(state.phase, "anchored");
  assert.equal(getActiveWordSearchSelectionCells(state).length, 4);
});
