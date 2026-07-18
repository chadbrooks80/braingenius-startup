import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import WordSearchWindow, {
  WordSearchWindowView,
  type WordSearchWindowViewProps,
} from "../../src/learning-engine-components/LearningWindows/WordSearch/WordSearchWindow";
import { resolveLearningWindow } from "../../src/lib/learning-engine/LearningWindowRegistry"
import { generateWordList } from "../../src/learning-engine-components/LearningWindows/WordSearch/generateWordList";
import { createWordSearchInteractionState } from "../../src/learning-engine-components/LearningWindows/WordSearch/wordSearchInteraction";
import type { WordSearchPuzzleResponse } from "../../src/learning-engine-components/LearningWindows/WordSearch/wordSearchTypes";

const WORDS = [
  { display: "cat", normalized: "CAT" },
  { display: "dog", normalized: "DOG" },
  { display: "sun", normalized: "SUN" },
  { display: "map", normalized: "MAP" },
  { display: "ice", normalized: "ICE" },
  { display: "ten", normalized: "TEN" },
];

const PUZZLE: WordSearchPuzzleResponse = {
  gridSize: 8,
  rows: [
    ["C", "A", "T", "Q", "Q", "Q", "Q", "Q"],
    ["Q", "Q", "Q", "Q", "Q", "Q", "Q", "Q"],
    ["Q", "Q", "Q", "Q", "D", "Q", "Q", "Q"],
    ["S", "Q", "Q", "Q", "O", "N", "Q", "Q"],
    ["Q", "U", "Q", "E", "G", "Q", "E", "Q"],
    ["Q", "Q", "N", "C", "Q", "Q", "Q", "T"],
    ["Q", "Q", "Q", "I", "Q", "Q", "Q", "Q"],
    ["Q", "Q", "Q", "Q", "Q", "P", "A", "M"],
  ],
  words: WORDS.map((word) => word.normalized),
  placements: [
    { word: "CAT", start: { row: 0, col: 0 }, direction: "left-to-right" },
    { word: "DOG", start: { row: 2, col: 4 }, direction: "top-to-bottom" },
    { word: "SUN", start: { row: 3, col: 0 }, direction: "diagonal-down-right" },
    { word: "MAP", start: { row: 7, col: 7 }, direction: "right-to-left" },
    { word: "ICE", start: { row: 6, col: 3 }, direction: "bottom-to-top" },
    { word: "TEN", start: { row: 5, col: 7 }, direction: "diagonal-up-left" },
  ],
};

function renderView(overrides: Partial<WordSearchWindowViewProps> = {}) {
  return renderToStaticMarkup(
    <WordSearchWindowView
      title="Word Search"
      instructions="Find every hidden word."
      actionLabel="Next →"
      words={WORDS}
      loadStatus="ready"
      puzzle={PUZZLE}
      interaction={createWordSearchInteractionState(PUZZLE)}
      cursor={{ row: 0, col: 0 }}
      onRetry={() => {}}
      onNext={() => {}}
      {...overrides}
    />
  );
}

test("the word-search window key resolves through the registry", () => {
  assert.equal(resolveLearningWindow("word-search"), WordSearchWindow);
});

test("the window renders the loading state before generation resolves", () => {
  const markup = renderToStaticMarkup(
    <WordSearchWindow
      gridSize={8}
      words={["cat", "dog"]}
      onAction={() => {}}
    />
  );

  assert.match(markup, /Building your word search…/);
  assert.match(markup, /Word Search/);
});

test("optional presentation overrides replace the defaults", () => {
  const markup = renderToStaticMarkup(
    <WordSearchWindow
      gridSize={8}
      words={["cat", "dog"]}
      title="Science hunt"
      instructions="Find the science words."
      onAction={() => {}}
    />
  );

  assert.match(markup, /Science hunt/);
  assert.match(markup, /Find the science words\./);
  assert.doesNotMatch(markup, /Find every hidden word\./);
});

