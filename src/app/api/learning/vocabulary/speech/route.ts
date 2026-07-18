import { handleVocabularySpeechRequest } from "@/learning-modules/vocabulary/server/handleVocabularySpeechRequest";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleVocabularySpeechRequest(request);
}
