// The public, subject-neutral input contract shared by Word Search windows and
// learning modules that intentionally create Word Search screen requests.
export const MIN_WORD_SEARCH_GRID_SIZE = 8;
export const MAX_WORD_SEARCH_GRID_SIZE = 30;
export const MAX_WORD_SEARCH_WORD_COUNT = 20;
// A single letter can never be committed as a selection, so one-letter words
// would make completion impossible.
export const MIN_WORD_SEARCH_WORD_LENGTH = 2;

const SUPPORTED_WORD_PATTERN = /^[A-Za-z]+$/;

export type ParsedWordSearchWord = {
  display: string;
  normalized: string;
};

export type ParsedWordSearchInput = {
  gridSize: number;
  words: ParsedWordSearchWord[];
  duplicateNormalizedWords: string[];
};

export function parseWordSearchInput(input: {
  gridSize: number;
  words: string[];
}): ParsedWordSearchInput {
  const { gridSize, words } = input;

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

  const parsedWords: ParsedWordSearchWord[] = [];
  const seenNormalizedWords = new Set<string>();
  const duplicateNormalizedWords = new Set<string>();

  for (const word of words) {
    if (typeof word !== "string") {
      throw new Error("WordSearchWindow words must all be strings.");
    }

    const display = word.trim();
    const normalized = display.toUpperCase();

    if (seenNormalizedWords.has(normalized)) {
      duplicateNormalizedWords.add(normalized);
      continue;
    }

    seenNormalizedWords.add(normalized);

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

    parsedWords.push({ display, normalized });
  }

  if (parsedWords.length > MAX_WORD_SEARCH_WORD_COUNT) {
    throw new Error(
      `WordSearchWindow supports at most ${MAX_WORD_SEARCH_WORD_COUNT} words. Received: ${parsedWords.length}`
    );
  }

  assertCompatibleTargetSet(parsedWords);

  return {
    gridSize,
    words: parsedWords,
    duplicateNormalizedWords: [...duplicateNormalizedWords],
  };
}

type TargetAlignment = Map<number, string>;

function assertCompatibleTargetSet(words: ParsedWordSearchWord[]): void {
  for (const { normalized: target } of words) {
    const containingTargets: string[] = [];
    const alignmentGroups: TargetAlignment[][] = [];

    for (const { normalized: container } of words) {
      if (container.length <= target.length) {
        continue;
      }

      const occurrenceCount = countUndirectedSubstringOccurrences(
        container,
        target
      );

      if (occurrenceCount > 1) {
        throw new Error(
          `WordSearchWindow target set is incompatible: "${target}" occurs more than once inside "${container}".`
        );
      }

      if (occurrenceCount === 1) {
        containingTargets.push(container);
        alignmentGroups.push(getTargetAlignments(container, target));
      }
    }

    if (
      containingTargets.length > 1 &&
      !hasCompatibleTargetAlignments(alignmentGroups)
    ) {
      throw new Error(
        `WordSearchWindow target set is incompatible: "${target}" cannot have one shared occurrence across ${containingTargets.join(", ")}.`
      );
    }
  }
}

function countUndirectedSubstringOccurrences(
  container: string,
  target: string
): number {
  const reversedTarget = reverseWord(target);
  let count = 0;

  for (let index = 0; index <= container.length - target.length; index += 1) {
    const visible = container.slice(index, index + target.length);

    if (visible === target || visible === reversedTarget) {
      count += 1;
    }
  }

  return count;
}

function getTargetAlignments(
  container: string,
  target: string
): TargetAlignment[] {
  const alignments = new Map<string, TargetAlignment>();

  for (const orientedContainer of new Set([
    container,
    reverseWord(container),
  ])) {
    for (
      let index = 0;
      index <= orientedContainer.length - target.length;
      index += 1
    ) {
      if (orientedContainer.slice(index, index + target.length) !== target) {
        continue;
      }

      const alignment = new Map(
        [...orientedContainer].map((letter, letterIndex) => [
          letterIndex - index,
          letter,
        ])
      );
      alignments.set(alignmentKey(alignment), alignment);
    }
  }

  return [...alignments.values()];
}

function hasCompatibleTargetAlignments(
  groups: TargetAlignment[][],
  groupIndex = 0,
  merged = new Map<number, string>()
): boolean {
  if (groupIndex === groups.length) {
    return true;
  }

  for (const alignment of groups[groupIndex]) {
    const changedPositions: number[] = [];
    let compatible = true;

    for (const [position, letter] of alignment) {
      const existing = merged.get(position);

      if (existing !== undefined && existing !== letter) {
        compatible = false;
        break;
      }

      if (existing === undefined) {
        merged.set(position, letter);
        changedPositions.push(position);
      }
    }

    if (
      compatible &&
      hasCompatibleTargetAlignments(groups, groupIndex + 1, merged)
    ) {
      return true;
    }

    changedPositions.forEach((position) => merged.delete(position));
  }

  return false;
}

function alignmentKey(alignment: TargetAlignment): string {
  return JSON.stringify([...alignment]);
}

function reverseWord(word: string): string {
  return [...word].reverse().join("");
}
