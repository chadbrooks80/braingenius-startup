import assert from "node:assert/strict";
import test from "node:test";
import { resolveLearningWindow } from "../../src/lib/learning-engine/LearningWindowRegistry";
import { createLearningEngineActionHandlers } from "../../src/lib/learning-engine/actions/createLearningEngineActionHandlers";
import { changeLearningEngineScreen } from "../../src/lib/learning-engine/screens/changeLearningEngineScreen";
import Vocabulary from "../../src/learning-modules/vocabulary/index";
import type {
  ActionPayload,
  ActiveModule,
  ActiveScreen,
  AnswerFeedback,
  LearningEngineStateSetters,
  ScreenRequest,
} from "../../src/types/learning";
import {
  createInProcessVocabularyApi,
  getServerCorrectChoiceId,
  getServerSpellingAnswer,
} from "../vocabulary/testVocabularyApi";

const ROUTE = "/learning/vocabulary/word_list_id";

test("real Vocabulary route/module flow reaches completion through real content and answer handlers", async () => {
  const { moduleName, moduleVariables } = parseLearningRoute(ROUTE);
  assert.equal(moduleName, "vocabulary");

  let seed = 42;
  const vocabulary = new Vocabulary(
    moduleVariables,
    () => {
      seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
      return seed / 4_294_967_296;
    },
    createInProcessVocabularyApi()
  );
  await vocabulary.initialize();
  const engine = createEngineHarness(vocabulary);
  engine.showStartup();
  assert.equal(engine.currentScreenRequest.windowName, "startup");

  const introductions = new Set<string>();
  let definitionQuestions = 0;
  let spellingQuestions = 0;
  let recaps = 0;
  let definitionReviews = 0;
  let spellingReviews = 0;
  let failedReview = false;
  let recoveredFailedWord = false;
  let failedWord: string | null = null;
  let sawReplacementAfterInitialPool = false;
  let current = await engine.next();

  for (let guard = 0; guard < 10_000; guard += 1) {
    resolveLearningWindow(current.windowName);

    if (current.windowName === "lesson-complete") {
      assert.equal(introductions.size, 20);
      assert.ok(definitionQuestions > 0);
      assert.ok(spellingQuestions > 0);
      assert.ok(recaps > 0);
      assert.ok(definitionReviews > 0);
      assert.ok(spellingReviews > 0);
      assert.equal(failedReview, true);
      assert.equal(recoveredFailedWord, true);
      assert.equal(sawReplacementAfterInitialPool, true);
      assert.equal(current.props.totalWords, undefined);
      const stats = current.props.stats as Array<{
        label: string;
        value: number;
      }>;
      assert.deepEqual(
        stats.map((stat) => stat.label),
        ["Words", "Correct", "Incorrect"]
      );
      assert.ok(stats.find((stat) => stat.label === "Incorrect")!.value >= 1);
      return;
    }

    if (current.windowName === "definition-display") {
      const word = String(current.props.title);
      introductions.add(word);
      if (introductions.size > 5) {
        sawReplacementAfterInitialPool = true;
      }
      if (failedWord === word && failedReview) {
        recoveredFailedWord = true;
      }
      current = await engine.next();
      continue;
    }

    if (current.windowName === "definition-fun-fact") {
      current = await engine.next();
      continue;
    }

    if (current.windowName === "answer-recap") {
      recaps += 1;
      current = await engine.next();
      continue;
    }

    if (current.windowName === "multiple-choice") {
      definitionQuestions += 1;
      const review = current.props.badgeLabel === "Definition review";
      if (review) {
        definitionReviews += 1;
      }
      const attemptId = String(current.props.attemptId);
      const choices = current.props.choices as Array<{ id: string; text: string }>;
      const correctChoiceId = getServerCorrectChoiceId({
        contentType: "definition-practice",
        nextCapability: "00000000-0000-4000-8000-000000000001",
        attemptId,
        question: String(current.props.question),
        choices: choices as [
          { id: string; text: string },
          { id: string; text: string },
          { id: string; text: string },
          { id: string; text: string },
        ],
      });

      let selectedChoiceId = correctChoiceId;
      if (review && !failedReview) {
        selectedChoiceId = choices.find(
          (choice) => choice.id !== correctChoiceId
        )!.id;
        failedReview = true;
        failedWord = String(current.props.question);
      } else if (failedWord === current.props.question) {
        recoveredFailedWord = true;
      }

      const feedback = await engine.submitAnswer({
        attemptId,
        selectedChoiceId,
      });
      assert.ok("correctChoiceId" in feedback);
      current = await engine.next();
      assert.equal(current.windowName, "answer-recap");
      assert.equal(engine.answerFeedback, null);
      continue;
    }

    if (current.windowName === "spelling") {
      spellingQuestions += 1;
      const review = current.props.badgeLabel === "Spelling review";
      if (review) {
        spellingReviews += 1;
      }
      const attemptId = String(current.props.attemptId);
      const correctAnswer = getServerSpellingAnswer({
        contentType: "spelling-practice",
        nextCapability: "00000000-0000-4000-8000-000000000001",
        attemptId,
        definition: String(current.props.promptText),
      });
      const feedback = await engine.submitAnswer({
        attemptId,
        answer: correctAnswer,
      });
      assert.deepEqual(feedback, { correct: true });
      current = await engine.next();
      assert.equal(current.windowName, "answer-recap");
      assert.equal(engine.answerFeedback, null);
      continue;
    }

    assert.fail(`Unexpected window ${current.windowName}.`);
  }

  assert.fail("The route smoke test did not complete within the guard.");
});

