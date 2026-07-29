import {
  parseWordSearchInput,
  type ParsedWordSearchInput,
} from "@/lib/learning-engine/word-search/wordSearchInputContract";

export {
  MAX_WORD_SEARCH_GRID_SIZE,
  MAX_WORD_SEARCH_WORD_COUNT,
  MIN_WORD_SEARCH_GRID_SIZE,
  MIN_WORD_SEARCH_WORD_LENGTH,
} from "@/lib/learning-engine/word-search/wordSearchInputContract";
export type {
  ParsedWordSearchWord,
} from "@/lib/learning-engine/word-search/wordSearchInputContract";

export type ParsedWordSearchWindowProps = ParsedWordSearchInput;

// Invalid module-owned props are programmer errors, so they throw instead of
// becoming learner-facing messages.
export function parseWordSearchWindowProps(props: {
  gridSize: number;
  words: string[];
}): ParsedWordSearchWindowProps {
  return parseWordSearchInput(props);
}

export function getWordSearchPuzzleKey(
  parsedProps: ParsedWordSearchWindowProps
): string {
  return JSON.stringify(parsedProps);
}

function logDuplicateInput(normalizedDuplicates: string[]): void {
  console.error(
    `[WordSearchWindow] Removed duplicate target input: ${normalizedDuplicates.join(", ")}`
  );
}

export type WordSearchDuplicateDiagnosticRef = {
  current: string | null;
};

export function reportDuplicateWordSearchInputOnce(
  normalizedDuplicates: string[],
  lastReportedEvent: WordSearchDuplicateDiagnosticRef,
  report: (duplicates: string[]) => void = logDuplicateInput
): boolean {
  if (normalizedDuplicates.length === 0) {
    return false;
  }

  const eventKey = JSON.stringify(normalizedDuplicates);

  if (lastReportedEvent.current === eventKey) {
    return false;
  }

  lastReportedEvent.current = eventKey;
  report(normalizedDuplicates);
  return true;
}
