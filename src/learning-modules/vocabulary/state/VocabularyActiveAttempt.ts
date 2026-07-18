import type {
  VocabularyAnswerResult,
  VocabularyAnswerSubmission,
} from "../types";

export type VocabularyActiveAttempt = {
  wordId: string;
  answerType: VocabularyAnswerSubmission["answerType"];
  attemptId: string;
  validChoiceIds: readonly string[];
  review: boolean;
  answered: boolean;
  answerPending: boolean;
  submission: VocabularyAnswerSubmission | null;
};

export type VocabularySubmissionOutcome = {
  wordId: string;
  answerType: VocabularyAnswerSubmission["answerType"];
  review: boolean;
  correct: boolean;
};

export type VocabularyAttemptDescriptor = Pick<
  VocabularyActiveAttempt,
  "wordId" | "answerType" | "attemptId" | "validChoiceIds" | "review"
>;

export function createVocabularyActiveAttempt(
  descriptor: VocabularyAttemptDescriptor
): VocabularyActiveAttempt {
  return {
    ...descriptor,
    answered: false,
    answerPending: false,
    submission: null,
  };
}

export function beginVocabularySubmission(
  attempt: VocabularyActiveAttempt,
  payload: VocabularyAnswerSubmission
): void {
  if (payload.attemptId !== attempt.attemptId) {
    throw new Error(
      `submitAnswer received a stale attemptId: ${payload.attemptId}.`
    );
  }

  if (payload.answerType !== attempt.answerType) {
    throw new Error(
      `Attempt ${attempt.attemptId} does not accept a ${payload.answerType} answer.`
    );
  }

  if (attempt.answered) {
    throw new Error(`Attempt ${attempt.attemptId} has already been answered.`);
  }

  if (attempt.answerPending) {
    throw new Error(`Attempt ${attempt.attemptId} already has an answer pending.`);
  }

  if (
    payload.answerType === "definition" &&
    !attempt.validChoiceIds.includes(payload.selectedChoiceId)
  ) {
    throw new Error(
      `selectedChoiceId "${payload.selectedChoiceId}" was not offered for attempt ${attempt.attemptId}.`
    );
  }

  attempt.answerPending = true;
  attempt.submission = payload;
}

export function recordVocabularySubmission(
  attempt: VocabularyActiveAttempt,
  result: VocabularyAnswerResult
): VocabularySubmissionOutcome {
  const submission = attempt.submission;

  if (!attempt.answerPending || !submission) {
    throw new Error(`Attempt ${attempt.attemptId} has no answer pending.`);
  }

  if (result.answerType !== attempt.answerType) {
    throw new Error(
      `Attempt ${attempt.attemptId} received mismatched ${result.answerType} feedback.`
    );
  }

  const correct =
    submission.answerType === "definition" &&
    result.answerType === "definition"
      ? submission.selectedChoiceId === result.correctChoiceId
      : result.answerType === "spelling" && result.correct;

  attempt.answerPending = false;
  attempt.answered = true;

  return {
    wordId: attempt.wordId,
    answerType: attempt.answerType,
    review: attempt.review,
    correct,
  };
}

export function cancelVocabularySubmission(
  attempt: VocabularyActiveAttempt
): void {
  attempt.answerPending = false;
  attempt.submission = null;
}

export function requireVocabularyActiveAttempt(
  attempt: VocabularyActiveAttempt | null
): VocabularyActiveAttempt {
  if (!attempt) {
    throw new Error("No active vocabulary attempt to submit against.");
  }
  return attempt;
}

export function requireVocabularyAttemptAnswered(
  attempt: VocabularyActiveAttempt
): void {
  if (!attempt.answered) {
    throw new Error(
      "Cannot advance before the active vocabulary attempt is answered."
    );
  }
}
