import { logTtsSynthesisError } from "@/lib/learning-engine/errors/logTtsSynthesisError";
import {
  TtsConfigurationError,
  TtsUpstreamError,
} from "@/lib/learning-engine/errors/TtsSynthesisError";
import { synthesizeTts } from "@/lib/learning-engine/speech/providers/synthesizeTts";
import type { SynthesizedAudio } from "@/lib/learning-engine/speech/providers/types";
import type { TtsSynthesisRequest } from "@/lib/learning-engine/speech/validation/parseTtsSynthesisRequest";
import { getWordList } from "../data/getWordList";
import { vocabularyTts } from "../data/vocabularyTts";
import {
  vocabularyContentCapabilityStore,
  type VocabularyContentCapabilityStore,
} from "./VocabularyContentCapabilityStore";
import { getVocabularyLearnerId } from "./vocabularyLearnerSession";

const SPEECH_REQUEST_FIELDS = ["reference"] as const;

type SpeechSynthesizer = (
  request: TtsSynthesisRequest
) => Promise<SynthesizedAudio>;

/**
 * Resolves an opaque spelling speech reference into provider audio entirely
 * on the server. The canonical written word exists only in the synthesis text
 * sent to the shared TTS service; browser responses carry audio bytes or the
 * generic error message, never the word.
 */
export async function handleVocabularySpeechRequest(
  request: Request,
  synthesize: SpeechSynthesizer = synthesizeTts,
  capabilityStore: VocabularyContentCapabilityStore =
    vocabularyContentCapabilityStore
): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const reference = parseSpeechReference(rawBody);
  if (!reference) {
    return Response.json(
      { error: "Invalid vocabulary speech request." },
      { status: 400 }
    );
  }

  const learnerId = getVocabularyLearnerId(request);
  const attempt = learnerId
    ? capabilityStore.getSpellingAttempt(learnerId, reference)
    : null;
  const word = attempt
    ? getWordList(attempt.wordListId)?.find(
        (candidate) => candidate.id === attempt.wordId
      ) ?? null
    : null;
  if (!word) {
    return Response.json(
      { error: "Invalid vocabulary speech request." },
      { status: 400 }
    );
  }

  try {
    const audio = await synthesize({
      text: `Spell the word: ${word.word}. ${word.definition}`,
      tts: vocabularyTts,
    });

    return new Response(audio.bytes as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": audio.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    logTtsSynthesisError(error);

    if (error instanceof TtsConfigurationError) {
      return Response.json(
        { error: "The text-to-speech service is not configured." },
        { status: 500 }
      );
    }

    if (error instanceof TtsUpstreamError) {
      return Response.json(
        { error: "The text-to-speech provider is unavailable." },
        { status: 502 }
      );
    }

    return Response.json(
      { error: "An unexpected error occurred." },
      { status: 500 }
    );
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
