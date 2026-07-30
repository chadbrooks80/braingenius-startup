import assert from "node:assert/strict";
import test from "node:test";
import {
  beginVocabularySubmission,
  cancelVocabularySubmission,
  createVocabularyActiveAttempt,
  recordVocabularySubmission,
  requireVocabularyAttemptAnswered,
} from "../../src/learning-modules/vocabulary/state/VocabularyActiveAttempt";

// VocabularyActiveAttempt is a pure state machine independent of content
// generation or grading, so these tests use synthetic attempt/choice IDs
// rather than a real content-building or database pipeline.
const WORD_ID = "word-01";
const ATTEMPT_ID = "attempt-definition-01";
const CHOICE_IDS = ["choice-a", "choice-b", "choice-c", "choice-d"];

test("active-attempt guards reject stale, mismatched, invalid, and duplicate submissions", () => {
  const attempt = createVocabularyActiveAttempt({
    wordId: WORD_ID,
    answerType: "definition",
    attemptId: ATTEMPT_ID,
    validChoiceIds: CHOICE_IDS,
    review: false,
  });

  assert.throws(
    () =>
      beginVocabularySubmission(attempt, {
        answerType: "definition",
        attemptId: "stale-attempt",
        selectedChoiceId: CHOICE_IDS[0],
      }),
    /stale attemptId/
  );
  assert.throws(
    () =>
      beginVocabularySubmission(attempt, {
        answerType: "spelling",
        attemptId: ATTEMPT_ID,
        answer: "brilliant",
      }),
    /does not accept a spelling answer/
  );
  assert.throws(
    () =>
      beginVocabularySubmission(attempt, {
        answerType: "definition",
        attemptId: ATTEMPT_ID,
        selectedChoiceId: "not-offered",
      }),
    /was not offered/
  );

  beginVocabularySubmission(attempt, {
    answerType: "definition",
    attemptId: ATTEMPT_ID,
    selectedChoiceId: CHOICE_IDS[0],
  });
  assert.throws(
    () =>
      beginVocabularySubmission(attempt, {
        answerType: "definition",
        attemptId: ATTEMPT_ID,
        selectedChoiceId: CHOICE_IDS[0],
      }),
    /already has an answer pending/
  );
});

test("cancellation permits retry and confirmed feedback completes the attempt", () => {
  const correctChoiceId = CHOICE_IDS[0];
  const attempt = createVocabularyActiveAttempt({
    wordId: WORD_ID,
    answerType: "definition",
    attemptId: ATTEMPT_ID,
    validChoiceIds: CHOICE_IDS,
    review: true,
  });
  const submission = {
    answerType: "definition" as const,
    attemptId: ATTEMPT_ID,
    selectedChoiceId: correctChoiceId,
  };

  beginVocabularySubmission(attempt, submission);
  cancelVocabularySubmission(attempt);
  beginVocabularySubmission(attempt, submission);
  const outcome = recordVocabularySubmission(attempt, {
    answerType: "definition",
    correctChoiceId,
  });

  assert.deepEqual(outcome, {
    wordId: WORD_ID,
    answerType: "definition",
    review: true,
    correct: true,
  });
  assert.doesNotThrow(() => requireVocabularyAttemptAnswered(attempt));
  assert.throws(
    () => beginVocabularySubmission(attempt, submission),
    /already been answered/
  );
});
