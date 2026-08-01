import type { VocabularyProgressSnapshot } from "./data/vocabularyContentTypes";

export type VocabularyDefinitionAnswerSubmission = {
  answerType: "definition";
  attemptId: string;
  selectedChoiceId: string;
};

export type VocabularySpellingAnswerSubmission = {
  answerType: "spelling";
  attemptId: string;
  answer: string;
};

export type VocabularyAnswerSubmission =
  | VocabularyDefinitionAnswerSubmission
  | VocabularySpellingAnswerSubmission;

export type VocabularyDefinitionAnswerResult = {
  answerType: "definition";
  correctChoiceId: string;
};

export type VocabularyCorrectSpellingAnswerResult = {
  answerType: "spelling";
  correct: true;
};

export type VocabularyIncorrectSpellingAnswerResult = {
  answerType: "spelling";
  correct: false;
  correctAnswer: string;
};

export type VocabularyAnswerResult =
  | VocabularyDefinitionAnswerResult
  | VocabularyCorrectSpellingAnswerResult
  | VocabularyIncorrectSpellingAnswerResult;

// The durable HTTP response contract: the existing grade shape plus the
// authoritative progress/panel snapshot. Kept separate from
// `VocabularyAnswerResult` so pure grading/mirroring code (which never sees
// the database projection) keeps its original, narrower contract.
export type VocabularyAnswerApiResult = VocabularyAnswerResult & {
  progress: VocabularyProgressSnapshot;
};
