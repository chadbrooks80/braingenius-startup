import {
  areSameWordSearchCells,
  getWordSearchCellsBetween,
  getWordSearchPlacementCells,
  isWordSearchCellInBounds,
} from "./wordSearchDirections";
import type {
  WordSearchCell,
  WordSearchPuzzleResponse,
} from "./wordSearchTypes";

export type WordSearchFoundWord = {
  word: string;
  cells: WordSearchCell[];
};

export type WordSearchSelectionOutcome = "found" | "already-found" | "no-match";

// "dragging" tracks an active press that may extend across cells.
// "anchored" is a committed first tap (or keyboard anchor) waiting for the
// selection's end cell.
export type WordSearchSelectionPhase = "idle" | "dragging" | "anchored";

export type WordSearchInteractionState = {
  phase: WordSearchSelectionPhase;
  anchor: WordSearchCell | null;
  focus: WordSearchCell | null;
  foundWords: WordSearchFoundWord[];
  lastOutcome: WordSearchSelectionOutcome | null;
  complete: boolean;
};

export type WordSearchInteractionSeed = {
  foundWords?: string[];
  selection?: { start: WordSearchCell; end: WordSearchCell };
};

// Builds the initial interaction state for a loaded puzzle. Seeds exist for
// the playground and tests only; modules never supply them. Invalid seeds are
// programmer errors.
export function createWordSearchInteractionState(
  puzzle: WordSearchPuzzleResponse,
  seed: WordSearchInteractionSeed = {}
): WordSearchInteractionState {
  const foundWords = (seed.foundWords ?? []).map((seedWord) => {
    const normalized = seedWord.trim().toUpperCase();
    const placement = puzzle.placements.find(
      (candidate) => candidate.word === normalized
    );

    if (!placement) {
      throw new Error(
        `WordSearchWindow initialFoundWords contains a word that is not in the puzzle: "${seedWord}"`
      );
    }

    return { word: normalized, cells: getWordSearchPlacementCells(placement) };
  });

  let anchor: WordSearchCell | null = null;
  let focus: WordSearchCell | null = null;
  let phase: WordSearchSelectionPhase = "idle";

  if (seed.selection) {
    const { start, end } = seed.selection;
    const cells = getWordSearchCellsBetween(start, end);
    const inBounds =
      isWordSearchCellInBounds(start, puzzle.gridSize) &&
      isWordSearchCellInBounds(end, puzzle.gridSize);

    if (!cells || !inBounds) {
      throw new Error(
        "WordSearchWindow initialSelection must be a straight in-bounds line."
      );
    }

    anchor = start;
    focus = end;
    phase = "anchored";
  }

  return {
    phase,
    anchor,
    focus,
    foundWords,
    lastOutcome: null,
    complete: foundWords.length === puzzle.words.length,
  };
}

// Pointer down on a cell (mouse press or touch start).
export function pressWordSearchCell(
  state: WordSearchInteractionState,
  cell: WordSearchCell
): WordSearchInteractionState {
  if (state.phase === "anchored" && state.anchor) {
    if (areSameWordSearchCells(state.anchor, cell)) {
      return clearSelection(state, null);
    }

    if (getWordSearchCellsBetween(state.anchor, cell)) {
      return { ...state, phase: "dragging", focus: cell, lastOutcome: null };
    }
  }

  return {
    ...state,
    phase: "dragging",
    anchor: cell,
    focus: cell,
    lastOutcome: null,
  };
}

// Pointer moved onto a cell while pressed. The focus only follows cells that
// stay on a supported straight line from the anchor.
export function dragWordSearchToCell(
  state: WordSearchInteractionState,
  cell: WordSearchCell
): WordSearchInteractionState {
  if (state.phase !== "dragging" || !state.anchor) {
    return state;
  }

  if (
    areSameWordSearchCells(state.anchor, cell) ||
    getWordSearchCellsBetween(state.anchor, cell)
  ) {
    return { ...state, focus: cell };
  }

  return state;
}

// Pointer released. A press released on its own anchor becomes a waiting tap
// anchor; a longer selection is checked against the word list.
export function releaseWordSearchPress(
  state: WordSearchInteractionState,
  puzzle: WordSearchPuzzleResponse
): WordSearchInteractionState {
  if (state.phase !== "dragging" || !state.anchor || !state.focus) {
    return state;
  }

  if (areSameWordSearchCells(state.anchor, state.focus)) {
    return { ...state, phase: "anchored", focus: state.anchor };
  }

  return commitSelection(state, puzzle);
}

