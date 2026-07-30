import assert from "node:assert/strict";
import test from "node:test";
import {
  DELAYED_REVIEW_ANSWER_COUNT,
  VocabularyLessonState,
  type VocabularyLessonStep,
  type VocabularyWordProgress,
} from "../../src/learning-modules/vocabulary/state/VocabularyLessonState";

// VocabularyLessonState is a pure progression/state machine independent of
// content generation, grading, or a database source, so these tests use
// synthetic lesson word descriptors and synthetic attempt data rather than
// real content-building or a database pipeline. Lazy-loading/refill behavior
// (loadedWordCount vs totalWordCount, appendWord) is covered separately.
const HANDLES = Array.from({ length: 20 }, (_unused, index) => ({
  id: `word-${index + 1}`,
}));

test("introduces the first five active words in load order before practice", () => {
  const state = new VocabularyLessonState(HANDLES, HANDLES.length, () => 0);
  const introduced: string[] = [];
  let step = state.next();

  for (let index = 0; index < 5; index += 1) {
    assert.equal(step.kind, "definition-display");
    assert.equal(step.wordId, HANDLES[index].id);
    introduced.push(step.wordId);
    step = state.next();
    assert.equal(step.kind, "definition-fun-fact");
    assert.equal(step.wordId, HANDLES[index].id);
    step = state.next();
  }

  assert.deepEqual(introduced, HANDLES.slice(0, 5).map((word) => word.id));
  assert.equal(step.kind, "definition-practice");
});

test("one correct definition and one correct spelling master independently", () => {
  const word = HANDLES[0];
  const state = new VocabularyLessonState([word], 1, () => 0);
  let step = finishIntroductions(state, 1);

  step = answerAndAdvance(state, step, true);
  let progress = state.getWordProgress(word.id);
  assert.equal(progress.definitionConsecutiveCorrect, 1);
  assert.equal(progress.definitionMastered, true);
  assert.equal(step.kind, "spelling-practice");

  step = answerAndAdvance(state, step, false);
  progress = state.getWordProgress(word.id);
  assert.equal(progress.definitionMastered, true);
  assert.equal(progress.spellingConsecutiveCorrect, 0);
  assert.equal(progress.spellingMastered, false);

  step = answerAndAdvance(state, step, true);
  progress = state.getWordProgress(word.id);
  assert.equal(progress.spellingConsecutiveCorrect, 1);
  assert.equal(progress.spellingMastered, true);
  assert.equal(
    progress.nextReviewQuestionNumber,
    state.getStats().gradedAnswerCount + DELAYED_REVIEW_ANSWER_COUNT
  );
  assert.equal(step.kind, "lesson-complete");
});

test("normal practice keeps a five-word pool, avoids immediate repetition, and favors less-shown words", () => {
  let randomCall = 0;
  const state = new VocabularyLessonState(HANDLES.slice(0, 6), 6, () => {
    const values = [0.05, 0.25, 0.45, 0.65, 0.85];
    const value = values[randomCall % values.length];
    randomCall += 1;
    return value;
  });
  let step = finishIntroductions(state, 5);
  const seen: string[] = [];

  for (let count = 0; count < 10; count += 1) {
    assert.equal(step.kind, "definition-practice");
    if (step.kind !== "definition-practice") {
      throw new Error("Expected definition practice.");
    }
    seen.push(step.wordId);
    step = answerAndAdvance(state, step, false);
  }

  assert.ok(seen.every((wordId) => wordId !== HANDLES[5].id));
  for (let index = 1; index < seen.length; index += 1) {
    assert.notEqual(seen[index], seen[index - 1]);
  }
  const counts = HANDLES.slice(0, 5).map(
    (word) => state.getWordProgress(word.id).practicePresentationCount
  );
  assert.ok(Math.max(...counts) - Math.min(...counts) <= 2);
});

