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
import { getWordList } from "../../src/learning-modules/vocabulary/data/getWordList";
import { getVocabularyAnswerForAttempt } from "../../src/learning-modules/vocabulary/data/getCorrectAnswer";
import type {
  VocabularyContentRequest,
  VocabularyContentResponseFor,
} from "../../src/learning-modules/vocabulary/data/vocabularyContentTypes";
import { vocabularyTts } from "../../src/learning-modules/vocabulary/data/vocabularyTts";
import { handleVocabularySpeechRequest } from "../../src/learning-modules/vocabulary/server/handleVocabularySpeechRequest";
import { handleVocabularyContentRequest } from "../../src/learning-modules/vocabulary/server/handleVocabularyContentRequest";
import { VocabularyContentCapabilityStore } from "../../src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
import { VOCABULARY_LEARNER_COOKIE } from "../../src/learning-modules/vocabulary/server/vocabularyLearnerSession";
import {
  getServerCorrectChoiceId,
} from "../vocabulary/testVocabularyApi";

const WORDS = getWordList("word_list_id")!;
const FAKE_AUDIO = new Uint8Array([1, 2, 3, 4]);

test("resolves an opaque spelling reference to audio without exposing the word", async () => {
  const authorization = await createSpellingAuthorization();
  const word = WORDS.find((candidate) => candidate.id === authorization.wordId)!;
  const synthesized: TtsSynthesisRequest[] = [];

  const response = await handleVocabularySpeechRequest(
    speechRequest(
      { reference: authorization.attemptId },
      authorization.learnerId
    ),
    async (request) => {
      synthesized.push(request);
      return { bytes: FAKE_AUDIO, contentType: "audio/mpeg" };
    },
    authorization.store
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "audio/mpeg");
  assert.equal(response.headers.get("cache-control"), "no-store");

  // The canonical word reaches only the server-side TTS synthesis request.
  assert.equal(synthesized.length, 1);
  assert.match(synthesized[0].text, new RegExp(`Spell the word: ${word.word}`));
  assert.match(synthesized[0].text, new RegExp(word.definition));
  assert.deepEqual(synthesized[0].tts, vocabularyTts);

  // The browser-visible response carries opaque audio bytes and headers only.
  const body = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual(body, FAKE_AUDIO);
  for (const [name, value] of response.headers.entries()) {
    assert.ok(
      !`${name} ${value}`.toLocaleLowerCase("en-US").includes(word.word),
      `header ${name} leaks the word`
    );
  }
});

test("rejects invalid, mismatched, and unsupported speech references with one generic error", async () => {
  const authorization = await createSpellingAuthorization();
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
      speechRequest(body, authorization.learnerId),
      async () => {
        throw new Error("synthesis must not run for a rejected reference");
      },
      authorization.store
    );
    assert.equal(response.status, 400, `expected 400 for ${JSON.stringify(body)}`);

    const errorBody = (await response.json()) as { error: string };
    assert.equal(errorBody.error, "Invalid vocabulary speech request.");
    assertNoFixtureWord(JSON.stringify(errorBody));
  }

  const otherLearner = await handleVocabularySpeechRequest(
    speechRequest(
      { reference: authorization.attemptId },
      "00000000-0000-4000-8000-000000000099"
    ),
    async () => {
      throw new Error("synthesis must not run for another learner");
    },
    authorization.store
  );
  assert.equal(otherLearner.status, 400);

  const malformed = await handleVocabularySpeechRequest(
    new Request("http://local.test/api/learning/vocabulary/speech", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    }),
    async () => {
      throw new Error("synthesis must not run for malformed JSON");
    }
  );
  assert.equal(malformed.status, 400);
});

test("provider failures return the generic learner-safe TTS errors without the word", async () => {
  const authorization = await createSpellingAuthorization();
  const reference = authorization.attemptId;

  const upstream = await handleVocabularySpeechRequest(
    speechRequest({ reference }, authorization.learnerId),
    async () => {
      throw new TtsUpstreamError("google", "provider raw failure detail");
    },
    authorization.store
  );
  assert.equal(upstream.status, 502);
  const upstreamBody = (await upstream.json()) as { error: string };
  assert.equal(upstreamBody.error, "The text-to-speech provider is unavailable.");
  assertNoFixtureWord(JSON.stringify(upstreamBody));

  const configuration = await handleVocabularySpeechRequest(
    speechRequest({ reference }, authorization.learnerId),
    async () => {
      throw new TtsConfigurationError("google", "missing credential detail");
    },
    authorization.store
  );
  assert.equal(configuration.status, 500);
  const configurationBody = (await configuration.json()) as { error: string };
  assert.equal(
    configurationBody.error,
    "The text-to-speech service is not configured."
  );
  assertNoFixtureWord(JSON.stringify(configurationBody));
});

function speechRequest(body: unknown, learnerId?: string): Request {
  const headers = new Headers({ "Content-Type": "application/json" });
  if (learnerId) {
    headers.set("Cookie", `${VOCABULARY_LEARNER_COOKIE}=${learnerId}`);
  }
  return new Request("http://local.test/api/learning/vocabulary/speech", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function createSpellingAuthorization(): Promise<{
  store: VocabularyContentCapabilityStore;
  learnerId: string;
  attemptId: string;
  wordId: string;
}> {
  const store = new VocabularyContentCapabilityStore({ seed: () => 0 });
  const learnerId = "00000000-0000-4000-8000-000000000001";
  const api: VocabularyModuleApi = {
    async loadContent<Request extends VocabularyContentRequest>(request: Request) {
      const response = await handleVocabularyContentRequest(
        new Request("http://local.test/api/learning/vocabulary/content", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Cookie: `${VOCABULARY_LEARNER_COOKIE}=${learnerId}`,
          },
          body: JSON.stringify(request),
        }),
        store
      );
      assert.equal(response.status, 200);
      return (await response.json()) as VocabularyContentResponseFor<Request>;
    },
    async submitAnswer(submission) {
      const result = store.resolveAnswer(
        learnerId,
        submission,
        getVocabularyAnswerForAttempt
      );
      assert.ok(result);
      return result;
    },
  };
  const vocabulary = new Vocabulary(["word_list_id"], () => 0, api);
  await vocabulary.initialize();

  for (let guard = 0; guard < 200; guard += 1) {
    const screen = await vocabulary.next();
    assert.ok(screen);
    if (screen.windowName === "spelling") {
      const attemptId = String(screen.props.attemptId);
      const attempt = store.getSpellingAttempt(learnerId, attemptId);
      assert.ok(attempt);
      return { store, learnerId, attemptId, wordId: attempt.wordId };
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
  for (const word of WORDS) {
    assert.ok(
      !normalized.includes(word.word.toLocaleLowerCase("en-US")),
      `browser-visible speech response leaks "${word.word}"`
    );
  }
}
