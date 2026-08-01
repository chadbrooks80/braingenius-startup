import assert from "node:assert/strict";
import test from "node:test";
import { handleVocabularyAnswerRequest } from "../../src/app/api/learning/vocabulary/submit-answer/handleVocabularyAnswerRequest";
import type {
  VocabularyAnswerApiResult,
  VocabularyAnswerSubmission,
} from "../../src/learning-modules/vocabulary/types";
import type { VocabularyProgressSnapshot } from "../../src/learning-modules/vocabulary/data/vocabularyContentTypes";

const FAKE_PROGRESS: VocabularyProgressSnapshot = {
  learningStatus: "ACTIVE",
  gradedAnswerCount: 1,
  correctAnswerCount: 1,
  incorrectAnswerCount: 0,
  stateVersion: 1,
  panel: { wordList: [], spellingWords: [], masteredWords: [] },
};
import {
  parseVocabularyAnswerSubmission,
  parseVocabularySubmitAnswerPayload,
} from "../../src/learning-modules/vocabulary/validation/parseVocabularySubmitAnswerPayload";

test("strictly accepts only the definition interaction fields", () => {
  assert.deepEqual(
    parseVocabularySubmitAnswerPayload({
      attemptId: "attempt-1",
      selectedChoiceId: "choice-a",
    }),
    {
      answerType: "definition",
      attemptId: "attempt-1",
      selectedChoiceId: "choice-a",
    }
  );

  for (const payload of [
    {
      attemptId: "attempt-1",
      selectedChoiceId: "choice-a",
      unexpected: true,
    },
    {
      attemptId: "attempt-1",
      selectedChoiceId: "choice-a",
      answer: "word",
    },
    {
      answerType: "definition",
      attemptId: "attempt-1",
      selectedChoiceId: "choice-a",
    },
  ]) {
    assert.throws(
      () => parseVocabularySubmitAnswerPayload(payload),
      /missing, unknown, or mismatched fields/
    );
  }
});

test("the module parser and the answer endpoint accept and reject identical submission shapes", async () => {
  const parityCases: Array<{ body: unknown; accepted: boolean }> = [
    {
      body: {
        answerType: "definition",
        attemptId: "attempt-1",
        selectedChoiceId: "choice-a",
      },
      accepted: true,
    },
    {
      body: { answerType: "spelling", attemptId: "attempt-2", answer: "word" },
      accepted: true,
    },
    {
      body: { answerType: "definition", attemptId: "attempt-1", answer: "word" },
      accepted: false,
    },
    {
      body: {
        answerType: "spelling",
        attemptId: "attempt-2",
        selectedChoiceId: "choice-a",
      },
      accepted: false,
    },
    {
      body: {
        answerType: "definition",
        attemptId: "attempt-1",
        selectedChoiceId: "choice-a",
        extra: true,
      },
      accepted: false,
    },
    {
      body: { answerType: "spelling", attemptId: "attempt-2", answer: "   " },
      accepted: false,
    },
    {
      body: { answerType: "definition", attemptId: "  ", selectedChoiceId: "choice-a" },
      accepted: false,
    },
    {
      body: { attemptId: "attempt-1", selectedChoiceId: "choice-a" },
      accepted: false,
    },
    { body: { answerType: "reading", attemptId: "attempt-1" }, accepted: false },
    { body: [], accepted: false },
    { body: "definition", accepted: false },
  ];

  const lookup = (
    submission: VocabularyAnswerSubmission
  ): Promise<VocabularyAnswerApiResult> =>
    Promise.resolve(
      submission.answerType === "definition"
        ? { answerType: "definition", correctChoiceId: "choice-a", progress: FAKE_PROGRESS }
        : { answerType: "spelling", correct: true, progress: FAKE_PROGRESS }
    );

  for (const { body, accepted } of parityCases) {
    const parserAccepted = parseVocabularyAnswerSubmission(body) !== null;
    assert.equal(
      parserAccepted,
      accepted,
      `parser disagreed for ${JSON.stringify(body)}`
    );

    const response = await handleVocabularyAnswerRequest(
      new Request("http://local.test/api/learning/vocabulary/submit-answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
      lookup
    );
    assert.equal(
      response.status,
      accepted ? 200 : 400,
      `endpoint disagreed for ${JSON.stringify(body)}`
    );
  }
});

test("strictly accepts only the spelling interaction fields", () => {
  assert.deepEqual(
    parseVocabularySubmitAnswerPayload({
      attemptId: "attempt-2",
      answer: "brilliant",
    }),
    {
      answerType: "spelling",
      attemptId: "attempt-2",
      answer: "brilliant",
    }
  );

  for (const payload of [
    {
      attemptId: "attempt-2",
      answer: "brilliant",
      unexpected: true,
    },
    {
      attemptId: "attempt-2",
      answer: "brilliant",
      selectedChoiceId: "choice-a",
    },
    {
      answerType: "spelling",
      attemptId: "attempt-2",
      answer: "brilliant",
    },
  ]) {
    assert.throws(
      () => parseVocabularySubmitAnswerPayload(payload),
      /missing, unknown, or mismatched fields/
    );
  }
});
