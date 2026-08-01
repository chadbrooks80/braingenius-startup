import assert from "node:assert/strict";
import test from "node:test";
import LearningEngine, {
  createLearningModuleRuntime,
} from "../../src/lib/learning-engine/LearningEngine";
import type {
  LearningEngineStateSetters,
  ModulePanelRegistration,
} from "../../src/types/learning";

// These tests exercise the generic module-to-engine panel setter bridge:
// `runtime.runPanelSetter` (constructor-injected) paired with the existing
// `registerModulePanelSetters()`/`getModulePanelSetters()` registration
// bridge. They stay independent of any module implementation, proving the
// bridge is subject-neutral.

function noopLearningEngineStateSetters(): LearningEngineStateSetters {
  return {
    setActiveScreen: () => {},
    setShowHeader: () => {},
    setModuleLayout: () => {},
    setAnswerFeedback: () => {},
    setIsSpeaking: () => {},
    setSpeechFailureNotice: () => {},
  };
}

// Builds the exact runtime object `LearningEngine.initialize()` would pass
// into a module constructor, bound to the given engine instance's private
// setter runner, without invoking the full module loading/initialization
// pipeline this focused bridge test does not need.
function runPanelSetterOf(
  engine: LearningEngine
): (setterName: string, value: unknown) => void {
  const runtime = createLearningModuleRuntime((setterName, value) => {
    (
      engine as unknown as {
        runModulePanelSetter(name: string, value: unknown): void;
      }
    ).runModulePanelSetter(setterName, value);
  });

  return runtime.runPanelSetter;
}

test("createLearningModuleRuntime exposes exactly runPanelSetter and nothing else", () => {
  const runtime = createLearningModuleRuntime(() => {});

  assert.deepEqual(Object.keys(runtime), ["runPanelSetter"]);
  assert.equal(typeof runtime.runPanelSetter, "function");
  assert.ok(
    Object.isFrozen(runtime),
    "expected the module runtime object to be frozen"
  );
});

test("createLearningModuleRuntime.runPanelSetter forwards the exact setterName and value to the injected callback", () => {
  const calls: Array<{ setterName: string; value: unknown }> = [];
  const runtime = createLearningModuleRuntime((setterName, value) => {
    calls.push({ setterName, value });
  });

  runtime.runPanelSetter("setFoo", { nested: "value" });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].setterName, "setFoo");
  assert.deepEqual(calls[0].value, { nested: "value" });
});

test("a call made after registration invokes exactly the requested registered setter with the exact value", () => {
  const engine = new LearningEngine();
  const runPanelSetter = runPanelSetterOf(engine);
  const received: unknown[] = [];
  const other: unknown[] = [];

  engine.registerModulePanelSetters({
    setFoo: (value: unknown) => received.push(value),
    setOther: (value: unknown) => other.push(value),
  });

  runPanelSetter("setFoo", "hello");

  assert.deepEqual(received, ["hello"]);
  assert.deepEqual(other, []);
});

test("a call made before registration is retained and replayed when matching setters register", () => {
  const engine = new LearningEngine();
  const runPanelSetter = runPanelSetterOf(engine);
  const received: unknown[] = [];

  runPanelSetter("setFoo", "early-value");

  engine.registerModulePanelSetters({
    setFoo: (value: unknown) => received.push(value),
  });

  assert.deepEqual(received, ["early-value"]);
});

test("multiple pre-registration values for one setter replay only the latest value", () => {
  const engine = new LearningEngine();
  const runPanelSetter = runPanelSetterOf(engine);
  const received: unknown[] = [];

  runPanelSetter("setFoo", "first");
  runPanelSetter("setFoo", "second");
  runPanelSetter("setFoo", "third");

  engine.registerModulePanelSetters({
    setFoo: (value: unknown) => received.push(value),
  });

  assert.deepEqual(received, ["third"]);
});

