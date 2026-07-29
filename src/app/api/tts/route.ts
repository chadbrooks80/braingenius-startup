import { handleTtsSynthesisRequest } from "@/lib/learning-engine/speech/handleTtsSynthesisRequest";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  return handleTtsSynthesisRequest(request);
}
