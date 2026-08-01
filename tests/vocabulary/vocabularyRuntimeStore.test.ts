import assert from "node:assert/strict";
import test from "node:test";
import { resolveLearningWindow } from "../../src/lib/learning-engine/LearningWindowRegistry";
import { createLearningEngineActionHandlers } from "../../src/lib/learning-engine/actions/createLearningEngineActionHandlers";
import { changeLearningEngineScreen } from "../../src/lib/learning-engine/screens/changeLearningEngineScreen";
import Vocabulary, { type VocabularyModuleApi } from "../../src/learning-modules/vocabulary/index";
import { handleVocabularyContentRequest } from "../../src/learning-modules/vocabulary/server/handleVocabularyContentRequest";
import { handleVocabularyAnswerRequest } from "../../src/app/api/learning/vocabulary/submit-answer/handleVocabularyAnswerRequest";
import { VocabularyContentCapabilityStore } from "../../src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
import { VocabularyLessonState } from "../../src/learning-modules/vocabulary/state/VocabularyLessonState";
import type {
  ActionPayload,
  ActiveModule,
  ActiveScreen,
  AnswerFeedback,
  LearningEngineStateSetters,
  ScreenRequest,
} from "../../src/types/learning";
import type {
  VocabularyContentRequest,
  VocabularyContentResponseFor,
} from "../../src/learning-modules/vocabulary/data/vocabularyContentTypes";
import type {
  VocabularyAnswerApiResult,
  VocabularyAnswerSubmission,
} from "../../src/learning-modules/vocabulary/types";
import {
  createFakeVocabularyList,
  createFakeVocabularyListSource,
  TEST_LIST_ID,
  TEST_OWNER_USER_ID,
  TEST_WORD_SEEDS,
  OTHER_USER_ID,
} from "./fakeVocabularyListStore";
import {
  getServerCorrectChoiceId,
  getServerSpellingAnswer,
  TEST_LEARNING_ID,
} from "./testVocabularyApi";
import { createFakeVocabularyLearningSource } from "./fakeVocabularyLearningStore";
import {
  createFakeVocabularyRuntimeStore,
  type FakeVocabularyRuntimeStore,
} from "./fakeVocabularyRuntimeStore";

// This suite proves the database-backed runtime replacement for
// `VocabularyContentCapabilityStore`'s former in-memory Maps: every test
// here would fail against the pre-persistence implementation because it
// either constructs more than one `VocabularyContentCapabilityStore`
// instance sharing one repository, or relies on server-authoritative state
// surviving across separately constructed instances.

function deterministicRandom(seed = 42): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}

