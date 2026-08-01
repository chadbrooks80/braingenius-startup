import type {
  ActionPayload,
  ActiveModule,
  AnswerFeedback,
  LearningModuleRuntime,
  ScreenRequest,
} from "@/types/learning";
import {
  createInvalidVocabularyRouteError,
  createVocabularyLearningIdMissingError,
  createVocabularyLearningNotFoundError,
} from "./errors/vocabularyRouteErrors";
import { createStartupProps } from "./screens/startupScreen";
import { createMultipleChoiceScreenRequest } from "./screens/multipleChoiceScreen";
import { createDefinitionDisplayScreenRequest } from "./screens/definitionDisplayScreen";
import { createDefinitionFunFactScreenRequest } from "./screens/definitionFunFactScreen";
import { createSpellingScreenRequest } from "./screens/spellingScreen";
import { createAnswerRecapScreenRequest } from "./screens/answerRecapScreen";
import { createLessonCompleteScreenRequest } from "./screens/lessonCompleteScreen";
import { createWordSearchCheckpointScreenRequest } from "./screens/wordSearchCheckpointScreen";
import {
  loadVocabularyContent,
  type VocabularyContentLoader,
} from "./data/loadVocabularyContent";
import { submitVocabularyAnswer } from "./data/submitVocabularyAnswer";
import { parseVocabularySubmitAnswerPayload } from "./validation/parseVocabularySubmitAnswerPayload";
import type {
  VocabularyAnswerResult,
} from "./types";
import type {
  VocabularyContentRequest,
  VocabularyContentResponseFor,
} from "./data/vocabularyContentTypes";
import {
  VocabularyLessonState,
  type VocabularyLessonHydration,
  type VocabularyLessonStep,
} from "./state/VocabularyLessonState";
import { createVocabularyLessonRandom } from "./state/createVocabularyLessonRandom";
import type { VocabularyProgressSnapshot } from "./data/vocabularyContentTypes";

export type VocabularyModuleApi = {
  loadContent: VocabularyContentLoader;
  submitAnswer: typeof submitVocabularyAnswer;
};

const DEFAULT_VOCABULARY_API: VocabularyModuleApi = {
  loadContent: (request) => loadVocabularyContent(request),
  submitAnswer: (submission) => submitVocabularyAnswer(submission),
};

class Vocabulary implements ActiveModule {
  private readonly learningId: string;
  private readonly random: () => number;
  // Retained only per the shared module-runtime contract: Vocabulary keeps
  // this narrow function and never stores the LearningEngine instance or its
  // private setter registry.
  private readonly runPanelSetter: (setterName: string, value: unknown) => void;
  private readonly api: VocabularyModuleApi;
  private lessonState: VocabularyLessonState | null = null;
  private lessonId: string | null = null;
  private nextCapability: string | null = null;
  private pendingStep: VocabularyLessonStep | null = null;
  private nextTransition: Promise<ScreenRequest> | null = null;
  // The number of authorized refills already requested for this lesson.
  // Compared against the lesson state's first-mastery count so a refill is
  // requested exactly once per newly opened active-pool slot.
  private refillsRequested = 0;

  // The second constructor parameter is widened to also accept a directly
  // injected deterministic `random` source so existing tests keep their
  // exact call signature. Only a real `LearningModuleRuntime` (what the
  // engine always passes in production) wires `runPanelSetter`; direct test
  // instantiation with a `random` function gets a no-op panel publisher.
  constructor(
    moduleVariables: string[],
    random: (() => number) | LearningModuleRuntime = Math.random,
    api: VocabularyModuleApi = DEFAULT_VOCABULARY_API
  ) {
    if (moduleVariables.length === 0) {
      throw createVocabularyLearningIdMissingError();
    }

    if (moduleVariables.length > 1) {
      throw createInvalidVocabularyRouteError();
    }

    this.learningId = moduleVariables[0];
    this.random = typeof random === "function" ? random : Math.random;
    this.runPanelSetter =
      typeof random === "function" ? () => {} : random.runPanelSetter;
    this.api = api;
  }

