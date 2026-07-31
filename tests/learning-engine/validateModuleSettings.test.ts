import assert from "node:assert/strict";
import test from "node:test";
import { validateModuleSettings } from "../../src/lib/learning-engine/initialization/validateModuleSettings";
import { loadLearningModuleSettings } from "../../src/lib/learning-engine/initialization/loadLearningModule";
import type { ModuleSettings } from "../../src/types/learning";

function baseSettings(overrides: Partial<ModuleSettings> = {}): ModuleSettings {
  return {
    showHeader: true,
    subscriptionTier: ["MONTHLY"],
    ...overrides,
  };
}

test("accepts valid settings with one or more supported tiers", () => {
  assert.doesNotThrow(() => validateModuleSettings(baseSettings()));
  assert.doesNotThrow(() =>
    validateModuleSettings(baseSettings({ subscriptionTier: ["MONTHLY", "LIFETIME", "ADMIN"] }))
  );
});

test("rejects a missing subscriptionTier", () => {
  const settings = baseSettings();
  // @ts-expect-error -- proving the runtime rejects a structurally invalid settings object.
  delete settings.subscriptionTier;
  assert.throws(() => validateModuleSettings(settings), /subscriptionTier/);
});

test("rejects a non-array subscriptionTier", () => {
  assert.throws(
    // @ts-expect-error -- deliberately invalid input.
    () => validateModuleSettings(baseSettings({ subscriptionTier: "MONTHLY" })),
    /subscriptionTier/
  );
});

test("rejects an empty subscriptionTier array", () => {
  assert.throws(
    () => validateModuleSettings(baseSettings({ subscriptionTier: [] })),
    /subscriptionTier/
  );
});

test("rejects non-string and unsupported subscriptionTier entries", () => {
  // @ts-expect-error -- deliberately invalid entry type.
  assert.throws(() => validateModuleSettings(baseSettings({ subscriptionTier: [7] })), /subscriptionTier/);
  assert.throws(
    // @ts-expect-error -- deliberately unsupported tier string.
    () => validateModuleSettings(baseSettings({ subscriptionTier: ["CANCELED"] })),
    /subscriptionTier/
  );
  assert.throws(
    // @ts-expect-error -- deliberately unsupported tier string.
    () => validateModuleSettings(baseSettings({ subscriptionTier: ["UNKNOWN"] })),
    /subscriptionTier/
  );
});

test("rejects duplicate subscriptionTier entries", () => {
  assert.throws(
    () => validateModuleSettings(baseSettings({ subscriptionTier: ["MONTHLY", "MONTHLY"] })),
    /subscriptionTier/
  );
});

test("preserves the existing boolean validation", () => {
  // @ts-expect-error -- deliberately invalid type.
  assert.throws(() => validateModuleSettings(baseSettings({ showHeader: "yes" })), /showHeader/);
});

test("loadLearningModuleSettings returns Vocabulary's exact approved tier list", async () => {
  const settings = await loadLearningModuleSettings("vocabulary");
  assert.doesNotThrow(() => validateModuleSettings(settings));
  assert.deepEqual(settings.subscriptionTier, ["MONTHLY", "LIFETIME", "ADMIN"]);
});

test("Vocabulary settings are valid without showSidebar", async () => {
  const settings = await loadLearningModuleSettings("vocabulary");
  assert.equal("showSidebar" in settings, false);
  assert.doesNotThrow(() => validateModuleSettings(settings));
});

test("loadLearningModuleSettings rejects an unregistered module name", async () => {
  await assert.rejects(() => loadLearningModuleSettings("not-a-real-module"));
});
