import assert from "node:assert/strict";
import test from "node:test";
import {
  IDLE_ANSWER_SUBMISSION_STATE,
  submitMultipleChoiceAnswer,
  type AnswerSubmissionState,
} from "../../src/components/learning-engine/windows/MultipleChoice/answerSubmissionFlow";

function createStateHarness() {
  const stateRef = { current: IDLE_ANSWER_SUBMISSION_STATE as AnswerSubmissionState };
  const transitions: AnswerSubmissionState[] = [];

  return {
    stateRef,
    transitions,
    updateState(state: AnswerSubmissionState) {
      transitions.push(state);
    },
  };
}

test("a failed submission enters error state and retry can succeed", async () => {
  const harness = createStateHarness();
  let attempts = 0;

  const submit = () => {
    attempts += 1;
    if (attempts === 1) {
      return Promise.reject(new Error("temporary failure"));
    }
    return Promise.resolve();
  };

  const firstResult = await submitMultipleChoiceAnswer({
    selectedChoiceId: "b",
    stateRef: harness.stateRef,
    updateState: harness.updateState,
    submitAnswer: submit,
  });

  assert.equal(firstResult, false);
  assert.deepEqual(harness.stateRef.current, {
    status: "error",
    selectedChoiceId: "b",
  });

  const retryResult = await submitMultipleChoiceAnswer({
    selectedChoiceId: harness.stateRef.current.selectedChoiceId ?? "",
    stateRef: harness.stateRef,
    updateState: harness.updateState,
    submitAnswer: submit,
  });

  assert.equal(retryResult, true);
  assert.equal(attempts, 2);
  assert.deepEqual(harness.stateRef.current, {
    status: "success",
    selectedChoiceId: "b",
  });
  assert.deepEqual(
    harness.transitions.map((state) => state.status),
    ["pending", "error", "pending", "success"]
  );
});

test("duplicate clicks do not create multiple pending submissions", async () => {
  const harness = createStateHarness();
  let attempts = 0;
  let resolveSubmission!: () => void;
  const pendingSubmission = new Promise<void>((resolve) => {
    resolveSubmission = resolve;
  });

  const first = submitMultipleChoiceAnswer({
    selectedChoiceId: "a",
    stateRef: harness.stateRef,
    updateState: harness.updateState,
    submitAnswer: () => {
      attempts += 1;
      return pendingSubmission;
    },
  });

  const duplicate = await submitMultipleChoiceAnswer({
    selectedChoiceId: "a",
    stateRef: harness.stateRef,
    updateState: harness.updateState,
    submitAnswer: () => {
      attempts += 1;
    },
  });

  assert.equal(duplicate, false);
  assert.equal(attempts, 1);
  assert.equal(harness.stateRef.current.status, "pending");

  resolveSubmission();
  assert.equal(await first, true);
  assert.equal(harness.stateRef.current.status, "success");
});
