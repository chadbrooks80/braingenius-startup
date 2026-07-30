import assert from "node:assert/strict";
import test from "node:test";
import {
  authorizeLearningModuleAccess,
  learningModuleAccessDenialResponse,
} from "../../src/lib/auth/module-access";
import type { ModuleSettings } from "../../src/types/learning";
import { createLearningModuleNotFoundError } from "../../src/lib/learning-engine/errors/learningEngineRouteErrors";

const VOCABULARY_SETTINGS: ModuleSettings = {
  showHeader: true,
  showSidebar: true,
  subscriptionTier: ["MONTHLY", "LIFETIME", "ADMIN"],
};

function loadSettingsFor(settings: ModuleSettings) {
  return async () => settings;
}

test("an unregistered module resolves to 'unregistered' without resolving a session or tier", async () => {
  let sessionCalls = 0;
  let tierCalls = 0;
  const result = await authorizeLearningModuleAccess("not-a-real-module", {
    loadSettings: async (moduleName) => {
      throw createLearningModuleNotFoundError(moduleName);
    },
    getSessionUserId: async () => {
      sessionCalls += 1;
      return "user-1";
    },
    resolveEffectiveTier: async () => {
      tierCalls += 1;
      return "ADMIN";
    },
  });

  assert.deepEqual(result, { status: "unregistered" });
  assert.equal(sessionCalls, 0);
  assert.equal(tierCalls, 0);
});

test("malformed settings resolve to 'unavailable' without resolving a session", async () => {
  let sessionCalls = 0;
  const result = await authorizeLearningModuleAccess("vocabulary", {
    loadSettings: async () => {
      throw new Error("simulated malformed settings.json");
    },
    getSessionUserId: async () => {
      sessionCalls += 1;
      return "user-1";
    },
  });

  assert.deepEqual(result, { status: "unavailable" });
  assert.equal(sessionCalls, 0);
});

test("an anonymous caller is unauthenticated without resolving a tier", async () => {
  let tierCalls = 0;
  const result = await authorizeLearningModuleAccess("vocabulary", {
    loadSettings: loadSettingsFor(VOCABULARY_SETTINGS),
    getSessionUserId: async () => null,
    resolveEffectiveTier: async () => {
      tierCalls += 1;
      return "ADMIN";
    },
  });

  assert.deepEqual(result, { status: "unauthenticated" });
  assert.equal(tierCalls, 0);
});

test("a session-lookup failure fails closed to 'unavailable'", async () => {
  const result = await authorizeLearningModuleAccess("vocabulary", {
    loadSettings: loadSettingsFor(VOCABULARY_SETTINGS),
    getSessionUserId: async () => {
      throw new Error("simulated session lookup failure");
    },
  });

  assert.deepEqual(result, { status: "unavailable" });
});

test("a caller with no current effective tier is forbidden", async () => {
  const result = await authorizeLearningModuleAccess("vocabulary", {
    loadSettings: loadSettingsFor(VOCABULARY_SETTINGS),
    getSessionUserId: async () => "user-1",
    resolveEffectiveTier: async () => null,
  });

  assert.deepEqual(result, { status: "forbidden" });
});

test("a truthful FREE_TRIAL tier is forbidden because Vocabulary's settings do not include it", async () => {
  const result = await authorizeLearningModuleAccess("vocabulary", {
    loadSettings: loadSettingsFor(VOCABULARY_SETTINGS),
    getSessionUserId: async () => "user-1",
    resolveEffectiveTier: async () => "FREE_TRIAL",
  });

  assert.deepEqual(result, { status: "forbidden" });
});

test("a tier-resolution failure fails closed to 'unavailable'", async () => {
  const result = await authorizeLearningModuleAccess("vocabulary", {
    loadSettings: loadSettingsFor(VOCABULARY_SETTINGS),
    getSessionUserId: async () => "user-1",
    resolveEffectiveTier: async () => {
      throw new Error("simulated tier resolution failure");
    },
  });

  assert.deepEqual(result, { status: "unavailable" });
});

test("an allowed current tier is granted with the resolved tier", async () => {
  for (const tier of ["MONTHLY", "LIFETIME", "ADMIN"] as const) {
    const result = await authorizeLearningModuleAccess("vocabulary", {
      loadSettings: loadSettingsFor(VOCABULARY_SETTINGS),
      getSessionUserId: async () => "user-1",
      resolveEffectiveTier: async () => tier,
    });

    assert.deepEqual(result, { status: "granted", tier });
  }
});

test("learningModuleAccessDenialResponse maps every denial to a generic no-store response", async () => {
  const cases: Array<{
    result: Parameters<typeof learningModuleAccessDenialResponse>[0];
    status: number;
  }> = [
    { result: { status: "unauthenticated" }, status: 401 },
    { result: { status: "forbidden" }, status: 403 },
    { result: { status: "unregistered" }, status: 503 },
    { result: { status: "unavailable" }, status: 503 },
  ];

  for (const { result, status } of cases) {
    const response = learningModuleAccessDenialResponse(result);
    assert.equal(response.status, status);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = (await response.json()) as { error: string };
    assert.equal(typeof body.error, "string");
    assert.doesNotMatch(body.error.toLowerCase(), /tier|parent|stripe|price/);
  }
});
