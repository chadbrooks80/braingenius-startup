import { NextResponse } from "next/server";
import { logTtsSynthesisError } from "@/lib/learning-engine/errors/logTtsSynthesisError";
import { TtsConfigurationError, TtsUpstreamError } from "@/lib/learning-engine/errors/TtsSynthesisError";
import { synthesizeTts } from "@/lib/learning-engine/speech/providers/synthesizeTts";
import { parseTtsSynthesisRequest } from "@/lib/learning-engine/speech/validation/parseTtsSynthesisRequest";

export const runtime = "nodejs";

function jsonError(status: number, message: string): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

// TODO: Before public production deployment, require the authenticated Brain
// Genius user context, enforce per-user quotas and rate limits, and track paid
// TTS usage plus rejected requests. Do not expose this endpoint with paid
// provider credentials until those protections are in place.
export async function POST(request: Request): Promise<Response> {
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
    const audio = await synthesizeTts(synthesisRequest);
    // Uint8Array is a valid fetch BodyInit at runtime; this cast works around
    // a TS lib type-definition mismatch, not a real incompatibility.
    return new NextResponse(audio.bytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": audio.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logTtsSynthesisError(error);

    if (error instanceof TtsConfigurationError) {
      return jsonError(500, "The text-to-speech service is not configured.");
    }

    if (error instanceof TtsUpstreamError) {
      return jsonError(502, "The text-to-speech provider is unavailable.");
    }

    return jsonError(500, "An unexpected error occurred.");
  }
}
