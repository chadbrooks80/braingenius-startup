import { handleVocabularyContentRequest } from "@/learning-modules/vocabulary/server/handleVocabularyContentRequest";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleVocabularyContentRequest(request);
}
