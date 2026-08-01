import assert from "node:assert/strict";
import test from "node:test";
import { VocabularyContentCapabilityStore } from "../../src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
import { VocabularyLessonState } from "../../src/learning-modules/vocabulary/state/VocabularyLessonState";
import { ACTIVE_POOL_SIZE } from "../../src/learning-modules/vocabulary/state/VocabularyLessonTypes";
import { handleVocabularyContentRequest } from "../../src/learning-modules/vocabulary/server/handleVocabularyContentRequest";
import {
  createFakeVocabularyList,
  createFakeVocabularyListSource,
  OTHER_USER_ID,
  TEST_LIST_ID,
  TEST_OWNER_USER_ID,
  type FakeVocabularyListSource,
  type FakeVocabularyWordSeed,
} from "./fakeVocabularyListStore";
import { createFakeVocabularyLearningSource } from "./fakeVocabularyLearningStore";
import {
  createFakeVocabularyRuntimeStore,
  type FakeVocabularyRuntimeStore,
} from "./fakeVocabularyRuntimeStore";

const TEST_LEARNING_ID = "00000000-0000-4000-8000-000000000010";

// Synthetic, uniquely defined word seeds -- used instead of the fixed
// 20-word TEST_WORD_SEEDS set whenever a test needs an arbitrary count.
function generateWordSeeds(count: number): FakeVocabularyWordSeed[] {
  return Array.from({ length: count }, (_unused, index) => {
    const label = String(index + 1).padStart(3, "0");
    return {
      word: `syntheticword${label}`,
      definition: `definition text for word ${label}`,
      spellingDefinition: `spelling prompt for word ${label}`,
      exampleSentence1: `Example one for word ${label}.`,
      exampleSentence2: `Example two for word ${label}.`,
      exampleSentence3: `Example three for word ${label}.`,
      interestingFact: `Interesting fact for word ${label}.`,
    };
  });
}

function spyListSource(source: FakeVocabularyListSource): FakeVocabularyListSource & {
  calls: { findByIds: number[]; findNext: number[] };
} {
  const calls = { findByIds: [] as number[], findNext: [] as number[] };
  return {
    calls,
    failNext: (operation) => source.failNext(operation),
    findByIds: (listId, ids) => {
      calls.findByIds.push(ids.length);
      return source.findByIds(listId, ids);
    },
    findNext: (listId, afterPosition) => {
      calls.findNext.push(afterPosition);
      return source.findNext(listId, afterPosition);
    },
    findDistractors: (listId, excludeIds, take) =>
      source.findDistractors(listId, excludeIds, take),
  };
}

function createStoreForSeeds(
  seeds: FakeVocabularyWordSeed[],
  learningId: string = TEST_LEARNING_ID,
  learnerUserId: string = TEST_OWNER_USER_ID
): {
  store: VocabularyContentCapabilityStore;
  spy: ReturnType<typeof spyListSource>;
  runtimeStore: FakeVocabularyRuntimeStore;
} {
  const list = createFakeVocabularyList(TEST_LIST_ID, TEST_OWNER_USER_ID, seeds);
  const spy = spyListSource(createFakeVocabularyListSource([list]));
  const learningSource = createFakeVocabularyLearningSource(
    [{ learningId, listId: TEST_LIST_ID, learnerUserId }],
    list.words.map((word) => ({ listId: TEST_LIST_ID, id: word.id, position: word.position, word: word.word }))
  );
  const runtimeStore = createFakeVocabularyRuntimeStore();
  const store = new VocabularyContentCapabilityStore({
    listSource: spy,
    learningSource,
    runtimeStore,
    seed: () => 0,
  });
  return { store, spy, runtimeStore };
}

test("initial load retrieves at most five complete words and reports the authoritative total for lists of every size", async () => {
  for (const count of [1, 4, 5, 8, 300]) {
    const { store, spy } = createStoreForSeeds(generateWordSeeds(count));
    const manifest = await store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);

    assert.ok(manifest);
    assert.equal(manifest.totalWordCount, count);
    assert.equal(manifest.words.length, Math.min(count, ACTIVE_POOL_SIZE));
    assert.deepEqual(spy.calls.findByIds, [Math.min(count, ACTIVE_POOL_SIZE)]);
    assert.equal(spy.calls.findNext.length, 0, "no refill query before any mastery");
  }
});