  async initialize(): Promise<void> {
    const manifest = await this.api.loadContent({
      contentType: "manifest",
      learningId: this.learningId,
    });

    if (!manifest) {
      throw createVocabularyLearningNotFoundError(this.learningId);
    }

    const hydration: VocabularyLessonHydration = {
      progressByWordId: new Map(Object.entries(manifest.hydratedProgressByWordId)),
      gradedAnswerCount: manifest.progress.gradedAnswerCount,
      correctCount: manifest.progress.correctAnswerCount,
      incorrectCount: manifest.progress.incorrectAnswerCount,
      checkpointEligibleOrder: manifest.checkpointEligibleWordIdOrder,
      servedCheckpointGroupCount: manifest.servedCheckpointGroupCount,
    };

    this.lessonState = new VocabularyLessonState(
      manifest.words,
      manifest.totalWordCount,
      createVocabularyLessonRandom(manifest.randomSeed),
      hydration
    );
    this.lessonId = manifest.lessonId;
    this.nextCapability = manifest.nextCapability;
    this.publishPanel(manifest.progress);
  }

  getStartupProps() {
    return createStartupProps(this.learningId);
  }

  async next(): Promise<ScreenRequest | void> {
    if (this.nextTransition) {
      await this.nextTransition;
      return;
    }

    const transition = this.createNextScreenRequest();
    this.nextTransition = transition;

    try {
      return await transition;
    } finally {
      if (this.nextTransition === transition) {
        this.nextTransition = null;
      }
    }
  }

  async submitAnswer(payload: ActionPayload): Promise<AnswerFeedback> {
    const lessonState = this.requireLessonState();
    const submission = parseVocabularySubmitAnswerPayload(payload);
    lessonState.beginSubmission(submission);

    try {
      const result = await this.api.submitAnswer(submission);
      lessonState.recordSubmission(result);
      await this.refillActivePoolIfNeeded(lessonState);
      this.publishPanel(result.progress);
      return createVocabularyWindowFeedback(result);
    } catch (error) {
      lessonState.cancelSubmission();
      throw error;
    }
  }

  /**
   * After a confirmed full initial mastery opens one active-pool slot,
   * makes exactly one authorized refill request for the next ordered
   * database word and mirrors the result into the shared lesson-state
   * contract. `refillsRequested` only advances on a settled request, so a
   * failed/timed-out refill leaves the lesson state recoverable and the
   * exact same refill can be retried on the next opportunity.
   */
  private async refillActivePoolIfNeeded(
    lessonState: VocabularyLessonState
  ): Promise<void> {
    const due = lessonState.getFirstMasteryCount();
    if (due <= this.refillsRequested) {
      return;
    }

    const lessonId = this.lessonId;
    if (!lessonId) {
      return;
    }

    let refill;
    try {
      refill = await this.api.loadContent({
        contentType: "word-refill",
        lessonId,
      });
    } catch (error) {
      // A failed/timed-out refill leaves refillsRequested unchanged so the
      // exact same refill is retried the next time this is called, instead
      // of inserting a placeholder or advancing the ordered cursor.
      console.warn("vocabulary_refill_failure", error);
      return;
    }
    if (!refill) {
      return;
    }

    this.refillsRequested += 1;
    if (refill.wordId) {
      lessonState.appendWord({ id: refill.wordId });
    }
  }

  private async createNextScreenRequest(): Promise<ScreenRequest> {
    const lessonState = this.requireLessonState();
    // A second, defensive retry point: if a prior refill attempt failed
    // after grading, this gives the lesson another chance to catch up
    // before computing the next step.
    await this.refillActivePoolIfNeeded(lessonState);
    const step = this.pendingStep ?? lessonState.next();
    this.pendingStep = step;

    const screenRequest = await this.createScreenRequest(step);
    this.pendingStep = null;
    return screenRequest;
  }

