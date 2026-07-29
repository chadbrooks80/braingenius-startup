import {
  WORD_SEARCH_DIRECTION_NAMES,
  WORD_SEARCH_DIRECTION_STEPS,
  getWordSearchPlacementCells,
} from "./wordSearchDirections";
import type {
  WordSearchCell,
  WordSearchPlacement,
  WordSearchPuzzleRequest,
  WordSearchPuzzleResponse,
} from "./wordSearchTypes";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const MAX_GENERATION_REBUILDS = 32;
const MAX_PLACEMENT_SEARCH_NODES = 100_000;
const CANONICAL_OCCURRENCE_STEPS: WordSearchCell[] = [
  { row: 0, col: 1 },
  { row: 1, col: 0 },
  { row: 1, col: 1 },
];

type MutableGrid = (string | null)[][];

type AccidentalOccurrence = {
  key: string;
  cells: WordSearchCell[];
};

type OccurrenceInspection = {
  officialPlacementsVisible: boolean;
  extras: AccidentalOccurrence[];
  extraKeys: Set<string>;
};

// Generates locally and deterministically for a request/attempt pair. Each
// retry attempt and bounded internal rebuild receives a different seed.
export async function generateWordList(
  request: WordSearchPuzzleRequest
): Promise<WordSearchPuzzleResponse> {
  const { gridSize, words } = request;

  for (let rebuild = 0; rebuild < MAX_GENERATION_REBUILDS; rebuild += 1) {
    const nextRandom = createSeededRandom(hashPuzzleRequest(request, rebuild));
    const candidate = buildPlacementCandidate(
      gridSize,
      words,
      nextRandom
    );

    if (!candidate) {
      continue;
    }

    const filledRows = candidate.letters.map((row) =>
      row.map(
        (letter) =>
          letter ?? ALPHABET[Math.floor(nextRandom() * ALPHABET.length)]
      )
    );
    const replacementOffset = Math.floor(nextRandom() * ALPHABET.length);
    const replacementAlphabet =
      ALPHABET.slice(replacementOffset) + ALPHABET.slice(0, replacementOffset);
    const repairedRows = repairAccidentalWordOccurrences(
      filledRows,
      words,
      candidate.placements,
      replacementAlphabet
    );

    if (repairedRows) {
      return {
        gridSize,
        rows: repairedRows,
        words: [...words],
        placements: candidate.placements,
      };
    }
  }

  throw new Error(
    `Unable to build a unique ${gridSize}x${gridSize} word-search puzzle after ${MAX_GENERATION_REBUILDS} bounded attempts.`
  );
}

// Returns each undirected visible occurrence once. The canonical scan covers
// horizontal, vertical, and supported diagonal lines; comparing both readings
// includes every corresponding reverse selection.
export function findWordSearchOccurrences(
  rows: string[][],
  word: string
): WordSearchCell[][] {
  const occurrences: WordSearchCell[][] = [];
  const reverse = [...word].reverse().join("");
  const gridSize = rows.length;

  for (const step of CANONICAL_OCCURRENCE_STEPS) {
    for (let row = 0; row < gridSize; row += 1) {
      for (let col = 0; col < gridSize; col += 1) {
        const endRow = row + step.row * (word.length - 1);
        const endCol = col + step.col * (word.length - 1);

        if (
          endRow < 0 ||
          endRow >= gridSize ||
          endCol < 0 ||
          endCol >= gridSize
        ) {
          continue;
        }

        const cells = Array.from({ length: word.length }, (unused, index) => ({
          row: row + step.row * index,
          col: col + step.col * index,
        }));
        const visibleText = cells
          .map((cell) => rows[cell.row]?.[cell.col] ?? "")
          .join("");

        if (visibleText === word || visibleText === reverse) {
          occurrences.push(cells);
        }
      }
    }
  }

  return occurrences;
}

// Returns a repaired clone, or null when a candidate must be abandoned. Only
// non-official cells can change. Every trial replacement is fully rescanned,
// and is accepted only when it removes the chosen occurrence without creating
// any new occurrence of any target.
export function repairAccidentalWordOccurrences(
  rows: string[][],
  words: string[],
  placements: WordSearchPlacement[],
  replacementAlphabet = ALPHABET
): string[][] | null {
  const repairedRows = rows.map((row) => [...row]);
  const protectedCells = new Set(
    placements.flatMap((placement) =>
      getWordSearchPlacementCells(placement).map(cellKey)
    )
  );
  const replacementLetters = [...replacementAlphabet].filter((letter) =>
    /^[A-Z]$/.test(letter)
  );
  const repairLimit = Math.max(1, rows.length * rows.length * words.length);

  for (let repair = 0; repair < repairLimit; repair += 1) {
    const before = inspectOccurrences(repairedRows, words, placements);

    if (!before.officialPlacementsVisible) {
      return null;
    }

    const accidental = before.extras[0];

    if (!accidental) {
      return repairedRows;
    }

    const safeCells = accidental.cells.filter(
      (cell) => !protectedCells.has(cellKey(cell))
    );

    if (safeCells.length === 0) {
      return null;
    }

    let accepted = false;

    for (const cell of safeCells) {
      const originalLetter = repairedRows[cell.row][cell.col];

      for (const replacement of replacementLetters) {
        if (replacement === originalLetter) {
          continue;
        }

        repairedRows[cell.row][cell.col] = replacement;
        const after = inspectOccurrences(repairedRows, words, placements);
        const createdNewOccurrence = [...after.extraKeys].some(
          (key) => !before.extraKeys.has(key)
        );

        if (
          after.officialPlacementsVisible &&
          !after.extraKeys.has(accidental.key) &&
          !createdNewOccurrence
        ) {
          accepted = true;
          break;
        }
      }

      if (accepted) {
        break;
      }

      repairedRows[cell.row][cell.col] = originalLetter;
    }

    if (!accepted) {
      return null;
    }
  }

  return null;
}

