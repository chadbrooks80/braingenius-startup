import assert from "node:assert/strict";
import test from "node:test";
import { createLearningEngineActionHandlers } from "../../src/lib/learning-engine/actions/createLearningEngineActionHandlers";
import type {
  ActionPayload,
  ActiveModule,
  AnswerFeedback,
  LearningEngineStateSetters,
} from "../../src/types/learning";

test("submitAnswer forwards an opaque non-vocabulary payload without interpreting it", async () => {
  const receivedPayloads: ActionPayload[] = [];
  const feedback: AnswerFeedback = { correct: true };
  const feedbackChanges: Array<AnswerFeedback | null> = [];
  const testModule: ActiveModule = {
    async initialize() {},
    getStartupProps() {
      throw new Error("Not used by this test.");
    },
    next() {
      throw new Error("Not used by this test.");
    },
    async submitAnswer(payload) {
      receivedPayloads.push(payload);
      return feedback;
    },
  };
  const setters: LearningEngineStateSetters = {
    setActiveScreen() {},
    setShowHeader() {},
    setShowSidebar() {},
    setAnswerFeedback(value) {
      feedbackChanges.push(value);
    },
    setIsSpeaking() {},
  };
  const handlers = createLearningEngineActionHandlers({
    getActiveModule: () => testModule,
    getLearningEngineStateSetters: () => setters,
  });
  const payload = {
    equationId: "equation-7",
    response: 42,
    units: "square centimeters",
  };

  await handlers.submitAnswer(payload);

  assert.equal(receivedPayloads.length, 1);
  assert.strictEqual(receivedPayloads[0], payload);
  assert.deepEqual(feedbackChanges, [feedback]);
});
