import { handleVocabularyContentRequest } from "@/learning-modules/vocabulary/server/handleVocabularyContentRequest";
import {
  authorizeLearningModuleAccess,
  learningModuleAccessDenialResponse,
  type AuthorizeLearningModuleAccessDeps,
} from "@/lib/auth/module-access";

export const runtime = "nodejs";

const VOCABULARY_MODULE_NAME = "vocabulary";

export async function handleVocabularyContentRouteRequest(
  request: Request,
  accessDeps: AuthorizeLearningModuleAccessDeps = {}
): Promise<Response> {
  const access = await authorizeLearningModuleAccess(VOCABULARY_MODULE_NAME, accessDeps);
  if (access.status !== "granted") {
    return learningModuleAccessDenialResponse(access);
  }

  return handleVocabularyContentRequest(request, access.userId);
}

export async function POST(request: Request): Promise<Response> {
  return handleVocabularyContentRouteRequest(request);
}
