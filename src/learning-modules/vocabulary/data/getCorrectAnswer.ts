import "server-only";

import type {
  VocabularyAnswerResult,
  VocabularyAnswerSubmission,
} from "../types";
import { evaluateVocabularyAnswer } from "./evaluateVocabularyAnswer";
import type { VocabularyGradableAttempt } from "../server/VocabularyContentCapabilityStore";

/**
 * Grades a submission against the server-only attempt snapshot recorded at
 * content-build time (`recordContentResponse`). This never re-queries the
 * database, re-derives distractors, or recomputes correctness: the snapshot
 * captured when the practice content was created is the single source of
 * truth, so exact-replay and duplicate-submission grading stay stable.
 */
export function getVocabularyAnswerForAttempt(
  attempt: VocabularyGradableAttempt,
  submission: VocabularyAnswerSubmission
): VocabularyAnswerResult | null {
  if (
    attempt.attemptId !== submission.attemptId ||
    attempt.answerType !== submission.answerType
  ) {
    return null;
  }

  if (
    attempt.answerType === "definition" &&
    attempt.correctChoiceId !== null
  ) {
    return evaluateVocabularyAnswer(
      {
        answerType: "definition",
        correctChoiceId: attempt.correctChoiceId,
        validChoiceIds: attempt.validChoiceIds,
      },
      submission
    );
  }

  if (attempt.answerType === "spelling" && attempt.canonicalSpelling) {
    return evaluateVocabularyAnswer(
      {
        answerType: "spelling",
        acceptedAnswers: [attempt.canonicalSpelling.toLocaleLowerCase("en-US")],
        displayAnswer: attempt.canonicalSpelling,
      },
      submission
    );
  }

  return null;
}