  private async createScreenRequest(
    step: VocabularyLessonStep
  ): Promise<ScreenRequest> {
    const lessonState = this.requireLessonState();

    switch (step.kind) {
      case "definition-display": {
        const content = await this.requireContent({
          contentType: "definition-display",
          ...this.requireCapability(),
        });
        this.rotateCapability(content);
        return createDefinitionDisplayScreenRequest(content);
      }
      case "definition-fun-fact": {
        const content = await this.requireContent({
          contentType: "definition-fun-fact",
          ...this.requireCapability(),
        });
        this.rotateCapability(content);
        return createDefinitionFunFactScreenRequest(content);
      }
      case "definition-practice": {
        const content = await this.requireContent({
          contentType: "definition-practice",
          ...this.requireCapability(),
        });
        this.rotateCapability(content);
        lessonState.activateAttempt({
          wordId: step.wordId,
          answerType: "definition",
          attemptId: content.attemptId,
          validChoiceIds: content.choices.map((choice) => choice.id),
          review: step.review,
        });
        return createMultipleChoiceScreenRequest(
          content,
          step.review,
          undefined,
          this.random
        );
      }
      case "spelling-practice": {
        const content = await this.requireContent({
          contentType: "spelling-practice",
          ...this.requireCapability(),
        });
        this.rotateCapability(content);
        lessonState.activateAttempt({
          wordId: step.wordId,
          answerType: "spelling",
          attemptId: content.attemptId,
          validChoiceIds: [],
          review: step.review,
        });
        return createSpellingScreenRequest(content, step.review);
      }
      case "answer-recap": {
        const content = await this.requireContent({
          contentType: "answer-recap",
          ...this.requireCapability(),
          exampleIndex: step.exampleIndex,
        });
        this.rotateCapability(content);
        return createAnswerRecapScreenRequest(content);
      }
      case "word-search-checkpoint": {
        const content = await this.requireContent({
          contentType: "word-search-checkpoint",
          ...this.requireCapability(),
        });
        this.rotateCapability(content);
        return createWordSearchCheckpointScreenRequest(content);
      }
      case "lesson-complete":
        return createLessonCompleteScreenRequest(step);
    }
  }

  private async requireContent<Request extends VocabularyContentRequest>(
    request: Request
  ): Promise<VocabularyContentResponseFor<Request>> {
    const content = await this.api.loadContent(request);
    if (!content) {
      throw new Error(
        `Vocabulary content is unavailable for ${request.contentType}.`
      );
    }
    return content;
  }

  private requireLessonState(): VocabularyLessonState {
    if (!this.lessonState) {
      throw new Error("Vocabulary module has not been initialized.");
    }
    return this.lessonState;
  }

  private requireCapability(): { lessonId: string; capability: string } {
    const lessonId = this.lessonId;
    const capability = this.nextCapability;
    if (!lessonId || !capability) {
      throw new Error("Vocabulary capability is unavailable for the active lesson step.");
    }
    return { lessonId, capability };
  }

  private rotateCapability(content: { nextCapability: string }): void {
    this.nextCapability = content.nextCapability;
  }

  // Publishes all three panel arrays from one authoritative server
  // projection through the retained `runPanelSetter` function. Never called
  // before the database transaction that produced `progress` has succeeded,
  // so a failed write never changes the panel.
  private publishPanel(progress: VocabularyProgressSnapshot): void {
    this.runPanelSetter("setWordList", progress.panel.wordList);
    this.runPanelSetter("setSpellingWords", progress.panel.spellingWords);
    this.runPanelSetter("setMasteredWords", progress.panel.masteredWords);
  }
}

function createVocabularyWindowFeedback(
  result: VocabularyAnswerResult
): AnswerFeedback {
  if (result.answerType === "definition") {
    return { correctChoiceId: result.correctChoiceId };
  }

  return result.correct
    ? { correct: true }
    : { correct: false, correctAnswer: result.correctAnswer };
}

export default Vocabulary;
