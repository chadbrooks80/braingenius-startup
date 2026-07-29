import "server-only";
import { parseTtsSynthesisRequest } from "./validation/parseTtsSynthesisRequest";
import {
  paidTtsAudioResponse,
  paidTtsFailureResponse,
  runPaidTtsSynthesis,
  ttsDenialResponse,
  type PaidTtsUsageDeps,
} from "./ttsUsageService";

function jsonError(status: number, message: string): Response {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Owning handler for the generic public paid TTS boundary. The route file
 * stays thin; every request passes through strict per-chunk parsing and the
 * one shared authentication/entitlement/usage policy before any provider
 * call. Dependencies are injectable only so tests can prove the boundary
 * with deterministic fakes.
 */
export async function handleTtsSynthesisRequest(
  request: Request,
  deps: PaidTtsUsageDeps = {}
): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  let synthesisRequest;
  try {
    synthesisRequest = parseTtsSynthesisRequest(rawBody);
  } catch {
    return jsonError(400, "Invalid TTS request.");
  }

  try {
    const result = await runPaidTtsSynthesis(synthesisRequest, "PUBLIC_TEXT", deps);
    if (result.status === "denied") {
      return ttsDenialResponse(result.denial);
    }
    return paidTtsAudioResponse(result.audio);
  } catch (error) {
    return paidTtsFailureResponse(error);
  }
}
