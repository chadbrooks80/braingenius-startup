import { getVocabularyAnswerForAttempt } from "@/learning-modules/vocabulary/data/getCorrectAnswer";
import { handleVocabularyAnswerRequest } from "./handleVocabularyAnswerRequest";
import { vocabularyContentCapabilityStore } from "@/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
import { getVocabularyLearnerId } from "@/learning-modules/vocabulary/server/vocabularyLearnerSession";
import {
  authorizeLearningModuleAccess,
  learningModuleAccessDenialResponse,
  type AuthorizeLearningModuleAccessDeps,
} from "@/lib/auth/module-access";

export const runtime = "nodejs";

const VOCABULARY_MODULE_NAME = "vocabulary";

export async function handleVocabularySubmitAnswerRouteRequest(
  request: Request,
  accessDeps: AuthorizeLearningModuleAccessDeps = {}
): Promise<Response> {
  const access = await authorizeLearningModuleAccess(VOCABULARY_MODULE_NAME, accessDeps);
  if (access.status !== "granted") {
    return learningModuleAccessDenialResponse(access);
  }

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

export async function POST(request: Request): Promise<Response> {
  return handleVocabularySubmitAnswerRouteRequest(request);
}
