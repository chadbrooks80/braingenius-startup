import { handleVocabularyAnswerRequest } from "./handleVocabularyAnswerRequest";
import { vocabularyContentCapabilityStore } from "@/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
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

  return handleVocabularyAnswerRequest(request, (submission) =>
    vocabularyContentCapabilityStore.resolveAnswer(access.userId, submission)
  );
}

export async function POST(request: Request): Promise<Response> {
  return handleVocabularySubmitAnswerRouteRequest(request);
}