test("review is not due at 29 and becomes due exactly at 30", () => {
  const before = createScheduledState(29, [
    { wordId: HANDLES[0].id, dueAt: 30 },
  ]);
  const beforeStep = before.next();
  assert.equal(beforeStep.kind, "definition-practice");
  assert.equal(beforeStep.review, false);
  assert.equal(beforeStep.wordId, HANDLES[1].id);

  const boundary = createScheduledState(30, [
    { wordId: HANDLES[0].id, dueAt: 30 },
  ]);
  const boundaryStep = boundary.next();
  assert.equal(boundaryStep.kind, "definition-practice");
  assert.equal(boundaryStep.review, true);
  assert.equal(boundaryStep.wordId, HANDLES[0].id);
});

test("oldest and multiple due reviews stay ahead of normal practice, preserve sequencing, and reschedule from the actual count", () => {
  const state = createScheduledState(100, [
    { wordId: HANDLES[0].id, dueAt: 98 },
    { wordId: HANDLES[1].id, dueAt: 99 },
  ]);

  let step = state.next();
  assertReviewStep(step, HANDLES[0].id, "definition-practice");
  submitAnswer(state, step, true);
  assert.equal(state.next().kind, "answer-recap");

  step = state.next();
  assertReviewStep(step, HANDLES[0].id, "spelling-practice");
  submitAnswer(state, step, true);
  assert.equal(state.getStats().gradedAnswerCount, 102);
  assert.equal(
    state.getWordProgress(HANDLES[0].id).nextReviewQuestionNumber,
    132
  );
  assert.equal(state.next().kind, "answer-recap");

  step = state.next();
  assertReviewStep(step, HANDLES[1].id, "definition-practice");
});

test("a rescheduled review remains due-first until the all-words-introduced completion snapshot", () => {
  const state = createScheduledState(100, [
    { wordId: HANDLES[0].id, dueAt: 98 },
  ]);

  let step = state.next();
  assertReviewStep(step, HANDLES[0].id, "definition-practice");
  submitAnswer(state, step, true);
  assert.equal(state.next().kind, "answer-recap");

  step = state.next();
  assertReviewStep(step, HANDLES[0].id, "spelling-practice");
  submitAnswer(state, step, true);
  assert.equal(state.getStats().gradedAnswerCount, 102);
  assert.equal(
    state.getWordProgress(HANDLES[0].id).nextReviewQuestionNumber,
    132
  );
  assert.equal(state.next().kind, "answer-recap");

  setGradedAnswerCount(state, 132);
  step = state.next();
  assertReviewStep(step, HANDLES[0].id, "definition-practice");
});

test("a failed review resets both mastery stages and re-enters learning without hiding other due reviews", () => {
  const state = createScheduledState(30, [
    { wordId: HANDLES[0].id, dueAt: 28 },
    { wordId: HANDLES[1].id, dueAt: 29 },
  ]);

  const failedReview = state.next();
  assertReviewStep(failedReview, HANDLES[0].id, "definition-practice");
  submitAnswer(state, failedReview, false);
  assert.equal(state.next().kind, "answer-recap");

  const progress = state.getWordProgress(HANDLES[0].id);
  assert.equal(progress.definitionMastered, false);
  assert.equal(progress.spellingMastered, false);
  assert.equal(progress.definitionConsecutiveCorrect, 0);
  assert.equal(progress.spellingConsecutiveCorrect, 0);
  assert.equal(progress.nextReviewQuestionNumber, null);

  const next = state.next();
  assertReviewStep(next, HANDLES[1].id, "definition-practice");
});

test("a failed review does not immediately repeat in normal practice when another word is eligible", () => {
  const state = createScheduledState(30, [
    { wordId: HANDLES[0].id, dueAt: 30 },
  ]);

  const failedReview = state.next();
  assertReviewStep(failedReview, HANDLES[0].id, "definition-practice");
  submitAnswer(state, failedReview, false);
  assert.equal(state.next().kind, "answer-recap");

  const next = state.next();
  assert.equal(next.kind, "definition-practice");
  if (next.kind !== "definition-practice") {
    throw new Error("Expected normal definition practice.");
  }
  assert.equal(next.review, false);
  assert.notEqual(next.wordId, HANDLES[0].id);
});

