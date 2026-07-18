import assert from "node:assert/strict";
import test from "node:test";
import { getVocabularyAnswer } from "../../src/learning-modules/vocabulary/data/getCorrectAnswer";
import { getWordList } from "../../src/learning-modules/vocabulary/data/getWordList";
import { getVocabularyContent } from "../../src/learning-modules/vocabulary/server/getVocabularyContent";
import {
  DELAYED_REVIEW_ANSWER_COUNT,
  VocabularyLessonState,
  type VocabularyLessonStep,
  type VocabularyWordProgress,
} from "../../src/learning-modules/vocabulary/state/VocabularyLessonState";

const WORDS = getWordList("word_list_id")!;
const HANDLES = WORDS.map((word) => ({ id: word.id }));

test("introduces the first five active words in fixture order before practice", () => {
  const state = new VocabularyLessonState(HANDLES, () => 0);
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

test("definition and spelling streaks master independently and reset only their own stage", () => {
  const word = HANDLES[0];
  const state = new VocabularyLessonState([word], () => 0);
  let step = finishIntroductions(state, 1);

  step = answerAndAdvance(state, step, true);
  step = answerAndAdvance(state, step, true);
  assert.equal(state.getWordProgress(word.id).definitionConsecutiveCorrect, 2);

  step = answerAndAdvance(state, step, false);
  assert.equal(state.getWordProgress(word.id).definitionConsecutiveCorrect, 0);

  for (let count = 0; count < 3; count += 1) {
    step = answerAndAdvance(state, step, true);
  }
  assert.equal(state.getWordProgress(word.id).definitionMastered, true);
  assert.equal(step.kind, "spelling-practice");

  step = answerAndAdvance(state, step, true);
  step = answerAndAdvance(state, step, true);
  step = answerAndAdvance(state, step, false);
  assert.equal(state.getWordProgress(word.id).definitionMastered, true);
  assert.equal(state.getWordProgress(word.id).spellingConsecutiveCorrect, 0);

  for (let count = 0; count < 3; count += 1) {
    step = answerAndAdvance(state, step, true);
  }
  const progress = state.getWordProgress(word.id);
  assert.equal(progress.spellingMastered, true);
  assert.equal(
    progress.nextReviewQuestionNumber,
    state.getStats().gradedAnswerCount + DELAYED_REVIEW_ANSWER_COUNT
  );
  assert.equal(step.kind, "lesson-complete");
});

test("normal practice keeps a five-word pool, avoids immediate repetition, and favors less-shown words", () => {
  let randomCall = 0;
  const state = new VocabularyLessonState(HANDLES.slice(0, 6), () => {
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
  const state = new VocabularyLessonState([HANDLES[0]], () => 0);
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
  const state = new VocabularyLessonState(HANDLES, () => {
    seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
    return seed / 4_294_967_296;
  });
  let step = state.next();
  let answerCount = 0;
  let recapCount = 0;
  let reviewCount = 0;
  const introduced = new Set<string>();

  for (let guard = 0; guard < 5_000; guard += 1) {
    if (step.kind === "lesson-complete") {
      assert.equal(step.totalWords, 20);
      assert.equal(step.gradedAnswerCount, answerCount);
      assert.equal(recapCount, answerCount);
      assert.equal(introduced.size, 20);
      assert.ok(reviewCount > 0);
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

    if (step.review) {
      reviewCount += 1;
    }
    submitAnswer(state, step, true);
    answerCount += 1;
    step = state.next();
  }

  assert.fail("The always-correct lesson did not complete within the guard.");
});

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

function submitAnswer(
  state: VocabularyLessonState,
  step: VocabularyLessonStep,
  correct: boolean
): void {
  if (step.kind === "definition-practice") {
    const content = getVocabularyContent({
      contentType: "definition-practice",
      wordListId: "word_list_id",
      wordId: step.wordId,
    })!;
    const serverResult = getVocabularyAnswer({
      answerType: "definition",
      attemptId: content.attemptId,
      selectedChoiceId: content.choices[0].id,
    });
    assert.ok(serverResult && serverResult.answerType === "definition");
    const selectedChoiceId = correct
      ? serverResult.correctChoiceId
      : content.choices.find(
          (choice) => choice.id !== serverResult.correctChoiceId
        )!.id;

    state.activateAttempt({
      wordId: step.wordId,
      answerType: "definition",
      attemptId: content.attemptId,
      validChoiceIds: content.choices.map((choice) => choice.id),
      review: step.review,
    });
    state.beginSubmission({
      answerType: "definition",
      attemptId: content.attemptId,
      selectedChoiceId,
    });
    state.recordSubmission(serverResult);
    return;
  }

  if (step.kind === "spelling-practice") {
    const content = getVocabularyContent({
      contentType: "spelling-practice",
      wordListId: "word_list_id",
      wordId: step.wordId,
    })!;
    // The public projection intentionally omits the word; the test reads the
    // canonical word from the server-only fixture, as the answer handler does.
    const canonicalWord = WORDS.find((word) => word.id === step.wordId)!.word;
    state.activateAttempt({
      wordId: step.wordId,
      answerType: "spelling",
      attemptId: content.attemptId,
      validChoiceIds: [],
      review: step.review,
    });
    state.beginSubmission({
      answerType: "spelling",
      attemptId: content.attemptId,
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
  const state = new VocabularyLessonState(HANDLES.slice(0, 3), () => 0);
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
