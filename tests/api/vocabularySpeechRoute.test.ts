import assert from "node:assert/strict";
import test from "node:test";
import Vocabulary, {
  type VocabularyModuleApi,
} from "../../src/learning-modules/vocabulary/index";
import {
  TtsConfigurationError,
  TtsUpstreamError,
} from "../../src/lib/learning-engine/errors/TtsSynthesisError";
import type { TtsSynthesisRequest } from "../../src/lib/learning-engine/speech/validation/parseTtsSynthesisRequest";
import type {
  VocabularyContentRequest,
  VocabularyContentResponseFor,
} from "../../src/learning-modules/vocabulary/data/vocabularyContentTypes";
import { vocabularyTts } from "../../src/learning-modules/vocabulary/data/vocabularyTts";
import { handleVocabularySpeechRequest } from "../../src/learning-modules/vocabulary/server/handleVocabularySpeechRequest";
import { handleVocabularyContentRequest } from "../../src/learning-modules/vocabulary/server/handleVocabularyContentRequest";
import { VocabularyContentCapabilityStore } from "../../src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
import {
  getServerCorrectChoiceId,
  TEST_LEARNING_ID,
  createDefaultFakeVocabularyLearningSource,
} from "../vocabulary/testVocabularyApi";
import {
  createDefaultFakeVocabularyListSource,
  TEST_OWNER_USER_ID,
  TEST_WORD_SEEDS,
} from "../vocabulary/fakeVocabularyListStore";
import { createFakeVocabularyRuntimeStore } from "../vocabulary/fakeVocabularyRuntimeStore";
import type { PaidTtsUsageDeps } from "../../src/lib/learning-engine/speech/ttsUsageService";
import {
  ADMIN_SUBSCRIPTION,
  FakeTtsUsageStore,
} from "../tts/testDoubles/fakeTtsUsageStore";

const FAKE_AUDIO = new Uint8Array([1, 2, 3, 4]);
const CALLER = "user-caller";
const NOW = new Date("2026-07-29T10:30:30Z");
const PRICES = { monthly: "price_monthly", lifetime: "price_lifetime" };

// Deterministic entitled TTS access context: the handler must pass the same
// shared paid usage policy as the public route, so every test provides an
// injected session, entitlement, and durable usage store.
function entitledAccess(overrides: PaidTtsUsageDeps = {}): {
  accessDeps: PaidTtsUsageDeps;
  usageStore: FakeTtsUsageStore;
} {
  const usageStore = new FakeTtsUsageStore();
  usageStore.seedUser({ id: CALLER, subscription: ADMIN_SUBSCRIPTION });
  return {
    usageStore,
    accessDeps: {
      getSessionUserId: async () => CALLER,
      resolveEntitlement: async () => ({
        granted: true,
        callerUserId: CALLER,
        entitlementPrincipalUserId: CALLER,
        source: "administrative",
      }),
      store: usageStore,
      prices: PRICES,
      now: () => NOW,
      ...overrides,
    },
  };
}

test("resolves an opaque spelling reference to audio without exposing the word", async () => {
  const authorization = await createSpellingAuthorization();
  const synthesized: TtsSynthesisRequest[] = [];
  const { accessDeps, usageStore } = entitledAccess();

  const response = await handleVocabularySpeechRequest(
    speechRequest({ reference: authorization.attemptId }),
    TEST_OWNER_USER_ID,
    async (request) => {
      synthesized.push(request);
      return { bytes: FAKE_AUDIO, contentType: "audio/mpeg" };
    },
    authorization.findAttempt,
    accessDeps
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "audio/mpeg");
  assert.equal(response.headers.get("cache-control"), "no-store");

  // The canonical word reaches only the server-side TTS synthesis request.
  assert.equal(synthesized.length, 1);
  assert.match(
    synthesized[0].text,
    new RegExp(`Spell the word: ${authorization.canonicalSpelling}`)
  );
  assert.match(synthesized[0].text, new RegExp(authorization.speechDefinition));
  assert.deepEqual(synthesized[0].tts, vocabularyTts);

  // The browser-visible response carries opaque audio bytes and headers only.
  const body = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual(body, FAKE_AUDIO);
  for (const [name, value] of response.headers.entries()) {
    assert.ok(
      !`${name} ${value}`
        .toLocaleLowerCase("en-US")
        .includes(authorization.canonicalSpelling.toLocaleLowerCase("en-US")),
      `header ${name} leaks the word`
    );
  }

  // Usage is durably recorded as protected speech with numbers only: no
  // spoken text, canonical word, or definition appears in any stored row.
  const dayBucket = usageStore.getBucket({
    subjectUserId: CALLER,
    scope: "CALLER_DAY",
    windowStart: new Date("2026-07-29T00:00:00Z"),
    provider: vocabularyTts.provider === "google" ? "GOOGLE" : "LEMONFOX",
    requestKind: "PROTECTED_TEXT",
  });
  assert.ok(dayBucket);
  assert.equal(dayBucket.acceptedRequests, 1);
  assert.equal(dayBucket.successfulRequests, 1);
  assert.ok(dayBucket.acceptedWords > 0);
  assertNoFixtureWord(
    JSON.stringify([...usageStore.getBuckets(), ...usageStore.getLeases()], (key, value) =>
      typeof value === "bigint" ? value.toString() : (value as unknown)
    )
  );
});