test("review definition still advances directly to spelling for the same word", () => {
  const state = createScheduledState(30, [
    { wordId: HANDLES[0].id, dueAt: 30 },
  ]);

  const definitionReview = state.next();
  assertReviewStep(
    definitionReview,
    HANDLES[0].id,
    "definition-practice"
  );
  submitAnswer(state, definitionReview, true);
  assert.equal(state.next().kind, "answer-recap");

  const spellingReview = state.next();
  assertReviewStep(
    spellingReview,
    HANDLES[0].id,
    "spelling-practice"
  );
});

test("Lesson Complete never appears with a due or partially completed review and ignores only future reviews", () => {
  const state = new VocabularyLessonState([HANDLES[0]], 1, () => 0);
  setProgress(state, HANDLES[0].id, {
    introduced: true,
    definitionMastered: true,
    spellingMastered: true,
    nextReviewQuestionNumber: 10,
  });
  setGradedAnswerCount(state, 10);

  let step = state.next();
  assertReviewStep(step, HANDLES[0].id, "definition-practice");
  submitAnswer(state, step, true);
  assert.equal(state.next().kind, "answer-recap");

  step = state.next();
  assertReviewStep(step, HANDLES[0].id, "spelling-practice");
  submitAnswer(state, step, true);
  assert.equal(state.next().kind, "answer-recap");

  const complete = state.next();
  assert.equal(complete.kind, "lesson-complete");
  assert.equal(
    state.getWordProgress(HANDLES[0].id).nextReviewQuestionNumber,
    42
  );
});

test("always-correct 20-word flow inserts a recap after every answer, replaces mastered words, runs reviews, and completes", () => {
  let seed = 42;
  const state = new VocabularyLessonState(HANDLES, HANDLES.length, () => {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return seed / 4_294_967_296;
  });
  let step = state.next();
  let answerCount = 0;
  let recapCount = 0;
  let reviewCount = 0;
  let checkpointCount = 0;
  const introduced = new Set<string>();

  for (let guard = 0; guard < 5_000; guard += 1) {
    if (step.kind === "lesson-complete") {
      assert.equal(step.totalWords, 20);
      assert.equal(step.gradedAnswerCount, answerCount);
      assert.equal(recapCount, answerCount);
      assert.equal(introduced.size, 20);
      assert.ok(reviewCount > 0);
      assert.equal(checkpointCount, 4);
      return;
    }

    if (step.kind === "definition-display") {
      introduced.add(step.wordId);
      step = state.next();
      continue;
    }
    if (step.kind === "definition-fun-fact") {
      step = state.next();
      continue;
    }
    if (step.kind === "answer-recap") {
      recapCount += 1;
      step = state.next();
      continue;
    }
    if (step.kind === "word-search-checkpoint") {
      checkpointCount += 1;
      assert.equal(step.wordIds.length, 5);
      step = state.next();
      continue;
    }

    if (step.review) {
      reviewCount += 1;
    }
    submitAnswer(state, step, true);
    answerCount += 1;
    step = state.next();
  }

  assert.fail("The always-correct lesson did not complete within the guard.");
});

test("checkpoints appear for unique mastered words 1-5, 6-10, 11-15, and 16-20, each served once directly after its mastering recap", () => {
  const state = new VocabularyLessonState(HANDLES, HANDLES.length, deterministicRandom());
  const { checkpoints, precedingKinds, finalStep } = driveVocabularyLesson(
    state
  );
  const firstMasteryOrder = getCheckpointEligibleOrder(state);
  const expectedGroups = Array.from({ length: 4 }, (unused, index) =>
    firstMasteryOrder.slice(index * 5, index * 5 + 5)
  );

  assert.equal(checkpoints.length, 4);
  for (const kind of precedingKinds) {
    assert.equal(kind, "answer-recap");
  }
  assert.deepEqual(
    checkpoints.map((checkpoint) => checkpoint.wordIds),
    expectedGroups
  );
  assert.deepEqual(firstMasteryOrder, checkpoints.flatMap(({ wordIds }) => wordIds));
  assert.equal(new Set(firstMasteryOrder).size, 20);
  assert.equal(finalStep.kind, "lesson-complete");
});

