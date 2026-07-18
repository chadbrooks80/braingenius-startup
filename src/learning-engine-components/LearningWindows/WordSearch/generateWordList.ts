import {
  WORD_SEARCH_DIRECTION_NAMES,
  WORD_SEARCH_DIRECTION_STEPS,
  getWordSearchPlacementCells,
} from "./wordSearchDirections";
import type {
  WordSearchPlacement,
  WordSearchPuzzleRequest,
  WordSearchPuzzleResponse,
} from "./wordSearchTypes";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Temporary Phase 1 puzzle generator. It stands in for the future AI puzzle
// action and returns the same response shape that action is expected to
// produce, so later phases can replace this implementation without rewriting
// the Word Search window. The output is deterministic for a given request.
//
// Learning modules must not call this to build grids or placements
// themselves; it belongs to the Word Search window and its playground usage.
export async function generateWordList(
  request: WordSearchPuzzleRequest
): Promise<WordSearchPuzzleResponse> {
  const { gridSize, words } = request;
  const nextRandom = createSeededRandom(hashPuzzleRequest(request));
  const letters: (string | null)[][] = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => null)
  );

  // Longest words first so the tightest fits are placed while the grid is
  // still empty.
  const orderedWords = [...words].sort(
    (a, b) => b.length - a.length || a.localeCompare(b)
  );
  const placements = new Map<string, WordSearchPlacement>();

  for (const word of orderedWords) {
    placements.set(word, placeWord(word, letters, gridSize, nextRandom));
  }

  const rows = letters.map((rowLetters) =>
    rowLetters.map(
      (letter) => letter ?? ALPHABET[Math.floor(nextRandom() * ALPHABET.length)]
    )
  );

  return {
    gridSize,
    rows,
    words: [...words],
    placements: words.map((word) => placements.get(word)!),
  };
}

function placeWord(
  word: string,
  letters: (string | null)[][],
  gridSize: number,
  nextRandom: () => number
): WordSearchPlacement {
  const candidates: WordSearchPlacement[] = [];

  for (const direction of WORD_SEARCH_DIRECTION_NAMES) {
    const step = WORD_SEARCH_DIRECTION_STEPS[direction];
    const lastOffset = word.length - 1;

    for (let row = 0; row < gridSize; row += 1) {
      for (let col = 0; col < gridSize; col += 1) {
        const endRow = row + step.row * lastOffset;
        const endCol = col + step.col * lastOffset;

        if (endRow < 0 || endRow >= gridSize || endCol < 0 || endCol >= gridSize) {
          continue;
        }

        candidates.push({ word, start: { row, col }, direction });
      }
    }
  }

  const offset = Math.floor(nextRandom() * candidates.length);

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[(offset + index) % candidates.length];
    const cells = getWordSearchPlacementCells(candidate);
    const fits = cells.every(({ row, col }, cellIndex) => {
      const existing = letters[row][col];
      return existing === null || existing === word[cellIndex];
    });

    if (fits) {
      cells.forEach(({ row, col }, cellIndex) => {
        letters[row][col] = word[cellIndex];
      });
      return candidate;
    }
  }

  throw new Error(
    `Unable to place "${word}" in a ${gridSize}x${gridSize} word-search grid.`
  );
}

function hashPuzzleRequest({ gridSize, words }: WordSearchPuzzleRequest): number {
  const text = `${gridSize}:${words.join(",")}`;
  let hash = 2166136261;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
