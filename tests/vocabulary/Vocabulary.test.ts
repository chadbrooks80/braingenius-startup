import assert from "node:assert/strict";
import test from "node:test";
import Vocabulary, {
  type VocabularyModuleApi,
} from "../../src/learning-modules/vocabulary/index";
import type { ScreenRequest } from "../../src/types/learning";
import type { VocabularyContentRequest } from "../../src/learning-modules/vocabulary/data/vocabularyContentTypes";
import { getWordList } from "../../src/learning-modules/vocabulary/data/getWordList";
import {
  createInProcessVocabularyApi,
  getServerCorrectChoiceId,
  getServerSpellingAnswer,
} from "./testVocabularyApi";

test("real browser request bodies use only screen-specific capabilities for every content projection", async () => {
  const requests: VocabularyContentRequest[] = [];
  const baseApi = createInProcessVocabularyApi();
  const api: VocabularyModuleApi = {
    ...baseApi,
    async loadContent<Request extends VocabularyContentRequest>(request: Request) {
      requests.push(structuredClone(request));
      return baseApi.loadContent(request);
    },
  };
  const vocabulary = new Vocabulary(["word_list_id"], () => 0, api);
  await vocabulary.initialize();

  for (let guard = 0; guard < 500; guard += 1) {
    const screen = await requireScreen(vocabulary.next());
    if (screen.windowName === "multiple-choice") {
      const choices = screen.props.choices as Array<{ id: string; text: string }>;
      const attemptId = String(screen.props.attemptId);
      await vocabulary.submitAnswer({
        attemptId,
        selectedChoiceId: getServerCorrectChoiceId({
          contentType: "definition-practice",
          nextCapability: "00000000-0000-4000-8000-000000000001",
          attemptId,
          question: String(screen.props.question),
          choices: choices as [
            { id: string; text: string },
            { id: string; text: string },
            { id: string; text: string },
            { id: string; text: string },
          ],
        }),
      });
    } else if (screen.windowName === "spelling") {
      const attemptId = String(screen.props.attemptId);
      await vocabulary.submitAnswer({
        attemptId,
        answer: getServerSpellingAnswer({
          contentType: "spelling-practice",
          nextCapability: "00000000-0000-4000-8000-000000000001",
          attemptId,
          definition: String(screen.props.promptText),
        }),
      });
    }

    if (
      new Set(requests.map((request) => request.contentType)).size === 6
    ) {
      break;
    }
  }

  assert.deepEqual(requests[0], {
    contentType: "manifest",
    wordListId: "word_list_id",
  });
  const screenRequests = requests.filter(
    (request): request is Exclude<VocabularyContentRequest, { contentType: "manifest" }> =>
      request.contentType !== "manifest"
  );
  assert.deepEqual(
    new Set(screenRequests.map((request) => request.contentType)),
    new Set([
      "definition-display",
      "definition-fun-fact",
      "definition-practice",
      "spelling-practice",
      "answer-recap",
    ])
  );

  const capabilityTypes = new Map<string, string>();
  for (const request of screenRequests) {
    assert.deepEqual(
      Object.keys(request).sort(),
      request.contentType === "answer-recap"
        ? ["capability", "contentType", "exampleIndex", "lessonId"]
        : ["capability", "contentType", "lessonId"]
    );
    assert.equal("wordId" in request, false);
    assert.equal("wordListId" in request, false);
    assert.match(request.lessonId, /^[0-9a-f-]{36}$/i);
    assert.match(request.capability, /^[0-9a-f-]{36}$/i);
    const previousType = capabilityTypes.get(request.capability);
    assert.ok(
      previousType === undefined || previousType === request.contentType,
      "a browser capability crossed content projections"
    );
    capabilityTypes.set(request.capability, request.contentType);
  }

  const serializedRequests = JSON.stringify(requests).toLocaleLowerCase("en-US");
  for (const word of getWordList("word_list_id")!) {
    assert.ok(!serializedRequests.includes(word.word.toLocaleLowerCase("en-US")));
  }
});