test("a zero-word list creates no false lesson", async () => {
  const { store } = createStoreForSeeds([]);
  const manifest = await store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.equal(manifest, null, "a zero-word list must not create a false lesson");
});

test("the sixth word is never requested while all five active slots remain occupied", async () => {
  const { store, spy } = createStoreForSeeds(generateWordSeeds(20));
  await store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.equal(spy.calls.findNext.length, 0);
});

test("a database failure during manifest creation is distinguished from a missing learning", async () => {
  const list = createFakeVocabularyList(TEST_LIST_ID, TEST_OWNER_USER_ID, generateWordSeeds(8));
  const source = createFakeVocabularyListSource([list]);
  const learningSource = createFakeVocabularyLearningSource(
    [{ learningId: TEST_LEARNING_ID, listId: TEST_LIST_ID, learnerUserId: TEST_OWNER_USER_ID }],
    list.words.map((word) => ({ listId: TEST_LIST_ID, id: word.id, position: word.position, word: word.word }))
  );

  const notFoundResponse = await handleVocabularyContentRequest(
    jsonRequest({ contentType: "manifest", learningId: "missing-learning" }),
    TEST_OWNER_USER_ID,
    new VocabularyContentCapabilityStore({
      listSource: source,
      learningSource,
      runtimeStore: createFakeVocabularyRuntimeStore(),
    })
  );
  assert.equal(notFoundResponse.status, 404);

  const failingLearningSource = {
    ...learningSource,
    initialize: (): Promise<never> => {
      throw new Error("simulated initialize failure");
    },
  };
  const failureResponse = await handleVocabularyContentRequest(
    jsonRequest({ contentType: "manifest", learningId: TEST_LEARNING_ID }),
    TEST_OWNER_USER_ID,
    new VocabularyContentCapabilityStore({
      listSource: source,
      learningSource: failingLearningSource,
      runtimeStore: createFakeVocabularyRuntimeStore(),
    })
  );
  assert.equal(failureResponse.status, 503);
  const body = (await failureResponse.json()) as { error: string };
  assert.doesNotMatch(body.error.toLowerCase(), /not found|missing/);
});

test("a learner without an authorized learning record sees the same result as a missing learning", async () => {
  const { store: ownerStore } = createStoreForSeeds(generateWordSeeds(8));
  const missingLearningResult = await ownerStore.createManifest(
    TEST_OWNER_USER_ID,
    "does-not-exist"
  );

  const { store: crossLearnerStore } = createStoreForSeeds(generateWordSeeds(8));
  const crossLearnerResult = await crossLearnerStore.createManifest(
    OTHER_USER_ID,
    TEST_LEARNING_ID
  );

  assert.equal(missingLearningResult, null);
  assert.equal(crossLearnerResult, null);
});

test("a learner can use a list assigned to them without owning the reusable list", async () => {
  // The list is owned by TEST_OWNER_USER_ID (a teacher/parent), but the
  // learning record's learnerUserId is a different authenticated user.
  const { store } = createStoreForSeeds(generateWordSeeds(8), TEST_LEARNING_ID, OTHER_USER_ID);
  const manifest = await store.createManifest(OTHER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest, "the assigned learner must be authorized without owning the list");
});

test("content boundaries repeat authorization instead of trusting the initial manifest request", async () => {
  const { store } = createStoreForSeeds(generateWordSeeds(8), TEST_LEARNING_ID, OTHER_USER_ID);

  const manifest = await store.createManifest(OTHER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);

  const deniedForWrongUser = await store.authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    manifest.nextCapability,
    "definition-display"
  );
  assert.equal(deniedForWrongUser, null);

  const grantedForLearner = await store.authorizeContent(
    OTHER_USER_ID,
    manifest.lessonId,
    manifest.nextCapability,
    "definition-display"
  );
  assert.ok(grantedForLearner);
});

