"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
  type PointerEvent,
  type Ref,
} from "react";
import Button from "@/components/ui/Button";
import { LearningWindowShell } from "@/components/learning-engine/LearningWindowShell";
import type { OnAction } from "@/types/learning";
import { generateWordList } from "./generateWordList";
import {
  parseWordSearchWindowProps,
  type ParsedWordSearchWindowProps,
  type ParsedWordSearchWord,
} from "./parseWordSearchWindowProps";
import {
  INITIAL_WORD_SEARCH_PUZZLE_LOAD_STATE,
  applyWordSearchPuzzleLoadFailure,
  applyWordSearchPuzzleLoadSuccess,
  retryWordSearchPuzzleLoad,
} from "./wordSearchPuzzleLoad";
import {
  buildWordSearchCompletionPayload,
  cancelWordSearchSelection,
  createWordSearchInteractionState,
  dragWordSearchToCell,
  getActiveWordSearchSelectionCells,
  pressWordSearchCell,
  previewWordSearchFocus,
  releaseWordSearchPress,
  toggleWordSearchAnchor,
  type WordSearchInteractionSeed,
  type WordSearchInteractionState,
} from "./wordSearchInteraction";
import type {
  GenerateWordSearchPuzzle,
  WordSearchCell,
  WordSearchPuzzleResponse,
} from "./wordSearchTypes";

const DEFAULT_TITLE = "Word Search";
const DEFAULT_INSTRUCTIONS =
  "Find every hidden word. Drag across the letters in a straight line, tap the first and last letter, or move with the arrow keys and press Enter.";
const DEFAULT_ACTION_LABEL = "Next →";
const LOADING_MESSAGE = "Building your word search…";
const ERROR_MESSAGE = "We couldn't build your puzzle. Please try again.";
const NO_MATCH_MESSAGE = "That's not one of your words. Keep looking!";
const ALREADY_FOUND_MESSAGE = "You already found that one!";
const COMPLETE_MESSAGE = "You found every word!";

export type WordSearchWindowProps = {
  gridSize: number;
  words: string[];
  title?: string;
  instructions?: string;
  actionLabel?: string;
  onAction: OnAction;
  // Optional seams for the playground and tests only. Learning modules never
  // supply these: generatePuzzle defaults to the temporary generateWordList
  // boundary, and the initial* seeds preset presentation states.
  generatePuzzle?: GenerateWordSearchPuzzle;
  initialFoundWords?: string[];
  initialSelection?: { start: WordSearchCell; end: WordSearchCell };
};

export function WordSearchWindow(props: WordSearchWindowProps) {
  // Invalid module props are programmer errors and throw before any puzzle
  // is generated or rendered.
  const parsedProps = parseWordSearchWindowProps({
    gridSize: props.gridSize,
    words: props.words,
  });
  const puzzleKey = `${parsedProps.gridSize}:${parsedProps.words
    .map((word) => word.normalized)
    .join(",")}`;

  // Remounting per puzzle drops in-flight generations and interaction state
  // whenever the requested puzzle changes.
  return (
    <WordSearchPuzzleSession
      key={puzzleKey}
      {...props}
      parsedProps={parsedProps}
    />
  );
}

type WordSearchPuzzleSessionProps = WordSearchWindowProps & {
  parsedProps: ParsedWordSearchWindowProps;
};