test("the checkpoint after the fifth mastered word appears immediately after that word's answer recap and gates progress", () => {
  const words = HANDLES.slice(0, 5);
  const state = new VocabularyLessonState(words, words.length, deterministicRandom());
  const { checkpoints, precedingKinds, finalStep } = driveVocabularyLesson(
    state
  );

  assert.equal(checkpoints.length, 1);
  assert.equal(precedingKinds[0], "answer-recap");
  assert.equal(checkpoints[0].wordIds.length, 5);
  assert.deepEqual(
    new Set(checkpoints[0].wordIds),
    new Set(words.map((word) => word.id))
  );
  assert.equal(finalStep.kind, "lesson-complete");
});

test("no checkpoint appears when fewer than five unique words can reach full mastery", () => {
  const state = new VocabularyLessonState(HANDLES.slice(0, 4), 4, () => 0);
  const { checkpoints, finalStep } = driveVocabularyLesson(state);

  assert.equal(checkpoints.length, 0);
  assert.equal(finalStep.kind, "lesson-complete");
});

test("a failed review resets mastery but the word keeps its assigned group and cannot enter a later checkpoint", () => {
  const words = HANDLES.slice(0, 10);
  const state = new VocabularyLessonState(words, words.length, deterministicRandom());

  const phase1 = driveVocabularyLesson(state, { stopAfterCheckpoints: 1 });
  assert.equal(phase1.checkpoints.length, 1);
  const group1WordIds = phase1.checkpoints[0].wordIds;
  assert.equal(group1WordIds.length, 5);

  const resetWordId = group1WordIds[0];
  assert.equal(state.getWordProgress(resetWordId).spellingMastered, true);

  // Force the delayed review due immediately instead of waiting for the
  // normal 30-answer delay, then fail it exactly once during phase two.
  setProgress(state, resetWordId, {
    reviewStage: "definition-pending",
    nextReviewQuestionNumber: null,
  });

  let reviewFailed = false;
  const phase2 = driveVocabularyLesson(state, {
    initialStep: phase1.finalStep,
    decideCorrect: (step) => {
      if (!reviewFailed && step.review && step.wordId === resetWordId) {
        reviewFailed = true;
        return false;
      }
      return true;
    },
  });

  assert.equal(reviewFailed, true, "expected the forced review to occur");
  assert.equal(state.getWordProgress(resetWordId).spellingMastered, true);
  assert.equal(phase2.checkpoints.length, 1);

  const group2WordIds = phase2.checkpoints[0].wordIds;
  assert.equal(group2WordIds.length, 5);
  assert.ok(!group2WordIds.includes(resetWordId));

  const allWordIds = [...group1WordIds, ...group2WordIds];
  assert.equal(new Set(allWordIds).size, 10);
  assert.deepEqual(new Set(allWordIds), new Set(words.map((word) => word.id)));
  assert.equal(phase2.finalStep.kind, "lesson-complete");
});

test("a served checkpoint cannot be queued again by repeated eligibility recomputation within one attempt", () => {
  const state = new VocabularyLessonState(
    HANDLES.slice(0, 10),
    10,
    deterministicRandom()
  );
  const checkpoint = driveToNextCheckpoint(state);
  const internal = state as unknown as {
    registerCheckpointEligibility(wordId: string): void;
    pendingCheckpointWordIds: string[] | null;
    servedCheckpointGroupCount: number;
  };

  assert.equal(internal.servedCheckpointGroupCount, 1);
  for (const wordId of checkpoint.wordIds) {
    internal.registerCheckpointEligibility(wordId);
    internal.registerCheckpointEligibility(wordId);
  }

  assert.equal(internal.pendingCheckpointWordIds, null);
  assert.notEqual(state.next().kind, "word-search-checkpoint");
});

