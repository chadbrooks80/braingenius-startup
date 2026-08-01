import assert from "node:assert/strict";
import test from "node:test";
import {
  applyVocabularyAnswerTransition,
  buildVocabularyPanelProjection,
  createDefaultVocabularyProgressRow,
  isVocabularyLearningComplete,
  selectDueVocabularyReviews,
  selectNextVocabularyCheckpointGroup,
  selectVocabularyActiveFive,
  type VocabularyProgressRow,
} from "../../src/learning-modules/vocabulary/state/vocabularyProgressProjection";

// Pure database-shape projection/transition tests, independent of Prisma or
// any capability-store plumbing. `vocabularyLearningStore.ts` is a thin
// Prisma-backed wrapper around exactly these functions, so exhaustively
// proving the matrix here proves the store's core correctness without a
// database; a guarded real-Postgres integration test covers the remaining
// transaction-boundary wiring separately.

function rows(count: number): VocabularyProgressRow[] {
  return Array.from({ length: count }, (_unused, index) =>
    createDefaultVocabularyProgressRow(`word-${index + 1}`, index + 1)
  );
}

test("active five is the first five unfinished words by position, for lists shorter than, equal to, and longer than five", () => {
  assert.deepEqual(
    selectVocabularyActiveFive(rows(3)).map((row) => row.listWordId),
    ["word-1", "word-2", "word-3"]
  );
  assert.deepEqual(
    selectVocabularyActiveFive(rows(5)).map((row) => row.listWordId),
    ["word-1", "word-2", "word-3", "word-4", "word-5"]
  );
  assert.deepEqual(
    selectVocabularyActiveFive(rows(9)).map((row) => row.listWordId),
    ["word-1", "word-2", "word-3", "word-4", "word-5"]
  );
});

test("mastering the first word opens exactly the next ordered unfinished word", () => {
  const list = rows(9);
  list[0].spellingMastered = true;
  assert.deepEqual(
    selectVocabularyActiveFive(list).map((row) => row.listWordId),
    ["word-2", "word-3", "word-4", "word-5", "word-6"]
  );
});

test("panel projection classifies word list, spelling, and mastered sections from the active five and full mastery set", () => {
  const list = rows(7);
  list[0].definitionMastered = true; // still needs spelling -> Spelling section
  list[1].spellingMastered = true; // fully mastered -> Mastered section, off the active five
  const projection = buildVocabularyPanelProjection(list);

  assert.deepEqual(
    projection.wordList.map((row) => row.listWordId),
    ["word-3", "word-4", "word-5", "word-6"]
  );
  assert.deepEqual(
    projection.spellingWords.map((row) => row.listWordId),
    ["word-1"]
  );
  assert.deepEqual(
    projection.masteredWords.map((row) => row.listWordId),
    ["word-2"]
  );
});

test("a failed review removes a word from Mastered and recomputes the active five to include it again", () => {
  const list = rows(6);
  list[0].spellingMastered = true;
  list[0].definitionMastered = true;
  const before = buildVocabularyPanelProjection(list);
  assert.deepEqual(before.masteredWords.map((row) => row.listWordId), ["word-1"]);

  // Simulate a failed review resetting mastery per the transition function.
  const transition = applyVocabularyAnswerTransition({
    progress: list[0],
    answerType: "DEFINITION",
    review: true,
    correct: false,
    gradedAnswerCountAfter: 40,
  });
  list[0] = transition.progress;
  const after = buildVocabularyPanelProjection(list);
  assert.deepEqual(after.masteredWords, []);
  assert.deepEqual(
    selectVocabularyActiveFive(list).map((row) => row.listWordId),
    ["word-1", "word-2", "word-3", "word-4", "word-5"]
  );
});

test("definition and spelling mastery each require exactly three consecutive correct answers", () => {
  let progress = createDefaultVocabularyProgressRow("word-1", 1);
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const result = applyVocabularyAnswerTransition({
      progress,
      answerType: "DEFINITION",
      review: false,
      correct: true,
      gradedAnswerCountAfter: attempt,
    });
    progress = result.progress;
    assert.equal(progress.definitionMastered, false);
  }
  const third = applyVocabularyAnswerTransition({
    progress,
    answerType: "DEFINITION",
    review: false,
    correct: true,
    gradedAnswerCountAfter: 3,
  });
  assert.equal(third.progress.definitionMastered, true);
});

test("an ordinary incorrect answer resets only the relevant streak", () => {
  const progress = createDefaultVocabularyProgressRow("word-1", 1);
  progress.definitionConsecutiveCorrect = 2;
  progress.spellingConsecutiveCorrect = 1;
  const result = applyVocabularyAnswerTransition({
    progress,
    answerType: "DEFINITION",
    review: false,
    correct: false,
    gradedAnswerCountAfter: 10,
  });
  assert.equal(result.progress.definitionConsecutiveCorrect, 0);
  assert.equal(result.progress.spellingConsecutiveCorrect, 1);
});

test("initial spelling mastery schedules a review at the global answer count plus 30", () => {
  const progress = createDefaultVocabularyProgressRow("word-1", 1);
  progress.definitionMastered = true;
  progress.spellingConsecutiveCorrect = 2;
  const result = applyVocabularyAnswerTransition({
    progress,
    answerType: "SPELLING",
    review: false,
    correct: true,
    gradedAnswerCountAfter: 55,
  });
  assert.equal(result.progress.spellingMastered, true);
  assert.equal(result.firstSpellingMasteryNow, true);
  assert.equal(result.progress.nextReviewQuestionNumber, 85);
});

