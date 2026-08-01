import assert from "node:assert/strict";
import test from "node:test";
import Vocabulary, {
  type VocabularyModuleApi,
} from "../../src/learning-modules/vocabulary/index";
import type { ScreenRequest } from "../../src/types/learning";
import type { VocabularyContentRequest } from "../../src/learning-modules/vocabulary/data/vocabularyContentTypes";
import { LearningRouteError } from "../../src/lib/learning-engine/errors/LearningRouteError";
import {
  createInProcessVocabularyApi,
  getServerCorrectChoiceId,
  getServerSpellingAnswer,
  TEST_LEARNING_ID,
} from "./testVocabularyApi";
import { TEST_WORD_SEEDS } from "./fakeVocabularyListStore";

test("constructor rejects a route without a learning ID using the module-owned error", () => {
  assert.throws(
    () => new Vocabulary([]),
    (error: unknown) =>
      matchesVocabularyRouteError(error, {
        kind: "MODULE_RESOURCE_MISSING",
        code: "VOCABULARY_LEARNING_ID_MISSING",
        message: "Vocabulary route omitted the required learning ID.",
      })
  );
});

test("constructor rejects extra route variables using the module-owned error", () => {
  assert.throws(
    () => new Vocabulary(["word_list_id", "unexpected"]),
    (error: unknown) =>
      matchesVocabularyRouteError(error, {
        kind: "INVALID_MODULE_ROUTE",
        code: "VOCABULARY_ROUTE_INVALID",
        message:
          "Vocabulary route contains unexpected extra path segments.",
      })
  );
});

test("initialize rejects an unknown learning using the module-owned error", async () => {
  const baseApi = createInProcessVocabularyApi();
  const api: VocabularyModuleApi = {
    ...baseApi,
    async loadContent() {
      return null;
    },
  };
  const vocabulary = new Vocabulary(["missing-learning-id"], () => 0, api);

  await assert.rejects(
    vocabulary.initialize(),
    (error: unknown) =>
      matchesVocabularyRouteError(error, {
        kind: "MODULE_RESOURCE_NOT_FOUND",
        code: "VOCABULARY_LEARNING_NOT_FOUND",
        message:
          "Vocabulary learning not found or not authorized: missing-learning-id",
      })
  );
});

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
  const vocabulary = new Vocabulary([TEST_LEARNING_ID], () => 0, api);
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

    // Mastering the first word's spelling also triggers exactly one
    // authorized "word-refill" content request, so the target set now
    // covers 7 distinct content types (the 5 screen types, manifest, and
    // word-refill).
    if (
      new Set(requests.map((request) => request.contentType)).size === 7
    ) {
      break;
    }
  }

  assert.deepEqual(requests[0], {
    contentType: "manifest",
    learningId: TEST_LEARNING_ID,
  });
  const refillRequests = requests.filter(
    (request): request is Extract<VocabularyContentRequest, { contentType: "word-refill" }> =>
      request.contentType === "word-refill"
  );
  assert.equal(refillRequests.length, 1);
  assert.deepEqual(Object.keys(refillRequests[0]).sort(), [
    "contentType",
    "lessonId",
  ]);
  assert.match(refillRequests[0].lessonId, /^[0-9a-f-]{36}$/i);

  const screenRequests = requests.filter(
    (
      request
    ): request is Exclude<
      VocabularyContentRequest,
      { contentType: "manifest" | "word-refill" }
    > => request.contentType !== "manifest" && request.contentType !== "word-refill"
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
    assert.equal("learningId" in request, false);
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
  for (const seed of TEST_WORD_SEEDS) {
    assert.ok(!serializedRequests.includes(seed.word.toLocaleLowerCase("en-US")));
  }
});

