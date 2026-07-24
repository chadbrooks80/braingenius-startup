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
};

// The response shape expected from the future AI puzzle action: a complete
// square array of letter rows, the requested words, and the placement data
// needed to verify learner selections.
export type WordSearchPuzzleResponse = {
  gridSize: number;
  rows: string[][];
  words: string[];
  placements: WordSearchPlacement[];
};

export type GenerateWordSearchPuzzle = (
  request: WordSearchPuzzleRequest
) => Promise<WordSearchPuzzleResponse>;