function buildPlacementCandidate(
  gridSize: number,
  words: string[],
  nextRandom: () => number
): { letters: MutableGrid; placements: WordSearchPlacement[] } | null {
  const letters: MutableGrid = Array.from({ length: gridSize }, () =>
    Array.from({ length: gridSize }, () => null)
  );
  const orderedWords = [...words].sort(
    (a, b) => b.length - a.length || a.localeCompare(b)
  );
  const candidatesByWord = new Map(
    orderedWords.map((word) => [
      word,
      shuffle(getPlacementCandidates(word, gridSize), nextRandom),
    ])
  );
  const placements = new Map<string, WordSearchPlacement>();
  let visitedNodes = 0;

  function placeNext(wordIndex: number): boolean {
    if (wordIndex === orderedWords.length) {
      return true;
    }

    const word = orderedWords[wordIndex];
    const candidates = [...(candidatesByWord.get(word) ?? [])].sort(
      (a, b) => placementOverlap(b, letters) - placementOverlap(a, letters)
    );

    for (const candidate of candidates) {
      visitedNodes += 1;

      if (visitedNodes > MAX_PLACEMENT_SEARCH_NODES) {
        return false;
      }

      const cells = getWordSearchPlacementCells(candidate);
      const fits = cells.every(({ row, col }, index) => {
        const existing = letters[row][col];
        return existing === null || existing === word[index];
      });

      if (!fits) {
        continue;
      }

      const changedCells: WordSearchCell[] = [];

      cells.forEach(({ row, col }, index) => {
        if (letters[row][col] === null) {
          letters[row][col] = word[index];
          changedCells.push({ row, col });
        }
      });
      placements.set(word, candidate);

      if (placeNext(wordIndex + 1)) {
        return true;
      }

      placements.delete(word);
      changedCells.forEach(({ row, col }) => {
        letters[row][col] = null;
      });
    }

    return false;
  }

  if (!placeNext(0)) {
    return null;
  }

  return {
    letters,
    placements: words.map((word) => placements.get(word)!),
  };
}

function getPlacementCandidates(
  word: string,
  gridSize: number
): WordSearchPlacement[] {
  const candidates: WordSearchPlacement[] = [];

  for (const direction of WORD_SEARCH_DIRECTION_NAMES) {
    const step = WORD_SEARCH_DIRECTION_STEPS[direction];
    const lastOffset = word.length - 1;

    for (let row = 0; row < gridSize; row += 1) {
      for (let col = 0; col < gridSize; col += 1) {
        const endRow = row + step.row * lastOffset;
        const endCol = col + step.col * lastOffset;

        if (
          endRow >= 0 &&
          endRow < gridSize &&
          endCol >= 0 &&
          endCol < gridSize
        ) {
          candidates.push({ word, start: { row, col }, direction });
        }
      }
    }
  }

  return candidates;
}

function placementOverlap(
  placement: WordSearchPlacement,
  letters: MutableGrid
): number {
  return getWordSearchPlacementCells(placement).reduce(
    (count, { row, col }) => count + (letters[row][col] === null ? 0 : 1),
    0
  );
}

function inspectOccurrences(
  rows: string[][],
  words: string[],
  placements: WordSearchPlacement[]
): OccurrenceInspection {
  const extras: AccidentalOccurrence[] = [];
  let officialPlacementsVisible = true;

  for (const word of words) {
    const placement = placements.find((candidate) => candidate.word === word);

    if (!placement) {
      officialPlacementsVisible = false;
      continue;
    }

    const officialKey = cellsKey(getWordSearchPlacementCells(placement));
    const occurrences = findWordSearchOccurrences(rows, word);

    if (!occurrences.some((cells) => cellsKey(cells) === officialKey)) {
      officialPlacementsVisible = false;
    }

    for (const cells of occurrences) {
      const visibleKey = cellsKey(cells);

      if (visibleKey !== officialKey) {
        extras.push({
          key: `${word}:${visibleKey}`,
          cells,
        });
      }
    }
  }

  return {
    officialPlacementsVisible,
    extras,
    extraKeys: new Set(extras.map((occurrence) => occurrence.key)),
  };
}

function cellKey({ row, col }: WordSearchCell): string {
  return `${row}:${col}`;
}

function cellsKey(cells: WordSearchCell[]): string {
  const forward = cells.map(cellKey).join("|");
  const reverse = [...cells].reverse().map(cellKey).join("|");
  return forward < reverse ? forward : reverse;
}

function shuffle<T>(values: T[], nextRandom: () => number): T[] {
  for (let index = values.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(nextRandom() * (index + 1));
    [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
  }

  return values;
}

function hashPuzzleRequest(
  { gridSize, words, attempt = 0 }: WordSearchPuzzleRequest,
  rebuild: number
): number {
  const text = `${gridSize}:${attempt}:${rebuild}:${words.join(",")}`;
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