test("exactly one refill request retrieves exactly the next ordered word after a confirmed full mastery", async () => {
  const { store, spy, runtimeStore } = createStoreForSeeds(generateWordSeeds(8));
  const manifest = await store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);

  await masterLessonWordDirectly(runtimeStore, manifest.lessonId, manifest.words[0].id);

  const outcome = await store.refillNextWord(TEST_OWNER_USER_ID, manifest.lessonId);
  assert.ok(outcome?.wordId);
  assert.deepEqual(spy.calls.findNext, [5]);

  // Exact replay of the same due slot returns the same recorded outcome
  // instead of advancing the cursor or issuing a second database query.
  const replay = await store.refillNextWord(TEST_OWNER_USER_ID, manifest.lessonId);
  assert.deepEqual(replay, outcome);
  assert.deepEqual(spy.calls.findNext, [5]);
});

test("two concurrent refill requests for the same due slot cannot insert the same next word twice", async () => {
  const { store, runtimeStore } = createStoreForSeeds(generateWordSeeds(8));
  const manifest = await store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);
  await masterLessonWordDirectly(runtimeStore, manifest.lessonId, manifest.words[0].id);

  const [first, second] = await Promise.all([
    store.refillNextWord(TEST_OWNER_USER_ID, manifest.lessonId),
    store.refillNextWord(TEST_OWNER_USER_ID, manifest.lessonId),
  ]);
  assert.deepEqual(first, second);
});

test("a failed refill preserves the ordered position and can be retried", async () => {
  const { store, spy, runtimeStore } = createStoreForSeeds(generateWordSeeds(8));
  const manifest = await store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);
  await masterLessonWordDirectly(runtimeStore, manifest.lessonId, manifest.words[0].id);

  spy.failNext("findNext");
  await assert.rejects(store.refillNextWord(TEST_OWNER_USER_ID, manifest.lessonId));

  const retried = await store.refillNextWord(TEST_OWNER_USER_ID, manifest.lessonId);
  assert.ok(retried?.wordId);
});

test("refill at the end of the list returns an explicit null word without error", async () => {
  const { store, runtimeStore } = createStoreForSeeds(generateWordSeeds(5));
  const manifest = await store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);
  await masterLessonWordDirectly(runtimeStore, manifest.lessonId, manifest.words[0].id);

  const outcome = await store.refillNextWord(TEST_OWNER_USER_ID, manifest.lessonId);
  assert.deepEqual(outcome, { wordId: null });
});

