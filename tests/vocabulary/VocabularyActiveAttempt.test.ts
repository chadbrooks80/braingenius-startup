import assert from "node:assert/strict";
import test from "node:test";
import { getVocabularyAnswer } from "../../src/learning-modules/vocabulary/data/getCorrectAnswer";
import { getVocabularyContent } from "../../src/learning-modules/vocabulary/server/getVocabularyContent";
import {
  beginVocabularySubmission,
  cancelVocabularySubmission,
  createVocabularyActiveAttempt,
  recordVocabularySubmission,
  requireVocabularyAttemptAnswered,
} from "../../src/learning-modules/vocabulary/state/VocabularyActiveAttempt";

const WORD_ID = "word-01";
const CONTENT = getVocabularyContent({
  contentType: "definition-practice",
  wordListId: "word_list_id",
  wordId: WORD_ID,
})!;

test("active-attempt guards reject stale, mismatched, invalid, and duplicate submissions", () => {
  const attempt = createVocabularyActiveAttempt({
    wordId: WORD_ID,
    answerType: "definition",
    attemptId: CONTENT.attemptId,
    validChoiceIds: CONTENT.choices.map((choice) => choice.id),
    review: false,
  });

  assert.throws(
    () =>
      beginVocabularySubmission(attempt, {
        answerType: "definition",
        attemptId: "stale-attempt",
        selectedChoiceId: CONTENT.choices[0].id,
      }),
    /stale attemptId/
  );
  assert.throws(
    () =>
      beginVocabularySubmission(attempt, {
        answerType: "spelling",
        attemptId: CONTENT.attemptId,
        answer: "brilliant",
      }),
    /does not accept a spelling answer/
  );
  assert.throws(
    () =>
      beginVocabularySubmission(attempt, {
        answerType: "definition",
        attemptId: CONTENT.attemptId,
        selectedChoiceId: "not-offered",
      }),
    /was not offered/
  );

  beginVocabularySubmission(attempt, {
    answerType: "definition",
    attemptId: CONTENT.attemptId,
    selectedChoiceId: CONTENT.choices[0].id,
  });
  assert.throws(
    () =>
      beginVocabularySubmission(attempt, {
        answerType: "definition",
        attemptId: CONTENT.attemptId,
        selectedChoiceId: CONTENT.choices[0].id,
      }),
    /already has an answer pending/
  );
});

test("cancellation permits retry and confirmed feedback completes the attempt", () => {
  const serverResult = getVocabularyAnswer({
    answerType: "definition",
    attemptId: CONTENT.attemptId,
    selectedChoiceId: CONTENT.choices[0].id,
  });
  assert.ok(serverResult && serverResult.answerType === "definition");
  const correctChoiceId = serverResult.correctChoiceId;
  const attempt = createVocabularyActiveAttempt({
    wordId: WORD_ID,
    answerType: "definition",
    attemptId: CONTENT.attemptId,
    validChoiceIds: CONTENT.choices.map((choice) => choice.id),
    review: true,
  });
  const submission = {
    answerType: "definition" as const,
    attemptId: CONTENT.attemptId,
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
