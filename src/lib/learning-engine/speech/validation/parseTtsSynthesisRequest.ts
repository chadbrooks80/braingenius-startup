import type { TtsConfiguration } from "@/types/learning";
import { parseTtsConfiguration } from "./parseTtsConfiguration";

const MAX_TEXT_BYTES = 4000;
const REQUEST_FIELDS = ["text", "tts"] as const;

export type TtsSynthesisRequest = {
  text: string;
  tts: TtsConfiguration;
};

export function parseTtsSynthesisRequest(raw: unknown): TtsSynthesisRequest {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Request body must be an object.");
  }

  const body = raw as Record<string, unknown>;
  const unknownFields = Object.keys(body).filter(
    (field) => !REQUEST_FIELDS.includes(field as (typeof REQUEST_FIELDS)[number])
  );
  if (unknownFields.length > 0) {
    throw new Error(
      `TTS request has unknown field(s): ${unknownFields.join(", ")}.`
    );
  }

  const { text } = body;

  if (typeof text !== "string" || text.trim() === "") {
    throw new Error("text must be a non-empty string.");
  }

  if (Buffer.byteLength(text, "utf8") > MAX_TEXT_BYTES) {
    throw new Error(`text must not exceed ${MAX_TEXT_BYTES} UTF-8 bytes.`);
  }

  const tts = parseTtsConfiguration(body.tts);

  return { text, tts };
}