test("routes the first five words through both introduction windows before practice", async () => {
  const vocabulary = new Vocabulary(
    [TEST_LEARNING_ID],
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

test("reaches an ungraded five-word Word Search checkpoint after five words first master, exposing only display words", async () => {
  const requests: VocabularyContentRequest[] = [];
  const baseApi = createInProcessVocabularyApi();
  const api: VocabularyModuleApi = {
    ...baseApi,
    async loadContent<Request extends VocabularyContentRequest>(request: Request) {
      requests.push(structuredClone(request));
      return baseApi.loadContent(request);
    },
  };
  const vocabulary = new Vocabulary([TEST_LEARNING_ID], () => 0, api);
  await vocabulary.initialize();

  let checkpoint: ScreenRequest | null = null;

  for (let guard = 0; guard < 2_000 && !checkpoint; guard += 1) {
    const screen = await requireScreen(vocabulary.next());
    if (screen.windowName === "word-search") {
      checkpoint = screen;
      break;
    }

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
  }

  assert.ok(checkpoint, "Expected a Word Search checkpoint screen to appear.");
  assert.equal(checkpoint.props.emitCompletionAction, false);
  const gridSize = checkpoint.props.gridSize as number;
  assert.ok(Number.isInteger(gridSize) && gridSize >= 8 && gridSize <= 30);

  const words = checkpoint.props.words as string[];
  assert.equal(words.length, 5);
  assert.equal(new Set(words.map((word) => word.toLocaleUpperCase("en-US"))).size, 5);

  const fixtureWords = new Set(TEST_WORD_SEEDS.map((seed) => seed.word));
  for (const word of words) {
    assert.ok(fixtureWords.has(word));
  }

  const checkpointRequests = requests.filter(
    (request): request is Extract<VocabularyContentRequest, { contentType: "word-search-checkpoint" }> =>
      request.contentType === "word-search-checkpoint"
  );
  assert.ok(checkpointRequests.length > 0);
  for (const request of checkpointRequests) {
    assert.deepEqual(
      Object.keys(request).sort(),
      ["capability", "contentType", "lessonId"]
    );
  }
});

test("repeated checkpoint capability reads and duplicate next handling cannot replay a served group within one attempt", async () => {
  const requests: VocabularyContentRequest[] = [];
  const baseApi = createInProcessVocabularyApi();
  const api: VocabularyModuleApi = {
    ...baseApi,
    async loadContent<Request extends VocabularyContentRequest>(request: Request) {
      requests.push(structuredClone(request));
      return baseApi.loadContent(request);
    },
  };
  const vocabulary = new Vocabulary([TEST_LEARNING_ID], () => 0, api);
  await vocabulary.initialize();

  const checkpoint = await advanceVocabularyToWordSearchCheckpoint(vocabulary);
  const checkpointRequest = requests.findLast(
    (
      request
    ): request is Extract<
      VocabularyContentRequest,
      { contentType: "word-search-checkpoint" }
    > => request.contentType === "word-search-checkpoint"
  );
  assert.ok(checkpointRequest);

  const repeatedRead1 = await api.loadContent(checkpointRequest);
  const repeatedRead2 = await api.loadContent(checkpointRequest);
  assert.deepEqual(repeatedRead2, repeatedRead1);
  assert.deepEqual(repeatedRead1?.words, checkpoint.props.words);

  const [nextScreen, duplicateNext] = await Promise.all([
    vocabulary.next(),
    vocabulary.next(),
  ]);

  assert.ok(nextScreen);
  assert.notEqual(nextScreen.windowName, "word-search");
  assert.equal(duplicateNext, undefined);
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
  const vocabulary = new Vocabulary([TEST_LEARNING_ID], () => 0, api);
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
  const vocabulary = new Vocabulary([TEST_LEARNING_ID], () => 0, api);
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

function matchesVocabularyRouteError(
  error: unknown,
  expected: {
    kind: LearningRouteError["kind"];
    code: string;
    message: string;
  }
): boolean {
  assert.ok(error instanceof LearningRouteError);
  assert.equal(error.source, "module");
  assert.equal(error.kind, expected.kind);
  assert.equal(error.code, expected.code);
  assert.equal(error.message, expected.message);
  return true;
}

async function advanceVocabularyToWordSearchCheckpoint(
  vocabulary: Vocabulary
): Promise<ScreenRequest> {
  for (let guard = 0; guard < 2_000; guard += 1) {
    const screen = await requireScreen(vocabulary.next());
    if (screen.windowName === "word-search") {
      return screen;
    }

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
      continue;
    }

    if (screen.windowName === "spelling") {
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
  }

  throw new Error("Vocabulary checkpoint did not appear within the guard.");
}
