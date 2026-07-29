import assert from "node:assert/strict";
import test from "node:test";
import {
  findWordSearchOccurrences,
  generateWordList,
  repairAccidentalWordOccurrences,
} from "../../src/components/learning-engine/windows/WordSearch/generateWordList";
import {
  WORD_SEARCH_DIRECTION_NAMES,
  getWordSearchPlacementCells,
} from "../../src/components/learning-engine/windows/WordSearch/wordSearchDirections";
import type { WordSearchPlacement } from "../../src/components/learning-engine/windows/WordSearch/wordSearchTypes";

const REQUEST = {
  gridSize: 10,
  words: ["FRACTION", "DECIMAL", "SUM", "PRODUCT"],
};

test("returns a complete square grid of single uppercase letters", async () => {
  const puzzle = await generateWordList(REQUEST);

  assert.equal(puzzle.gridSize, REQUEST.gridSize);
  assert.equal(puzzle.rows.length, REQUEST.gridSize);

  for (const row of puzzle.rows) {
    assert.equal(row.length, REQUEST.gridSize);

    for (const letter of row) {
      assert.match(letter, /^[A-Z]$/);
    }
  }
});

test("returns the requested words with one placement per word", async () => {
  const puzzle = await generateWordList(REQUEST);

  assert.deepEqual(puzzle.words, REQUEST.words);
  assert.deepEqual(
    puzzle.placements.map((placement) => placement.word),
    REQUEST.words
  );
});

test("every placement spells its word inside the grid on a supported line", async () => {
  const puzzle = await generateWordList(REQUEST);

  for (const placement of puzzle.placements) {
    assert.ok(WORD_SEARCH_DIRECTION_NAMES.includes(placement.direction));

    const cells = getWordSearchPlacementCells(placement);
    assert.equal(cells.length, placement.word.length);

    const spelled = cells
      .map(({ row, col }) => {
        assert.ok(row >= 0 && row < puzzle.gridSize);
        assert.ok(col >= 0 && col < puzzle.gridSize);
        return puzzle.rows[row][col];
      })
      .join("");

    assert.equal(spelled, placement.word);
  }
});

test("generation is deterministic for the same request", async () => {
  const first = await generateWordList(REQUEST);
  const second = await generateWordList(REQUEST);

  assert.deepEqual(first, second);
});

test("a retry attempt produces a deterministic but meaningfully reseeded puzzle", async () => {
  const firstRetry = await generateWordList({ ...REQUEST, attempt: 1 });
  const repeatedRetry = await generateWordList({ ...REQUEST, attempt: 1 });
  const initial = await generateWordList({ ...REQUEST, attempt: 0 });

  assert.deepEqual(firstRetry, repeatedRetry);
  assert.notDeepEqual(firstRetry, initial);
});

test("every target has exactly one visible occurrence across every supported reverse reading", async () => {
  const puzzle = await generateWordList(REQUEST);

  for (const word of puzzle.words) {
    assert.equal(findWordSearchOccurrences(puzzle.rows, word).length, 1);
  }
});

test("reverse and substring targets share official cells without creating extra occurrences", async () => {
  for (const words of [
    ["STAR", "RATS"],
    ["FRACTION", "ACTION"],
    ["CAT", "AT"],
  ]) {
    const puzzle = await generateWordList({ gridSize: 8, words });

    for (const word of words) {
      assert.equal(findWordSearchOccurrences(puzzle.rows, word).length, 1);
    }
  }
});

test("repairs an accidental occurrence by changing only a safe filler cell", () => {
  const rows = emptyRows();
  writeRow(rows, 0, "CAT");
  writeRow(rows, 2, "CAT");
  const placements: WordSearchPlacement[] = [
    { word: "CAT", start: { row: 0, col: 0 }, direction: "left-to-right" },
  ];

  const repaired = repairAccidentalWordOccurrences(
    rows,
    ["CAT"],
    placements,
    "QWERTYUIOPASDFGHJKLZXCVBNM"
  );

  assert.ok(repaired);
  assert.deepEqual(repaired[0].slice(0, 3), ["C", "A", "T"]);
  assert.notDeepEqual(repaired[2].slice(0, 3), ["C", "A", "T"]);
  assert.equal(findWordSearchOccurrences(repaired, "CAT").length, 1);
});

