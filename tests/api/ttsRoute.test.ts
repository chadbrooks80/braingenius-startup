import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../../src/app/api/tts/route";
import { handleTtsSynthesisRequest } from "../../src/lib/learning-engine/speech/handleTtsSynthesisRequest";
import {
  TtsConfigurationError,
  TtsUpstreamError,
} from "../../src/lib/learning-engine/errors/TtsSynthesisError";
import type { PaidTtsUsageDeps } from "../../src/lib/learning-engine/speech/ttsUsageService";
import {
  ADMIN_SUBSCRIPTION,
  FakeTtsUsageStore,
} from "../tts/testDoubles/fakeTtsUsageStore";

const NOW = new Date("2026-07-29T10:30:30Z");
const PRICES = { monthly: "price_monthly", lifetime: "price_lifetime" };
const CALLER = "user-caller";
const FAKE_AUDIO = new Uint8Array([1, 2, 3, 4]);
const VALID_BODY = {
  text: "hello there",
  tts: { provider: "lemonfox", voice: "sarah" },
};

function requestWithBody(body: BodyInit): Request {
  return new Request("http://localhost/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

function entitledDeps(overrides: PaidTtsUsageDeps = {}): {
  deps: PaidTtsUsageDeps;
  store: FakeTtsUsageStore;
  synthesized: string[];
} {
  const store = new FakeTtsUsageStore();
  store.seedUser({ id: CALLER, subscription: ADMIN_SUBSCRIPTION });
  const synthesized: string[] = [];
  const deps: PaidTtsUsageDeps = {
    getSessionUserId: async () => CALLER,
    resolveEntitlement: async () => ({
      granted: true,
      callerUserId: CALLER,
      entitlementPrincipalUserId: CALLER,
      source: "administrative",
    }),
    store,
    prices: PRICES,
    now: () => NOW,
    synthesize: async (request) => {
      synthesized.push(request.text);
      return { bytes: FAKE_AUDIO, contentType: "audio/mpeg" };
    },
    ...overrides,
  };
  return { deps, store, synthesized };
}

async function assertGenericErrorBody(
  response: Response,
  expectedError: string
): Promise<void> {
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = (await response.json()) as Record<string, unknown>;
  assert.deepEqual(body, { error: expectedError });
  // Denials never reveal identity, usage, entitlement, or provider details.
  const serialized = JSON.stringify(body).toLocaleLowerCase("en-US");
  for (const banned of [CALLER, "words", "quota", "suspend", "stripe", "parent"]) {
    assert.ok(
      !serialized.includes(banned.toLocaleLowerCase("en-US")),
      `error body leaks "${banned}"`
    );
  }
}

test("returns a learner-safe 400 response for malformed JSON", async () => {
  const response = await POST(requestWithBody("{"));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Request body must be valid JSON.",
  });
});

test("returns a generic 400 response for invalid provider configuration", async () => {
  const invalidBodies = [
    { text: "hello" },
    { text: "hello", tts: { provider: "unknown", voice: "test" } },
    {
      text: "hello",
      tts: {
        provider: "google",
        model: "unsupported",
        voice: "unsupported",
        languageCode: "en-US",
      },
    },
  ];

  for (const body of invalidBodies) {
    const response = await POST(requestWithBody(JSON.stringify(body)));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid TTS request." });
  }
});

test("an anonymous request returns 401 without provider, usage, alert, or lease creation", async () => {
  const { deps, store, synthesized } = entitledDeps({
    getSessionUserId: async () => null,
  });

  const response = await handleTtsSynthesisRequest(
    requestWithBody(JSON.stringify(VALID_BODY)),
    deps
  );

  assert.equal(response.status, 401);
  await assertGenericErrorBody(response, "Sign in to use text-to-speech.");
  assert.deepEqual(synthesized, []);
  assert.deepEqual(store.getBuckets(), []);
  assert.deepEqual(store.getAlerts(), []);
  assert.deepEqual(store.getLeases(), []);
});

test("a stale or non-entitled session user returns a generic 403 without a provider call", async () => {
  const { deps, synthesized } = entitledDeps({
    resolveEntitlement: async () => ({ granted: false }),
  });

  const response = await handleTtsSynthesisRequest(
    requestWithBody(JSON.stringify(VALID_BODY)),
    deps
  );

  assert.equal(response.status, 403);
  await assertGenericErrorBody(
    response,
    "Text-to-speech is not available for this account."
  );
  assert.deepEqual(synthesized, []);
});

test("a manually suspended caller receives the same generic 403 as a non-entitled caller", async () => {
  const { deps, store, synthesized } = entitledDeps();
  store.setSuspension(CALLER, NOW);

  const response = await handleTtsSynthesisRequest(
    requestWithBody(JSON.stringify(VALID_BODY)),
    deps
  );

  assert.equal(response.status, 403);
  await assertGenericErrorBody(
    response,
    "Text-to-speech is not available for this account."
  );
  assert.deepEqual(synthesized, []);
  assert.deepEqual(store.getLeases(), []);
});

