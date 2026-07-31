import assert from "node:assert/strict";
import test from "node:test";
import LearningEngine from "../../src/lib/learning-engine/LearningEngine";
import type { ModulePanelRegistration } from "../../src/types/learning";

// These tests exercise LearningEngine.registerModulePanelSetters() and
// getModulePanelSetters() directly, independent of initialize(): the
// registration bridge is plain, subject-neutral engine state, not React, so
// its storage/replace/cleanup-safety contract is provable here without a
// module, a rendered ModuleLayout, or any DOM.

test("registers the exact opaque object passed in, retrievable by identity", () => {
  const engine = new LearningEngine();
  const registration: ModulePanelRegistration = { anything: () => {} };

  engine.registerModulePanelSetters(registration);

  assert.equal(engine.getModulePanelSetters(), registration);
});

test("a new registration replaces the previously active one", () => {
  const engine = new LearningEngine();
  const first: ModulePanelRegistration = { first: true };
  const second: ModulePanelRegistration = { second: true };

  engine.registerModulePanelSetters(first);
  engine.registerModulePanelSetters(second);

  assert.equal(engine.getModulePanelSetters(), second);
});

test("calling the disposer for the currently active registration clears it", () => {
  const engine = new LearningEngine();
  const registration: ModulePanelRegistration = {};

  const dispose = engine.registerModulePanelSetters(registration);
  dispose();

  assert.equal(engine.getModulePanelSetters(), null);
});

test("an old (Strict Mode-style) cleanup cannot clear a newer registration", () => {
  const engine = new LearningEngine();
  const first: ModulePanelRegistration = { first: true };
  const second: ModulePanelRegistration = { second: true };

  const disposeFirst = engine.registerModulePanelSetters(first);
  const disposeSecond = engine.registerModulePanelSetters(second);

  // The stale disposer from the first (already-replaced) registration must
  // be a no-op against the now-active second registration.
  disposeFirst();
  assert.equal(engine.getModulePanelSetters(), second);

  disposeSecond();
  assert.equal(engine.getModulePanelSetters(), null);
});

test("re-registering after a clean disposal starts a fresh, independently disposable registration", () => {
  const engine = new LearningEngine();
  const first: ModulePanelRegistration = { first: true };
  const second: ModulePanelRegistration = { second: true };

  const disposeFirst = engine.registerModulePanelSetters(first);
  disposeFirst();
  assert.equal(engine.getModulePanelSetters(), null);

  const disposeSecond = engine.registerModulePanelSetters(second);
  assert.equal(engine.getModulePanelSetters(), second);

  // The already-fired first disposer must not affect the unrelated second
  // registration that started fresh after full cleanup.
  disposeFirst();
  assert.equal(engine.getModulePanelSetters(), second);

  disposeSecond();
  assert.equal(engine.getModulePanelSetters(), null);
});

test("stores an opaque object generically, with no knowledge of Vocabulary setter names", () => {
  const engine = new LearningEngine();
  const vocabularyShaped: ModulePanelRegistration = {
    setWordList: () => {},
    setSpellingWords: () => {},
    setMasteredWords: () => {},
  };
  const unrelatedShaped: ModulePanelRegistration = {
    setSomethingElseEntirely: () => {},
  };

  engine.registerModulePanelSetters(vocabularyShaped);
  assert.equal(engine.getModulePanelSetters(), vocabularyShaped);

  // A completely differently-shaped object registers and replaces exactly
  // the same way, proving the engine does not special-case Vocabulary's
  // key names.
  engine.registerModulePanelSetters(unrelatedShaped);
  assert.equal(engine.getModulePanelSetters(), unrelatedShaped);
});