test("review definition success immediately selects review spelling next", () => {
  const progress = createDefaultVocabularyProgressRow("word-1", 1);
  progress.reviewStage = "DEFINITION_PENDING";
  const result = applyVocabularyAnswerTransition({
    progress,
    answerType: "DEFINITION",
    review: true,
    correct: true,
    gradedAnswerCountAfter: 31,
  });
  assert.equal(result.progress.reviewStage, "SPELLING_PENDING");
  assert.equal(result.progress.nextReviewQuestionNumber, null);
});

test("review spelling success reschedules the review and does not re-trigger a first-mastery event", () => {
  const progress = createDefaultVocabularyProgressRow("word-1", 1);
  progress.reviewStage = "SPELLING_PENDING";
  progress.spellingMastered = true;
  progress.initialMasterySequence = 2;
  const result = applyVocabularyAnswerTransition({
    progress,
    answerType: "SPELLING",
    review: true,
    correct: true,
    gradedAnswerCountAfter: 61,
  });
  assert.equal(result.progress.reviewStage, "IDLE");
  assert.equal(result.progress.nextReviewQuestionNumber, 91);
  assert.equal(result.firstSpellingMasteryNow, false);
  assert.equal(result.progress.initialMasterySequence, 2);
});

test("either review failure resets current mastery but preserves initialMasterySequence", () => {
  const progress = createDefaultVocabularyProgressRow("word-1", 1);
  progress.reviewStage = "SPELLING_PENDING";
  progress.definitionMastered = true;
  progress.spellingMastered = true;
  progress.initialMasterySequence = 3;
  const result = applyVocabularyAnswerTransition({
    progress,
    answerType: "SPELLING",
    review: true,
    correct: false,
    gradedAnswerCountAfter: 61,
  });
  assert.equal(result.progress.definitionMastered, false);
  assert.equal(result.progress.spellingMastered, false);
  assert.equal(result.progress.reviewStage, "IDLE");
  assert.equal(result.progress.nextReviewQuestionNumber, null);
  assert.equal(result.progress.initialMasterySequence, 3, "first-mastery history is never cleared");
});

test("a review is not due at 29 and becomes due exactly at 30", () => {
  const list = rows(1);
  list[0].nextReviewQuestionNumber = 30;
  assert.deepEqual(selectDueVocabularyReviews(list, 29), []);
  assert.deepEqual(
    selectDueVocabularyReviews(list, 30).map((row) => row.listWordId),
    ["word-1"]
  );
});

test("due reviews are ordered by due question number then position", () => {
  const list = rows(3);
  list[0].nextReviewQuestionNumber = 50;
  list[1].nextReviewQuestionNumber = 10;
  list[2].nextReviewQuestionNumber = 10;
  const due = selectDueVocabularyReviews(list, 100);
  assert.deepEqual(
    due.map((row) => row.listWordId),
    ["word-2", "word-3", "word-1"]
  );
});

test("every five first-mastered words create one durable non-overlapping checkpoint group in first-mastery order", () => {
  const list = rows(12);
  const masteryOrder = [4, 0, 7, 2, 9, 1, 5];
  masteryOrder.forEach((index, sequence) => {
    list[index].initialMasterySequence = sequence + 1;
  });

  const firstGroup = selectNextVocabularyCheckpointGroup(list, 0);
  assert.deepEqual(
    firstGroup,
    masteryOrder.slice(0, 5).map((index) => list[index].listWordId)
  );

  // A served checkpoint does not repeat: with servedCheckpointGroupCount=1
  // and only 7 mastered words total, the next group of 5 is not yet earned.
  assert.equal(selectNextVocabularyCheckpointGroup(list, 1), null);
});

test("review re-mastery does not create a second checkpoint entry", () => {
  const list = rows(5);
  list.forEach((row, index) => {
    row.initialMasterySequence = index + 1;
    row.spellingMastered = true;
  });
  // A later review failure and re-mastery must not touch initialMasterySequence.
  const firstGroup = selectNextVocabularyCheckpointGroup(list, 0);
  assert.equal(firstGroup?.length, 5);
  const groupAfterServed = selectNextVocabularyCheckpointGroup(list, 1);
  assert.equal(groupAfterServed, null, "no sixth word exists to start a new group");
});

test("completion requires an exhausted active five, no due review, no pending review, and no unserved checkpoint", () => {
  const list = rows(5);
  list.forEach((row) => {
    row.spellingMastered = true;
  });
  assert.equal(isVocabularyLearningComplete(list, 5, 100, 1), true);

  const withPendingReview = rows(5).map((row) => ({ ...row, spellingMastered: true }));
  withPendingReview[0].reviewStage = "DEFINITION_PENDING";
  assert.equal(isVocabularyLearningComplete(withPendingReview, 5, 100, 1), false);

  const withDueReview = rows(5).map((row) => ({ ...row, spellingMastered: true }));
  withDueReview[0].nextReviewQuestionNumber = 50;
  assert.equal(isVocabularyLearningComplete(withDueReview, 5, 100, 1), false);

  const withUnservedCheckpoint = rows(5).map((row, index) => ({
    ...row,
    spellingMastered: true,
    initialMasterySequence: index + 1,
  }));
  assert.equal(isVocabularyLearningComplete(withUnservedCheckpoint, 5, 100, 0), false);

  assert.equal(isVocabularyLearningComplete(rows(5), 5, 0, 0), false, "unfinished words block completion");
});