test("a valid entitled request returns no-store MP3 audio and records exact durable paid-attempt usage", async () => {
  const { deps, store, synthesized } = entitledDeps();

  const response = await handleTtsSynthesisRequest(
    requestWithBody(JSON.stringify(VALID_BODY)),
    deps
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "audio/mpeg");
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(new Uint8Array(await response.arrayBuffer()), FAKE_AUDIO);
  assert.deepEqual(synthesized, ["hello there"]);

  const dayBucket = store.getBucket({
    subjectUserId: CALLER,
    scope: "CALLER_DAY",
    windowStart: new Date("2026-07-29T00:00:00Z"),
    provider: "LEMONFOX",
    requestKind: "PUBLIC_TEXT",
  });
  assert.ok(dayBucket);
  assert.equal(dayBucket.acceptedRequests, 1);
  assert.equal(dayBucket.acceptedWords, 2);
  assert.equal(dayBucket.successfulRequests, 1);
  assert.equal(dayBucket.generatedAudioBytes, BigInt(FAKE_AUDIO.byteLength));
  assert.equal(store.getLeases().length, 0, "the lease is released on completion");
});

test("a direct public chunk of exactly 5,000 UTF-8 bytes is accepted while 5,001 bytes is rejected with 400", async () => {
  const atLimit = entitledDeps();
  const accepted = await handleTtsSynthesisRequest(
    requestWithBody(
      JSON.stringify({ ...VALID_BODY, text: "a".repeat(5000) })
    ),
    atLimit.deps
  );
  assert.equal(accepted.status, 200);

  const overLimit = entitledDeps();
  const rejected = await handleTtsSynthesisRequest(
    requestWithBody(
      JSON.stringify({ ...VALID_BODY, text: "a".repeat(5001) })
    ),
    overLimit.deps
  );
  assert.equal(rejected.status, 400);
  assert.deepEqual(await rejected.json(), { error: "Invalid TTS request." });
  assert.deepEqual(overLimit.synthesized, []);
});

test("crossing the five-hour warning still returns a normal 200 audio response with no warning disclosure", async () => {
  const { deps, store } = entitledDeps();
  // Seed the caller day to exactly the warning boundary through the store.
  await store.transact(async (tx) => {
    await tx.addAcceptedUsage(
      {
        subjectUserId: CALLER,
        scope: "CALLER_DAY",
        windowStart: new Date("2026-07-29T00:00:00Z"),
        provider: "LEMONFOX",
        requestKind: "PUBLIC_TEXT",
      },
      { utf8Bytes: 1, characters: 1, words: 45_000 }
    );
  });

  const response = await handleTtsSynthesisRequest(
    requestWithBody(JSON.stringify(VALID_BODY)),
    deps
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(
    [...response.headers.keys()].filter((name) =>
      /warning|usage|quota|limit|retry/i.test(name)
    ).length,
    0,
    "no warning state appears in response headers"
  );
  assert.equal(
    store.getAlerts().filter((alert) => alert.kind === "FIVE_HOUR_WARNING").length,
    1
  );
});

test("a request beyond the ten-hour word boundary returns generic 429 with an integer Retry-After and no provider call", async () => {
  const { deps, store, synthesized } = entitledDeps();
  await store.transact(async (tx) => {
    await tx.addAcceptedUsage(
      {
        subjectUserId: CALLER,
        scope: "CALLER_DAY",
        windowStart: new Date("2026-07-29T00:00:00Z"),
        provider: "LEMONFOX",
        requestKind: "PUBLIC_TEXT",
      },
      { utf8Bytes: 1, characters: 1, words: 90_000 }
    );
  });

  const response = await handleTtsSynthesisRequest(
    requestWithBody(JSON.stringify(VALID_BODY)),
    deps
  );

  assert.equal(response.status, 429);
  const retryAfter = response.headers.get("retry-after");
  assert.ok(retryAfter);
  assert.match(retryAfter, /^\d+$/, "Retry-After is a whole number of seconds");
  assert.equal(Number(retryAfter), 13 * 3600 + 29 * 60 + 30);
  await assertGenericErrorBody(response, "Too many text-to-speech requests.");
  assert.deepEqual(synthesized, []);
});

test("the 121st accepted attempt in one UTC minute returns 429 through the route boundary", async () => {
  const { deps, store, synthesized } = entitledDeps();
  await store.transact(async (tx) => {
    for (let index = 0; index < 120; index += 1) {
      await tx.addAcceptedUsage(
        {
          subjectUserId: CALLER,
          scope: "CALLER_MINUTE",
          windowStart: new Date("2026-07-29T10:30:00Z"),
          provider: "LEMONFOX",
          requestKind: "PUBLIC_TEXT",
        },
        { utf8Bytes: 1, characters: 1, words: 1 }
      );
    }
  });

  const response = await handleTtsSynthesisRequest(
    requestWithBody(JSON.stringify(VALID_BODY)),
    deps
  );

  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "30");
  assert.deepEqual(synthesized, []);
});

