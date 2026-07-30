import assert from "node:assert/strict";
import test from "node:test";
import {
  VocabularyContentCapabilityStore,
  type VocabularyListSource,
} from "../../src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
import { ACTIVE_POOL_SIZE } from "../../src/learning-modules/vocabulary/state/VocabularyLessonTypes";
import { handleVocabularyContentRequest } from "../../src/learning-modules/vocabulary/server/handleVocabularyContentRequest";
import {
  createFakeVocabularyList,
  createFakeVocabularyListSource,
  OTHER_USER_ID,
  TEST_LIST_ID,
  TEST_OWNER_USER_ID,
  type FakeVocabularyWordSeed,
} from "./fakeVocabularyListStore";

const LEARNER_ID = "00000000-0000-4000-8000-000000000010";

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

function spyListSource(source: VocabularyListSource): VocabularyListSource & {
  calls: { findFirst: number[]; findNext: number[] };
} {
  const calls = { findFirst: [] as number[], findNext: [] as number[] };
  return {
    calls,
    isOwned: (userId, listId) => source.isOwned(userId, listId),
    countWords: (listId) => source.countWords(listId),
    findFirst: (listId, take) => {
      calls.findFirst.push(take);
      return source.findFirst(listId, take);
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
  seeds: FakeVocabularyWordSeed[]
): { store: VocabularyContentCapabilityStore; spy: ReturnType<typeof spyListSource> } {
  const list = createFakeVocabularyList(TEST_LIST_ID, TEST_OWNER_USER_ID, seeds);
  const spy = spyListSource(createFakeVocabularyListSource([list]));
  const store = new VocabularyContentCapabilityStore({ listSource: spy, seed: () => 0 });
  return { store, spy };
}

test("initial load retrieves at most five complete words and reports the authoritative total for lists of every size", async () => {
  for (const count of [0, 1, 4, 5, 8, 300]) {
    const { store, spy } = createStoreForSeeds(generateWordSeeds(count));
    const manifest = await store.createManifest(LEARNER_ID, TEST_OWNER_USER_ID, TEST_LIST_ID);

    if (count === 0) {
      assert.equal(manifest, null, "a zero-word list must not create a false lesson");
      continue;
    }

    assert.ok(manifest);
    assert.equal(manifest.totalWordCount, count);
    assert.equal(manifest.words.length, Math.min(count, ACTIVE_POOL_SIZE));
    assert.deepEqual(spy.calls.findFirst, [ACTIVE_POOL_SIZE]);
    assert.equal(spy.calls.findNext.length, 0, "no refill query before any mastery");
  }
});

test("the sixth word is never requested while all five active slots remain occupied", async () => {
  const { store, spy } = createStoreForSeeds(generateWordSeeds(20));
  await store.createManifest(LEARNER_ID, TEST_OWNER_USER_ID, TEST_LIST_ID);
  assert.equal(spy.calls.findNext.length, 0);
});

test("a database failure during manifest creation is distinguished from a missing list", async () => {
  const list = createFakeVocabularyList(TEST_LIST_ID, TEST_OWNER_USER_ID, generateWordSeeds(8));
  const source = createFakeVocabularyListSource([list]);

  const notFoundResponse = await handleVocabularyContentRequest(
    jsonRequest({ contentType: "manifest", wordListId: "missing-list" }),
    TEST_OWNER_USER_ID,
    new VocabularyContentCapabilityStore({ listSource: source })
  );
  assert.equal(notFoundResponse.status, 404);

  source.failNext("countWords");
  const failureResponse = await handleVocabularyContentRequest(
    jsonRequest({ contentType: "manifest", wordListId: TEST_LIST_ID }),
    TEST_OWNER_USER_ID,
    new VocabularyContentCapabilityStore({ listSource: source })
  );
  assert.equal(failureResponse.status, 503);
  const body = (await failureResponse.json()) as { error: string };
  assert.doesNotMatch(body.error.toLowerCase(), /not found|missing/);
});

test("another authenticated user cannot load a list they do not own, and sees the same result as a missing list", async () => {
  const { store: ownerStore } = createStoreForSeeds(generateWordSeeds(8));
  const missingListResult = await ownerStore.createManifest(
    LEARNER_ID,
    TEST_OWNER_USER_ID,
    "does-not-exist"
  );

  const { store: crossOwnerStore } = createStoreForSeeds(generateWordSeeds(8));
  const crossOwnerResult = await crossOwnerStore.createManifest(
    LEARNER_ID,
    OTHER_USER_ID,
    TEST_LIST_ID
  );

  assert.equal(missingListResult, null);
  assert.equal(crossOwnerResult, null);
});

test("content boundaries repeat authorization instead of trusting the initial manifest request", async () => {
  const list = createFakeVocabularyList(TEST_LIST_ID, OTHER_USER_ID, generateWordSeeds(8));
  const source = createFakeVocabularyListSource([list]);
  const store = new VocabularyContentCapabilityStore({ listSource: source, seed: () => 0 });

  const manifest = await store.createManifest(LEARNER_ID, OTHER_USER_ID, TEST_LIST_ID);
  assert.ok(manifest);

  const deniedForNonOwner = await store.authorizeContent(
    LEARNER_ID,
    TEST_OWNER_USER_ID,
    manifest.lessonId,
    manifest.nextCapability,
    "definition-display"
  );
  assert.equal(deniedForNonOwner, null);

  const grantedForOwner = await store.authorizeContent(
    LEARNER_ID,
    OTHER_USER_ID,
    manifest.lessonId,
    manifest.nextCapability,
    "definition-display"
  );
  assert.ok(grantedForOwner);
});

test("exactly one refill request retrieves exactly the next ordered word after a confirmed full mastery", async () => {
  const { store, spy } = createStoreForSeeds(generateWordSeeds(8));
  const manifest = await store.createManifest(LEARNER_ID, TEST_OWNER_USER_ID, TEST_LIST_ID);
  assert.ok(manifest);

  await masterLessonWordDirectly(store, manifest.lessonId, manifest.words[0].id);

  const outcome = await store.refillNextWord(LEARNER_ID, TEST_OWNER_USER_ID, manifest.lessonId);
  assert.ok(outcome?.wordId);
  assert.deepEqual(spy.calls.findNext, [5]);

  // Exact replay of the same due slot returns the same recorded outcome
  // instead of advancing the cursor or issuing a second database query.
  const replay = await store.refillNextWord(LEARNER_ID, TEST_OWNER_USER_ID, manifest.lessonId);
  assert.deepEqual(replay, outcome);
  assert.deepEqual(spy.calls.findNext, [5]);
});

test("two concurrent refill requests for the same due slot cannot insert the same next word twice", async () => {
  const { store } = createStoreForSeeds(generateWordSeeds(8));
  const manifest = await store.createManifest(LEARNER_ID, TEST_OWNER_USER_ID, TEST_LIST_ID);
  assert.ok(manifest);
  await masterLessonWordDirectly(store, manifest.lessonId, manifest.words[0].id);

  const [first, second] = await Promise.all([
    store.refillNextWord(LEARNER_ID, TEST_OWNER_USER_ID, manifest.lessonId),
    store.refillNextWord(LEARNER_ID, TEST_OWNER_USER_ID, manifest.lessonId),
  ]);
  assert.deepEqual(first, second);
});

test("a failed refill preserves the ordered position and can be retried", async () => {
  const list = createFakeVocabularyList(TEST_LIST_ID, TEST_OWNER_USER_ID, generateWordSeeds(8));
  const source = createFakeVocabularyListSource([list]);
  const store = new VocabularyContentCapabilityStore({ listSource: source, seed: () => 0 });
  const manifest = await store.createManifest(LEARNER_ID, TEST_OWNER_USER_ID, TEST_LIST_ID);
  assert.ok(manifest);
  await masterLessonWordDirectly(store, manifest.lessonId, manifest.words[0].id);

  source.failNext("findNext");
  await assert.rejects(store.refillNextWord(LEARNER_ID, TEST_OWNER_USER_ID, manifest.lessonId));

  const retried = await store.refillNextWord(LEARNER_ID, TEST_OWNER_USER_ID, manifest.lessonId);
  assert.ok(retried?.wordId);
});

test("refill at the end of the list returns an explicit null word without error", async () => {
  const { store } = createStoreForSeeds(generateWordSeeds(5));
  const manifest = await store.createManifest(LEARNER_ID, TEST_OWNER_USER_ID, TEST_LIST_ID);
  assert.ok(manifest);
  await masterLessonWordDirectly(store, manifest.lessonId, manifest.words[0].id);

  const outcome = await store.refillNextWord(LEARNER_ID, TEST_OWNER_USER_ID, manifest.lessonId);
  assert.deepEqual(outcome, { wordId: null });
});

test("no word is skipped or duplicated across repeated refills, and the lesson only completes once the database source is exhausted", async () => {
  const totalWords = 9;
  const { store, spy } = createStoreForSeeds(generateWordSeeds(totalWords));
  const manifest = await store.createManifest(LEARNER_ID, TEST_OWNER_USER_ID, TEST_LIST_ID);
  assert.ok(manifest);

  const seenCanonicalIds = new Set<string>(manifest.words.map((word) => word.id));
  let lessonWordId = manifest.words[0].id;

  for (let refillCount = 0; refillCount < totalWords - ACTIVE_POOL_SIZE; refillCount += 1) {
    await masterLessonWordDirectly(store, manifest.lessonId, lessonWordId);
    const outcome = await store.refillNextWord(LEARNER_ID, TEST_OWNER_USER_ID, manifest.lessonId);
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
  await masterLessonWordDirectly(store, manifest.lessonId, lessonWordId);
  const endOfList = await store.refillNextWord(LEARNER_ID, TEST_OWNER_USER_ID, manifest.lessonId);
  assert.deepEqual(endOfList, { wordId: null });

  // Master every remaining loaded-but-unmastered word; only once every one
  // of the totalWords descriptors has been loaded AND mastered does the
  // lesson reach lesson-complete with the authoritative total.
  const internal = store as unknown as {
    lessons: Map<
      string,
      {
        state: {
          next(): { kind: string; wordId?: string; totalWords?: number };
          getWordProgress(wordId: string): { spellingMastered: boolean };
        };
        canonicalWordIdByLessonWordId: Map<string, string>;
      }
    >;
  };
  const lesson = internal.lessons.get(manifest.lessonId)!;
  for (const lessonWordIdCandidate of lesson.canonicalWordIdByLessonWordId.keys()) {
    if (!lesson.state.getWordProgress(lessonWordIdCandidate).spellingMastered) {
      await masterLessonWordDirectly(store, manifest.lessonId, lessonWordIdCandidate);
    }
  }

  // The pending recap from the very last graded answer, and any queued
  // Word Search checkpoint, must be consumed before the true final step.
  let finalStep = lesson.state.next();
  for (
    let guard = 0;
    guard < 5 && (finalStep.kind === "answer-recap" || finalStep.kind === "word-search-checkpoint");
    guard += 1
  ) {
    finalStep = lesson.state.next();
  }
  assert.equal(finalStep.kind, "lesson-complete");
  assert.equal(finalStep.totalWords, totalWords);
});

test("definition-practice fails safely with a content-unavailable result when the list cannot supply four unique definitions", async () => {
  const { store } = createStoreForSeeds(generateWordSeeds(2));
  const manifest = await store.createManifest(LEARNER_ID, TEST_OWNER_USER_ID, TEST_LIST_ID);
  assert.ok(manifest);

  let capability = manifest.nextCapability;
  let contentType = peekContentType(store, capability);
  while (contentType !== "definition-practice") {
    const authorized = await store.authorizeContent(
      LEARNER_ID,
      TEST_OWNER_USER_ID,
      manifest.lessonId,
      capability,
      contentType
    );
    assert.ok(authorized);
    const built = await store.buildContent(authorized);
    assert.ok(built, `expected buildable content for ${contentType}`);
    store.recordContentResponse(authorized, built);
    assert.ok("nextCapability" in built.content && built.content.nextCapability);
    capability = built.content.nextCapability as string;
    contentType = peekContentType(store, capability);
  }

  const authorized = await store.authorizeContent(
    LEARNER_ID,
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

function peekContentType(
  store: VocabularyContentCapabilityStore,
  capability: string
):
  | "definition-display"
  | "definition-fun-fact"
  | "definition-practice"
  | "spelling-practice"
  | "answer-recap"
  | "word-search-checkpoint" {
  const internal = store as unknown as {
    capabilities: Map<string, { step: { kind: string } | null }>;
  };
  const kind = internal.capabilities.get(capability)?.step?.kind;
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

// Masters exactly one target word by activating and grading its definition
// and spelling attempts directly against the lesson state, bypassing
// `next()`'s weighted pool selection entirely. This is deterministic and
// side-effect-free with respect to every other pool word, so refill
// accounting (exactly one first-mastery event per call) is never disturbed
// by an incidental mastery of an unrelated word.
async function masterLessonWordDirectly(
  store: VocabularyContentCapabilityStore,
  lessonId: string,
  lessonWordId: string
): Promise<void> {
  const internal = store as unknown as {
    lessons: Map<
      string,
      {
        state: {
          next(): unknown;
          activateAttempt(descriptor: unknown): void;
          beginSubmission(payload: unknown): void;
          recordSubmission(result: unknown): void;
        };
      }
    >;
  };
  const lesson = internal.lessons.get(lessonId);
  assert.ok(lesson);

  gradeDirectly(lesson.state, lessonWordId, "definition");
  gradeDirectly(lesson.state, lessonWordId, "spelling");
}

function gradeDirectly(
  state: {
    next(): unknown;
    activateAttempt(descriptor: unknown): void;
    beginSubmission(payload: unknown): void;
    recordSubmission(result: unknown): void;
  },
  wordId: string,
  answerType: "definition" | "spelling"
): void {
  const attemptId = `synthetic-${answerType}-${wordId}-${Math.random()}`;
  if (answerType === "definition") {
    const choiceIds = ["choice-a", "choice-b", "choice-c", "choice-d"];
    state.activateAttempt({
      wordId,
      answerType: "definition",
      attemptId,
      validChoiceIds: choiceIds,
      review: false,
    });
    state.beginSubmission({ answerType: "definition", attemptId, selectedChoiceId: choiceIds[0] });
    state.recordSubmission({ answerType: "definition", correctChoiceId: choiceIds[0] });
  } else {
    state.activateAttempt({ wordId, answerType: "spelling", attemptId, validChoiceIds: [], review: false });
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
