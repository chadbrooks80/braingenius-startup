import assert from "node:assert/strict";
import test from "node:test";
import Vocabulary, {
  type VocabularyModuleApi,
} from "../../src/learning-modules/vocabulary/index";
import { getVocabularyAnswerForAttempt } from "../../src/learning-modules/vocabulary/data/getCorrectAnswer";
import type {
  VocabularyContentRequest,
  VocabularyContentResponseFor,
  VocabularyLessonManifest,
} from "../../src/learning-modules/vocabulary/data/vocabularyContentTypes";
import { getWordList } from "../../src/learning-modules/vocabulary/data/getWordList";
import { handleVocabularyContentRequest } from "../../src/learning-modules/vocabulary/server/handleVocabularyContentRequest";
import { VocabularyContentCapabilityStore } from "../../src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
import { VOCABULARY_LEARNER_COOKIE } from "../../src/learning-modules/vocabulary/server/vocabularyLearnerSession";
import type {
  VocabularyAnswerResult,
  VocabularyAnswerSubmission,
} from "../../src/learning-modules/vocabulary/types";
import {
  getServerCorrectChoiceId,
  getServerSpellingAnswer,
} from "../vocabulary/testVocabularyApi";

const LEARNER_ID = "00000000-0000-4000-8000-000000000001";
const OTHER_LEARNER_ID = "00000000-0000-4000-8000-000000000099";

test("returns an opaque single-step lesson chain and narrow projections", async () => {
  const client = createContentClient();
  const manifestResult = await client.post({
    contentType: "manifest",
    wordListId: "word_list_id",
  });
  assert.equal(manifestResult.response.status, 200);
  assert.deepEqual(Object.keys(manifestResult.body).sort(), [
    "contentType",
    "lessonId",
    "nextCapability",
    "randomSeed",
    "words",
  ]);
  assert.match(manifestResult.response.headers.get("set-cookie") ?? "", /HttpOnly/);

  const lesson = manifestResult.body as VocabularyLessonManifest;
  assert.equal(lesson.words.length, 20);
  assert.equal(new Set(lesson.words.map((word) => word.id)).size, 20);
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

test("a spelling capability cannot cross projection, screen, attempt, lesson, learner, or lifecycle boundaries", async () => {
  const store = new VocabularyContentCapabilityStore({ seed: () => 0 });
  const learner = createContentClient(store, LEARNER_ID);
  const requests: VocabularyContentRequest[] = [];
  const vocabulary = new Vocabulary(
    ["word_list_id"],
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

  const secondLesson = await manifestFor(learner);
  assert.equal(
    (
      await learner.post({
        ...spellingRequest,
        lessonId: secondLesson.lessonId,
      })
    ).response.status,
    400
  );
  const otherLearner = createContentClient(store, OTHER_LEARNER_ID);
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
  assert.deepEqual(learner.answer(spellingSubmission), {
    answerType: "spelling",
    correct: true,
  });
  assert.equal(
    store.resolveAnswer(
      LEARNER_ID,
      { ...spellingSubmission, answer: "different" },
      getVocabularyAnswerForAttempt
    ),
    null
  );
  assert.equal(
    store.getSpellingAttempt(LEARNER_ID, spellingSubmission.attemptId),
    null,
    "speech references become stale as soon as grading completes"
  );
  assert.equal((await vocabulary.next())?.windowName, "answer-recap");
  assert.equal((await learner.post(spellingRequest)).response.status, 400);
  assert.equal(
    store.resolveAnswer(
      LEARNER_ID,
      spellingSubmission,
      getVocabularyAnswerForAttempt
    ),
    null,
    "the bounded answer retry closes when the recap capability is consumed"
  );

  const browserVisible = JSON.stringify({
    requests,
    spellingResponse: retry.body,
  }).toLocaleLowerCase("en-US");
  for (const word of getWordList("word_list_id")!) {
    assert.ok(
      !browserVisible.includes(word.word.toLocaleLowerCase("en-US")),
      `browser-visible capability data leaks ${word.word}`
    );
  }
});

test("expires lesson capabilities and attempts", async () => {
  let now = 10_000;
  const store = new VocabularyContentCapabilityStore({
    now: () => now,
    lifetimeMs: 100,
    seed: () => 0,
  });
  const client = createContentClient(store, LEARNER_ID);
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
    { contentType: "manifest", wordListId: "word_list_id", extra: true },
    { contentType: "definition-display", lessonId: manifest.lessonId },
    {
      contentType: "definition-practice",
      wordListId: "word_list_id",
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

test("returns 404 for an unknown list", async () => {
  const client = createContentClient();
  assert.equal(
    (
      await client.post({
        contentType: "manifest",
        wordListId: "missing",
      })
    ).response.status,
    404
  );
});

type ContentClient = ReturnType<typeof createContentClient>;

function createContentClient(
  store = new VocabularyContentCapabilityStore(),
  learnerId?: string
) {
  let cookie: string | null = learnerId
    ? `${VOCABULARY_LEARNER_COOKIE}=${learnerId}`
    : null;

  return {
    store,
    learnerId,
    async post(body: unknown): Promise<{
      response: Response;
      body: Record<string, unknown>;
    }> {
      const headers = new Headers({ "Content-Type": "application/json" });
      if (cookie) headers.set("Cookie", cookie);
      const response = await handleVocabularyContentRequest(
        new Request("http://local.test/api/learning/vocabulary/content", {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        }),
        store
      );
      cookie = response.headers.get("set-cookie")?.split(";", 1)[0] ?? cookie;
      return {
        response,
        body: (await response.json()) as Record<string, unknown>,
      };
    },
    answer(submission: VocabularyAnswerSubmission): VocabularyAnswerResult {
      assert.ok(learnerId);
      const result = store.resolveAnswer(
        learnerId,
        submission,
        getVocabularyAnswerForAttempt
      );
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
    wordListId: "word_list_id",
  });
  assert.equal(result.response.status, 200);
  return result.body as VocabularyLessonManifest;
}

function isOpaqueIdentifier(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
