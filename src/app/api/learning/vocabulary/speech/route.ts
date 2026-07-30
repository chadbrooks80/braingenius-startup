import { handleVocabularySpeechRequest } from "@/learning-modules/vocabulary/server/handleVocabularySpeechRequest";
import {
  authorizeLearningModuleAccess,
  learningModuleAccessDenialResponse,
  type AuthorizeLearningModuleAccessDeps,
} from "@/lib/auth/module-access";

export const runtime = "nodejs";

const VOCABULARY_MODULE_NAME = "vocabulary";

export async function handleVocabularySpeechRouteRequest(
  request: Request,
  accessDeps: AuthorizeLearningModuleAccessDeps = {}
): Promise<Response> {
  const access = await authorizeLearningModuleAccess(VOCABULARY_MODULE_NAME, accessDeps);
  if (access.status !== "granted") {
    return learningModuleAccessDenialResponse(access);
  }

  return handleVocabularySpeechRequest(request, access.userId);
}

export async function POST(request: Request): Promise<Response> {
  return handleVocabularySpeechRouteRequest(request);
}