// Keyboard Enter/Space on the focused cell: anchor, cancel on the same cell,
// commit on an aligned cell, or re-anchor on an unaligned cell.
export function toggleWordSearchAnchor(
  state: WordSearchInteractionState,
  cell: WordSearchCell,
  puzzle: WordSearchPuzzleResponse
): WordSearchInteractionState {
  if (state.phase === "idle" || !state.anchor) {
    return {
      ...state,
      phase: "anchored",
      anchor: cell,
      focus: cell,
      lastOutcome: null,
    };
  }

  if (areSameWordSearchCells(state.anchor, cell)) {
    return clearSelection(state, null);
  }

  if (getWordSearchCellsBetween(state.anchor, cell)) {
    return commitSelection({ ...state, focus: cell }, puzzle);
  }

  return {
    ...state,
    phase: "anchored",
    anchor: cell,
    focus: cell,
    lastOutcome: null,
  };
}

// Keyboard cursor movement while a tap/keyboard anchor is waiting: preview
// the selection up to the cursor while it stays on a supported line, and fall
// back to the anchor alone when it does not.
export function previewWordSearchFocus(
  state: WordSearchInteractionState,
  cell: WordSearchCell
): WordSearchInteractionState {
  if (state.phase !== "anchored" || !state.anchor) {
    return state;
  }

  if (
    areSameWordSearchCells(state.anchor, cell) ||
    getWordSearchCellsBetween(state.anchor, cell)
  ) {
    return { ...state, focus: cell };
  }

  return { ...state, focus: state.anchor };
}

export function cancelWordSearchSelection(
  state: WordSearchInteractionState
): WordSearchInteractionState {
  return clearSelection(state, null);
}

// The payload for the established completion emission. Found words are
// reported using their module-supplied display text, in the order found.
export function buildWordSearchCompletionPayload(
  words: { display: string; normalized: string }[],
  state: WordSearchInteractionState
): { complete: true; foundWords: string[] } {
  const displayByNormalized = new Map(
    words.map((word) => [word.normalized, word.display])
  );

  return {
    complete: true,
    foundWords: state.foundWords.map(
      (found) => displayByNormalized.get(found.word) ?? found.word
    ),
  };
}

export function getActiveWordSearchSelectionCells(
  state: WordSearchInteractionState
): WordSearchCell[] {
  if (state.phase === "idle" || !state.anchor || !state.focus) {
    return [];
  }

  return getWordSearchCellsBetween(state.anchor, state.focus) ?? [state.anchor];
}

function commitSelection(
  state: WordSearchInteractionState,
  puzzle: WordSearchPuzzleResponse
): WordSearchInteractionState {
  const cells = getActiveWordSearchSelectionCells(state);
  const selectedText = cells
    .map(({ row, col }) => puzzle.rows[row][col])
    .join("");
  const reversedText = [...selectedText].reverse().join("");

  // Only words that are still missing can match, and an exact forward match
  // wins before the reversed reading, so reversed pairs such as STAR and
  // RATS can both be found regardless of which one is found first.
  const foundWordSet = new Set(state.foundWords.map((found) => found.word));
  const remainingWords = puzzle.words.filter(
    (word) => !foundWordSet.has(word)
  );
  const matchedWord =
    remainingWords.find((word) => word === selectedText) ??
    remainingWords.find((word) => word === reversedText);

  if (!matchedWord) {
    const spellsFoundWord =
      foundWordSet.has(selectedText) || foundWordSet.has(reversedText);

    return clearSelection(state, spellsFoundWord ? "already-found" : "no-match");
  }

  const foundWords = [...state.foundWords, { word: matchedWord, cells }];

  return {
    ...clearSelection(state, "found"),
    foundWords,
    complete: foundWords.length === puzzle.words.length,
  };
}

function clearSelection(
  state: WordSearchInteractionState,
  lastOutcome: WordSearchSelectionOutcome | null
): WordSearchInteractionState {
  return { ...state, phase: "idle", anchor: null, focus: null, lastOutcome };
}