test("invalid module props throw as programmer errors before rendering", () => {
  assert.throws(() =>
    renderToStaticMarkup(
      <WordSearchWindow gridSize={7} words={["cat"]} onAction={() => {}} />
    )
  );
  assert.throws(() =>
    renderToStaticMarkup(
      <WordSearchWindow gridSize={31} words={["cat"]} onAction={() => {}} />
    )
  );
  assert.throws(() =>
    renderToStaticMarkup(
      <WordSearchWindow gridSize={10} words={[]} onAction={() => {}} />
    )
  );
  assert.throws(() =>
    renderToStaticMarkup(
      <WordSearchWindow
        gridSize={10}
        words={["cat", "CAT"]}
        onAction={() => {}}
      />
    )
  );
});

test("the failure state shows a learner-safe alert with Retry", () => {
  const markup = renderView({
    loadStatus: "error",
    puzzle: null,
    interaction: null,
  });

  assert.match(markup, /role="alert"/);
  assert.match(markup, /We couldn(&#x27;|')t build your puzzle\. Please try again\./);
  assert.match(markup, /Retry/);
  assert.doesNotMatch(markup, /gridcell/);
});

test("the ready puzzle renders an accessible grid and the full word list", () => {
  const markup = renderView();

  assert.match(markup, /role="grid"/);
  assert.equal(markup.match(/role="row"/g)?.length, 8);
  assert.equal(markup.match(/role="gridcell"/g)?.length, 64);
  assert.match(markup, /aria-label="Row 1, column 1, letter C"/);
  assert.match(markup, /aria-label="Row 8, column 8, letter M"/);

  for (const { display } of WORDS) {
    assert.match(markup, new RegExp(`>${display}<`));
  }

  assert.match(markup, /0 of 6 found/);
  assert.match(markup, /disabled=""/);
  assert.match(markup, /overflow-auto/);
  assert.match(markup, /max-h-\[60vh\]/);
});

test("an active selection is highlighted and drawn as a line", () => {
  const markup = renderView({
    interaction: createWordSearchInteractionState(PUZZLE, {
      selection: { start: { row: 1, col: 1 }, end: { row: 1, col: 4 } },
    }),
  });

  assert.equal(markup.match(/aria-selected="true"/g)?.length, 4);
  assert.match(markup, /<line/);
});

test("found words stay highlighted and are crossed out in the list", () => {
  const markup = renderView({
    interaction: createWordSearchInteractionState(PUZZLE, {
      foundWords: ["cat"],
    }),
  });

  assert.match(markup, /line-through/);
  assert.match(markup, /\(found\)/);
  assert.match(markup, /aria-label="Row 1, column 1, letter C, found word"/);
  assert.match(markup, /1 of 6 found/);
  assert.match(markup, /<line/);
  assert.match(markup, /disabled=""/);
});

test("completion unlocks Next and announces the finished puzzle", () => {
  const markup = renderView({
    interaction: createWordSearchInteractionState(PUZZLE, {
      foundWords: WORDS.map((word) => word.display),
    }),
  });

  assert.match(markup, /You found every word!/);
  assert.match(markup, /6 of 6 found/);
  assert.doesNotMatch(markup, /disabled=""/);
});

test("a large generated puzzle renders every cell inside the bounded scroll area", async () => {
  const puzzle = await generateWordList({
    gridSize: 30,
    words: ["FRACTION", "DECIMAL", "NUMERATOR"],
  });
  const markup = renderView({
    words: [
      { display: "fraction", normalized: "FRACTION" },
      { display: "decimal", normalized: "DECIMAL" },
      { display: "numerator", normalized: "NUMERATOR" },
    ],
    puzzle,
    interaction: createWordSearchInteractionState(puzzle),
  });

  assert.equal(markup.match(/role="gridcell"/g)?.length, 900);
  assert.match(markup, /overflow-auto/);
});
