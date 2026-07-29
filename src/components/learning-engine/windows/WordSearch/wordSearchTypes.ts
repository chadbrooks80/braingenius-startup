export type WordSearchCell = {
  row: number;
  col: number;
};

export type WordSearchDirectionName =
  | "left-to-right"
  | "top-to-bottom"
  | "diagonal-down-right"
  | "right-to-left"
  | "bottom-to-top"
  | "diagonal-up-left";

export type WordSearchPlacement = {
  word: string;
  start: WordSearchCell;
  direction: WordSearchDirectionName;
};

export type WordSearchPuzzleRequest = {
  gridSize: number;
  words: string[];
  attempt?: number;
};

// A complete square array of locally generated letter rows, the requested
// words, and the official placement data used to verify learner selections.
export type WordSearchPuzzleResponse = {
  gridSize: number;
  rows: string[][];
  words: string[];
  placements: WordSearchPlacement[];
};

export type GenerateWordSearchPuzzle = (
  request: WordSearchPuzzleRequest
) => Promise<WordSearchPuzzleResponse>;
