import type { ScreenRequest } from "@/types/learning";
import {
  MAX_WORD_SEARCH_GRID_SIZE,
  MIN_WORD_SEARCH_GRID_SIZE,
  parseWordSearchInput,
} from "@/lib/learning-engine/word-search/wordSearchInputContract";
import { WORD_SEARCH_CHECKPOINT_GROUP_SIZE } from "../data/vocabularyContentTypes";
import type { VocabularyWordSearchCheckpointContent } from "../data/vocabularyContentTypes";

const GRID_SIZE_PADDING = 4;
const INVALID_CHECKPOINT_CONTENT_MESSAGE =
  "Vocabulary word-search checkpoint content failed Word Search input validation.";

export function createWordSearchCheckpointScreenRequest(
  content: VocabularyWordSearchCheckpointContent
): ScreenRequest {
  const validated = parseCheckpointWords(content.words);

  return {
    windowName: "word-search",
    props: {
      gridSize: validated.gridSize,
      words: validated.words,
      title: "Word Search Checkpoint",
      instructions:
        "Find the five words you just mastered before continuing your lesson.",
      actionLabel: "Next →",
      // Ungraded reinforcement: completion must never reach the graded
      // definition/spelling submitAnswer parser.
      emitCompletionAction: false,
    },
  };
}

function parseCheckpointWords(words: string[]): {
  gridSize: number;
  words: string[];
} {
  try {
    if (
      !Array.isArray(words) ||
      words.length !== WORD_SEARCH_CHECKPOINT_GROUP_SIZE ||
      !words.every((word) => typeof word === "string")
    ) {
      throw new Error(INVALID_CHECKPOINT_CONTENT_MESSAGE);
    }

    const longestWordLength = Math.max(
      ...words.map((word) => word.trim().length)
    );
    const gridSize = Math.min(
      MAX_WORD_SEARCH_GRID_SIZE,
      Math.max(MIN_WORD_SEARCH_GRID_SIZE, longestWordLength + GRID_SIZE_PADDING)
    );
    const parsed = parseWordSearchInput({ gridSize, words });

    if (
      parsed.words.length !== WORD_SEARCH_CHECKPOINT_GROUP_SIZE ||
      parsed.duplicateNormalizedWords.length > 0
    ) {
      throw new Error(INVALID_CHECKPOINT_CONTENT_MESSAGE);
    }

    return {
      gridSize,
      words: parsed.words.map((word) => word.display),
    };
  } catch {
    throw new Error(INVALID_CHECKPOINT_CONTENT_MESSAGE);
  }
}