// Builds a `VocabularyModuleApi` that constructs a brand-new
// `VocabularyContentCapabilityStore` for every single content/answer
// request instead of reusing one instance, so a full lesson driven through
// it can only succeed if every request reconstructs its state solely from
// the shared runtime repository.
function createReconstructingVocabularyApi(
  userId: string,
  storeFactory: () => VocabularyContentCapabilityStore
): VocabularyModuleApi {
  return {
    async loadContent<Request extends VocabularyContentRequest>(
      request: Request
    ): Promise<VocabularyContentResponseFor<Request> | null> {
      const response = await handleVocabularyContentRequest(
        jsonRequest("http://local.test/api/learning/vocabulary/content", request),
        userId,
        storeFactory()
      );
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Content handler failed with status ${response.status}.`);
      }
      return (await response.json()) as VocabularyContentResponseFor<Request>;
    },
    async submitAnswer(submission: VocabularyAnswerSubmission): Promise<VocabularyAnswerApiResult> {
      const response = await handleVocabularyAnswerRequest(
        jsonRequest("http://local.test/api/learning/vocabulary/submit-answer", submission),
        (parsedSubmission) => storeFactory().resolveAnswer(userId, parsedSubmission)
      );
      if (!response.ok) {
        throw new Error(`Answer handler failed with status ${response.status}.`);
      }
      return (await response.json()) as VocabularyAnswerApiResult;
    },
  };
}

function jsonRequest(url: string, body: unknown): Request {
  return new Request(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createEngineHarness(module: ActiveModule): {
  readonly currentScreenRequest: ScreenRequest;
  readonly answerFeedback: AnswerFeedback | null;
  showStartup(): void;
  next(): Promise<ScreenRequest>;
  submitAnswer(payload: ActionPayload): Promise<AnswerFeedback>;
} {
  let currentScreenRequest: ScreenRequest | null = null;
  let activeScreen: ActiveScreen | null = null;
  let answerFeedback: AnswerFeedback | null = null;
  const setters: LearningEngineStateSetters = {
    setActiveScreen: (screen) => {
      activeScreen = screen;
    },
    setShowHeader: () => {},
    setModuleLayout: () => {},
    setAnswerFeedback: (feedback) => {
      answerFeedback = feedback;
    },
    setIsSpeaking: () => {},
    setSpeechFailureNotice: () => {},
  };
  const handlers = createLearningEngineActionHandlers({
    getActiveModule: () => module,
    getLearningEngineStateSetters: () => setters,
  });

  const dispatch = async (actionId: string, payload: ActionPayload = {}): Promise<void> => {
    const request = await handlers[actionId](payload);
    if (request) {
      currentScreenRequest = request;
      changeLearningEngineScreen(request, setters, dispatch);
      assert.ok(activeScreen);
    }
  };

  return {
    get currentScreenRequest() {
      if (!currentScreenRequest) {
        throw new Error("No screen request has been applied.");
      }
      return currentScreenRequest;
    },
    get answerFeedback() {
      return answerFeedback;
    },
    showStartup() {
      currentScreenRequest = { windowName: "startup", props: module.getStartupProps() };
      changeLearningEngineScreen(currentScreenRequest, setters, dispatch);
      assert.ok(activeScreen);
    },
    async next() {
      await dispatch("next");
      return this.currentScreenRequest;
    },
    async submitAnswer(payload) {
      await dispatch("submitAnswer", payload);
      if (!answerFeedback) {
        throw new Error("Expected engine-owned answer feedback.");
      }
      return answerFeedback;
    },
  };
}

// Drives one complete Vocabulary lesson through the real module and engine
// action handlers, always answering correctly, and returns a compact trace
// of every screen shown (window name plus its identifying content) so two
// independently driven lessons can be compared for exact equality.
async function driveFullLesson(api: VocabularyModuleApi): Promise<string[]> {
  const trace: string[] = [];
  const vocabulary = new Vocabulary([TEST_LEARNING_ID], deterministicRandom(), api);
  await vocabulary.initialize();
  const engine = createEngineHarness(vocabulary);
  engine.showStartup();
  let current = await engine.next();

  for (let guard = 0; guard < 10_000; guard += 1) {
    resolveLearningWindow(current.windowName);

    if (current.windowName === "lesson-complete") {
      const stats = current.props.stats as Array<{ label: string; value: number }>;
      trace.push(`lesson-complete:${JSON.stringify(stats)}`);
      return trace;
    }

    if (current.windowName === "definition-display") {
      trace.push(`definition-display:${current.props.title}`);
      current = await engine.next();
      continue;
    }
    if (current.windowName === "definition-fun-fact") {
      trace.push(`definition-fun-fact:${current.props.title}`);
      current = await engine.next();
      continue;
    }
    if (current.windowName === "answer-recap") {
      trace.push(`answer-recap:${current.props.title}`);
      current = await engine.next();
      continue;
    }
    if (current.windowName === "word-search") {
      const words = current.props.words as string[];
      trace.push(`word-search:${[...words].sort().join(",")}`);
      current = await engine.next();
      continue;
    }

    if (current.windowName === "multiple-choice") {
      const attemptId = String(current.props.attemptId);
      const choices = current.props.choices as Array<{ id: string; text: string }>;
      const correctChoiceId = getServerCorrectChoiceId({
        contentType: "definition-practice",
        nextCapability: "00000000-0000-4000-8000-000000000001",
        attemptId,
        question: String(current.props.question),
        choices: choices as [
          { id: string; text: string },
          { id: string; text: string },
          { id: string; text: string },
          { id: string; text: string },
        ],
      });
      trace.push(
        `multiple-choice:${current.props.question}:${current.props.badgeLabel ?? "none"}`
      );
      await engine.submitAnswer({ attemptId, selectedChoiceId: correctChoiceId });
      current = await engine.next();
      continue;
    }

    if (current.windowName === "spelling") {
      const attemptId = String(current.props.attemptId);
      const answer = getServerSpellingAnswer({
        contentType: "spelling-practice",
        nextCapability: "00000000-0000-4000-8000-000000000001",
        attemptId,
        definition: String(current.props.promptText),
      });
      trace.push(`spelling:${current.props.promptText}:${current.props.badgeLabel ?? "none"}`);
      await engine.submitAnswer({ attemptId, answer });
      current = await engine.next();
      continue;
    }

    assert.fail(`Unexpected window ${current.windowName}.`);
  }

  throw new Error("Lesson driver did not finish within the guard.");
}

function createSharedDeps(
  learnerUserId: string = TEST_OWNER_USER_ID
): {
  listSource: ReturnType<typeof createFakeVocabularyListSource>;
  learningSource: ReturnType<typeof createFakeVocabularyLearningSource>;
} {
  const list = createFakeVocabularyList(TEST_LIST_ID, TEST_OWNER_USER_ID, TEST_WORD_SEEDS);
  return {
    listSource: createFakeVocabularyListSource([list]),
    learningSource: createFakeVocabularyLearningSource(
      [{ learningId: TEST_LEARNING_ID, listId: TEST_LIST_ID, learnerUserId }],
      list.words.map((word) => ({
        listId: TEST_LIST_ID,
        id: word.id,
        position: word.position,
        word: word.word,
      }))
    ),
  };
}

// Walks a lesson from any capability through as many
// definition-display/definition-fun-fact introduction pairs as the active
// pool requires (one pair per pool word) until the capability chain reaches
// the first definition-practice attempt, using a fresh store instance for
// every request. Inspects the shared runtime store directly (a legitimate
// use of the test double's own public interface, not an internal-Map
// reach-through) rather than assuming a fixed introduction-pair count.
async function walkToDefinitionPractice(
  makeStore: () => VocabularyContentCapabilityStore,
  runtimeStore: FakeVocabularyRuntimeStore,
  lessonId: string,
  startCapability: string
): Promise<string> {
  let capability = startCapability;
  for (let guard = 0; guard < 100; guard += 1) {
    const loaded = await runtimeStore.loadCapability(capability);
    assert.ok(loaded, `expected capability ${capability} to exist`);
    const kind = loaded.snapshot.step?.kind;
    if (kind === "definition-practice") {
      return capability;
    }
    assert.ok(
      kind === "definition-display" || kind === "definition-fun-fact",
      `expected an introduction step, got ${String(kind)}`
    );
    const authorized = await makeStore().authorizeContent(
      TEST_OWNER_USER_ID,
      lessonId,
      capability,
      kind
    );
    assert.ok(authorized);
    const built = await makeStore().buildContent(authorized);
    assert.ok(built, `expected buildable content for ${kind}`);
    await makeStore().recordContentResponse(authorized, built);
    capability = (built.content as { nextCapability: string }).nextCapability;
  }
  throw new Error("did not reach definition-practice within the guard");
}

// Masters the first loaded word directly against the lesson's runtime
// state (bypassing the real introduction/practice flow) so a refill
// becomes due, mirroring the equivalent helper in
// `vocabularyDatabaseLoading.test.ts`.
async function masterFirstWordDirectly(
  runtimeStore: FakeVocabularyRuntimeStore,
  lessonId: string,
  lessonWordId: string
): Promise<void> {
  const loaded = await runtimeStore.loadLesson(lessonId);
  assert.ok(loaded);
  const lessonState = VocabularyLessonState.restoreFromSnapshot(
    loaded.snapshot.lessonState,
    loaded.snapshot.randomSeed
  );
  const internal = lessonState as unknown as {
    progressByWordId: Map<string, { introduced: boolean }>;
  };
  const progress = internal.progressByWordId.get(lessonWordId);
  if (progress) {
    progress.introduced = true;
  }
  const gradeOnce = (answerType: "definition" | "spelling"): void => {
    const attemptId = `synthetic-${answerType}-${lessonWordId}-${Math.random()}`;
    if (answerType === "definition") {
      const choiceIds = ["choice-a", "choice-b", "choice-c", "choice-d"];
      lessonState.activateAttempt({
        wordId: lessonWordId,
        answerType: "definition",
        attemptId,
        validChoiceIds: choiceIds,
        review: false,
      });
      lessonState.beginSubmission({ answerType: "definition", attemptId, selectedChoiceId: choiceIds[0] });
      lessonState.recordSubmission({ answerType: "definition", correctChoiceId: choiceIds[0] });
    } else {
      lessonState.activateAttempt({
        wordId: lessonWordId,
        answerType: "spelling",
        attemptId,
        validChoiceIds: [],
        review: false,
      });
      lessonState.beginSubmission({ answerType: "spelling", attemptId, answer: "x" });
      lessonState.recordSubmission({ answerType: "spelling", correct: true });
    }
    lessonState.next();
  };
  for (let attempt = 0; attempt < 3; attempt += 1) gradeOnce("definition");
  for (let attempt = 0; attempt < 3; attempt += 1) gradeOnce("spelling");

  const ok = await runtimeStore.updateLesson({
    lessonId,
    expectedVersion: loaded.version,
    snapshot: { ...loaded.snapshot, lessonState: lessonState.exportSnapshot() },
    expiresAt: loaded.expiresAt,
  });
  assert.ok(ok);
}

test("a manifest created by one store instance authorizes its next content through a separately constructed instance", async () => {
  const runtimeStore = createFakeVocabularyRuntimeStore();
  const { listSource, learningSource } = createSharedDeps();
  const storeA = new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0 });
  const storeB = new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0 });

  const manifest = await storeA.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);

  const authorized = await storeB.authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    manifest.nextCapability,
    "definition-display"
  );
  assert.ok(authorized, "a second store instance must authorize content created by the first");

  const built = await storeB.buildContent(authorized);
  assert.ok(built);
  await storeB.recordContentResponse(authorized, built);

  // Exact replay from a third instance must return the identical cached
  // projection and next capability rather than rebuilding new content.
  const storeC = new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0 });
  const replayedAuthorization = await storeC.authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    manifest.nextCapability,
    "definition-display"
  );
  assert.ok(replayedAuthorization);
  const cached = await storeC.getCachedContent(replayedAuthorization);
  assert.deepEqual(cached, built.content);
  assert.equal(replayedAuthorization.nextCapability, authorized.nextCapability);
});

test("a practice attempt created through one instance can be graded and advance its successor through other instances", async () => {
  const runtimeStore = createFakeVocabularyRuntimeStore();
  const { listSource, learningSource } = createSharedDeps();
  const makeStore = () =>
    new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0 });

  const manifest = await makeStore().createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);

  const practiceCapability = await walkToDefinitionPractice(
    makeStore,
    runtimeStore,
    manifest.lessonId,
    manifest.nextCapability
  );

  const practiceAuthorization = await makeStore().authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    practiceCapability,
    "definition-practice"
  );
  assert.ok(practiceAuthorization);
  const practiceBuilt = await makeStore().buildContent(practiceAuthorization);
  assert.ok(practiceBuilt && practiceBuilt.content.contentType === "definition-practice");
  await makeStore().recordContentResponse(practiceAuthorization, practiceBuilt);

  const correctChoiceId = getServerCorrectChoiceId(practiceBuilt.content);

  // Grade through yet another fresh instance.
  const result = await makeStore().resolveAnswer(TEST_OWNER_USER_ID, {
    attemptId: practiceBuilt.content.attemptId,
    answerType: "definition",
    selectedChoiceId: correctChoiceId,
  });
  assert.ok(result);
  assert.equal(result.answerType, "definition");
  assert.equal(result.correctChoiceId, correctChoiceId);

  // The successor capability must now be authorizable (as answer-recap)
  // through yet another instance -- proving the sequencer mirror advanced.
  const successorCapability = practiceBuilt.content.nextCapability;
  const successorAuthorization = await makeStore().authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    successorCapability,
    "answer-recap",
    0
  );
  assert.ok(successorAuthorization, "successor capability must advance across instances");
});

test("reconstructing the service between every request reproduces identical progression to an uninterrupted instance", async (context) => {
  const originalWarn = console.warn;
  console.warn = (message?: unknown, ...optionalParams: unknown[]) => {
    if (message !== "speech_playback_failure") {
      originalWarn(message, ...optionalParams);
    }
  };
  context.after(() => {
    console.warn = originalWarn;
  });

  const persistentDeps = createSharedDeps();
  const persistentRuntimeStore = createFakeVocabularyRuntimeStore();
  const persistentStore = new VocabularyContentCapabilityStore({
    listSource: persistentDeps.listSource,
    learningSource: persistentDeps.learningSource,
    runtimeStore: persistentRuntimeStore,
    seed: () => 0,
  });
  const persistentApi: VocabularyModuleApi = {
    async loadContent(request) {
      const response = await handleVocabularyContentRequest(
        jsonRequest("http://local.test/api/learning/vocabulary/content", request),
        TEST_OWNER_USER_ID,
        persistentStore
      );
      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`unexpected status ${response.status}`);
      return response.json();
    },
    async submitAnswer(submission) {
      const response = await handleVocabularyAnswerRequest(
        jsonRequest("http://local.test/api/learning/vocabulary/submit-answer", submission),
        (parsed) => persistentStore.resolveAnswer(TEST_OWNER_USER_ID, parsed)
      );
      if (!response.ok) throw new Error(`unexpected status ${response.status}`);
      return response.json();
    },
  };

  const reconstructedDeps = createSharedDeps();
  const reconstructedRuntimeStore = createFakeVocabularyRuntimeStore();
  const reconstructedApi = createReconstructingVocabularyApi(TEST_OWNER_USER_ID, () =>
    new VocabularyContentCapabilityStore({
      listSource: reconstructedDeps.listSource,
      learningSource: reconstructedDeps.learningSource,
      runtimeStore: reconstructedRuntimeStore,
      seed: () => 0,
    })
  );

  const [persistentTrace, reconstructedTrace] = await Promise.all([
    driveFullLesson(persistentApi),
    driveFullLesson(reconstructedApi),
  ]);

  assert.ok(persistentTrace.length > 20, "expected a substantial lesson trace");
  assert.deepEqual(
    reconstructedTrace,
    persistentTrace,
    "reconstructing the store between every request must not change screen sequence, selection, recap choice, or checkpoint grouping"
  );
});

test("exact duplicate answer delivery across instances returns the recorded result while a changed duplicate is rejected", async () => {
  const runtimeStore = createFakeVocabularyRuntimeStore();
  const { listSource, learningSource } = createSharedDeps();
  const makeStore = () =>
    new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0 });

  const manifest = await makeStore().createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);

  const capability = await walkToDefinitionPractice(
    makeStore,
    runtimeStore,
    manifest.lessonId,
    manifest.nextCapability
  );

  const practiceAuthorization = await makeStore().authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    capability,
    "definition-practice"
  );
  assert.ok(practiceAuthorization);
  const practiceBuilt = await makeStore().buildContent(practiceAuthorization);
  assert.ok(practiceBuilt && practiceBuilt.content.contentType === "definition-practice");
  await makeStore().recordContentResponse(practiceAuthorization, practiceBuilt);
  const correctChoiceId = getServerCorrectChoiceId(practiceBuilt.content);
  const wrongChoiceId = practiceBuilt.content.choices.find((choice) => choice.id !== correctChoiceId)!.id;

  const submission: VocabularyAnswerSubmission = {
    attemptId: practiceBuilt.content.attemptId,
    answerType: "definition",
    selectedChoiceId: correctChoiceId,
  };

  const first = await makeStore().resolveAnswer(TEST_OWNER_USER_ID, submission);
  assert.ok(first);

  const exactReplay = await makeStore().resolveAnswer(TEST_OWNER_USER_ID, submission);
  assert.deepEqual(exactReplay, first);

  const changedDuplicate = await makeStore().resolveAnswer(TEST_OWNER_USER_ID, {
    ...submission,
    selectedChoiceId: wrongChoiceId,
  });
  assert.equal(changedDuplicate, null, "a modified duplicate submission must be rejected");
});

test("fixed 30-minute lesson expiry is not refreshed by activity and is enforced immediately before, at, and after the boundary", async () => {
  const runtimeStore = createFakeVocabularyRuntimeStore();
  const { listSource, learningSource } = createSharedDeps();
  let currentTime = 1_000_000;
  const now = () => currentTime;
  const lifetimeMs = 30 * 60 * 1_000;
  const makeStore = () =>
    new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0, now, lifetimeMs });

  const manifest = await makeStore().createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);

  // Activity well before expiry keeps working and does not slide the
  // lesson's fixed expiry forward.
  currentTime += 10 * 60 * 1_000;
  const midLesson = await makeStore().authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    manifest.nextCapability,
    "definition-display"
  );
  assert.ok(midLesson, "content must remain authorized well before expiry");

  currentTime = 1_000_000 + lifetimeMs - 1;
  const justBefore = await makeStore().authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    manifest.nextCapability,
    "definition-display"
  );
  assert.ok(justBefore, "content must remain authorized one millisecond before the fixed expiry");

  currentTime = 1_000_000 + lifetimeMs;
  const atBoundary = await makeStore().authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    manifest.nextCapability,
    "definition-display"
  );
  assert.equal(atBoundary, null, "content must be rejected exactly at the fixed expiry");

  currentTime = 1_000_000 + lifetimeMs + 1;
  const afterBoundary = await makeStore().authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    manifest.nextCapability,
    "definition-display"
  );
  assert.equal(afterBoundary, null, "content must remain rejected after the fixed expiry");
});

test("concurrent content authorization for the same capability creates only one successor", async () => {
  const runtimeStore = createFakeVocabularyRuntimeStore();
  const { listSource, learningSource } = createSharedDeps();
  const makeStore = () =>
    new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0 });

  const manifest = await makeStore().createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);

  const [first, second] = await Promise.all([
    makeStore().authorizeContent(
      TEST_OWNER_USER_ID,
      manifest.lessonId,
      manifest.nextCapability,
      "definition-display"
    ),
    makeStore().authorizeContent(
      TEST_OWNER_USER_ID,
      manifest.lessonId,
      manifest.nextCapability,
      "definition-display"
    ),
  ]);
  assert.ok(first);
  assert.ok(second);
  assert.equal(
    first.nextCapability,
    second.nextCapability,
    "two concurrent authorizations of the same capability must converge on one successor"
  );
});

test("concurrent duplicate answer submission applies progress exactly once", async () => {
  const runtimeStore = createFakeVocabularyRuntimeStore();
  const { listSource, learningSource } = createSharedDeps();
  const makeStore = () =>
    new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0 });

  const manifest = await makeStore().createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);
  const capability = await walkToDefinitionPractice(
    makeStore,
    runtimeStore,
    manifest.lessonId,
    manifest.nextCapability
  );
  const practiceAuthorization = await makeStore().authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    capability,
    "definition-practice"
  );
  assert.ok(practiceAuthorization);
  const practiceBuilt = await makeStore().buildContent(practiceAuthorization);
  assert.ok(practiceBuilt && practiceBuilt.content.contentType === "definition-practice");
  await makeStore().recordContentResponse(practiceAuthorization, practiceBuilt);
  const correctChoiceId = getServerCorrectChoiceId(practiceBuilt.content);

  const submission: VocabularyAnswerSubmission = {
    attemptId: practiceBuilt.content.attemptId,
    answerType: "definition",
    selectedChoiceId: correctChoiceId,
  };

  const [first, second] = await Promise.all([
    makeStore().resolveAnswer(TEST_OWNER_USER_ID, submission),
    makeStore().resolveAnswer(TEST_OWNER_USER_ID, submission),
  ]);
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.progress.gradedAnswerCount, second.progress.gradedAnswerCount);
  assert.equal(first.progress.gradedAnswerCount, 1, "progress must apply exactly once, not twice");
});

test("a transaction failure during manifest creation leaves no partial lesson or capability record", async () => {
  const runtimeStore = createFakeVocabularyRuntimeStore();
  const { listSource, learningSource } = createSharedDeps();
  const store = new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0 });

  runtimeStore.failNext("createLessonAndCapability");
  await assert.rejects(store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID));
  assert.equal(runtimeStore.recordCount(), 0, "a failed manifest creation must leave no runtime records");

  const manifest = await store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest, "a retried manifest creation must still succeed");
});

test("a transaction failure during content advancement leaves the capability and lesson unchanged", async () => {
  const runtimeStore = createFakeVocabularyRuntimeStore();
  const { listSource, learningSource } = createSharedDeps();
  const store = new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0 });

  const manifest = await store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);

  const before = await runtimeStore.loadCapability(manifest.nextCapability);
  assert.ok(before);

  runtimeStore.failNext("advanceCapability");
  await assert.rejects(
    store.authorizeContent(
      TEST_OWNER_USER_ID,
      manifest.lessonId,
      manifest.nextCapability,
      "definition-display"
    )
  );

  const after = await runtimeStore.loadCapability(manifest.nextCapability);
  assert.ok(after);
  assert.deepEqual(after.snapshot, before.snapshot);
  assert.equal(after.version, before.version, "a rolled-back advance must not bump the capability version");

  const retried = await store.authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    manifest.nextCapability,
    "definition-display"
  );
  assert.ok(retried, "a retried authorization must still succeed after the simulated failure");
});

test("a transaction failure during refill preserves the ordered cursor and can be retried", async () => {
  const runtimeStore = createFakeVocabularyRuntimeStore();
  const list = createFakeVocabularyList(TEST_LIST_ID, TEST_OWNER_USER_ID, TEST_WORD_SEEDS.slice(0, 8));
  const listSource = createFakeVocabularyListSource([list]);
  const learningSource = createFakeVocabularyLearningSource(
    [{ learningId: TEST_LEARNING_ID, listId: TEST_LIST_ID, learnerUserId: TEST_OWNER_USER_ID }],
    list.words.map((word) => ({ listId: TEST_LIST_ID, id: word.id, position: word.position, word: word.word }))
  );
  const store = new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0 });

  const manifest = await store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);

  // Master the first pool word so a refill becomes due; otherwise
  // `refillNextWord` returns early without ever writing to the store.
  await masterFirstWordDirectly(runtimeStore, manifest.lessonId, manifest.words[0].id);

  const loaded = await runtimeStore.loadLesson(manifest.lessonId);
  assert.ok(loaded);

  runtimeStore.failNext("updateLesson");
  await assert.rejects(store.refillNextWord(TEST_OWNER_USER_ID, manifest.lessonId));

  const afterFailure = await runtimeStore.loadLesson(manifest.lessonId);
  assert.ok(afterFailure);
  assert.equal(afterFailure.snapshot.lastLoadedPosition, loaded.snapshot.lastLoadedPosition);
  assert.equal(afterFailure.version, loaded.version);

  const retried = await store.refillNextWord(TEST_OWNER_USER_ID, manifest.lessonId);
  assert.ok(retried?.wordId, "a retried refill after the simulated failure must still succeed");
});

test("a transaction failure during practice-attempt activation (recordContent) leaves the capability, lesson, and attempt-index unchanged", async () => {
  const runtimeStore = createFakeVocabularyRuntimeStore();
  const { listSource, learningSource } = createSharedDeps();
  const makeStore = () =>
    new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0 });

  const manifest = await makeStore().createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);

  const practiceCapability = await walkToDefinitionPractice(
    makeStore,
    runtimeStore,
    manifest.lessonId,
    manifest.nextCapability
  );

  const practiceAuthorization = await makeStore().authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    practiceCapability,
    "definition-practice"
  );
  assert.ok(practiceAuthorization);
  const practiceBuilt = await makeStore().buildContent(practiceAuthorization);
  assert.ok(practiceBuilt && practiceBuilt.content.contentType === "definition-practice");

  const beforeCapability = await runtimeStore.loadCapability(practiceCapability);
  assert.ok(beforeCapability);
  const beforeLesson = await runtimeStore.loadLesson(manifest.lessonId);
  assert.ok(beforeLesson);

  runtimeStore.failNext("recordContent");
  await assert.rejects(makeStore().recordContentResponse(practiceAuthorization, practiceBuilt));

  // The capability cache, lesson snapshot, and attempt-index are written
  // together in one transaction; a failure must leave none of them applied.
  const afterCapability = await runtimeStore.loadCapability(practiceCapability);
  assert.ok(afterCapability);
  assert.deepEqual(afterCapability.snapshot, beforeCapability.snapshot);
  assert.equal(
    afterCapability.version,
    beforeCapability.version,
    "a rolled-back activation must not bump the capability version"
  );
  assert.equal(
    afterCapability.snapshot.contentResponse,
    null,
    "no partial content cache may be committed"
  );

  const afterLesson = await runtimeStore.loadLesson(manifest.lessonId);
  assert.ok(afterLesson);
  assert.deepEqual(afterLesson.snapshot, beforeLesson.snapshot);
  assert.equal(
    afterLesson.version,
    beforeLesson.version,
    "a rolled-back activation must not persist a partial lesson snapshot"
  );

  const missingAttemptIndex = await runtimeStore.loadAttemptIndex(practiceBuilt.content.attemptId);
  assert.equal(missingAttemptIndex, null, "no attempt-index record may be partially created");

  // A retry after the simulated failure must still succeed cleanly and
  // create exactly one attempt activation/successor, not a duplicate.
  await makeStore().recordContentResponse(practiceAuthorization, practiceBuilt);
  const retriedCapability = await runtimeStore.loadCapability(practiceCapability);
  assert.ok(retriedCapability);
  assert.deepEqual(retriedCapability.snapshot.contentResponse, practiceBuilt.content);

  const retriedAttemptIndex = await runtimeStore.loadAttemptIndex(practiceBuilt.content.attemptId);
  assert.ok(retriedAttemptIndex, "the retried activation must create exactly one attempt-index record");
  assert.equal(retriedAttemptIndex.successorCapability, retriedCapability.snapshot.nextCapability);

  const correctChoiceId = getServerCorrectChoiceId(practiceBuilt.content);
  const result = await makeStore().resolveAnswer(TEST_OWNER_USER_ID, {
    attemptId: practiceBuilt.content.attemptId,
    answerType: "definition",
    selectedChoiceId: correctChoiceId,
  });
  assert.ok(result);
  assert.equal(
    result.progress.gradedAnswerCount,
    1,
    "the retried activation must not have produced duplicate attempt or successor state"
  );
});

test("a transaction failure during answer-driven successor advancement (resolveAnswerAdvance) does not lose or duplicate the durably graded answer", async (context) => {
  const originalWarn = console.warn;
  console.warn = () => {};
  context.after(() => {
    console.warn = originalWarn;
  });

  const runtimeStore = createFakeVocabularyRuntimeStore();
  const { listSource, learningSource } = createSharedDeps();
  const makeStore = () =>
    new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0 });

  const manifest = await makeStore().createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);
  const capability = await walkToDefinitionPractice(
    makeStore,
    runtimeStore,
    manifest.lessonId,
    manifest.nextCapability
  );
  const practiceAuthorization = await makeStore().authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    capability,
    "definition-practice"
  );
  assert.ok(practiceAuthorization);
  const practiceBuilt = await makeStore().buildContent(practiceAuthorization);
  assert.ok(practiceBuilt && practiceBuilt.content.contentType === "definition-practice");
  await makeStore().recordContentResponse(practiceAuthorization, practiceBuilt);
  const correctChoiceId = getServerCorrectChoiceId(practiceBuilt.content);
  const successorCapability = practiceBuilt.content.nextCapability;

  const beforeSuccessor = await runtimeStore.loadCapability(successorCapability);
  assert.ok(beforeSuccessor);
  const lessonBeforeGrading = await runtimeStore.loadLesson(manifest.lessonId);
  assert.ok(lessonBeforeGrading);

  runtimeStore.failNext("resolveAnswerAdvance");
  const submission: VocabularyAnswerSubmission = {
    attemptId: practiceBuilt.content.attemptId,
    answerType: "definition",
    selectedChoiceId: correctChoiceId,
  };
  const result = await makeStore().resolveAnswer(TEST_OWNER_USER_ID, submission);

  // The durable answer grade (committed independently through
  // `commitVocabularyAnswer` before the sequencer-mirror advance runs) must
  // never be lost just because the disposable in-process screen-sequencing
  // mirror failed to persist -- this is the existing, approved
  // "sequencer_mirror_desync" degradation, not a rejected submission.
  assert.ok(result, "grading must still succeed even when the mirror advance fails");
  assert.equal(result.answerType, "definition");
  assert.equal(result.correctChoiceId, correctChoiceId);
  assert.equal(result.progress.gradedAnswerCount, 1);

  // The failed mirror transaction must leave the successor capability and
  // lesson snapshot exactly as they were -- no partially-advanced step.
  const afterSuccessor = await runtimeStore.loadCapability(successorCapability);
  assert.ok(afterSuccessor);
  assert.deepEqual(afterSuccessor.snapshot, beforeSuccessor.snapshot);
  assert.equal(afterSuccessor.version, beforeSuccessor.version);
  const lessonAfterGrading = await runtimeStore.loadLesson(manifest.lessonId);
  assert.ok(lessonAfterGrading);
  assert.deepEqual(lessonAfterGrading.snapshot, lessonBeforeGrading.snapshot);
  assert.equal(lessonAfterGrading.version, lessonBeforeGrading.version);

  // The disposable attempt-index is discarded rather than left pointing at a
  // stalled advance, so a later duplicate submission for the same attempt
  // safely replays the already-durable result instead of retrying (and
  // re-failing) the same mirror update.
  const attemptIndexAfterFailure = await runtimeStore.loadAttemptIndex(submission.attemptId);
  assert.equal(attemptIndexAfterFailure, null);

  const duplicate = await makeStore().resolveAnswer(TEST_OWNER_USER_ID, submission);
  assert.ok(duplicate);
  assert.equal(
    duplicate.progress.gradedAnswerCount,
    1,
    "a later duplicate submission must not regrade or duplicate progress"
  );
  assert.deepEqual(duplicate, result);
});

test("database read failures during content authorization surface as the safe unavailable response, not fabricated success", async () => {
  const runtimeStore = createFakeVocabularyRuntimeStore();
  const { listSource, learningSource } = createSharedDeps();
  const store = new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0 });

  const manifest = await store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);

  const response = await handleVocabularyContentRequest(
    jsonRequest("http://local.test/api/learning/vocabulary/content", {
      contentType: "definition-display",
      lessonId: manifest.lessonId,
      capability: manifest.nextCapability,
    }),
    TEST_OWNER_USER_ID,
    (() => {
      const failingStore = new VocabularyContentCapabilityStore({
        listSource,
        learningSource,
        runtimeStore: {
          ...runtimeStore,
          loadLesson: () => {
            throw new Error("simulated database outage");
          },
        },
        seed: () => 0,
      });
      return failingStore;
    })()
  );
  assert.equal(response.status, 503);
  const body = (await response.json()) as { error: string };
  assert.doesNotMatch(body.error.toLowerCase(), /not found|missing/);
});

test("cross-learner, cross-lesson, wrong-answer-type, and unknown identifiers remain rejected", async () => {
  const runtimeStore = createFakeVocabularyRuntimeStore();
  const otherList = createFakeVocabularyList(TEST_LIST_ID, TEST_OWNER_USER_ID, TEST_WORD_SEEDS);
  const listSource = createFakeVocabularyListSource([otherList]);
  const learningSource = createFakeVocabularyLearningSource(
    [
      { learningId: TEST_LEARNING_ID, listId: TEST_LIST_ID, learnerUserId: TEST_OWNER_USER_ID },
      { learningId: "other-learning", listId: TEST_LIST_ID, learnerUserId: OTHER_USER_ID },
    ],
    otherList.words.map((word) => ({
      listId: TEST_LIST_ID,
      id: word.id,
      position: word.position,
      word: word.word,
    }))
  );
  const store = new VocabularyContentCapabilityStore({ listSource, learningSource, runtimeStore, seed: () => 0 });

  const manifest = await store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);
  const otherManifest = await store.createManifest(OTHER_USER_ID, "other-learning");
  assert.ok(otherManifest);

  assert.equal(
    await store.authorizeContent(
      OTHER_USER_ID,
      manifest.lessonId,
      manifest.nextCapability,
      "definition-display"
    ),
    null,
    "a capability must reject a learner other than its owner"
  );
  assert.equal(
    await store.authorizeContent(
      TEST_OWNER_USER_ID,
      otherManifest.lessonId,
      manifest.nextCapability,
      "definition-display"
    ),
    null,
    "a capability must reject a lessonId it was not issued under"
  );
  assert.equal(
    await store.authorizeContent(
      TEST_OWNER_USER_ID,
      manifest.lessonId,
      manifest.nextCapability,
      "spelling-practice"
    ),
    null,
    "a capability must reject a mismatched content type"
  );
  assert.equal(
    await store.authorizeContent(
      TEST_OWNER_USER_ID,
      manifest.lessonId,
      "00000000-0000-4000-8000-000000000000",
      "definition-display"
    ),
    null,
    "an unknown capability must be rejected"
  );
  assert.equal(
    await store.resolveAnswer(TEST_OWNER_USER_ID, {
      attemptId: "00000000-0000-4000-8000-000000000000",
      answerType: "definition",
      selectedChoiceId: "unknown-choice",
    }),
    null,
    "an unknown attempt ID must be rejected"
  );
});
