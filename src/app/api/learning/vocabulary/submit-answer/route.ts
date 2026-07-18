import { getVocabularyAnswerForAttempt } from "@/learning-modules/vocabulary/data/getCorrectAnswer";
import { handleVocabularyAnswerRequest } from "./handleVocabularyAnswerRequest";
import { vocabularyContentCapabilityStore } from "@/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
import { getVocabularyLearnerId } from "@/learning-modules/vocabulary/server/vocabularyLearnerSession";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const learnerId = getVocabularyLearnerId(request);
  return handleVocabularyAnswerRequest(request, (submission) => {
    if (!learnerId) {
      return null;
    }
    return vocabularyContentCapabilityStore.resolveAnswer(
      learnerId,
      submission,
      getVocabularyAnswerForAttempt
    );
  });
}
