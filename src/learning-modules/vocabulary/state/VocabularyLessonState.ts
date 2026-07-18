import { normalizedRandom } from "@/lib/random/normalizedRandom";
import type {
  VocabularyAnswerResult,
  VocabularyAnswerSubmission,
} from "../types";
import {
  beginVocabularySubmission,
  cancelVocabularySubmission,
  createVocabularyActiveAttempt,
  recordVocabularySubmission,
  requireVocabularyActiveAttempt,
  requireVocabularyAttemptAnswered,
  type VocabularyActiveAttempt,
  type VocabularyAttemptDescriptor,
} from "./VocabularyActiveAttempt";
import {
  ACTIVE_POOL_SIZE,
  DEFINITION_MASTERY_STREAK,
  DELAYED_REVIEW_ANSWER_COUNT,
  SPELLING_MASTERY_STREAK,
  createInitialVocabularyWordProgress,
  type VocabularyLessonStats,
  type VocabularyLessonStep,
  type VocabularyLessonWord,
  type VocabularyWordProgress,
} from "./VocabularyLessonTypes";
import { selectVocabularyPracticeWord } from "./selectVocabularyPracticeWord";
import { getVocabularyReviewsDueBy } from "./vocabularyReviewSchedule";

export {
  ACTIVE_POOL_SIZE,
  DEFINITION_MASTERY_STREAK,
  DELAYED_REVIEW_ANSWER_COUNT,
  SPELLING_MASTERY_STREAK,
} from "./VocabularyLessonTypes";
export type {
  ReviewStage,
  VocabularyLessonStats,
  VocabularyLessonStep,
  VocabularyLessonWord,
  VocabularyWordProgress,
} from "./VocabularyLessonTypes";

type IntroductionPhase = {
  wordId: string;
  stage: "definition-display" | "definition-fun-fact";
};

export class VocabularyLessonState {
  private readonly words: readonly VocabularyLessonWord[];
  private readonly random: () => number;
  private readonly progressByWordId: Map<string, VocabularyWordProgress>;
  private activeAttempt: VocabularyActiveAttempt | null = null;
  private introductionPhase: IntroductionPhase | null = null;
  private pendingRecap: Extract<
    VocabularyLessonStep,
    { kind: "answer-recap" }
  > | null = null;
  private recapVisible = false;
  private gradedAnswerCount = 0;
  private correctCount = 0;
  private incorrectCount = 0;
  private lastPracticedWordId: string | null = null;
  private completionReviewWordIds: Set<string> | null = null;

  constructor(
    words: readonly VocabularyLessonWord[],
    random: () => number = Math.random
  ) {
    this.words = words;
    this.random = random;
    this.progressByWordId = new Map(
      words.map((word) => [word.id, createInitialVocabularyWordProgress()])
    );
  }

  next(): VocabularyLessonStep {
    if (this.activeAttempt) {
      requireVocabularyAttemptAnswered(this.activeAttempt);

      this.activeAttempt = null;
      if (this.pendingRecap && !this.recapVisible) {
        this.recapVisible = true;
        return this.pendingRecap;
      }
    }

    if (this.recapVisible) {
      this.recapVisible = false;
      this.pendingRecap = null;
    }

    if (this.introductionPhase) {
      const wordId = this.introductionPhase.wordId;

      if (this.introductionPhase.stage === "definition-display") {
        this.introductionPhase.stage = "definition-fun-fact";
        return { kind: "definition-fun-fact", wordId };
      }

      this.requireProgress(wordId).introduced = true;
      this.introductionPhase = null;
      this.captureCompletionReviewSnapshotIfReady();
    }

    return this.selectNextStep();
  }

  activateAttempt(descriptor: VocabularyAttemptDescriptor): void {
    if (this.activeAttempt) {
      throw new Error("A vocabulary attempt is already active.");
    }
    this.requireWord(descriptor.wordId);
    this.activeAttempt = createVocabularyActiveAttempt(descriptor);
  }

  beginSubmission(payload: VocabularyAnswerSubmission): void {
    beginVocabularySubmission(this.requireActiveAttempt(), payload);
  }

  recordSubmission(result: VocabularyAnswerResult): void {
    const outcome = recordVocabularySubmission(
      this.requireActiveAttempt(),
      result
    );
    this.gradedAnswerCount += 1;

    if (outcome.correct) {
      this.correctCount += 1;
    } else {
      this.incorrectCount += 1;
    }

    const progress = this.requireProgress(outcome.wordId);
    if (outcome.review) {
      this.recordReviewAnswer(
        outcome.wordId,
        progress,
        outcome.answerType,
        outcome.correct
      );
    } else {
      this.recordPracticeAnswer(
        outcome.wordId,
        progress,
        outcome.answerType,
        outcome.correct
      );
    }

    this.pendingRecap = {
      kind: "answer-recap",
      wordId: outcome.wordId,
      exampleIndex: Math.floor(normalizedRandom(this.random()) * 3),
    };
  }

  cancelSubmission(): void {
    cancelVocabularySubmission(this.requireActiveAttempt());
  }

  getStats(): VocabularyLessonStats {
    return {
      totalWords: this.words.length,
      gradedAnswerCount: this.gradedAnswerCount,
      correctCount: this.correctCount,
      incorrectCount: this.incorrectCount,
    };
  }

  getWordProgress(wordId: string): VocabularyWordProgress {
    return { ...this.requireProgress(wordId) };
  }