test("checkpoint advancement leaves mastery, stats, streaks, and review scheduling unchanged", () => {
  const words = HANDLES.slice(0, 10);
  const state = new VocabularyLessonState(words, words.length, deterministicRandom());
  driveToNextCheckpoint(state);
  const before = snapshotAuthoritativeLearningState(state, words);

  const nextStep = state.next();

  assert.notEqual(nextStep.kind, "word-search-checkpoint");
  assert.deepEqual(snapshotAuthoritativeLearningState(state, words), before);
  assert.equal("reward" in (state as unknown as Record<string, unknown>), false);
  assert.equal("rewards" in (state as unknown as Record<string, unknown>), false);
});

function deterministicRandom(): () => number {
  let seed = 42;
  return () => {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return seed / 4_294_967_296;
  };
}

type CheckpointRecord = { wordIds: string[] };

type DriveVocabularyLessonOptions = {
  initialStep?: VocabularyLessonStep;
  stopAfterCheckpoints?: number;
  guard?: number;
  decideCorrect?: (
    step: Extract<
      VocabularyLessonStep,
      { kind: "definition-practice" | "spelling-practice" }
    >
  ) => boolean;
};

// Drives an always-correct-by-default lesson, recording every Word Search
// checkpoint and the step kind that immediately preceded it. Resumable via
// `initialStep` so a test can perform direct state surgery (e.g. forcing a
// review due) between two drive phases without skipping a step.
function driveVocabularyLesson(
  state: VocabularyLessonState,
  options: DriveVocabularyLessonOptions = {}
): {
  checkpoints: CheckpointRecord[];
  finalStep: VocabularyLessonStep;
  precedingKinds: string[];
} {
  const decideCorrect = options.decideCorrect ?? (() => true);
  const checkpoints: CheckpointRecord[] = [];
  const precedingKinds: string[] = [];
  let step = options.initialStep ?? state.next();
  let lastKind: string = step.kind;
  const guard = options.guard ?? 5_000;

  for (let iteration = 0; iteration < guard; iteration += 1) {
    if (step.kind === "lesson-complete") {
      return { checkpoints, finalStep: step, precedingKinds };
    }

    if (step.kind === "word-search-checkpoint") {
      checkpoints.push({ wordIds: step.wordIds });
      precedingKinds.push(lastKind);
      lastKind = step.kind;
      step = state.next();
      if (
        options.stopAfterCheckpoints !== undefined &&
        checkpoints.length >= options.stopAfterCheckpoints
      ) {
        return { checkpoints, finalStep: step, precedingKinds };
      }
      continue;
    }

    if (
      step.kind === "definition-display" ||
      step.kind === "definition-fun-fact" ||
      step.kind === "answer-recap"
    ) {
      lastKind = step.kind;
      step = state.next();
      continue;
    }

    submitAnswer(state, step, decideCorrect(step));
    lastKind = step.kind;
    step = state.next();
  }

  throw new Error("Vocabulary lesson driver did not finish within guard.");
}

function driveToNextCheckpoint(
  state: VocabularyLessonState
): Extract<VocabularyLessonStep, { kind: "word-search-checkpoint" }> {
  let step = state.next();

  for (let iteration = 0; iteration < 5_000; iteration += 1) {
    if (step.kind === "word-search-checkpoint") {
      return step;
    }
    if (step.kind === "lesson-complete") {
      throw new Error("Lesson completed before a checkpoint appeared.");
    }
    if (
      step.kind === "definition-display" ||
      step.kind === "definition-fun-fact" ||
      step.kind === "answer-recap"
    ) {
      step = state.next();
      continue;
    }

    submitAnswer(state, step, true);
    step = state.next();
  }

  throw new Error("Vocabulary checkpoint did not appear within the guard.");
}

function getCheckpointEligibleOrder(state: VocabularyLessonState): string[] {
  const internal = state as unknown as {
    checkpointEligibleOrder: string[];
  };
  return [...internal.checkpointEligibleOrder];
}

function snapshotAuthoritativeLearningState(
  state: VocabularyLessonState,
  words: readonly { id: string }[]
): {
  stats: ReturnType<VocabularyLessonState["getStats"]>;
  progress: Array<{ wordId: string; value: VocabularyWordProgress }>;
} {
  return {
    stats: state.getStats(),
    progress: words.map((word) => ({
      wordId: word.id,
      value: state.getWordProgress(word.id),
    })),
  };
}

