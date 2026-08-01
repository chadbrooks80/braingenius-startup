import assert from "node:assert/strict";
import test from "node:test";
import Vocabulary, {
  type VocabularyModuleApi,
} from "../../src/learning-modules/vocabulary/index";
import type {
  VocabularyContentRequest,
  VocabularyContentResponseFor,
  VocabularyLessonManifest,
} from "../../src/learning-modules/vocabulary/data/vocabularyContentTypes";
import { handleVocabularyContentRequest } from "../../src/learning-modules/vocabulary/server/handleVocabularyContentRequest";
import { VocabularyContentCapabilityStore } from "../../src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
import type {
  VocabularyAnswerApiResult,
  VocabularyAnswerSubmission,
} from "../../src/learning-modules/vocabulary/types";
import {
  getServerCorrectChoiceId,
  getServerSpellingAnswer,
  TEST_LEARNING_ID,
  createDefaultFakeVocabularyLearningSource,
} from "../vocabulary/testVocabularyApi";
import {
  createDefaultFakeVocabularyListSource,
  OTHER_USER_ID,
  TEST_OWNER_USER_ID,
  TEST_WORD_SEEDS,
} from "../vocabulary/fakeVocabularyListStore";
import { createFakeVocabularyRuntimeStore } from "../vocabulary/fakeVocabularyRuntimeStore";

function createStore(
  options: Partial<ConstructorParameters<typeof VocabularyContentCapabilityStore>[0]> = {}
): VocabularyContentCapabilityStore {
  return new VocabularyContentCapabilityStore({
    listSource: createDefaultFakeVocabularyListSource(),
    learningSource: createDefaultFakeVocabularyLearningSource(),
    runtimeStore: createFakeVocabularyRuntimeStore(),
    ...options,
  });
}

test("returns an opaque single-step lesson chain and narrow projections", async () => {
  const client = createContentClient();
  const manifestResult = await client.post({
    contentType: "manifest",
    learningId: TEST_LEARNING_ID,
  });
  assert.equal(manifestResult.response.status, 200);
  assert.deepEqual(Object.keys(manifestResult.body).sort(), [
    "checkpointEligibleWordIdOrder",
    "contentType",
    "hydratedProgressByWordId",
    "lessonId",
    "nextCapability",
    "progress",
    "randomSeed",
    "servedCheckpointGroupCount",
    "totalWordCount",
    "words",
  ]);

  const lesson = manifestResult.body as VocabularyLessonManifest;
  assert.equal(lesson.totalWordCount, TEST_WORD_SEEDS.length);
  assert.equal(lesson.words.length, 5);
  assert.equal(new Set(lesson.words.map((word) => word.id)).size, 5);
  assert.ok(lesson.words.every((word) => Object.keys(word).length === 1));
  assert.ok(isOpaqueIdentifier(lesson.nextCapability));

  const display = await client.post({
    contentType: "definition-display",
    lessonId: lesson.lessonId,
    capability: lesson.nextCapability,
  });
  assert.equal(display.response.status, 200);
  assert.deepEqual(Object.keys(display.body).sort(), [
    "contentType",
    "definition",
    "exampleSentences",
    "nextCapability",
    "word",
  ]);
  assert.equal("wordId" in display.body, false);
  assert.equal(display.response.headers.get("cache-control"), "no-store");
});

test("a spelling capability cannot cross projection, screen, attempt, lesson, or learner boundaries", async () => {
  const store = createStore({ seed: () => 0 });
  const learner = createContentClient(store, TEST_OWNER_USER_ID);
  const requests: VocabularyContentRequest[] = [];
  const vocabulary = new Vocabulary(
    [TEST_LEARNING_ID],
    () => 0,
    createModuleApi(learner, requests)
  );
  await vocabulary.initialize();
  const spellingScreen = await advanceToSpelling(vocabulary);
  const spellingRequest = requests.findLast(
    (request) => request.contentType === "spelling-practice"
  );
  assert.ok(spellingRequest?.contentType === "spelling-practice");
  assert.deepEqual(Object.keys(spellingRequest).sort(), [
    "capability",
    "contentType",
    "lessonId",
  ]);
  assert.equal("wordId" in spellingRequest, false);

  for (const contentType of [
    "definition-display",
    "definition-fun-fact",
    "definition-practice",
  ] as const) {
    const result = await learner.post({ ...spellingRequest, contentType });
    assert.equal(result.response.status, 400, contentType);
  }
  const recap = await learner.post({
    ...spellingRequest,
    contentType: "answer-recap",
    exampleIndex: 0,
  });
  assert.equal(recap.response.status, 400);

  const otherLearnerStore = createStore({
    seed: () => 0,
    learningSource: createDefaultFakeVocabularyLearningSource(OTHER_USER_ID),
  });
  const otherLearner = createContentClient(otherLearnerStore, OTHER_USER_ID);
  assert.equal((await otherLearner.post(spellingRequest)).response.status, 400);

  const retry = await learner.post(spellingRequest);
  assert.equal(retry.response.status, 200);
  assert.equal(retry.body.attemptId, spellingScreen.props.attemptId);
  const successor = String(retry.body.nextCapability);
  assert.equal(
    (
      await learner.post({
        ...spellingRequest,
        capability: successor,
      })
    ).response.status,
    400,
    "an ungraded attempt cannot be skipped"
  );

  const spellingWindowPayload = {
    attemptId: String(spellingScreen.props.attemptId),
    answer: getServerSpellingAnswer({
      contentType: "spelling-practice",
      nextCapability: successor,
      attemptId: String(spellingScreen.props.attemptId),
      definition: String(spellingScreen.props.promptText),
    }),
  } as const;
  const firstResult = await vocabulary.submitAnswer(spellingWindowPayload);
  const spellingSubmission = {
    answerType: "spelling" as const,
    ...spellingWindowPayload,
  };
  assert.deepEqual(firstResult, { correct: true });
  const secondResult = await learner.answer(spellingSubmission);
  assert.equal(secondResult.answerType, "spelling");
  assert.equal((secondResult as { correct: boolean }).correct, true);

  assert.equal(
    await store.resolveAnswer(TEST_OWNER_USER_ID, {
      ...spellingSubmission,
      answer: "different",
    }),
    null,
    "a modified duplicate submission is rejected"
  );
  assert.equal((await vocabulary.next())?.windowName, "answer-recap");
  assert.equal((await learner.post(spellingRequest)).response.status, 400);

  const browserVisible = JSON.stringify({
    requests,
    spellingResponse: retry.body,
  }).toLocaleLowerCase("en-US");
  for (const seed of TEST_WORD_SEEDS) {
    assert.ok(
      !browserVisible.includes(seed.word.toLocaleLowerCase("en-US")),
      `browser-visible capability data leaks ${seed.word}`
    );
  }
});

