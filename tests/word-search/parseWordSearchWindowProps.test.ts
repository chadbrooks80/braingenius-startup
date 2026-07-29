import assert from "node:assert/strict";
import test from "node:test";
import {
  parseWordSearchWindowProps,
} from "../../src/components/learning-engine/windows/WordSearch/parseWordSearchWindowProps";
import {
  MAX_WORD_SEARCH_GRID_SIZE,
  MAX_WORD_SEARCH_WORD_COUNT,
  MIN_WORD_SEARCH_GRID_SIZE,
  parseWordSearchInput,
} from "../../src/lib/learning-engine/word-search/wordSearchInputContract";

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

test("deduplicates case and whitespace variants and keeps the diagnostic data pure", () => {
  const originalConsoleError = console.error;
  const messages: unknown[][] = [];
  console.error = (...args: unknown[]) => messages.push(args);

  try {
    const parsed = parseWordSearchWindowProps({
      gridSize: 10,
      words: ["Fraction", "FRACTION", " decimal ", "DECIMAL", "sum"],
    });

    assert.deepEqual(parsed.words, [
      { display: "Fraction", normalized: "FRACTION" },
      { display: "decimal", normalized: "DECIMAL" },
      { display: "sum", normalized: "SUM" },
    ]);
    assert.deepEqual(parsed.duplicateNormalizedWords, [
      "FRACTION",
      "DECIMAL",
    ]);
    assert.deepEqual(messages, []);
  } finally {
    console.error = originalConsoleError;
  }
});

test("applies the word-count bound after duplicate removal", () => {
  const maxWords = Array.from(
    { length: MAX_WORD_SEARCH_WORD_COUNT },
    (unused, index) => `word${"abcdefghijklmnopqrst"[index]}`
  );

  const parsed = parseWordSearchWindowProps({
    gridSize: 10,
    words: [...maxWords, " WORDA "],
  });

  assert.equal(parsed.words.length, MAX_WORD_SEARCH_WORD_COUNT);
  assert.equal(parsed.words[0].display, "worda");
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

test("rejects structurally incompatible substring target sets before generation", () => {
  for (const words of [
    ["MATH", "HAT", "AT"],
    ["CATER", "LATER", "ATE"],
    ["TEACH", "BEACH", "EACH"],
  ]) {
    assert.throws(
      () => parseWordSearchWindowProps({ gridSize: 8, words }),
      /target set is incompatible/
    );
  }
});

test("preserves compatible substring, reverse-pair, and palindrome target sets", () => {
  for (const words of [
    ["FRACTION", "ACTION"],
    ["CAT", "AT"],
    ["STAR", "RATS"],
    ["XABA", "ABAY", "ABA"],
  ]) {
    assert.doesNotThrow(() =>
      parseWordSearchWindowProps({ gridSize: 8, words })
    );
  }
});

test("the Window parser delegates the supported bounds and compatibility rules to the public contract", () => {
  const accepted = [
    { gridSize: 8, words: ["ox", "cat"] },
    { gridSize: 30, words: ["q".repeat(30), "cat"] },
    { gridSize: 8, words: ["FRACTION", "ACTION"] },
  ];

  for (const input of accepted) {
    assert.deepEqual(
      parseWordSearchWindowProps(input),
      parseWordSearchInput(input)
    );
  }

  const rejected = [
    { gridSize: 7, words: ["cat", "dog"] },
    { gridSize: 30, words: ["q".repeat(31), "cat"] },
    { gridSize: 8, words: ["MATH", "HAT", "AT"] },
  ];

  for (const input of rejected) {
    assert.throws(() => parseWordSearchInput(input));
    assert.throws(() => parseWordSearchWindowProps(input));
  }
});

test("rejects a parent that would force multiple occurrences of a shorter target", () => {
  assert.throws(
    () =>
      parseWordSearchWindowProps({
        gridSize: 8,
        words: ["BANANA", "ANA"],
      }),
    /"ANA" occurs more than once inside "BANANA"/
  );
});
