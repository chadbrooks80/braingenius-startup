import { synthesizeTts } from "@/lib/learning-engine/speech/providers/synthesizeTts";
import type { SynthesizedAudio } from "@/lib/learning-engine/speech/providers/types";
import {
  authorizePaidTtsCaller,
  paidTtsAudioResponse,
  paidTtsFailureResponse,
  runMeteredTtsSynthesis,
  ttsDenialResponse,
  type PaidTtsUsageDeps,
} from "@/lib/learning-engine/speech/ttsUsageService";
import type { TtsSynthesisRequest } from "@/lib/learning-engine/speech/validation/parseTtsSynthesisRequest";
import { vocabularyTts } from "../data/vocabularyTts";
import { findVocabularySpellingAttemptForSpeech } from "./vocabularyLearningStore";

const SPEECH_REQUEST_FIELDS = ["reference"] as const;

type SpeechSynthesizer = (
  request: TtsSynthesisRequest
) => Promise<SynthesizedAudio>;

type VocabularySpellingAttemptLookup = (
  userId: string,
  reference: string
) => Promise<{ canonicalSpelling: string; speechDefinition: string } | null>;

function jsonError(status: number, message: string): Response {
  return Response.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * Resolves an opaque spelling speech reference (the durable attempt ID) into
 * provider audio entirely on the server. The canonical written word and its
 * speech-synthesis definition come only from the durable attempt row
 * (authorized against the authenticated learner via its session/learning
 * chain) -- this never scans a database list for a matching word. Browser
 * responses carry audio bytes or a generic error message, never the word.
 * Every request passes the same authenticated/entitled/suspension-checked
 * shared usage policy as public teaching speech, classified as
 * VOCABULARY_PROTECTED.
 */
export async function handleVocabularySpeechRequest(
  request: Request,
  userId: string,
  synthesize: SpeechSynthesizer = synthesizeTts,
  findAttempt: VocabularySpellingAttemptLookup = findVocabularySpellingAttemptForSpeech,
  accessDeps: PaidTtsUsageDeps = {}
): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonError(400, "Request body must be valid JSON.");
  }

  const reference = parseSpeechReference(rawBody);
  if (!reference) {
    return jsonError(400, "Invalid vocabulary speech request.");
  }

  const authorization = await authorizePaidTtsCaller(accessDeps);
  if (!authorization.ok) {
    return ttsDenialResponse(authorization.denial);
  }

  let attempt;
  try {
    attempt = await findAttempt(userId, reference);
  } catch (error) {
    console.error("[vocabulary-speech] attempt lookup unavailable", error);
    return jsonError(503, "This learning module is temporarily unavailable.");
  }
  if (!attempt) {
    return jsonError(400, "Invalid vocabulary speech request.");
  }

  try {
    const result = await runMeteredTtsSynthesis(
      {
        text: `Spell the word: ${attempt.canonicalSpelling}. ${attempt.speechDefinition}`,
        tts: vocabularyTts,
      },
      "VOCABULARY_PROTECTED",
      authorization.access,
      { ...accessDeps, synthesize }
    );
    if (result.status === "denied") {
      return ttsDenialResponse(result.denial);
    }
    return paidTtsAudioResponse(result.audio);
  } catch (error) {
    return paidTtsFailureResponse(error);
  }
}

function parseSpeechReference(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return null;
  }

  const body = raw as Record<string, unknown>;
  const fields = Object.keys(body);
  if (
    fields.length !== SPEECH_REQUEST_FIELDS.length ||
    !fields.every((field) =>
      SPEECH_REQUEST_FIELDS.includes(
        field as (typeof SPEECH_REQUEST_FIELDS)[number]
      )
    )
  ) {
    return null;
  }

  const { reference } = body;
  if (typeof reference !== "string" || reference.trim() === "") {
    return null;
  }

  return reference;
}
