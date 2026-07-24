import type { WordSearchPuzzleResponse } from "./wordSearchTypes";

// Tracks one asynchronous puzzle generation per attempt number. Results are
// applied only while their attempt is still the active loading attempt, so a
// generation that resolves after a retry (or after the state moved on) is
// ignored instead of overwriting newer state.
export type WordSearchPuzzleLoadState =
  | { status: "loading"; attempt: number }
  | { status: "error"; attempt: number }
  | { status: "ready"; attempt: number; puzzle: WordSearchPuzzleResponse };

export const INITIAL_WORD_SEARCH_PUZZLE_LOAD_STATE: WordSearchPuzzleLoadState =
  {
    status: "loading",
    attempt: 0,
  };

export function retryWordSearchPuzzleLoad(
  state: WordSearchPuzzleLoadState
): WordSearchPuzzleLoadState {
  return { status: "loading", attempt: state.attempt + 1 };
}

export function applyWordSearchPuzzleLoadSuccess(
  state: WordSearchPuzzleLoadState,
  attempt: number,
  puzzle: WordSearchPuzzleResponse
): WordSearchPuzzleLoadState {
  if (state.status !== "loading" || state.attempt !== attempt) {
    return state;
  }

  return { status: "ready", attempt, puzzle };
}

export function applyWordSearchPuzzleLoadFailure(
  state: WordSearchPuzzleLoadState,
  attempt: number
): WordSearchPuzzleLoadState {
  if (state.status !== "loading" || state.attempt !== attempt) {
    return state;
  }

  return { status: "error", attempt };
}