test("values for multiple setter names remain independent", () => {
  const engine = new LearningEngine();
  const runPanelSetter = runPanelSetterOf(engine);
  const receivedFoo: unknown[] = [];
  const receivedBar: unknown[] = [];

  runPanelSetter("setFoo", "foo-value");
  runPanelSetter("setBar", "bar-value");

  engine.registerModulePanelSetters({
    setFoo: (value: unknown) => receivedFoo.push(value),
    setBar: (value: unknown) => receivedBar.push(value),
  });

  assert.deepEqual(receivedFoo, ["foo-value"]);
  assert.deepEqual(receivedBar, ["bar-value"]);
});

test("re-registering replacement setters replays the latest values to the replacement functions", () => {
  const engine = new LearningEngine();
  const runPanelSetter = runPanelSetterOf(engine);
  const firstPanelReceived: unknown[] = [];
  const replacementPanelReceived: unknown[] = [];

  engine.registerModulePanelSetters({
    setFoo: (value: unknown) => firstPanelReceived.push(value),
  });

  runPanelSetter("setFoo", "current-value");
  assert.deepEqual(firstPanelReceived, ["current-value"]);

  // Simulate a remounted panel registering a brand-new setter object.
  engine.registerModulePanelSetters({
    setFoo: (value: unknown) => replacementPanelReceived.push(value),
  });

  assert.deepEqual(replacementPanelReceived, ["current-value"]);
});

test("an invalid or missing setter name throws instead of silently calling a different setter", () => {
  const engine = new LearningEngine();
  const runPanelSetter = runPanelSetterOf(engine);

  engine.registerModulePanelSetters({
    setFoo: () => {},
  });

  assert.throws(() => runPanelSetter("setNotRegistered", "value"));
});

test("a retained pre-registration name that is missing from the newly registered setters throws on registration", () => {
  const engine = new LearningEngine();
  const runPanelSetter = runPanelSetterOf(engine);

  runPanelSetter("setMissing", "value");

  assert.throws(() =>
    engine.registerModulePanelSetters({
      setSomethingElse: () => {},
    })
  );
});

test("two LearningEngine instances never share registered setters or retained values", () => {
  const engineA = new LearningEngine();
  const engineB = new LearningEngine();
  const runPanelSetterA = runPanelSetterOf(engineA);
  const receivedA: unknown[] = [];
  const receivedB: unknown[] = [];

  runPanelSetterA("setFoo", "a-only-value");

  engineA.registerModulePanelSetters({
    setFoo: (value: unknown) => receivedA.push(value),
  });
  engineB.registerModulePanelSetters({
    setFoo: (value: unknown) => receivedB.push(value),
  });

  assert.deepEqual(receivedA, ["a-only-value"]);
  assert.deepEqual(receivedB, []);
  assert.notEqual(
    engineA.getModulePanelSetters(),
    engineB.getModulePanelSetters()
  );
});

test("reinitializing an engine for a different module/route does not leak prior module panel values", async () => {
  const engine = new LearningEngine();
  const runPanelSetter = runPanelSetterOf(engine);

  runPanelSetter("setFoo", "stale-value-from-previous-module");
  engine.registerModulePanelSetters({
    setFoo: () => {},
  });

  const result = await engine.initialize(
    "module-not-registered",
    [],
    noopLearningEngineStateSetters(),
    "/learning/module-not-registered",
    new AbortController().signal
  );

  assert.equal(result, "route-error");
  assert.equal(engine.getModulePanelSetters(), null);

  const receivedAfterReinitialize: unknown[] = [];
  engine.registerModulePanelSetters({
    setFoo: (value: unknown) => receivedAfterReinitialize.push(value),
  });

  assert.deepEqual(receivedAfterReinitialize, []);
});

test("existing registration/getter behavior continues to pass: exact opaque object is retrievable by identity", () => {
  const engine = new LearningEngine();
  const registration: ModulePanelRegistration = { anything: () => {} };

  engine.registerModulePanelSetters(registration);

  assert.equal(engine.getModulePanelSetters(), registration);
});