function finishIntroductions(
  state: VocabularyLessonState,
  count: number
): VocabularyLessonStep {
  let step = state.next();
  for (let index = 0; index < count; index += 1) {
    assert.equal(step.kind, "definition-display");
    step = state.next();
    assert.equal(step.kind, "definition-fun-fact");
    step = state.next();
  }
  return step;
}

function answerAndAdvance(
  state: VocabularyLessonState,
  step: VocabularyLessonStep,
  correct: boolean
): VocabularyLessonStep {
  submitAnswer(state, step, correct);
  const recap = state.next();
  assert.equal(recap.kind, "answer-recap");
  return state.next();
}

let syntheticAttemptCounter = 0;

function submitAnswer(
  state: VocabularyLessonState,
  step: VocabularyLessonStep,
  correct: boolean
): void {
  syntheticAttemptCounter += 1;

  if (step.kind === "definition-practice") {
    const attemptId = `synthetic-definition-attempt-${syntheticAttemptCounter}`;
    const choiceIds = ["choice-a", "choice-b", "choice-c", "choice-d"];
    const correctChoiceId = choiceIds[0];
    const selectedChoiceId = correct ? correctChoiceId : choiceIds[1];

    state.activateAttempt({
      wordId: step.wordId,
      answerType: "definition",
      attemptId,
      validChoiceIds: choiceIds,
      review: step.review,
    });
    state.beginSubmission({
      answerType: "definition",
      attemptId,
      selectedChoiceId,
    });
    state.recordSubmission({ answerType: "definition", correctChoiceId });
    return;
  }

  if (step.kind === "spelling-practice") {
    const attemptId = `synthetic-spelling-attempt-${syntheticAttemptCounter}`;
    const canonicalWord = "synthetic-word";
    state.activateAttempt({
      wordId: step.wordId,
      answerType: "spelling",
      attemptId,
      validChoiceIds: [],
      review: step.review,
    });
    state.beginSubmission({
      answerType: "spelling",
      attemptId,
      answer: correct ? canonicalWord : "incorrect",
    });
    state.recordSubmission(
      correct
        ? { answerType: "spelling", correct: true }
        : {
            answerType: "spelling",
            correct: false,
            correctAnswer: canonicalWord,
          }
    );
    return;
  }

  throw new Error(`Cannot submit an answer for ${step.kind}.`);
}

function createScheduledState(
  gradedAnswerCount: number,
  scheduled: Array<{ wordId: string; dueAt: number }>
): VocabularyLessonState {
  const state = new VocabularyLessonState(HANDLES.slice(0, 3), 3, () => 0);
  for (const word of HANDLES.slice(0, 3)) {
    setProgress(state, word.id, { introduced: true });
  }
  for (const review of scheduled) {
    setProgress(state, review.wordId, {
      definitionConsecutiveCorrect: 3,
      definitionMastered: true,
      spellingConsecutiveCorrect: 3,
      spellingMastered: true,
      nextReviewQuestionNumber: review.dueAt,
    });
  }
  setGradedAnswerCount(state, gradedAnswerCount);
  return state;
}

function setProgress(
  state: VocabularyLessonState,
  wordId: string,
  changes: Partial<VocabularyWordProgress>
): void {
  const internal = state as unknown as {
    progressByWordId: Map<string, VocabularyWordProgress>;
  };
  const progress = internal.progressByWordId.get(wordId);
  assert.ok(progress);
  Object.assign(progress, changes);
}

function setGradedAnswerCount(
  state: VocabularyLessonState,
  gradedAnswerCount: number
): void {
  const internal = state as unknown as { gradedAnswerCount: number };
  internal.gradedAnswerCount = gradedAnswerCount;
}

function assertReviewStep(
  step: VocabularyLessonStep,
  wordId: string,
  kind: "definition-practice" | "spelling-practice"
): void {
  assert.equal(step.kind, kind);
  if (step.kind !== kind) {
    throw new Error(`Expected ${kind}.`);
  }
  assert.equal(step.review, true);
  assert.equal(step.wordId, wordId);
}
