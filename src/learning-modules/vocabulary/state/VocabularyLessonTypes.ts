export const ACTIVE_POOL_SIZE = 5;
export const DEFINITION_MASTERY_STREAK = 3;
export const SPELLING_MASTERY_STREAK = 3;
export const DELAYED_REVIEW_ANSWER_COUNT = 30;

export type ReviewStage =
  | "idle"
  | "definition-pending"
  | "spelling-pending";

export type VocabularyWordProgress = {
  introduced: boolean;
  definitionConsecutiveCorrect: number;
  definitionMastered: boolean;
  spellingConsecutiveCorrect: number;
  spellingMastered: boolean;
  practicePresentationCount: number;
  reviewStage: ReviewStage;
  nextReviewQuestionNumber: number | null;
};

export type VocabularyLessonStats = {
  totalWords: number;
  gradedAnswerCount: number;
  correctCount: number;
  incorrectCount: number;
};

export type VocabularyLessonWord = {
  id: string;
};

export type VocabularyLessonStep =
  | { kind: "definition-display"; wordId: string }
  | { kind: "definition-fun-fact"; wordId: string }
  | {
      kind: "definition-practice";
      wordId: string;
      review: boolean;
    }
  | {
      kind: "spelling-practice";
      wordId: string;
      review: boolean;
    }
  | {
      kind: "answer-recap";
      wordId: string;
      exampleIndex: number;
    }
  | ({ kind: "lesson-complete" } & VocabularyLessonStats);

export function createInitialVocabularyWordProgress(): VocabularyWordProgress {
  return {
    introduced: false,
    definitionConsecutiveCorrect: 0,
    definitionMastered: false,
    spellingConsecutiveCorrect: 0,
    spellingMastered: false,
    practicePresentationCount: 0,
    reviewStage: "idle",
    nextReviewQuestionNumber: null,
  };
}
