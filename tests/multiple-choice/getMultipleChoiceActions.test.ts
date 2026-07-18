import assert from "node:assert/strict";
import test from "node:test";
import { getMultipleChoiceActions } from "../../src/learning-engine-components/LearningWindows/MultipleChoice/getMultipleChoiceActions";
import type { ActionPayload } from "../../src/types/learning";

const VALID_TTS = {
  provider: "google" as const,
  model: "chirp-3-hd",
  voice: "en-US-Chirp3-HD-Aoede",
  languageCode: "en-US",
};

test("enabled TTS exposes pronunciation and dispatches the question with the unchanged configuration", () => {
  const calls: Array<{ actionId: string; payload?: ActionPayload }> = [];
  const actions = getMultipleChoiceActions({
    attemptId: "attempt-1",
    question: "brilliant",
    tts: VALID_TTS,
    onAction: (actionId, payload) => {
      calls.push({ actionId, payload });
    },
  });

  assert.notEqual(actions.hearPronunciation, null);
  actions.hearPronunciation?.();
  assert.deepEqual(calls, [
    {
      actionId: "speak",
      payload: { text: "brilliant", tts: VALID_TTS },
    },
  ]);
});

test("disabled TTS hides pronunciation while answer submission still works", () => {
  const calls: Array<{ actionId: string; payload?: ActionPayload }> = [];
  const actions = getMultipleChoiceActions({
    attemptId: "attempt-1",
    question: "brilliant",
    tts: null,
    onAction: (actionId, payload) => {
      calls.push({ actionId, payload });
    },
  });

  assert.equal(actions.hearPronunciation, null);
  actions.submitAnswer("choice-b");
  assert.deepEqual(calls, [
    {
      actionId: "submitAnswer",
      payload: {
        attemptId: "attempt-1",
        selectedChoiceId: "choice-b",
      },
    },
  ]);
});
