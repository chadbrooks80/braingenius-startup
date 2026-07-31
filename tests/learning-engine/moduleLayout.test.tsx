import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import LearningEngine from "../../src/lib/learning-engine/LearningEngine";
import { loadLearningModule } from "../../src/lib/learning-engine/initialization/loadLearningModule";
import { ModuleLayout as VocabularyModuleLayout } from "../../src/learning-modules/vocabulary/ModuleLayout";
import type {
  ActiveScreen,
  LearningEngineStateSetters,
  ModuleLayoutComponent,
} from "../../src/types/learning";

test("the client-facing Vocabulary module loader returns the module's ModuleLayout", async () => {
  const { ModuleLayout } = await loadLearningModule("vocabulary");
  assert.equal(ModuleLayout, VocabularyModuleLayout);
});

test("the Vocabulary ModuleLayout renders its status panel before the supplied children, in the current left-panel/main-window order", () => {
  const markup = renderToStaticMarkup(
    <VocabularyModuleLayout>
      <span>main window content</span>
    </VocabularyModuleLayout>
  );

  const panelIndex = markup.indexOf("My Words");
  const childrenIndex = markup.indexOf("main window content");

  assert.ok(panelIndex >= 0, "expected the status panel content to render");
  assert.ok(childrenIndex >= 0, "expected the supplied children to render");
  assert.ok(
    panelIndex < childrenIndex,
    "expected the status panel to render before the supplied children"
  );
  assert.match(markup, /<aside[^>]*>/);
});

test("successful Vocabulary initialization selects the Vocabulary-owned module layout", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    new Response(
      JSON.stringify({
        contentType: "manifest",
        lessonId: "11111111-1111-4111-8111-111111111111",
        randomSeed: 1,
        nextCapability: "11111111-1111-4111-8111-111111111112",
        words: [{ id: "11111111-1111-4111-8111-111111111113" }],
        totalWordCount: 1,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )) as typeof fetch;

  const moduleLayoutValues: Array<ModuleLayoutComponent | null> = [];
  let activeScreen: ActiveScreen | null = null;
  const setters: LearningEngineStateSetters = {
    setActiveScreen: (screen) => {
      activeScreen = screen;
    },
    setShowHeader: () => {},
    setModuleLayout: (layout) => moduleLayoutValues.push(layout),
    setAnswerFeedback: () => {},
    setIsSpeaking: () => {},
    setSpeechFailureNotice: () => {},
  };

  let result: string;
  try {
    result = await new LearningEngine().initialize(
      "vocabulary",
      ["word_list_id"],
      setters,
      "/learning/vocabulary/word_list_id",
      new AbortController().signal
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(result, "ready");
  assert.deepEqual(moduleLayoutValues, [VocabularyModuleLayout]);
  // Selecting the module layout during initialize() does not itself set an
  // active screen; that only happens once showStartupScreen() is called.
  assert.equal(activeScreen, null);
});