function parseLearningRoute(route: string): {
  moduleName: string;
  moduleVariables: string[];
} {
  const segments = route.split("/").filter(Boolean);
  assert.equal(segments[0], "learning");
  assert.ok(segments[1]);
  return {
    moduleName: segments[1],
    moduleVariables: segments.slice(2),
  };
}

function createEngineHarness(module: ActiveModule): {
  readonly currentScreenRequest: ScreenRequest;
  readonly answerFeedback: AnswerFeedback | null;
  showStartup(): void;
  next(): Promise<ScreenRequest>;
  submitAnswer(payload: ActionPayload): Promise<AnswerFeedback>;
} {
  let currentScreenRequest: ScreenRequest | null = null;
  let activeScreen: ActiveScreen | null = null;
  let answerFeedback: AnswerFeedback | null = null;
  const setters: LearningEngineStateSetters = {
    setActiveScreen: (screen) => {
      activeScreen = screen;
    },
    setShowHeader: () => {},
    setShowSidebar: () => {},
    setAnswerFeedback: (feedback) => {
      answerFeedback = feedback;
    },
    setIsSpeaking: () => {},
  };
  const handlers = createLearningEngineActionHandlers({
    getActiveModule: () => module,
    getLearningEngineStateSetters: () => setters,
  });

  const dispatch = async (
    actionId: string,
    payload: ActionPayload = {}
  ): Promise<void> => {
    const request = await handlers[actionId](payload);
    if (request) {
      currentScreenRequest = request;
      changeLearningEngineScreen(request, setters, dispatch);
      assert.ok(activeScreen);
    }
  };

  return {
    get currentScreenRequest() {
      if (!currentScreenRequest) {
        throw new Error("No screen request has been applied.");
      }
      return currentScreenRequest;
    },
    get answerFeedback() {
      return answerFeedback;
    },
    showStartup() {
      currentScreenRequest = {
        windowName: "startup",
        props: module.getStartupProps(),
      };
      changeLearningEngineScreen(currentScreenRequest, setters, dispatch);
      assert.ok(activeScreen);
    },
    async next() {
      await dispatch("next");
      return this.currentScreenRequest;
    },
    async submitAnswer(payload) {
      await dispatch("submitAnswer", payload);
      if (!answerFeedback) {
        throw new Error("Expected engine-owned answer feedback.");
      }
      return answerFeedback;
    },
  };
}
