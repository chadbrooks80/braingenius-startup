import assert from "node:assert/strict";
import test from "node:test";
import { submitVocabularyAnswer } from "../../src/learning-modules/vocabulary/data/submitVocabularyAnswer";

const DEFINITION_PAYLOAD = {
  answerType: "definition" as const,
  attemptId: "attempt-1",
  selectedChoiceId: "a",
};
const SPELLING_PAYLOAD = {
  answerType: "spelling" as const,
  attemptId: "attempt-2",
  answer: "brilliant",
};

test("returns validated definition and spelling results", async () => {
  assert.deepEqual(
    await submitVocabularyAnswer(DEFINITION_PAYLOAD, {
      fetchImpl: async () =>
        Response.json({ answerType: "definition", correctChoiceId: "b" }),
    }),
    { answerType: "definition", correctChoiceId: "b" }
  );

  assert.deepEqual(
    await submitVocabularyAnswer(SPELLING_PAYLOAD, {
      fetchImpl: async () =>
        Response.json({ answerType: "spelling", correct: true }),
    }),
    { answerType: "spelling", correct: true }
  );

  assert.deepEqual(
    await submitVocabularyAnswer(SPELLING_PAYLOAD, {
      fetchImpl: async () =>
        Response.json({
          answerType: "spelling",
          correct: false,
          correctAnswer: "brilliant",
        }),
    }),
    {
      answerType: "spelling",
      correct: false,
      correctAnswer: "brilliant",
    }
  );
});

test("rejects failed, mismatched, or non-minimal answer responses", async () => {
  await assert.rejects(
    submitVocabularyAnswer(DEFINITION_PAYLOAD, {
      fetchImpl: async () => new Response(null, { status: 503 }),
    }),
    /failed with status 503/
  );

  const invalidResults = [
    { answerType: "spelling", correct: true },
    { answerType: "definition", correctChoiceId: null },
    { answerType: "definition", correctChoiceId: "a", correct: true },
  ];

  for (const result of invalidResults) {
    await assert.rejects(
      submitVocabularyAnswer(DEFINITION_PAYLOAD, {
        fetchImpl: async () => Response.json(result),
      }),
      /returned an invalid result/
    );
  }
});

test("aborts and rejects a timed-out answer request", async () => {
  const fetchImpl = ((_input: string | URL | Request, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(new DOMException("Aborted", "AbortError"))
      );
    })) as typeof fetch;

  await assert.rejects(
    submitVocabularyAnswer(DEFINITION_PAYLOAD, { fetchImpl, timeoutMs: 1 }),
    /timed out/
  );
});
