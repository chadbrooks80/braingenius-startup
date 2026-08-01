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
  WORD_SEARCH_CHECKPOINT_GROUP_SIZE,
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
  WORD_SEARCH_CHECKPOINT_GROUP_SIZE,
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

// Durable-resume seed data, keyed by lesson-scoped word IDs (never canonical
// list-word IDs). The caller resolves the canonical-to-lesson-word-ID
// mapping; this class stays unaware of canonical identity.
export type VocabularyLessonHydration = {
  progressByWordId: ReadonlyMap<string, VocabularyWordProgress>;
  gradedAnswerCount: number;
  correctCount: number;
  incorrectCount: number;
  // Lesson word IDs already fully first-mastered, in first-mastery order.
  checkpointEligibleOrder: readonly string[];
  servedCheckpointGroupCount: number;
};

export class VocabularyLessonState {
  private words: readonly VocabularyLessonWord[];
  private readonly totalWordCount: number;
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
  // Unique words in the order they first reach full initial mastery. A later
  // review failure and re-mastery never re-adds or reorders an entry, so a
  // word can belong to at most one checkpoint group for this lesson attempt.
  private readonly checkpointEligibleOrder: string[] = [];
  private readonly checkpointEligibleWordIds = new Set<string>();
  private servedCheckpointGroupCount = 0;
  private pendingCheckpointWordIds: string[] | null = null;

  constructor(
    words: readonly VocabularyLessonWord[],
    totalWordCount: number,
    random: () => number = Math.random,
    hydration?: VocabularyLessonHydration
  ) {
    this.words = words;
    this.totalWordCount = totalWordCount;
    this.random = random;
    this.progressByWordId = new Map(
      words.map((word) => [
        word.id,
        hydration?.progressByWordId.get(word.id) ??
          createInitialVocabularyWordProgress(),
      ])
    );

    if (hydration) {
      this.gradedAnswerCount = hydration.gradedAnswerCount;
      this.correctCount = hydration.correctCount;
      this.incorrectCount = hydration.incorrectCount;
      this.servedCheckpointGroupCount = hydration.servedCheckpointGroupCount;
      for (const wordId of hydration.checkpointEligibleOrder) {
        if (!this.progressByWordId.has(wordId)) {
          continue;
        }
        this.checkpointEligibleWordIds.add(wordId);
        this.checkpointEligibleOrder.push(wordId);
      }

      const completedGroups = Math.floor(
        this.checkpointEligibleOrder.length / WORD_SEARCH_CHECKPOINT_GROUP_SIZE
      );
      if (completedGroups > this.servedCheckpointGroupCount) {
        const start =
          this.servedCheckpointGroupCount * WORD_SEARCH_CHECKPOINT_GROUP_SIZE;
        this.pendingCheckpointWordIds = this.checkpointEligibleOrder.slice(
          start,
          start + WORD_SEARCH_CHECKPOINT_GROUP_SIZE
        );
      }
    }
  }

  /**
   * Appends exactly one newly loaded word after an authorized refill. A
   * duplicate append (a replayed or concurrent refill result) is silently
   * ignored so the same database word can never enter the ordered lesson
   * twice.
   */
  appendWord(word: VocabularyLessonWord): void {
    if (this.progressByWordId.has(word.id)) {
      return;
    }
    this.words = [...this.words, word];
    this.progressByWordId.set(word.id, createInitialVocabularyWordProgress());
  }

  // The current active pool: the first ACTIVE_POOL_SIZE currently loaded
  // words that have not yet reached full spelling mastery, in load order.
  getActivePoolWordIds(): string[] {
    return this.words
      .filter((word) => !this.requireProgress(word.id).spellingMastered)
      .slice(0, ACTIVE_POOL_SIZE)
      .map((word) => word.id);
  }

  // The number of unique words that have ever reached full initial mastery.
  // A later review failure and re-mastery never increases this again, so it
  // is the correct signal for "one more active-pool slot is now due a
  // refill" -- exactly once per word, exactly at first mastery.
  getFirstMasteryCount(): number {
    return this.checkpointEligibleOrder.length;
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

    if (this.pendingCheckpointWordIds) {
      const wordIds = this.pendingCheckpointWordIds;
      this.pendingCheckpointWordIds = null;
      this.servedCheckpointGroupCount += 1;
      return { kind: "word-search-checkpoint", wordIds };
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
      totalWords: this.totalWordCount,
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

    const activePoolIds = new Set(this.getActivePoolWordIds());
    const activePool = this.words.filter((word) => activePoolIds.has(word.id));
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
      if (this.words.length < this.totalWordCount) {
        throw new Error(
          "Vocabulary lesson has no active work but the database source is not exhausted; an authorized refill must complete before advancing."
        );
      }
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
      this.registerCheckpointEligibility(wordId);
    }
  }

  // Called the first time a word ever reaches full initial mastery. Later
  // review failure and re-mastery must not re-enter it into a new group.
  private registerCheckpointEligibility(wordId: string): void {
    if (this.checkpointEligibleWordIds.has(wordId)) {
      return;
    }

    this.checkpointEligibleWordIds.add(wordId);
    this.checkpointEligibleOrder.push(wordId);

    const completedGroups = Math.floor(
      this.checkpointEligibleOrder.length / WORD_SEARCH_CHECKPOINT_GROUP_SIZE
    );
    if (
      completedGroups > this.servedCheckpointGroupCount &&
      !this.pendingCheckpointWordIds
    ) {
      const start = this.servedCheckpointGroupCount * WORD_SEARCH_CHECKPOINT_GROUP_SIZE;
      this.pendingCheckpointWordIds = this.checkpointEligibleOrder.slice(
        start,
        start + WORD_SEARCH_CHECKPOINT_GROUP_SIZE
      );
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
      this.words.length < this.totalWordCount ||
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