test("an anonymous protected speech request returns 401 without provider use or canonical-answer exposure", async () => {
  const authorization = await createSpellingAuthorization();
  const { accessDeps, usageStore } = entitledAccess({
    getSessionUserId: async () => null,
  });

  const response = await handleVocabularySpeechRequest(
    speechRequest({ reference: authorization.attemptId }),
    TEST_OWNER_USER_ID,
    async () => {
      throw new Error("synthesis must not run for an anonymous caller");
    },
    authorization.findAttempt,
    accessDeps
  );

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, "Sign in to use text-to-speech.");
  assertNoFixtureWord(JSON.stringify(body));
  assert.deepEqual(usageStore.getBuckets(), []);
  assert.deepEqual(usageStore.getLeases(), []);
});

test("a non-entitled caller receives a generic 403 without provider use", async () => {
  const authorization = await createSpellingAuthorization();
  const { accessDeps } = entitledAccess({
    resolveEntitlement: async () => ({ granted: false }),
  });

  const response = await handleVocabularySpeechRequest(
    speechRequest({ reference: authorization.attemptId }),
    TEST_OWNER_USER_ID,
    async () => {
      throw new Error("synthesis must not run for a non-entitled caller");
    },
    authorization.findAttempt,
    accessDeps
  );

  assert.equal(response.status, 403);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, "Text-to-speech is not available for this account.");
  assertNoFixtureWord(JSON.stringify(body));
});

test("a caller past the emergency burst boundary receives 429 with an integer Retry-After and no provider call", async () => {
  const authorization = await createSpellingAuthorization();
  const { accessDeps, usageStore } = entitledAccess();
  await usageStore.transact(async (tx) => {
    for (let index = 0; index < 120; index += 1) {
      await tx.addAcceptedUsage(
        {
          subjectUserId: CALLER,
          scope: "CALLER_MINUTE",
          windowStart: new Date("2026-07-29T10:30:00Z"),
          provider: "GOOGLE",
          requestKind: "PROTECTED_TEXT",
        },
        { utf8Bytes: 1, characters: 1, words: 1 }
      );
    }
  });

  const response = await handleVocabularySpeechRequest(
    speechRequest({ reference: authorization.attemptId }),
    TEST_OWNER_USER_ID,
    async () => {
      throw new Error("synthesis must not run past the burst boundary");
    },
    authorization.findAttempt,
    accessDeps
  );

  assert.equal(response.status, 429);
  assert.match(response.headers.get("retry-after") ?? "", /^\d+$/);
  const body = (await response.json()) as { error: string };
  assert.equal(body.error, "Too many text-to-speech requests.");
  assertNoFixtureWord(JSON.stringify(body));
});

