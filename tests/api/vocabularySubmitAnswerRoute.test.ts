import assert from "node:assert/strict";
import test from "node:test";
import { handleVocabularyAnswerRequest } from "../../src/app/api/learning/vocabulary/submit-answer/handleVocabularyAnswerRequest";

function requestWithBody(body: BodyInit): Request {
  return new Request("http://localhost/api/learning/vocabulary/submit-answer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

test("rejects malformed JSON without calling the answer lookup", async () => {
  let lookupCalls = 0;
  const response = await handleVocabularyAnswerRequest(
    requestWithBody("{"),
    () => {
      lookupCalls += 1;
      return { answerType: "definition", correctChoiceId: "a" };
    }
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Request body must be valid JSON.",
  });
  assert.equal(lookupCalls, 0);
});

test("strictly rejects unknown, missing, and type-mismatched fields", async () => {
  const invalidBodies = [
    {
      answerType: "definition",
      attemptId: "attempt-1",
      selectedChoiceId: "a",
      answer: "a",
    },
    { answerType: "definition", attemptId: "", selectedChoiceId: "a" },
    { answerType: "definition", attemptId: "attempt-1", answer: "a" },
    { answerType: "spelling", attemptId: "attempt-1", selectedChoiceId: "a" },
    { answerType: "spelling", attemptId: "attempt-1", answer: "   " },
    { answerType: "other", attemptId: "attempt-1", answer: "word" },
  ];

  for (const body of invalidBodies) {
    const response = await handleVocabularyAnswerRequest(
      requestWithBody(JSON.stringify(body)),
      () => ({ answerType: "definition", correctChoiceId: "a" })
    );

    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: "Invalid vocabulary answer submission.",
    });
  }
});

test("rejects attempts that the server lookup does not recognize", async () => {
  const response = await handleVocabularyAnswerRequest(
    requestWithBody(
      JSON.stringify({
        answerType: "definition",
        attemptId: "unknown",
        selectedChoiceId: "a",
      })
    ),
    () => null
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Invalid vocabulary answer submission.",
  });
});

test("returns minimal definition feedback for a valid submission", async () => {
  const response = await handleVocabularyAnswerRequest(
    requestWithBody(
      JSON.stringify({
        answerType: "definition",
        attemptId: "attempt-1",
        selectedChoiceId: "b",
      })
    ),
    (submission) => {
      assert.deepEqual(submission, {
        answerType: "definition",
        attemptId: "attempt-1",
        selectedChoiceId: "b",
      });
      return { answerType: "definition", correctChoiceId: "c" };
    }
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    answerType: "definition",
    correctChoiceId: "c",
  });
});

test("returns correct and incorrect spelling feedback", async () => {
  for (const result of [
    { answerType: "spelling" as const, correct: true as const },
    {
      answerType: "spelling" as const,
      correct: false as const,
      correctAnswer: "brilliant",
    },
  ]) {
    const response = await handleVocabularyAnswerRequest(
      requestWithBody(
        JSON.stringify({
          answerType: "spelling",
          attemptId: "attempt-2",
          answer: " Brilliant ",
        })
      ),
      (submission) => {
        assert.equal(submission.answerType, "spelling");
        return result;
      }
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), result);
  }
});
