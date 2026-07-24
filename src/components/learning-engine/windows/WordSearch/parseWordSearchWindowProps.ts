// The documented safe input ranges for the word-search window. gridSize is
// both the row count and the column count.
export const MIN_WORD_SEARCH_GRID_SIZE = 8;
export const MAX_WORD_SEARCH_GRID_SIZE = 30;
export const MAX_WORD_SEARCH_WORD_COUNT = 20;
// A single letter can never be committed as a selection, so one-letter words
// would make completion impossible.
export const MIN_WORD_SEARCH_WORD_LENGTH = 2;

// Words may contain only letters. Case is normalized to uppercase for
// placement and matching; the trimmed original text is preserved for display.
const SUPPORTED_WORD_PATTERN = /^[A-Za-z]+$/;

export type ParsedWordSearchWord = {
  display: string;
  normalized: string;
};

export type ParsedWordSearchWindowProps = {
  gridSize: number;
  words: ParsedWordSearchWord[];
};

// Invalid module-owned props are programmer errors, so they throw instead of
// becoming learner-facing messages.
export function parseWordSearchWindowProps(props: {
  gridSize: number;
  words: string[];
}): ParsedWordSearchWindowProps {
  const { gridSize, words } = props;

  if (
    typeof gridSize !== "number" ||
    !Number.isInteger(gridSize) ||
    gridSize < MIN_WORD_SEARCH_GRID_SIZE ||
    gridSize > MAX_WORD_SEARCH_GRID_SIZE
  ) {
    throw new Error(
      `WordSearchWindow gridSize must be an integer from ${MIN_WORD_SEARCH_GRID_SIZE} to ${MAX_WORD_SEARCH_GRID_SIZE}. Received: ${String(gridSize)}`
    );
  }

  if (!Array.isArray(words) || words.length === 0) {
    throw new Error("WordSearchWindow words must be a nonempty array.");
  }

  if (words.length > MAX_WORD_SEARCH_WORD_COUNT) {
    throw new Error(
      `WordSearchWindow supports at most ${MAX_WORD_SEARCH_WORD_COUNT} words. Received: ${words.length}`
    );
  }

  const parsedWords: ParsedWordSearchWord[] = [];
  const seenNormalizedWords = new Set<string>();

  for (const word of words) {
    if (typeof word !== "string") {
      throw new Error("WordSearchWindow words must all be strings.");
    }

    const display = word.trim();

    if (display === "") {
      throw new Error(
        "WordSearchWindow words must not be empty after trimming."
      );
    }

    if (!SUPPORTED_WORD_PATTERN.test(display)) {
      throw new Error(
        `WordSearchWindow words may contain letters only. Received: "${display}"`
      );
    }

    const normalized = display.toUpperCase();

    if (normalized.length < MIN_WORD_SEARCH_WORD_LENGTH) {
      throw new Error(
        `WordSearchWindow words must be at least ${MIN_WORD_SEARCH_WORD_LENGTH} letters. Received: "${display}"`
      );
    }

    if (normalized.length > gridSize) {
      throw new Error(
        `WordSearchWindow words must fit the grid. "${display}" is longer than ${gridSize}.`
      );
    }

    if (seenNormalizedWords.has(normalized)) {
      throw new Error(
        `WordSearchWindow words must be unique. Duplicate: "${display}"`
      );
    }

    seenNormalizedWords.add(normalized);
    parsedWords.push({ display, normalized });
  }

  return { gridSize, words: parsedWords };
}
