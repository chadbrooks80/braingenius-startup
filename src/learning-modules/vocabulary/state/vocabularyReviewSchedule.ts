import type {
  VocabularyLessonWord,
  VocabularyWordProgress,
} from "./VocabularyLessonTypes";

export type DueVocabularyReview = {
  word: VocabularyLessonWord;
  index: number;
  questionNumber: number | null;
};

export function getVocabularyReviewsDueBy(
  words: readonly VocabularyLessonWord[],
  getProgress: (wordId: string) => VocabularyWordProgress,
  answerCount: number
): DueVocabularyReview[] {
  return words
    .map((word, index) => ({
      word,
      index,
      questionNumber: getProgress(word.id).nextReviewQuestionNumber,
    }))
    .filter(
      (candidate) =>
        candidate.questionNumber !== null &&
        candidate.questionNumber <= answerCount
    )
    .sort(
      (left, right) =>
        (left.questionNumber ?? 0) - (right.questionNumber ?? 0) ||
        left.index - right.index
    );
}