test("no word is skipped or duplicated across repeated refills, and the lesson only completes once the database source is exhausted", async () => {
  const totalWords = 9;
  const { store, spy, runtimeStore } = createStoreForSeeds(generateWordSeeds(totalWords));
  const manifest = await store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);

  const seenCanonicalIds = new Set<string>(manifest.words.map((word) => word.id));
  let lessonWordId = manifest.words[0].id;

  for (let refillCount = 0; refillCount < totalWords - ACTIVE_POOL_SIZE; refillCount += 1) {
    await masterLessonWordDirectly(runtimeStore, manifest.lessonId, lessonWordId);
    const outcome = await store.refillNextWord(TEST_OWNER_USER_ID, manifest.lessonId);
    assert.ok(outcome?.wordId, `expected a real refill word for iteration ${refillCount}`);
    assert.ok(!seenCanonicalIds.has(outcome.wordId), "a refilled word must never repeat");
    seenCanonicalIds.add(outcome.wordId);
    lessonWordId = outcome.wordId;
  }

  assert.equal(seenCanonicalIds.size, totalWords, "every word must be loaded exactly once");
  assert.deepEqual(spy.calls.findNext, [5, 6, 7, 8]);

  // Master the last refilled word too; only then is every loaded word
  // mastered and a further refill request becomes the explicit
  // end-of-list result instead of repeating the previous outcome.
  await masterLessonWordDirectly(runtimeStore, manifest.lessonId, lessonWordId);
  const endOfList = await store.refillNextWord(TEST_OWNER_USER_ID, manifest.lessonId);
  assert.deepEqual(endOfList, { wordId: null });

  // Master every remaining loaded-but-unmastered word; only once every one
  // of the totalWords descriptors has been loaded AND mastered does the
  // lesson reach lesson-complete with the authoritative total. All of this
  // final phase operates on one restored, in-memory `VocabularyLessonState`
  // (never persisted back) purely to drive the pure state machine to its
  // true final step, mirroring what the pre-persistence version of this
  // test did directly against the in-memory store.
  const loaded = await runtimeStore.loadLesson(manifest.lessonId);
  assert.ok(loaded);
  const lessonState = VocabularyLessonState.restoreFromSnapshot(
    loaded.snapshot.lessonState,
    loaded.snapshot.randomSeed
  );
  const canonicalWordIdByLessonWordId = new Map(
    Object.entries(loaded.snapshot.canonicalWordIdByLessonWordId)
  );
  for (const lessonWordIdCandidate of canonicalWordIdByLessonWordId.keys()) {
    if (!lessonState.getWordProgress(lessonWordIdCandidate).spellingMastered) {
      masterWordOnState(lessonState, lessonWordIdCandidate);
    }
  }

  // This direct-grading bypass never drives the real introduction flow, so
  // it never triggers the finite completion-review snapshot
  // (`captureCompletionReviewSnapshotIfReady`) the normal path uses to stop
  // rescheduled delayed reviews from recurring forever. Every word is now
  // loaded and mastered, so freeze the snapshot directly the same way that
  // method would, from the current outstanding review set.
  const internalState = lessonState as unknown as {
    completionReviewWordIds: Set<string> | null;
  };
  internalState.completionReviewWordIds = new Set(
    [...canonicalWordIdByLessonWordId.keys()].filter(
      (id) => lessonState.getWordProgress(id).nextReviewQuestionNumber !== null
    )
  );

  // The pending recap from the very last graded answer, any queued Word
  // Search checkpoint, and any delayed review already inside that frozen
  // snapshot must be consumed before the true final step.
  let finalStep = lessonState.next() as {
    kind: string;
    wordId?: string;
    review?: boolean;
    totalWords?: number;
  };
  for (let guard = 0; guard < 50 && finalStep.kind !== "lesson-complete"; guard += 1) {
    if (finalStep.kind === "definition-practice" || finalStep.kind === "spelling-practice") {
      gradeDirectly(
        lessonState,
        finalStep.wordId as string,
        finalStep.kind === "definition-practice" ? "definition" : "spelling",
        finalStep.review ?? false
      );
    }
    finalStep = lessonState.next() as typeof finalStep;
  }
  assert.equal(finalStep.kind, "lesson-complete");
  assert.equal(finalStep.totalWords, totalWords);
});

test("definition-practice fails safely with a content-unavailable result when the list cannot supply four unique definitions", async () => {
  const { store, runtimeStore } = createStoreForSeeds(generateWordSeeds(2));
  const manifest = await store.createManifest(TEST_OWNER_USER_ID, TEST_LEARNING_ID);
  assert.ok(manifest);

  let capability = manifest.nextCapability;
  let contentType = await peekContentType(runtimeStore, capability);
  while (contentType !== "definition-practice") {
    const authorized = await store.authorizeContent(
      TEST_OWNER_USER_ID,
      manifest.lessonId,
      capability,
      contentType
    );
    assert.ok(authorized);
    const built = await store.buildContent(authorized);
    assert.ok(built, `expected buildable content for ${contentType}`);
    await store.recordContentResponse(authorized, built);
    assert.ok("nextCapability" in built.content && built.content.nextCapability);
    capability = built.content.nextCapability as string;
    contentType = await peekContentType(runtimeStore, capability);
  }

  const authorized = await store.authorizeContent(
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    capability,
    "definition-practice"
  );
  assert.ok(authorized);
  const built = await store.buildContent(authorized);
  assert.equal(
    built,
    null,
    "a two-word list cannot supply three distractors plus the correct definition"
  );
});

