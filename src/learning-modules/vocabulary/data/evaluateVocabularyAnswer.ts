import type {
  VocabularyAnswerResult,
  VocabularyAnswerSubmission,
} from "../types";

export type DefinitionFixtureAnswer = {
  answerType: "definition";
  correctChoiceId: string;
  validChoiceIds: readonly string[];
};

export type SpellingFixtureAnswer = {
  answerType: "spelling";
  acceptedAnswers: readonly string[];
  displayAnswer: string;
};

export type FixtureAnswer = DefinitionFixtureAnswer | SpellingFixtureAnswer;

export function evaluateVocabularyAnswer(
  answer: FixtureAnswer | undefined,
  submission: VocabularyAnswerSubmission
): VocabularyAnswerResult | null {
  if (!answer || answer.answerType !== submission.answerType) {
    return null;
  }

  if (answer.answerType === "definition" && submission.answerType === "definition") {
    if (!answer.validChoiceIds.includes(submission.selectedChoiceId)) {
      return null;
    }

    return {
      answerType: "definition",
      correctChoiceId: answer.correctChoiceId,
    };
  }

  if (answer.answerType === "spelling" && submission.answerType === "spelling") {
    const normalizedAnswer = submission.answer.trim().toLocaleLowerCase("en-US");
    const correct = answer.acceptedAnswers.includes(normalizedAnswer);

    return correct
      ? { answerType: "spelling", correct: true }
      : {
          answerType: "spelling",
          correct: false,
          correctAnswer: answer.displayAnswer,
        };
  }

  return null;
}