test("provider failures map to the established 502/500 contract after the paid attempt is finalized", async () => {
  const upstream = entitledDeps({
    synthesize: async () => {
      throw new TtsUpstreamError("lemonfox", "raw upstream failure detail");
    },
  });
  const upstreamResponse = await handleTtsSynthesisRequest(
    requestWithBody(JSON.stringify(VALID_BODY)),
    upstream.deps
  );
  assert.equal(upstreamResponse.status, 502);
  await assertGenericErrorBody(
    upstreamResponse,
    "The text-to-speech provider is unavailable."
  );
  const failedBucket = upstream.store.getBucket({
    subjectUserId: CALLER,
    scope: "CALLER_DAY",
    windowStart: new Date("2026-07-29T00:00:00Z"),
    provider: "LEMONFOX",
    requestKind: "PUBLIC_TEXT",
  });
  assert.ok(failedBucket);
  assert.equal(failedBucket.acceptedRequests, 1, "accepted usage is not refunded");
  assert.equal(failedBucket.failedRequests, 1);

  const configuration = entitledDeps({
    synthesize: async () => {
      throw new TtsConfigurationError("lemonfox", "missing credential detail");
    },
  });
  const configurationResponse = await handleTtsSynthesisRequest(
    requestWithBody(JSON.stringify(VALID_BODY)),
    configuration.deps
  );
  assert.equal(configurationResponse.status, 500);
  await assertGenericErrorBody(
    configurationResponse,
    "The text-to-speech service is not configured."
  );
});

test("an unavailable usage database returns 503 before any provider call", async () => {
  const { deps, store, synthesized } = entitledDeps();
  store.failNext("transact");

  const response = await handleTtsSynthesisRequest(
    requestWithBody(JSON.stringify(VALID_BODY)),
    deps
  );

  assert.equal(response.status, 503);
  await assertGenericErrorBody(
    response,
    "The text-to-speech service is temporarily unavailable."
  );
  assert.deepEqual(synthesized, []);
});

test("unconfirmed success accounting returns 503 and never returns the unaccounted audio", async () => {
  const { deps, store } = entitledDeps({
    synthesize: async () => {
      return { bytes: FAKE_AUDIO, contentType: "audio/mpeg" };
    },
  });
  const originalSynthesize = deps.synthesize!;
  deps.synthesize = async (request) => {
    const audio = await originalSynthesize(request);
    store.failNext("transact");
    return audio;
  };

  const response = await handleTtsSynthesisRequest(
    requestWithBody(JSON.stringify(VALID_BODY)),
    deps
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("content-type")?.includes("audio"), false);
  await assertGenericErrorBody(
    response,
    "The text-to-speech service is temporarily unavailable."
  );
});

test("an expired success lease returns generic no-store 503 and never returns audio", async () => {
  let clockReads = 0;
  const { deps, store } = entitledDeps({
    now: () => {
      clockReads += 1;
      return clockReads === 1
        ? NOW
        : new Date(NOW.getTime() + 31_000);
    },
  });

  const response = await handleTtsSynthesisRequest(
    requestWithBody(JSON.stringify(VALID_BODY)),
    deps
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("content-type")?.includes("audio"), false);
  await assertGenericErrorBody(
    response,
    "The text-to-speech service is temporarily unavailable."
  );
  const dayBucket = store.getBucket({
    subjectUserId: CALLER,
    scope: "CALLER_DAY",
    windowStart: new Date("2026-07-29T00:00:00Z"),
    provider: "LEMONFOX",
    requestKind: "PUBLIC_TEXT",
  });
  assert.ok(dayBucket);
  assert.equal(dayBucket.acceptedRequests, 1);
  assert.equal(dayBucket.successfulRequests, 0);
  assert.equal(dayBucket.generatedAudioBytes, BigInt(0));
});

test("an expired failure lease returns generic no-store 503 instead of the provider error", async () => {
  let clockReads = 0;
  const { deps, store } = entitledDeps({
    now: () => {
      clockReads += 1;
      return clockReads === 1
        ? NOW
        : new Date(NOW.getTime() + 31_000);
    },
    synthesize: async () => {
      throw new TtsUpstreamError("lemonfox", "provider failed");
    },
  });

  const response = await handleTtsSynthesisRequest(
    requestWithBody(JSON.stringify(VALID_BODY)),
    deps
  );

  assert.equal(response.status, 503);
  await assertGenericErrorBody(
    response,
    "The text-to-speech service is temporarily unavailable."
  );
  const dayBucket = store.getBucket({
    subjectUserId: CALLER,
    scope: "CALLER_DAY",
    windowStart: new Date("2026-07-29T00:00:00Z"),
    provider: "LEMONFOX",
    requestKind: "PUBLIC_TEXT",
  });
  assert.ok(dayBucket);
  assert.equal(dayBucket.acceptedRequests, 1);
  assert.equal(dayBucket.failedRequests, 0);
});