async function peekContentType(
  runtimeStore: FakeVocabularyRuntimeStore,
  capability: string
): Promise<
  | "definition-display"
  | "definition-fun-fact"
  | "definition-practice"
  | "spelling-practice"
  | "answer-recap"
  | "word-search-checkpoint"
> {
  const loaded = await runtimeStore.loadCapability(capability);
  const kind = loaded?.snapshot.step?.kind;
  if (
    kind === "definition-display" ||
    kind === "definition-fun-fact" ||
    kind === "definition-practice" ||
    kind === "spelling-practice" ||
    kind === "answer-recap" ||
    kind === "word-search-checkpoint"
  ) {
    return kind;
  }
  throw new Error(`Unexpected or missing capability step kind: ${String(kind)}.`);
}

// Masters exactly one target word by restoring the lesson's runtime state,
// activating and grading its definition and spelling attempts directly
// against it (bypassing `next()`'s weighted pool selection entirely), then
// persisting the mutated state back through the store's own public CAS
// update. Deterministic and side-effect-free with respect to every other
// pool word, so refill accounting (exactly one first-mastery event per
// call) is never disturbed by an incidental mastery of an unrelated word.
async function masterLessonWordDirectly(
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

  masterWordOnState(lessonState, lessonWordId);

  const ok = await runtimeStore.updateLesson({
    lessonId,
    expectedVersion: loaded.version,
    snapshot: { ...loaded.snapshot, lessonState: lessonState.exportSnapshot() },
    expiresAt: loaded.expiresAt,
  });
  assert.ok(ok, "expected the direct-mastery CAS update to apply cleanly");
}

// Grades three consecutive correct definition answers and three consecutive
// correct spelling answers directly against an already-restored lesson
// state instance, reaching the configured mastery streak for both stages.
function masterWordOnState(lessonState: VocabularyLessonState, lessonWordId: string): void {
  // This bypass never drives the normal introduction screens, so mark the
  // word introduced directly. Otherwise the finite completion-review
  // snapshot (`captureCompletionReviewSnapshotIfReady`) can never engage
  // once delayed reviews start coming due, and grading would cycle forever.
  const internal = lessonState as unknown as {
    progressByWordId: Map<string, { introduced: boolean }>;
  };
  const progress = internal.progressByWordId.get(lessonWordId);
  if (progress) {
    progress.introduced = true;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    gradeDirectly(lessonState, lessonWordId, "definition");
  }
  for (let attempt = 0; attempt < 3; attempt += 1) {
    gradeDirectly(lessonState, lessonWordId, "spelling");
  }
}

function gradeDirectly(
  state: VocabularyLessonState,
  wordId: string,
  answerType: "definition" | "spelling",
  review = false
): void {
  const attemptId = `synthetic-${answerType}-${wordId}-${Math.random()}`;
  if (answerType === "definition") {
    const choiceIds = ["choice-a", "choice-b", "choice-c", "choice-d"];
    state.activateAttempt({
      wordId,
      answerType: "definition",
      attemptId,
      validChoiceIds: choiceIds,
      review,
    });
    state.beginSubmission({ answerType: "definition", attemptId, selectedChoiceId: choiceIds[0] });
    state.recordSubmission({ answerType: "definition", correctChoiceId: choiceIds[0] });
  } else {
    state.activateAttempt({ wordId, answerType: "spelling", attemptId, validChoiceIds: [], review });
    state.beginSubmission({ answerType: "spelling", attemptId, answer: "x" });
    state.recordSubmission({ answerType: "spelling", correct: true });
  }
  // Clears the just-answered active attempt (and consumes whatever
  // recap/checkpoint step it queues) so the next direct grade call can
  // activate a fresh attempt, mirroring what a real client's `next()` call
  // would do between two graded answers.
  state.next();
}

function jsonRequest(body: unknown): Request {
  return new Request("http://local.test/api/learning/vocabulary/content", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