function WordSearchPuzzleSession({
  title = DEFAULT_TITLE,
  instructions = DEFAULT_INSTRUCTIONS,
  actionLabel = DEFAULT_ACTION_LABEL,
  onAction,
  generatePuzzle,
  initialFoundWords,
  initialSelection,
  parsedProps,
}: WordSearchPuzzleSessionProps) {
  const [loadState, setLoadState] = useState(
    INITIAL_WORD_SEARCH_PUZZLE_LOAD_STATE
  );
  const [interaction, setInteraction] =
    useState<WordSearchInteractionState | null>(null);
  const [cursor, setCursor] = useState<WordSearchCell>({ row: 0, col: 0 });
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const completionEmittedRef = useRef(false);

  const generate = generatePuzzle ?? generateWordList;
  const puzzle = loadState.status === "ready" ? loadState.puzzle : null;

  const interactionSeed = useMemo<WordSearchInteractionSeed>(
    () => ({
      foundWords: initialFoundWords,
      selection: initialSelection,
    }),
    [initialFoundWords, initialSelection]
  );

  // The initial interaction state is derived from the loaded puzzle during
  // render; learner transitions then replace it through updateInteraction.
  // Invalid playground/test seeds throw here as programmer errors.
  const initialInteraction = useMemo(
    () =>
      puzzle === null
        ? null
        : createWordSearchInteractionState(puzzle, interactionSeed),
    [puzzle, interactionSeed]
  );
  const activeInteraction = interaction ?? initialInteraction;

  useEffect(() => {
    if (loadState.status !== "loading") {
      return;
    }

    // Results are ignored after unmount or retry: the cleanup flag covers
    // unmount and puzzle-prop remounts, and the attempt number covers
    // retries that started a newer generation.
    let stale = false;
    const attempt = loadState.attempt;

    generate({
      gridSize: parsedProps.gridSize,
      words: parsedProps.words.map((word) => word.normalized),
    }).then(
      (generated) => {
        if (!stale) {
          setLoadState((state) =>
            applyWordSearchPuzzleLoadSuccess(state, attempt, generated)
          );
        }
      },
      () => {
        if (!stale) {
          setLoadState((state) =>
            applyWordSearchPuzzleLoadFailure(state, attempt)
          );
        }
      }
    );

    return () => {
      stale = true;
    };
  }, [loadState, generate, parsedProps]);

  useEffect(() => {
    if (!activeInteraction?.complete || completionEmittedRef.current) {
      return;
    }

    completionEmittedRef.current = true;

    // A puzzle seeded as already complete must not emit a completion the
    // learner did not perform.
    if (!initialInteraction?.complete) {
      void onAction(
        "submitAnswer",
        buildWordSearchCompletionPayload(parsedProps.words, activeInteraction)
      );
    }
  }, [activeInteraction, initialInteraction, onAction, parsedProps]);

  function updateInteraction(
    transition: (state: WordSearchInteractionState) => WordSearchInteractionState
  ) {
    setInteraction((state) => {
      const base = state ?? initialInteraction;

      return base === null ? state : transition(base);
    });
  }

  function focusCell(cell: WordSearchCell) {
    const element = cellRefs.current.get(`${cell.row}:${cell.col}`);
    element?.focus();
    element?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function handleGridPointerDown(event: PointerEvent<HTMLDivElement>) {
    const cell = cellFromEventTarget(event.target);

    if (!cell || !puzzle) {
      return;
    }

    event.currentTarget.setPointerCapture(event.pointerId);
    setCursor(cell);
    updateInteraction((state) => pressWordSearchCell(state, cell));
  }

  function handleGridPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (activeInteraction?.phase !== "dragging") {
      return;
    }

    autoScrollPuzzleArea(scrollAreaRef.current, event.clientX, event.clientY);

    const cell = cellFromEventTarget(
      document.elementFromPoint(event.clientX, event.clientY)
    );

    if (cell) {
      updateInteraction((state) => dragWordSearchToCell(state, cell));
    }
  }

  function handleGridPointerUp() {
    if (puzzle) {
      updateInteraction((state) => releaseWordSearchPress(state, puzzle));
    }
  }

  function handleGridPointerCancel() {
    updateInteraction(cancelWordSearchSelection);
  }

  // Keeps the keyboard cursor in sync when a cell gains focus by any path,
  // including tabbing into the grid.
  function handleGridFocus(event: FocusEvent<HTMLDivElement>) {
    const cell = cellFromEventTarget(event.target);

    if (cell && (cell.row !== cursor.row || cell.col !== cursor.col)) {
      setCursor(cell);
    }
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!puzzle) {
      return;
    }

    const cursorStep = KEYBOARD_CURSOR_STEPS[event.key];

    if (cursorStep) {
      event.preventDefault();

      const nextCursor = {
        row: clampGridIndex(cursor.row + cursorStep.row, puzzle.gridSize),
        col: clampGridIndex(cursor.col + cursorStep.col, puzzle.gridSize),
      };

      setCursor(nextCursor);
      focusCell(nextCursor);
      updateInteraction((state) => previewWordSearchFocus(state, nextCursor));
      return;
    }

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      updateInteraction((state) =>
        toggleWordSearchAnchor(state, cursor, puzzle)
      );
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      updateInteraction(cancelWordSearchSelection);
    }
  }

  return (
    <WordSearchWindowView
      title={title}
      instructions={instructions}
      actionLabel={actionLabel}
      words={parsedProps.words}
      loadStatus={loadState.status}
      puzzle={puzzle}
      interaction={activeInteraction}
      cursor={cursor}
      scrollAreaRef={scrollAreaRef}
      registerCellRef={(key, element) => {
        if (element) {
          cellRefs.current.set(key, element);
        } else {
          cellRefs.current.delete(key);
        }
      }}
      onGridPointerDown={handleGridPointerDown}
      onGridPointerMove={handleGridPointerMove}
      onGridPointerUp={handleGridPointerUp}
      onGridPointerCancel={handleGridPointerCancel}
      onGridKeyDown={handleGridKeyDown}
      onGridFocus={handleGridFocus}
      onRetry={() => {
        setLoadState(retryWordSearchPuzzleLoad);
      }}
      onNext={() => onAction("next")}
    />
  );
}