test("rejects invalid, mismatched, and unsupported speech references with one generic error", async () => {
  const authorization = await createSpellingAuthorization();
  const { accessDeps, usageStore } = entitledAccess();
  const rejectedBodies: unknown[] = [
    { reference: "definition-attempt" },
    { reference: "unknown-reference" },
    { reference: "" },
    { reference: "   " },
    { reference: 7 },
    { reference: authorization.attemptId, extra: true },
    { attemptId: authorization.attemptId },
    {},
    [],
  ];

  for (const body of rejectedBodies) {
    const response = await handleVocabularySpeechRequest(
      speechRequest(body),
      TEST_OWNER_USER_ID,
      async () => {
        throw new Error("synthesis must not run for a rejected reference");
      },
      authorization.findAttempt,
      accessDeps
    );
    assert.equal(response.status, 400, `expected 400 for ${JSON.stringify(body)}`);

    const errorBody = (await response.json()) as { error: string };
    assert.equal(errorBody.error, "Invalid vocabulary speech request.");
    assertNoFixtureWord(JSON.stringify(errorBody));
  }

  const otherUser = await handleVocabularySpeechRequest(
    speechRequest({ reference: authorization.attemptId }),
    "some-other-user",
    async () => {
      throw new Error("synthesis must not run for a non-owning user");
    },
    authorization.findAttempt,
    accessDeps
  );
  assert.equal(otherUser.status, 400);

  const malformed = await handleVocabularySpeechRequest(
    new Request("http://local.test/api/learning/vocabulary/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    }),
    TEST_OWNER_USER_ID,
    async () => {
      throw new Error("synthesis must not run for malformed JSON");
    },
    authorization.findAttempt,
    accessDeps
  );
  assert.equal(malformed.status, 400);

  // Rejected references never create an accepted paid attempt.
  assert.deepEqual(usageStore.getBuckets(), []);
  assert.deepEqual(usageStore.getLeases(), []);
});

test("provider failures return the generic learner-safe TTS errors without the word", async () => {
  const authorization = await createSpellingAuthorization();
  const reference = authorization.attemptId;
  const { accessDeps, usageStore } = entitledAccess();

  const upstream = await handleVocabularySpeechRequest(
    speechRequest({ reference }),
    TEST_OWNER_USER_ID,
    async () => {
      throw new TtsUpstreamError("google", "provider raw failure detail");
    },
    authorization.findAttempt,
    accessDeps
  );
  assert.equal(upstream.status, 502);
  const upstreamBody = (await upstream.json()) as { error: string };
  assert.equal(upstreamBody.error, "The text-to-speech provider is unavailable.");
  assertNoFixtureWord(JSON.stringify(upstreamBody));

  // The failed provider attempt remains counted; provider cost cannot be
  // disproved after dispatch.
  const buckets = usageStore.getBuckets();
  assert.ok(buckets.some((row) => row.failedRequests === 1));

  const configuration = await handleVocabularySpeechRequest(
    speechRequest({ reference }),
    TEST_OWNER_USER_ID,
    async () => {
      throw new TtsConfigurationError("google", "missing credential detail");
    },
    authorization.findAttempt,
    accessDeps
  );
  assert.equal(configuration.status, 500);
  const configurationBody = (await configuration.json()) as { error: string };
  assert.equal(
    configurationBody.error,
    "The text-to-speech service is not configured."
  );
  assertNoFixtureWord(JSON.stringify(configurationBody));
});

function speechRequest(body: unknown): Request {
  return new Request("http://local.test/api/learning/vocabulary/speech", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function createSpellingAuthorization(): Promise<{
  findAttempt: (
    userId: string,
    reference: string
  ) => Promise<{ canonicalSpelling: string; speechDefinition: string } | null>;
  attemptId: string;
  canonicalSpelling: string;
  speechDefinition: string;
}> {
  const learningSource = createDefaultFakeVocabularyLearningSource();
  const store = new VocabularyContentCapabilityStore({
    seed: () => 0,
    listSource: createDefaultFakeVocabularyListSource(),
    learningSource,
    runtimeStore: createFakeVocabularyRuntimeStore(),
  });
  const api: VocabularyModuleApi = {
    async loadContent<Request extends VocabularyContentRequest>(request: Request) {
      const response = await handleVocabularyContentRequest(
        new Request("http://local.test/api/learning/vocabulary/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(request),
        }),
        TEST_OWNER_USER_ID,
        store
      );
      assert.equal(response.status, 200);
      return (await response.json()) as VocabularyContentResponseFor<Request>;
    },
    async submitAnswer(submission) {
      const result = await store.resolveAnswer(TEST_OWNER_USER_ID, submission);
      assert.ok(result);
      return result;
    },
  };
  const vocabulary = new Vocabulary([TEST_LEARNING_ID], () => 0, api);
  await vocabulary.initialize();

  for (let guard = 0; guard < 200; guard += 1) {
    const screen = await vocabulary.next();
    assert.ok(screen);
    if (screen.windowName === "spelling") {
      const attemptId = String(screen.props.attemptId);
      const attempt = await learningSource.findSpellingAttemptForSpeech(
        TEST_OWNER_USER_ID,
        attemptId
      );
      assert.ok(attempt?.canonicalSpelling && attempt.speechDefinition);
      return {
        findAttempt: learningSource.findSpellingAttemptForSpeech,
        attemptId,
        canonicalSpelling: attempt.canonicalSpelling,
        speechDefinition: attempt.speechDefinition,
      };
    }
    if (screen.windowName === "multiple-choice") {
      const choices = screen.props.choices as [
        { id: string; text: string },
        { id: string; text: string },
        { id: string; text: string },
        { id: string; text: string },
      ];
      const attemptId = String(screen.props.attemptId);
      await vocabulary.submitAnswer({
        attemptId,
        selectedChoiceId: getServerCorrectChoiceId({
          contentType: "definition-practice",
          nextCapability: "unused",
          attemptId,
          question: String(screen.props.question),
          choices,
        }),
      });
    }
  }
  assert.fail("Vocabulary lesson did not reach spelling practice.");
}

function assertNoFixtureWord(serialized: string): void {
  const normalized = serialized.toLocaleLowerCase("en-US");
  for (const seed of TEST_WORD_SEEDS) {
    assert.ok(
      !normalized.includes(seed.word.toLocaleLowerCase("en-US")),
      `browser-visible speech response leaks "${seed.word}"`
    );
  }
}
