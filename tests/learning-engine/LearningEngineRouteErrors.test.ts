import assert from "node:assert/strict";
import test from "node:test";
import LearningErrorWindow from "../../src/components/learning-engine/windows/Error/LearningErrorWindow";
import LearningEngine from "../../src/lib/learning-engine/LearningEngine";
import { LearningRouteError } from "../../src/lib/learning-engine/errors/LearningRouteError";
import type {
  ActiveScreen,
  AnswerFeedback,
  LearningEngineStateSetters,
  ModuleLayoutComponent,
} from "../../src/types/learning";

type EngineStateCapture = {
  readonly setters: LearningEngineStateSetters;
  readonly showHeaderValues: boolean[];
  readonly moduleLayoutValues: Array<ModuleLayoutComponent | null>;
  readonly answerFeedbackValues: Array<AnswerFeedback | null>;
  readonly isSpeakingValues: boolean[];
  requireActiveScreen(): ActiveScreen;
  hasActiveScreen(): boolean;
};

test("unknown modules render only the engine-owned safe presentation and log neutral diagnostics", async () => {
  const capture = createEngineStateCapture();
  const engine = new LearningEngine();
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args);
  };

  try {
    const result = await engine.initialize(
      "unknown-module",
      ["resource-42"],
      capture.setters,
      "/learning/unknown-module/resource-42",
      new AbortController().signal
    );

    assert.equal(result, "route-error");
  } finally {
    console.warn = originalWarn;
  }

  assert.deepEqual(capture.showHeaderValues, [false]);
  assert.deepEqual(capture.moduleLayoutValues, [null]);
  assert.deepEqual(capture.answerFeedbackValues, [null]);
  assert.deepEqual(capture.isSpeakingValues, [false]);

  const activeScreen = capture.requireActiveScreen();
  assert.equal(activeScreen.WindowComponent, LearningErrorWindow);
  assert.deepEqual(
    Object.keys(activeScreen.props).sort(),
    ["message", "onAction", "title"]
  );
  assert.equal(activeScreen.props.title, "Lesson Not Found");
  assert.equal(
    activeScreen.props.message,
    "We could not find the lesson requested by this link."
  );
  assert.equal(typeof activeScreen.props.onAction, "function");

  const serializedProps = JSON.stringify(activeScreen.props);
  for (const forbiddenValue of [
    "code",
    "kind",
    "source",
    "technicalMessage",
    "routePath",
    "moduleVariables",
    "unknown-module",
    "resource-42",
    "Unknown learning module requested",
  ]) {
    assert.doesNotMatch(serializedProps, new RegExp(forbiddenValue));
  }

  assert.equal(warnings.length, 1);
  assert.equal(warnings[0][0], "Learning route error");
  const payload = requireRecord(warnings[0][1]);
  assert.equal(payload.event, "learning_route_error");
  assert.equal(payload.source, "engine");
  assert.equal(payload.kind, "MODULE_NOT_FOUND");
  assert.equal(payload.code, "LEARNING_MODULE_NOT_FOUND");
  assert.equal(payload.moduleName, "unknown-module");
  assert.deepEqual(payload.moduleVariables, ["resource-42"]);
  assert.equal(
    payload.routePath,
    "/learning/unknown-module/resource-42"
  );
  assert.equal(
    payload.technicalMessage,
    "Unknown learning module requested: unknown-module"
  );
  assert.equal(typeof payload.occurredAt, "string");
  assert.ok(!Number.isNaN(Date.parse(String(payload.occurredAt))));
  assert.equal("presentation" in payload, false);
});

test("Vocabulary missing-list errors retain module-owned safe presentation", async () => {
  const capture = createEngineStateCapture();
  const result = await withMutedWarn(() =>
    new LearningEngine().initialize(
      "vocabulary",
      [],
      capture.setters,
      "/learning/vocabulary",
      new AbortController().signal
    )
  );

  assert.equal(result, "route-error");
  assert.deepEqual(capture.showHeaderValues, [true, false]);
  assert.equal(capture.moduleLayoutValues.length, 2);
  assert.equal(typeof capture.moduleLayoutValues[0], "function");
  assert.equal(capture.moduleLayoutValues[1], null);
  assertSafeErrorScreen(capture.requireActiveScreen(), {
    title: "Vocabulary List Not Found",
    message: "This lesson link does not include a vocabulary list.",
  });
});

