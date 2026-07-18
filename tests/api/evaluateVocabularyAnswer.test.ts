import assert from "node:assert/strict";
import test from "node:test";
import { evaluateVocabularyAnswer } from "../../src/learning-modules/vocabulary/data/evaluateVocabularyAnswer";

test("spelling evaluation trims outer whitespace and compares case-insensitively", () => {
  const answer = {
    answerType: "spelling" as const,
    acceptedAnswers: ["brilliant"],
    displayAnswer: "brilliant",
  };

  for (const submittedAnswer of ["brilliant", " BRILLIANT ", "BrIlLiAnT"] ) {
    assert.deepEqual(
      evaluateVocabularyAnswer(answer, {
        answerType: "spelling",
        attemptId: "attempt-1",
        answer: submittedAnswer,
      }),
      { answerType: "spelling", correct: true }
    );
  }

  assert.deepEqual(
    evaluateVocabularyAnswer(answer, {
      answerType: "spelling",
      attemptId: "attempt-1",
      answer: "briliant",
    }),
    {
      answerType: "spelling",
      correct: false,
      correctAnswer: "brilliant",
    }
  );
});

test("answer evaluation rejects mismatched variants and invalid definition choices", () => {
  const definition = {
    answerType: "definition" as const,
    correctChoiceId: "choice-a",
    validChoiceIds: ["choice-a", "choice-b"],
  };

  assert.equal(
    evaluateVocabularyAnswer(definition, {
      answerType: "spelling",
      attemptId: "attempt-1",
      answer: "word",
    }),
    null
  );
  assert.equal(
    evaluateVocabularyAnswer(definition, {
      answerType: "definition",
      attemptId: "attempt-1",
      selectedChoiceId: "not-offered",
    }),
    null
  );
});
