import type {
  ActionPayload,
  ActiveModule,
  AnswerFeedback,
  ScreenRequest,
} from "@/types/learning";
import { LearningRouteError } from "@/lib/learning-engine/errors/LearningRouteError";
import { createStartupProps } from "./screens/startupScreen";
import { createMultipleChoiceScreenRequest } from "./screens/multipleChoiceScreen";
import { createDefinitionDisplayScreenRequest } from "./screens/definitionDisplayScreen";
import { createDefinitionFunFactScreenRequest } from "./screens/definitionFunFactScreen";
import { createSpellingScreenRequest } from "./screens/spellingScreen";
import { createAnswerRecapScreenRequest } from "./screens/answerRecapScreen";
import { createLessonCompleteScreenRequest } from "./screens/lessonCompleteScreen";
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
  type VocabularyLessonStep,
} from "./state/VocabularyLessonState";
import { createVocabularyLessonRandom } from "./state/createVocabularyLessonRandom";

export type VocabularyModuleApi = {
  loadContent: VocabularyContentLoader;
  submitAnswer: typeof submitVocabularyAnswer;
};

const DEFAULT_VOCABULARY_API: VocabularyModuleApi = {
  loadContent: (request) => loadVocabularyContent(request),
  submitAnswer: (submission) => submitVocabularyAnswer(submission),
};

class Vocabulary implements ActiveModule {
  private readonly wordListId: string;
  private readonly random: () => number;
  private readonly api: VocabularyModuleApi;
  private lessonState: VocabularyLessonState | null = null;
  private lessonId: string | null = null;
  private nextCapability: string | null = null;
  private pendingStep: VocabularyLessonStep | null = null;
  private nextTransition: Promise<ScreenRequest> | null = null;

  constructor(
    moduleVariables: string[],
    random: () => number = Math.random,
    api: VocabularyModuleApi = DEFAULT_VOCABULARY_API
  ) {
    if (moduleVariables.length === 0) {
      throw new LearningRouteError(
        "VOCABULARY_LIST_ID_MISSING",
        "Vocabulary route omitted the required word-list ID."
      );
    }

    if (moduleVariables.length > 1) {
      throw new LearningRouteError(
        "INVALID_LEARNING_ROUTE",
        "Vocabulary route contains unexpected extra path segments."
      );
    }

    this.wordListId = moduleVariables[0];
    this.random = random;
    this.api = api;
  }

  async initialize(): Promise<void> {
    const manifest = await this.api.loadContent({
      contentType: "manifest",
      wordListId: this.wordListId,
    });

    if (!manifest) {
      throw new LearningRouteError(
        "VOCABULARY_LIST_NOT_FOUND",
        `Vocabulary word list not found: ${this.wordListId}`
      );
    }

    this.lessonState = new VocabularyLessonState(
      manifest.words,
      createVocabularyLessonRandom(manifest.randomSeed)
    );
    this.lessonId = manifest.lessonId;
    this.nextCapability = manifest.nextCapability;
  }

  getStartupProps() {
    return createStartupProps(this.wordListId);
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
      return createVocabularyWindowFeedback(result);
    } catch (error) {
      lessonState.cancelSubmission();
      throw error;
    }
  }

  private async createNextScreenRequest(): Promise<ScreenRequest> {
    const lessonState = this.requireLessonState();
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