test("routes the first five words through both introduction windows before practice", async () => {
  const vocabulary = new Vocabulary(
    ["word_list_id"],
    () => 0,
    createInProcessVocabularyApi()
  );
  await vocabulary.initialize();

  for (let index = 0; index < 5; index += 1) {
    const display = await requireScreen(vocabulary.next());
    assert.equal(display.windowName, "definition-display");
    assert.equal(typeof display.props.title, "string");
    assert.deepEqual(
      Object.keys(display.props).sort(),
      [
        "eyebrow",
        "primaryLabel",
        "primaryText",
        "replayLabel",
        "replayText",
        "secondaryItems",
        "secondaryLabel",
        "title",
        "tts",
      ].sort()
    );

    const fact = await requireScreen(vocabulary.next());
    assert.equal(fact.windowName, "definition-fun-fact");
    assert.equal(typeof fact.props.body, "string");
  }

  assert.equal(
    (await requireScreen(vocabulary.next())).windowName,
    "multiple-choice"
  );
});

test("network failure preserves the active attempt for a safe retry", async () => {
  let offline = true;
  const baseApi = createInProcessVocabularyApi();
  const api: VocabularyModuleApi = {
    ...baseApi,
    async submitAnswer(submission) {
      if (offline) {
        throw new Error("offline");
      }
      return baseApi.submitAnswer(submission);
    },
  };
  const vocabulary = new Vocabulary(["word_list_id"], () => 0, api);
  await vocabulary.initialize();

  for (let index = 0; index < 10; index += 1) {
    await vocabulary.next();
  }
  const practice = await requireScreen(vocabulary.next());
  const attemptId = String(practice.props.attemptId);
  const choices = practice.props.choices as Array<{ id: string; text: string }>;
  const correctChoiceId = getServerCorrectChoiceId({
    contentType: "definition-practice",
    nextCapability: String(practice.props.nextCapability ?? "unused"),
    attemptId,
    question: String(practice.props.question),
    choices: choices as [
      { id: string; text: string },
      { id: string; text: string },
      { id: string; text: string },
      { id: string; text: string },
    ],
  });

  await assert.rejects(
    vocabulary.submitAnswer({
      attemptId,
      selectedChoiceId: correctChoiceId,
    }),
    /offline/
  );
  await assert.rejects(vocabulary.next(), /Cannot advance before/);

  offline = false;

  assert.deepEqual(
    await vocabulary.submitAnswer({
      attemptId,
      selectedChoiceId: correctChoiceId,
    }),
    { correctChoiceId }
  );
  assert.equal(
    (await requireScreen(vocabulary.next())).windowName,
    "answer-recap"
  );
});

test("duplicate next actions and answer submissions cannot create duplicate progress", async () => {
  let submitCalls = 0;
  let releaseSubmission!: () => void;
  const submissionBlocked = new Promise<void>((resolve) => {
    releaseSubmission = resolve;
  });
  const baseApi = createInProcessVocabularyApi();
  const api: VocabularyModuleApi = {
    ...baseApi,
    async submitAnswer(submission) {
      submitCalls += 1;
      await submissionBlocked;
      return baseApi.submitAnswer(submission);
    },
  };
  const vocabulary = new Vocabulary(["word_list_id"], () => 0, api);
  await vocabulary.initialize();

  const [firstDisplay, duplicateDisplay] = await Promise.all([
    vocabulary.next(),
    vocabulary.next(),
  ]);
  assert.equal(firstDisplay?.windowName, "definition-display");
  assert.equal(duplicateDisplay, undefined);
  assert.equal(
    (await requireScreen(vocabulary.next())).windowName,
    "definition-fun-fact"
  );

  for (let index = 0; index < 8; index += 1) {
    await vocabulary.next();
  }
  const practice = await requireScreen(vocabulary.next());
  const attemptId = String(practice.props.attemptId);
  const choices = practice.props.choices as Array<{ id: string }>;
  const firstSubmission = vocabulary.submitAnswer({
    attemptId,
    selectedChoiceId: choices[0].id,
  });

  await assert.rejects(
    vocabulary.submitAnswer({
      attemptId,
      selectedChoiceId: choices[0].id,
    }),
    /already has an answer pending/
  );
  assert.equal(submitCalls, 1);

  releaseSubmission();
  await firstSubmission;
  assert.equal(submitCalls, 1);
});

async function requireScreen(
  result: ScreenRequest | void | Promise<ScreenRequest | void>
): Promise<ScreenRequest> {
  const screen = await result;
  if (!screen) {
    throw new Error("Expected a screen request.");
  }
  return screen;
}
