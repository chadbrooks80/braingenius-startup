import type {
  WordSearchCell,
  WordSearchDirectionName,
  WordSearchPlacement,
} from "./wordSearchTypes";

// The supported straight-line selection and placement directions. Bent,
// branching, disconnected, and wrapping selections are never supported.
export const WORD_SEARCH_DIRECTION_STEPS: Record<
  WordSearchDirectionName,
  WordSearchCell
> = {
  "left-to-right": { row: 0, col: 1 },
  "top-to-bottom": { row: 1, col: 0 },
  "diagonal-down-right": { row: 1, col: 1 },
  "right-to-left": { row: 0, col: -1 },
  "bottom-to-top": { row: -1, col: 0 },
  "diagonal-up-left": { row: -1, col: -1 },
};

export const WORD_SEARCH_DIRECTION_NAMES = Object.keys(
  WORD_SEARCH_DIRECTION_STEPS
) as WordSearchDirectionName[];

export function isWordSearchCellInBounds(
  cell: WordSearchCell,
  gridSize: number
): boolean {
  return (
    cell.row >= 0 && cell.row < gridSize && cell.col >= 0 && cell.col < gridSize
  );
}

export function areSameWordSearchCells(
  a: WordSearchCell,
  b: WordSearchCell
): boolean {
  return a.row === b.row && a.col === b.col;
}

// Returns the supported direction pointing from anchor to target, or null
// when the target is not on a supported straight line from the anchor.
export function getWordSearchDirectionBetween(
  anchor: WordSearchCell,
  target: WordSearchCell
): WordSearchDirectionName | null {
  const rowDelta = target.row - anchor.row;
  const colDelta = target.col - anchor.col;

  if (rowDelta === 0 && colDelta === 0) {
    return null;
  }

  for (const direction of WORD_SEARCH_DIRECTION_NAMES) {
    const step = WORD_SEARCH_DIRECTION_STEPS[direction];
    const alignsOnRows =
      step.row === 0 ? rowDelta === 0 : rowDelta * step.row > 0;
    const alignsOnCols =
      step.col === 0 ? colDelta === 0 : colDelta * step.col > 0;
    const isDiagonal = step.row !== 0 && step.col !== 0;
    const diagonalBalanced = !isDiagonal || Math.abs(rowDelta) === Math.abs(colDelta);

    if (alignsOnRows && alignsOnCols && diagonalBalanced) {
      return direction;
    }
  }

  return null;
}

// Returns every cell from anchor to target inclusive when they sit on a
// supported straight line, or null otherwise.
export function getWordSearchCellsBetween(
  anchor: WordSearchCell,
  target: WordSearchCell
): WordSearchCell[] | null {
  if (areSameWordSearchCells(anchor, target)) {
    return [anchor];
  }

  const direction = getWordSearchDirectionBetween(anchor, target);

  if (direction === null) {
    return null;
  }

  const step = WORD_SEARCH_DIRECTION_STEPS[direction];
  const length =
    Math.max(
      Math.abs(target.row - anchor.row),
      Math.abs(target.col - anchor.col)
    ) + 1;
  const cells: WordSearchCell[] = [];

  for (let index = 0; index < length; index += 1) {
    cells.push({
      row: anchor.row + step.row * index,
      col: anchor.col + step.col * index,
    });
  }

  return cells;
}

export function getWordSearchPlacementCells(
  placement: WordSearchPlacement
): WordSearchCell[] {
  const step = WORD_SEARCH_DIRECTION_STEPS[placement.direction];

  return Array.from({ length: placement.word.length }, (unused, index) => ({
    row: placement.start.row + step.row * index,
    col: placement.start.col + step.col * index,
  }));
}
