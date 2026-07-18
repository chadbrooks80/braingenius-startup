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