test("rejects a candidate when an accidental occurrence contains only protected cells", () => {
  const rows = emptyRows();
  writeRow(rows, 0, "CAT");
  writeRow(rows, 2, "CAT");
  rows[3][0] = "O";
  rows[3][1] = "S";
  rows[3][2] = "O";
  const placements: WordSearchPlacement[] = [
    { word: "CAT", start: { row: 0, col: 0 }, direction: "left-to-right" },
    { word: "CO", start: { row: 2, col: 0 }, direction: "top-to-bottom" },
    { word: "AS", start: { row: 2, col: 1 }, direction: "top-to-bottom" },
    { word: "TO", start: { row: 2, col: 2 }, direction: "top-to-bottom" },
  ];

  assert.equal(
    repairAccidentalWordOccurrences(
      rows,
      ["CAT", "CO", "AS", "TO"],
      placements
    ),
    null
  );
  assert.deepEqual(rows[0].slice(0, 3), ["C", "A", "T"]);
  assert.deepEqual(rows[2].slice(0, 3), ["C", "A", "T"]);
});

test("rescans replacement letters and refuses one that creates another target", () => {
  const rows = emptyRows();
  writeRow(rows, 0, "CAT");
  writeRow(rows, 2, "CAT");
  rows[3][0] = "O";
  rows[3][1] = "O";
  rows[3][2] = "O";
  rows[4][1] = "G";
  writeRow(rows, 6, "DOG");
  const placements: WordSearchPlacement[] = [
    { word: "CAT", start: { row: 0, col: 0 }, direction: "left-to-right" },
    { word: "DOG", start: { row: 6, col: 0 }, direction: "left-to-right" },
    { word: "CO", start: { row: 2, col: 0 }, direction: "top-to-bottom" },
    { word: "TO", start: { row: 2, col: 2 }, direction: "top-to-bottom" },
  ];

  const repaired = repairAccidentalWordOccurrences(
    rows,
    ["CAT", "DOG", "CO", "TO"],
    placements,
    "DQ"
  );

  assert.ok(repaired);
  assert.equal(repaired[2][1], "Q");
  assert.equal(findWordSearchOccurrences(repaired, "CAT").length, 1);
  assert.equal(findWordSearchOccurrences(repaired, "DOG").length, 1);
});

test("places a word that exactly fits the smallest supported grid", async () => {
  const puzzle = await generateWordList({
    gridSize: 8,
    words: ["DINOSAUR"],
  });
  const placement = puzzle.placements[0];
  const spelled = getWordSearchPlacementCells(placement)
    .map(({ row, col }) => puzzle.rows[row][col])
    .join("");

  assert.equal(spelled, "DINOSAUR");
});

test("places many words in the largest supported grid", async () => {
  const words = [
    "FRACTION",
    "DECIMAL",
    "NUMERATOR",
    "DENOMINATOR",
    "QUOTIENT",
    "PRODUCT",
    "REMAINDER",
    "MULTIPLE",
    "DIVISOR",
    "EQUATION",
  ];
  const puzzle = await generateWordList({ gridSize: 30, words });

  for (const placement of puzzle.placements) {
    const spelled = getWordSearchPlacementCells(placement)
      .map(({ row, col }) => puzzle.rows[row][col])
      .join("");

    assert.equal(spelled, placement.word);
  }
});

test("generates a dense maximum-count request within the supported bounds", async () => {
  const words = [
    "FRACTION",
    "DECIMAL",
    "NUMERATOR",
    "DENOMINATOR",
    "QUOTIENT",
    "PRODUCT",
    "REMAINDER",
    "MULTIPLE",
    "DIVISOR",
    "EQUATION",
    "INTEGER",
    "FACTOR",
    "RATIO",
    "PERCENT",
    "ALGEBRA",
    "GEOMETRY",
    "VARIABLE",
    "EXPONENT",
    "FORMULA",
    "MEASURE",
  ];
  const puzzle = await generateWordList({ gridSize: 30, words });

  assert.equal(puzzle.placements.length, words.length);
  for (const word of words) {
    assert.equal(findWordSearchOccurrences(puzzle.rows, word).length, 1);
  }
});

function emptyRows(): string[][] {
  return Array.from({ length: 8 }, () =>
    Array.from({ length: 8 }, () => "Q")
  );
}

function writeRow(rows: string[][], row: number, word: string): void {
  [...word].forEach((letter, col) => {
    rows[row][col] = letter;
  });
}