test("expires lesson capabilities and attempts", async () => {
  let now = 10_000;
  const store = createStore({
    now: () => now,
    lifetimeMs: 100,
    seed: () => 0,
  });
  const client = createContentClient(store, TEST_OWNER_USER_ID);
  const manifest = await manifestFor(client);
  now += 101;
  assert.equal(
    (
      await client.post({
        contentType: "definition-display",
        lessonId: manifest.lessonId,
        capability: manifest.nextCapability,
      })
    ).response.status,
    400
  );
});

test("strictly rejects malformed, unknown, and legacy reusable-handle requests", async () => {
  const client = createContentClient();
  const manifest = await manifestFor(client);

  for (const body of [
    { contentType: "manifest", learningId: TEST_LEARNING_ID, extra: true },
    { contentType: "definition-display", lessonId: manifest.lessonId },
    {
      contentType: "definition-practice",
      learningId: TEST_LEARNING_ID,
      wordId: "word-01",
    },
    {
      contentType: "answer-recap",
      lessonId: manifest.lessonId,
      capability: manifest.nextCapability,
      exampleIndex: 3,
    },
    {
      contentType: "spelling-practice",
      lessonId: manifest.lessonId,
      capability: manifest.nextCapability,
      wordId: "word-01",
    },
  ]) {
    const { response } = await client.post(body);
    assert.equal(response.status, 400, JSON.stringify(body));
  }
});

test("returns 404 for an unknown learning", async () => {
  const client = createContentClient();
  assert.equal(
    (
      await client.post({
        contentType: "manifest",
        learningId: "missing",
      })
    ).response.status,
    404
  );
});

type ContentClient = ReturnType<typeof createContentClient>;

function createContentClient(
  store = createStore(),
  userId: string = TEST_OWNER_USER_ID
) {
  return {
    store,
    userId,
    async post(body: unknown): Promise<{
      response: Response;
      body: Record<string, unknown>;
    }> {
      const response = await handleVocabularyContentRequest(
        new Request("http://local.test/api/learning/vocabulary/content", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }),
        userId,
        store
      );
      return {
        response,
        body: (await response.json()) as Record<string, unknown>,
      };
    },
    async answer(
      submission: VocabularyAnswerSubmission
    ): Promise<VocabularyAnswerApiResult> {
      const result = await store.resolveAnswer(userId, submission);
      assert.ok(result);
      return result;
    },
  };
}

function createModuleApi(
  client: ContentClient,
  requests: VocabularyContentRequest[]
): VocabularyModuleApi {
  return {
    async loadContent<Request extends VocabularyContentRequest>(request: Request) {
      requests.push(structuredClone(request));
      const result = await client.post(request);
      if (result.response.status === 404) return null;
      assert.equal(result.response.status, 200, JSON.stringify(result.body));
      return result.body as VocabularyContentResponseFor<Request>;
    },
    async submitAnswer(submission) {
      return client.answer(submission);
    },
  };
}

async function advanceToSpelling(vocabulary: Vocabulary) {
  for (let guard = 0; guard < 200; guard += 1) {
    const screen = await vocabulary.next();
    assert.ok(screen);
    if (screen.windowName === "spelling") return screen;
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

async function manifestFor(client: ContentClient): Promise<VocabularyLessonManifest> {
  const result = await client.post({
    contentType: "manifest",
    learningId: TEST_LEARNING_ID,
  });
  assert.equal(result.response.status, 200);
  return result.body as VocabularyLessonManifest;
}

function isOpaqueIdentifier(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