/* ---------- Presentational view (exported for rendering tests) ---------- */

export type WordSearchWindowViewProps = {
  title: string;
  instructions: string;
  actionLabel: string;
  words: ParsedWordSearchWord[];
  loadStatus: "loading" | "error" | "ready";
  puzzle: WordSearchPuzzleResponse | null;
  interaction: WordSearchInteractionState | null;
  cursor: WordSearchCell;
  scrollAreaRef?: Ref<HTMLDivElement>;
  registerCellRef?: (key: string, element: HTMLButtonElement | null) => void;
  onGridPointerDown?: (event: PointerEvent<HTMLDivElement>) => void;
  onGridPointerMove?: (event: PointerEvent<HTMLDivElement>) => void;
  onGridPointerUp?: (event: PointerEvent<HTMLDivElement>) => void;
  onGridPointerCancel?: (event: PointerEvent<HTMLDivElement>) => void;
  onGridKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onGridFocus?: (event: FocusEvent<HTMLDivElement>) => void;
  onRetry: () => void;
  onNext: () => void;
};

export function WordSearchWindowView({
  title,
  instructions,
  actionLabel,
  words,
  loadStatus,
  puzzle,
  interaction,
  cursor,
  scrollAreaRef,
  registerCellRef,
  onGridPointerDown,
  onGridPointerMove,
  onGridPointerUp,
  onGridPointerCancel,
  onGridKeyDown,
  onGridFocus,
  onRetry,
  onNext,
}: WordSearchWindowViewProps) {
  const selectedCells = interaction
    ? getActiveWordSearchSelectionCells(interaction)
    : [];
  const selectedCellKeys = new Set(
    selectedCells.map(({ row, col }) => `${row}:${col}`)
  );
  const foundCellKeys = new Set(
    (interaction?.foundWords ?? []).flatMap((found) =>
      found.cells.map(({ row, col }) => `${row}:${col}`)
    )
  );
  const foundWordSet = new Set(
    (interaction?.foundWords ?? []).map((found) => found.word)
  );
  const complete = interaction?.complete ?? false;
  const showPuzzle = loadStatus === "ready" && puzzle !== null;

  return (
    <LearningWindowShell size="wide">
      <h2 className="font-display text-3xl font-extrabold mb-1 text-heading">
        {title}
      </h2>
      <p className="text-sm font-medium mb-5 text-muted">
        {instructions}
      </p>

      {loadStatus === "loading" && (
        <p className="text-sm font-semibold text-muted">
          {LOADING_MESSAGE}
        </p>
      )}

      {loadStatus === "error" && (
        <div className="flex items-center justify-between gap-4" role="alert">
          <p className="text-sm font-semibold text-danger">
            {ERROR_MESSAGE}
          </p>
          <Button variant="learning-secondary" onClick={onRetry}>
            Retry
          </Button>
        </div>
      )}

      {showPuzzle && (
        <>
          <div
            ref={scrollAreaRef}
            className="overflow-auto max-h-[60vh] rounded-2xl p-3 border bg-primary/(--alpha-subtle) border-primary/(--alpha-medium)"
          >
            <div
              className="relative w-fit mx-auto select-none"
              style={{ touchAction: "none" }}
              onPointerDown={onGridPointerDown}
              onPointerMove={onGridPointerMove}
              onPointerUp={onGridPointerUp}
              onPointerCancel={onGridPointerCancel}
              onKeyDown={onGridKeyDown}
              onFocus={onGridFocus}
            >
              <div role="grid" aria-label={title}>
                {puzzle.rows.map((rowLetters, row) => (
                  <div key={row} role="row" className="flex">
                    {rowLetters.map((letter, col) => {
                      const cellKey = `${row}:${col}`;
                      const isSelected = selectedCellKeys.has(cellKey);
                      const isFound = foundCellKeys.has(cellKey);
                      const isCursor =
                        cursor.row === row && cursor.col === col;

                      return (
                        <button
                          key={cellKey}
                          type="button"
                          role="gridcell"
                          data-ws-cell={cellKey}
                          ref={
                            registerCellRef
                              ? (element) => registerCellRef(cellKey, element)
                              : undefined
                          }
                          tabIndex={isCursor ? 0 : -1}
                          aria-selected={isSelected}
                          aria-label={`Row ${row + 1}, column ${col + 1}, letter ${letter}${isFound ? ", found word" : ""}`}
                          className={`flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center border text-sm font-bold uppercase focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary-strong motion-safe:transition-colors sm:h-10 sm:w-10 sm:text-base ${getCellClass(isSelected, isFound)}`}
                        >
                          {letter}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              <svg
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${puzzle.gridSize} ${puzzle.gridSize}`}
                preserveAspectRatio="none"
              >
                {(interaction?.foundWords ?? []).map((found) => (
                  <SelectionLine
                    key={found.word}
                    cells={found.cells}
                    strokeClassName="stroke-secondary"
                  />
                ))}
                {selectedCells.length > 1 && (
                  <SelectionLine cells={selectedCells} strokeClassName="stroke-primary" />
                )}
              </svg>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between gap-4">
            <p
              aria-live="polite"
              className={`text-sm font-semibold ${complete ? "text-secondary-strong" : "text-muted"}`}
            >
              {getStatusMessage(interaction, words)}
            </p>
            <p className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-primary-strong">
              {foundWordSet.size} of {words.length} found
            </p>
          </div>

          <ul aria-label="Words to find" className="mt-4 flex flex-wrap gap-2">
            {words.map(({ display, normalized }) => {
              const isFound = foundWordSet.has(normalized);

              return (
                <li key={normalized}>
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-semibold ${
                      isFound
                        ? "line-through bg-secondary/(--alpha-subtle) border-secondary/(--alpha-medium) text-secondary-strong"
                        : "bg-surface border-heading/(--alpha-subtle) text-text"
                    }`}
                  >
                    {display}
                    {isFound && <span className="sr-only"> (found)</span>}
                  </span>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex justify-end">
            <Button
              variant="learning-accent"
              disabled={!complete}
              onClick={onNext}
            >
              {actionLabel}
            </Button>
          </div>
        </>
      )}
    </LearningWindowShell>
  );
}

function SelectionLine({
  cells,
  strokeClassName,
}: {
  cells: WordSearchCell[];
  strokeClassName: string;
}) {
  const first = cells[0];
  const last = cells[cells.length - 1];

  return (
    <line
      className={strokeClassName}
      x1={first.col + 0.5}
      y1={first.row + 0.5}
      x2={last.col + 0.5}
      y2={last.row + 0.5}
      strokeOpacity={0.4}
      strokeWidth={0.72}
      strokeLinecap="round"
    />
  );
}

function getCellClass(isSelected: boolean, isFound: boolean): string {
  if (isSelected) {
    return "bg-primary/(--alpha-soft) border-primary/(--alpha-medium) text-primary-strong";
  }

  if (isFound) {
    return "bg-secondary/(--alpha-soft) border-secondary/(--alpha-medium) text-secondary-strong";
  }

  return "bg-surface border-heading/(--alpha-hairline) text-text";
}

function getStatusMessage(
  interaction: WordSearchInteractionState | null,
  words: ParsedWordSearchWord[]
): string {
  if (interaction?.complete) {
    return COMPLETE_MESSAGE;
  }

  if (interaction?.lastOutcome === "no-match") {
    return NO_MATCH_MESSAGE;
  }

  if (interaction?.lastOutcome === "already-found") {
    return ALREADY_FOUND_MESSAGE;
  }

  if (interaction?.lastOutcome === "found") {
    const lastFound = interaction.foundWords[interaction.foundWords.length - 1];
    const display =
      words.find((word) => word.normalized === lastFound.word)?.display ??
      lastFound.word;

    return `You found "${display}"!`;
  }

  return "Select a word to get started.";
}

const KEYBOARD_CURSOR_STEPS: Record<string, WordSearchCell> = {
  ArrowUp: { row: -1, col: 0 },
  ArrowDown: { row: 1, col: 0 },
  ArrowLeft: { row: 0, col: -1 },
  ArrowRight: { row: 0, col: 1 },
};

function clampGridIndex(value: number, gridSize: number): number {
  return Math.min(Math.max(value, 0), gridSize - 1);
}

function cellFromEventTarget(target: unknown): WordSearchCell | null {
  if (!(target instanceof Element)) {
    return null;
  }

  const cellKey = target
    .closest("[data-ws-cell]")
    ?.getAttribute("data-ws-cell");

  if (!cellKey) {
    return null;
  }

  const [row, col] = cellKey.split(":").map(Number);

  return { row, col };
}

// Keeps drag selection usable on large scrolled grids: dragging near an edge
// of the bounded puzzle area scrolls further cells into reach, which touch
// devices cannot do mid-drag themselves while the grid owns the gesture.
function autoScrollPuzzleArea(
  area: HTMLDivElement | null,
  clientX: number,
  clientY: number
) {
  if (!area) {
    return;
  }

  const rect = area.getBoundingClientRect();
  const edge = 28;
  const step = 14;

  if (clientX > rect.right - edge) {
    area.scrollLeft += step;
  } else if (clientX < rect.left + edge) {
    area.scrollLeft -= step;
  }

  if (clientY > rect.bottom - edge) {
    area.scrollTop += step;
  } else if (clientY < rect.top + edge) {
    area.scrollTop -= step;
  }
}

export default WordSearchWindow;
