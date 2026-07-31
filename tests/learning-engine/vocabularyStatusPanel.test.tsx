import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  VocabularyStatusPanel,
  VocabularyMasteredSection,
  VocabularySpellingSection,
  VocabularyWordListSection,
} from "../../src/learning-modules/vocabulary/module-panels/VocabularyStatusPanel";
import {
  createVocabularyStatusPanelSetters,
  type VocabularyPanelDisplayWord,
  type VocabularyPanelSpellingWord,
} from "../../src/learning-modules/vocabulary/module-panels/vocabularyPanelTypes";

// This repository's component-test harness is React server rendering
// (`renderToStaticMarkup`) with no DOM/jsdom (see docs/reference/testing.md),
// so effects never run here. That proves the panel's static initial render
// and each section's presentation contract from real props, but it cannot
// mount/unmount the panel or fire its registration `useEffect`. The engine
// side of registration/replacement/cleanup-safety (what that effect calls
// into) is fully covered without a DOM by
// `tests/learning-engine/modulePanelRegistration.test.ts`. Proving that the
// effect itself fires registerModulePanelSetters on mount and calls the
// returned disposer on unmount (including Strict Mode's extra
// mount/cleanup/remount cycle) would require a DOM-capable harness
// (jsdom/react-test-renderer) not present in this repository, and is
// reported as a known limitation rather than fabricated.

test("createVocabularyStatusPanelSetters bundles exactly the three given setters by identity", () => {
  const setWordList = () => {};
  const setSpellingWords = () => {};
  const setMasteredWords = () => {};

  const bundle = createVocabularyStatusPanelSetters(
    setWordList,
    setSpellingWords,
    setMasteredWords
  );

  assert.equal(bundle.setWordList, setWordList);
  assert.equal(bundle.setSpellingWords, setSpellingWords);
  assert.equal(bundle.setMasteredWords, setMasteredWords);
  assert.deepEqual(Object.keys(bundle).sort(), [
    "setMasteredWords",
    "setSpellingWords",
    "setWordList",
  ]);
});

test("initial panel render keeps the three zero counts and existing empty messages", () => {
  const markup = renderToStaticMarkup(
    <VocabularyStatusPanel registerModulePanelSetters={() => () => {}} />
  );

  assert.match(markup, /Word List/);
  assert.match(markup, /All words advanced!/);
  assert.match(markup, /Spelling/);
  assert.match(markup, /None yet/);
  assert.match(markup, /Mastered/);

  const zeroBadgeCount = (markup.match(/>0</g) ?? []).length;
  assert.ok(
    zeroBadgeCount >= 3,
    "expected all three section badges to render 0 initially"
  );
});

test("Word List section renders its entries and a count matching the array length", () => {
  const words: VocabularyPanelDisplayWord[] = [
    { id: "w1", word: "photosynthesis" },
    { id: "w2", word: "ecosystem" },
  ];

  const markup = renderToStaticMarkup(<VocabularyWordListSection wordList={words} />);

  assert.match(markup, />2</);
  assert.match(markup, /photosynthesis/);
  assert.match(markup, /ecosystem/);
  assert.doesNotMatch(markup, /All words advanced!/);
});

test("Mastered section renders its entries and a count matching the array length", () => {
  const words: VocabularyPanelDisplayWord[] = [{ id: "m1", word: "biome" }];

  const markup = renderToStaticMarkup(
    <VocabularyMasteredSection masteredWords={words} />
  );

  assert.match(markup, />1</);
  assert.match(markup, /biome/);
});

test("Spelling section renders one masked row per entry, with no word text present anywhere", () => {
  const entries: VocabularyPanelSpellingWord[] = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];

  const markup = renderToStaticMarkup(
    <VocabularySpellingSection spellingWords={entries} />
  );

  assert.match(markup, />3</);
  const maskedRowMatches = markup.match(/•••••/g) ?? [];
  assert.equal(maskedRowMatches.length, 3);
  assert.doesNotMatch(markup, /None yet/);
});

test("Spelling section falls back to the existing empty message when there are no entries", () => {
  const markup = renderToStaticMarkup(<VocabularySpellingSection spellingWords={[]} />);

  assert.match(markup, />0</);
  assert.match(markup, /None yet/);
});
