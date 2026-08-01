import assert from "node:assert/strict";
import test from "node:test";
import { handleVocabularyContentRouteRequest } from "../../src/app/api/learning/vocabulary/content/route";
import { handleVocabularySubmitAnswerRouteRequest } from "../../src/app/api/learning/vocabulary/submit-answer/route";
import { handleVocabularySpeechRouteRequest } from "../../src/app/api/learning/vocabulary/speech/route";
import type { AuthorizeLearningModuleAccessDeps } from "../../src/lib/auth/module-access";

// Each Vocabulary HTTP boundary must independently enforce current
// Vocabulary module access before any content creation, capability
// mutation, grading, or paid TTS usage acquisition. These handler-exported
// wrappers are the same functions each route's `POST` delegates to with
// real (uninjected) dependencies; tests inject `accessDeps` directly instead
// of going through a real session/database, mirroring the established
// `authorizePaidTtsCaller`/`accessDeps` injection pattern used by the
// existing Vocabulary speech route tests.

const ROUTES: Array<{
  name: string;
  handler: (
    request: Request,
    accessDeps?: AuthorizeLearningModuleAccessDeps
  ) => Promise<Response>;
  url: string;
  body: unknown;
  // A body that, once access is granted, is rejected deterministically by
  // the real downstream handler's own validation *before* it would need a
  // real database/session (which these tests deliberately never fake) --
  // proving the request passed the module-access gate and reached the real
  // handler, without depending on unrelated downstream authentication.
  passThroughBody: unknown;
  passThroughStatus: number;
}> = [
  {
    name: "content",
    handler: handleVocabularyContentRouteRequest,
    url: "http://local.test/api/learning/vocabulary/content",
    body: { contentType: "manifest", learningId: "learning-id" },
    // A structurally malformed screen-content request (an invalid opaque
    // capability shape) is rejected by strict request parsing before the
    // handler ever calls the database-backed capability store, proving the
    // request passed the module-access gate and reached the real handler
    // without depending on a real (unfaked) Prisma-backed lookup. A
    // well-formed but unauthorized/unknown lessonId cannot serve this role
    // now that lesson/capability state is authoritative in the shared
    // runtime database rather than an in-process Map.
    passThroughBody: {
      contentType: "definition-display",
      lessonId: "00000000-0000-4000-8000-000000000001",
      capability: "not-a-valid-opaque-capability",
    },
    passThroughStatus: 400,
  },
  {
    name: "submit-answer",
    handler: handleVocabularySubmitAnswerRouteRequest,
    url: "http://local.test/api/learning/vocabulary/submit-answer",
    body: { answerType: "definition", attemptId: "attempt-1", selectedChoiceId: "a" },
    // A structurally invalid submission is rejected by strict parsing before
    // grading would ever need a real (unfaked) database, proving the
    // request passed the module-access gate and reached the real handler.
    passThroughBody: {
      answerType: "definition",
      attemptId: "attempt-1",
      selectedChoiceId: "a",
      extra: true,
    },
    passThroughStatus: 400,
  },
  {
    name: "speech",
    handler: handleVocabularySpeechRouteRequest,
    url: "http://local.test/api/learning/vocabulary/speech",
    body: { reference: "attempt-1" },
    // An invalid reference shape is rejected before the downstream handler
    // ever reaches its own (unrelated) paid-TTS session authorization.
    passThroughBody: {},
    passThroughStatus: 400,
  },
];

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

for (const route of ROUTES) {
  test(`${route.name}: no session returns 401 without reaching the handler`, async () => {
    const response = await route.handler(jsonRequest(route.url, route.body), {
      getSessionUserId: async () => null,
    });

    assert.equal(response.status, 401);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = (await response.json()) as { error: string };
    assert.match(body.error, /sign in/i);
  });

  test(`${route.name}: a session without an allowed current tier returns 403 without reaching the handler`, async () => {
    const response = await route.handler(jsonRequest(route.url, route.body), {
      getSessionUserId: async () => "user-1",
      resolveEffectiveTier: async () => null,
    });

    assert.equal(response.status, 403);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const body = (await response.json()) as { error: string };
    assert.doesNotMatch(body.error.toLowerCase(), /tier|parent|stripe|price/);
  });

  test(`${route.name}: a truthful FREE_TRIAL tier is denied because Vocabulary's settings do not include it`, async () => {
    const response = await route.handler(jsonRequest(route.url, route.body), {
      getSessionUserId: async () => "user-1",
      resolveEffectiveTier: async () => "FREE_TRIAL",
    });

    assert.equal(response.status, 403);
  });

  test(`${route.name}: an allowed tier passes through to the real handler`, async () => {
    const response = await route.handler(jsonRequest(route.url, route.passThroughBody), {
      getSessionUserId: async () => "user-1",
      resolveEffectiveTier: async () => "ADMIN",
    });

    assert.equal(response.status, route.passThroughStatus);
  });

  test(`${route.name}: a database/session failure fails closed instead of granting access`, async () => {
    const response = await route.handler(jsonRequest(route.url, route.body), {
      getSessionUserId: async () => {
        throw new Error("simulated session lookup failure");
      },
    });

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
  });
}
