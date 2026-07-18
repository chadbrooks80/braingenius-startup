import assert from "node:assert/strict";
import test from "node:test";
import {
  IDLE_SPELLING_SUBMISSION_STATE,
  submitSpellingAnswer,
  type SpellingSubmissionState,
} from "../../src/learning-engine-components/LearningWindows/Spelling/spellingSubmissionFlow";

function createHarness() {
  const stateRef = {
    current: IDLE_SPELLING_SUBMISSION_STATE as SpellingSubmissionState,
  };
  const transitions: SpellingSubmissionState[] = [];
  return {
    stateRef,
    transitions,
    updateState(state: SpellingSubmissionState) {
      transitions.push(state);
    },
  };
}

test("spelling submission locks pending duplicates and supports retry after failure", async () => {
  const harness = createHarness();
  let attempts = 0;
  let resolveFirst!: () => void;
  const pending = new Promise<void>((resolve) => {
    resolveFirst = resolve;
  });

  const first = submitSpellingAnswer({
    answer: "brilliant",
    stateRef: harness.stateRef,
    updateState: harness.updateState,
    submitAnswer: () => {
      attempts += 1;
      return pending;
    },
  });
  assert.equal(
    await submitSpellingAnswer({
      answer: "brilliant",
      stateRef: harness.stateRef,
      updateState: harness.updateState,
      submitAnswer: () => {
        attempts += 1;
      },
    }),
    false
  );
  assert.equal(attempts, 1);
  resolveFirst();
  assert.equal(await first, true);

  const retryHarness = createHarness();
  assert.equal(
    await submitSpellingAnswer({
      answer: "briliant",
      stateRef: retryHarness.stateRef,
      updateState: retryHarness.updateState,
      submitAnswer: () => Promise.reject(new Error("offline")),
    }),
    false
  );
  assert.deepEqual(retryHarness.stateRef.current, {
    status: "error",
    answer: "briliant",
  });
  assert.equal(
    await submitSpellingAnswer({
      answer: retryHarness.stateRef.current.answer ?? "",
      stateRef: retryHarness.stateRef,
      updateState: retryHarness.updateState,
      submitAnswer: () => Promise.resolve(),
    }),
    true
  );
});
