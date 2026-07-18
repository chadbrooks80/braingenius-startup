import assert from "node:assert/strict";
import test from "node:test";
import { generateWordList } from "../../src/learning-engine-components/LearningWindows/WordSearch/generateWordList";
import {
  WORD_SEARCH_DIRECTION_NAMES,
  getWordSearchPlacementCells,
} from "../../src/learning-engine-components/LearningWindows/WordSearch/wordSearchDirections";

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