  private selectNextStep(): VocabularyLessonStep {
    const pendingSpellingReview = this.words.find(
      (word) => this.requireProgress(word.id).reviewStage === "spelling-pending"
    );
    if (pendingSpellingReview) {
      return this.createAttemptStep(pendingSpellingReview.id, "spelling", true);
    }

    const pendingDefinitionReview = this.words.find(
      (word) => this.requireProgress(word.id).reviewStage === "definition-pending"
    );
    if (pendingDefinitionReview) {
      return this.createAttemptStep(
        pendingDefinitionReview.id,
        "definition",
        true
      );
    }

    const activePool = this.words
      .filter((word) => !this.requireProgress(word.id).spellingMastered)
      .slice(0, ACTIVE_POOL_SIZE);
    const unintroducedWord = activePool.find(
      (word) => !this.requireProgress(word.id).introduced
    );
    if (unintroducedWord) {
      this.introductionPhase = {
        wordId: unintroducedWord.id,
        stage: "definition-display",
      };
      return { kind: "definition-display", wordId: unintroducedWord.id };
    }

    const dueReview = this.getUnresolvedReviewsDue()[0];
    if (dueReview) {
      const progress = this.requireProgress(dueReview.word.id);
      progress.nextReviewQuestionNumber = null;
      progress.reviewStage = "definition-pending";
      return this.createAttemptStep(dueReview.word.id, "definition", true);
    }

    if (activePool.length === 0) {
      return { kind: "lesson-complete", ...this.getStats() };
    }

    const candidates =
      activePool.length > 1
        ? activePool.filter((word) => word.id !== this.lastPracticedWordId)
        : activePool;
    const word = selectVocabularyPracticeWord(
      candidates,
      (wordId) => this.requireProgress(wordId).practicePresentationCount,
      this.random
    );
    const progress = this.requireProgress(word.id);
    const answerType = progress.definitionMastered
      ? "spelling"
      : "definition";

    progress.practicePresentationCount += 1;
    this.lastPracticedWordId = word.id;
    return this.createAttemptStep(word.id, answerType, false);
  }

  private createAttemptStep(
    wordId: string,
    answerType: VocabularyAnswerSubmission["answerType"],
    review: boolean
  ): VocabularyLessonStep {
    if (review) {
      this.lastPracticedWordId = wordId;
    }
    return answerType === "definition"
      ? { kind: "definition-practice", wordId, review }
      : { kind: "spelling-practice", wordId, review };
  }

  private recordPracticeAnswer(
    wordId: string,
    progress: VocabularyWordProgress,
    answerType: VocabularyAnswerSubmission["answerType"],
    correct: boolean
  ): void {
    if (answerType === "definition") {
      progress.definitionConsecutiveCorrect = correct
        ? progress.definitionConsecutiveCorrect + 1
        : 0;
      if (progress.definitionConsecutiveCorrect >= DEFINITION_MASTERY_STREAK) {
        progress.definitionMastered = true;
      }
      return;
    }

    progress.spellingConsecutiveCorrect = correct
      ? progress.spellingConsecutiveCorrect + 1
      : 0;
    if (progress.spellingConsecutiveCorrect >= SPELLING_MASTERY_STREAK) {
      progress.spellingMastered = true;
      progress.reviewStage = "idle";
      progress.nextReviewQuestionNumber =
        this.gradedAnswerCount + DELAYED_REVIEW_ANSWER_COUNT;
      this.completionReviewWordIds?.add(wordId);
    }
  }

  private recordReviewAnswer(
    wordId: string,
    progress: VocabularyWordProgress,
    answerType: VocabularyAnswerSubmission["answerType"],
    correct: boolean
  ): void {
    if (!correct) {
      this.completionReviewWordIds?.delete(wordId);
      progress.definitionConsecutiveCorrect = 0;
      progress.definitionMastered = false;
      progress.spellingConsecutiveCorrect = 0;
      progress.spellingMastered = false;
      progress.reviewStage = "idle";
      progress.nextReviewQuestionNumber = null;
      return;
    }

    if (answerType === "definition") {
      progress.reviewStage = "spelling-pending";
      return;
    }

    progress.reviewStage = "idle";
    progress.nextReviewQuestionNumber =
      this.gradedAnswerCount + DELAYED_REVIEW_ANSWER_COUNT;
    this.completionReviewWordIds?.delete(wordId);
  }

  private getUnresolvedReviewsDue() {
    const dueReviews = getVocabularyReviewsDueBy(
      this.words,
      (wordId) => this.requireProgress(wordId),
      this.gradedAnswerCount
    );

    const completionReviewWordIds = this.completionReviewWordIds;
    return completionReviewWordIds === null
      ? dueReviews
      : dueReviews.filter((review) =>
          completionReviewWordIds.has(review.word.id)
        );
  }

  private captureCompletionReviewSnapshotIfReady(): void {
    if (
      this.completionReviewWordIds !== null ||
      this.words.some((word) => !this.requireProgress(word.id).introduced)
    ) {
      return;
    }

    this.completionReviewWordIds = new Set(
      this.words
        .filter(
          (word) =>
            this.requireProgress(word.id).nextReviewQuestionNumber !== null
        )
        .map((word) => word.id)
    );
  }

  private requireActiveAttempt(): VocabularyActiveAttempt {
    return requireVocabularyActiveAttempt(this.activeAttempt);
  }

  private requireProgress(wordId: string): VocabularyWordProgress {
    const progress = this.progressByWordId.get(wordId);
    if (!progress) {
      throw new Error(`Unknown vocabulary word progress: ${wordId}.`);
    }
    return progress;
  }

  private requireWord(wordId: string): VocabularyLessonWord {
    const word = this.words.find((candidate) => candidate.id === wordId);
    if (!word) {
      throw new Error(`Unknown vocabulary word: ${wordId}.`);
    }
    return word;
  }
}
