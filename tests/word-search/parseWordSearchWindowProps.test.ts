import assert from "node:assert/strict";
import test from "node:test";
import {
  MAX_WORD_SEARCH_GRID_SIZE,
  MAX_WORD_SEARCH_WORD_COUNT,
  MIN_WORD_SEARCH_GRID_SIZE,
  parseWordSearchWindowProps,
} from "../../src/components/learning-engine/windows/WordSearch/parseWordSearchWindowProps";

const VALID_WORDS = ["cat", "dog", "bird"];

test("accepts the documented grid-size boundaries", () => {
  assert.equal(MIN_WORD_SEARCH_GRID_SIZE, 8);
  assert.equal(MAX_WORD_SEARCH_GRID_SIZE, 30);

  for (const gridSize of [MIN_WORD_SEARCH_GRID_SIZE, MAX_WORD_SEARCH_GRID_SIZE]) {
    const parsed = parseWordSearchWindowProps({ gridSize, words: VALID_WORDS });
    assert.equal(parsed.gridSize, gridSize);
  }
});

test("rejects grid sizes immediately outside the boundaries", () => {
  for (const gridSize of [
    MIN_WORD_SEARCH_GRID_SIZE - 1,
    MAX_WORD_SEARCH_GRID_SIZE + 1,
  ]) {
    assert.throws(
      () => parseWordSearchWindowProps({ gridSize, words: VALID_WORDS }),
      /gridSize/
    );
  }
});

test("rejects invalid grid-size numbers", () => {
  for (const gridSize of [8.5, Number.NaN, Number.POSITIVE_INFINITY, -8, 0]) {
    assert.throws(
      () => parseWordSearchWindowProps({ gridSize, words: VALID_WORDS }),
      /gridSize/
    );
  }

  assert.throws(
    () =>
      parseWordSearchWindowProps({
        gridSize: "12" as unknown as number,
        words: VALID_WORDS,
      }),
    /gridSize/
  );
});

test("rejects a missing, empty, or non-array word list", () => {
  assert.throws(
    () => parseWordSearchWindowProps({ gridSize: 10, words: [] }),
    /nonempty/
  );
  assert.throws(
    () =>
      parseWordSearchWindowProps({
        gridSize: 10,
        words: "cat" as unknown as string[],
      }),
    /nonempty/
  );
});

test("enforces the documented maximum word count", () => {
  const maxWords = Array.from(
    { length: MAX_WORD_SEARCH_WORD_COUNT },
    (unused, index) => `word${"abcdefghijklmnopqrst"[index]}`
  );

  assert.equal(
    parseWordSearchWindowProps({ gridSize: 10, words: maxWords }).words.length,
    MAX_WORD_SEARCH_WORD_COUNT
  );
  assert.throws(
    () =>
      parseWordSearchWindowProps({
        gridSize: 10,
        words: [...maxWords, "extra"],
      }),
    /at most/
  );
});

test("rejects non-string words", () => {
  assert.throws(
    () =>
      parseWordSearchWindowProps({
        gridSize: 10,
        words: ["cat", 42 as unknown as string],
      }),
    /strings/
  );
});

test("trims outer whitespace and normalizes matching case exactly", () => {
  const parsed = parseWordSearchWindowProps({
    gridSize: 10,
    words: ["  Cat ", "DOG", "bird"],
  });

  assert.deepEqual(parsed.words, [
    { display: "Cat", normalized: "CAT" },
    { display: "DOG", normalized: "DOG" },
    { display: "bird", normalized: "BIRD" },
  ]);
});

test("rejects single-letter words and accepts the two-letter minimum", () => {
  for (const word of ["a", " Z "]) {
    assert.throws(
      () => parseWordSearchWindowProps({ gridSize: 10, words: ["cat", word] }),
      /at least 2 letters/
    );
  }

  const parsed = parseWordSearchWindowProps({ gridSize: 10, words: ["ox"] });
  assert.deepEqual(parsed.words, [{ display: "ox", normalized: "OX" }]);
});

test("rejects words that are empty after trimming", () => {
  for (const word of ["", "   "]) {
    assert.throws(
      () => parseWordSearchWindowProps({ gridSize: 10, words: ["cat", word] }),
      /empty/
    );
  }
});

test("rejects duplicate normalized words", () => {
  assert.throws(
    () =>
      parseWordSearchWindowProps({ gridSize: 10, words: ["cat", " CAT "] }),
    /unique/i
  );
});

test("rejects words longer than the grid and accepts an exact fit", () => {
  assert.throws(
    () =>
      parseWordSearchWindowProps({ gridSize: 8, words: ["dinosaurs"] }),
    /longer/
  );

  const parsed = parseWordSearchWindowProps({
    gridSize: 8,
    words: ["dinosaur"],
  });
  assert.equal(parsed.words[0].normalized.length, 8);
});

test("rejects unsupported characters instead of silently removing words", () => {
  for (const word of ["ice cream", "don't", "co-op", "cat1", "café"]) {
    assert.throws(
      () => parseWordSearchWindowProps({ gridSize: 10, words: [word] }),
      /letters only/
    );
  }
});