test("Vocabulary invalid routes retain module-owned safe presentation", async () => {
  const capture = createEngineStateCapture();
  const result = await withMutedWarn(() =>
    new LearningEngine().initialize(
      "vocabulary",
      ["list-1", "unexpected"],
      capture.setters,
      "/learning/vocabulary/list-1/unexpected",
      new AbortController().signal
    )
  );

  assert.equal(result, "route-error");
  assert.deepEqual(capture.showHeaderValues, [true, false]);
  assert.equal(capture.moduleLayoutValues.length, 2);
  assert.equal(typeof capture.moduleLayoutValues[0], "function");
  assert.equal(capture.moduleLayoutValues[1], null);
  assertSafeErrorScreen(capture.requireActiveScreen(), {
    title: "Invalid Lesson Link",
    message: "This lesson link has an invalid format.",
  });
});

test("aborted route-error initialization remains stale without terminal rendering", async () => {
  const capture = createEngineStateCapture();
  const controller = new AbortController();
  controller.abort();

  const result = await new LearningEngine().initialize(
    "unknown-module",
    [],
    capture.setters,
    "/learning/unknown-module",
    controller.signal
  );

  assert.equal(result, "stale");
  assert.equal(capture.hasActiveScreen(), false);
  assert.deepEqual(capture.showHeaderValues, []);
  assert.deepEqual(capture.moduleLayoutValues, []);
});

test("ordinary initialization errors escape unchanged as unexpected failures", async () => {
  const capture = createEngineStateCapture();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error("deliberate ordinary loader failure");
  };

  try {
    await assert.rejects(
      new LearningEngine().initialize(
        "vocabulary",
        ["word_list_id"],
        capture.setters,
        "/learning/vocabulary/word_list_id",
        new AbortController().signal
      ),
      (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.ok(!(error instanceof LearningRouteError));
        assert.equal(
          error.message,
          "Vocabulary content request could not be completed."
        );
        assert.ok(error.cause instanceof Error);
        assert.equal(error.cause.message, "deliberate ordinary loader failure");
        return true;
      }
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(capture.hasActiveScreen(), false);
});

function createEngineStateCapture(): EngineStateCapture {
  let activeScreen: ActiveScreen | null = null;
  const showHeaderValues: boolean[] = [];
  const moduleLayoutValues: Array<ModuleLayoutComponent | null> = [];
  const answerFeedbackValues: Array<AnswerFeedback | null> = [];
  const isSpeakingValues: boolean[] = [];

  return {
    setters: {
      setActiveScreen: (screen) => {
        activeScreen = screen;
      },
      setShowHeader: (show) => showHeaderValues.push(show),
      setModuleLayout: (ModuleLayout) => moduleLayoutValues.push(ModuleLayout),
      setAnswerFeedback: (feedback) => answerFeedbackValues.push(feedback),
      setIsSpeaking: (isSpeaking) => isSpeakingValues.push(isSpeaking),
      setSpeechFailureNotice: () => {},
    },
    showHeaderValues,
    moduleLayoutValues,
    answerFeedbackValues,
    isSpeakingValues,
    requireActiveScreen() {
      if (!activeScreen) {
        throw new Error("Expected an active Learning Engine screen.");
      }
      return activeScreen;
    },
    hasActiveScreen() {
      return activeScreen !== null;
    },
  };
}

function assertSafeErrorScreen(
  activeScreen: ActiveScreen,
  expectedPresentation: { title: string; message: string }
): void {
  assert.equal(activeScreen.WindowComponent, LearningErrorWindow);
  assert.deepEqual(
    Object.keys(activeScreen.props).sort(),
    ["message", "onAction", "title"]
  );
  assert.equal(activeScreen.props.title, expectedPresentation.title);
  assert.equal(activeScreen.props.message, expectedPresentation.message);
  assert.equal(typeof activeScreen.props.onAction, "function");
}

async function withMutedWarn<T>(operation: () => Promise<T>): Promise<T> {
  const originalWarn = console.warn;
  console.warn = () => {};
  try {
    return await operation();
  } finally {
    console.warn = originalWarn;
  }
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new Error("Expected a structured log payload.");
  }
  return value as Record<string, unknown>;
}
