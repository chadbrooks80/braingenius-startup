import type {
  ActionPayload,
  SpeakActionPayload,
  SpeechSourceReference,
} from "@/types/learning";
import { parseTtsConfiguration } from "./parseTtsConfiguration";

const SOURCE_FIELDS = ["endpoint", "reference"] as const;
const TRUSTED_SPEECH_ORIGIN = "https://learning-engine.invalid";
const PERMITTED_SPEECH_PATH =
  /^\/api\/learning\/[a-z0-9-]+\/speech$/;

function parseSpeechSourceReference(source: unknown): SpeechSourceReference {
  if (typeof source !== "object" || source === null || Array.isArray(source)) {
    throw new Error("speak requires source to be an object.");
  }

  const record = source as Record<string, unknown>;
  const fields = Object.keys(record);
  if (
    fields.length !== SOURCE_FIELDS.length ||
    !fields.every((field) =>
      SOURCE_FIELDS.includes(field as (typeof SOURCE_FIELDS)[number])
    )
  ) {
    throw new Error("speak requires source to contain exactly endpoint and reference.");
  }

  const { endpoint, reference } = record;

  if (typeof endpoint !== "string" || endpoint.includes("\\")) {
    throw new Error("speak requires source.endpoint to be a same-origin path.");
  }

  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(endpoint, TRUSTED_SPEECH_ORIGIN);
  } catch {
    throw new Error("speak requires source.endpoint to be a same-origin path.");
  }

  if (
    parsedEndpoint.origin !== TRUSTED_SPEECH_ORIGIN ||
    parsedEndpoint.search !== "" ||
    parsedEndpoint.hash !== "" ||
    !PERMITTED_SPEECH_PATH.test(parsedEndpoint.pathname) ||
    endpoint !== parsedEndpoint.pathname
  ) {
    throw new Error("speak requires source.endpoint to be a permitted speech path.");
  }

  if (typeof reference !== "string" || reference.trim() === "") {
    throw new Error("speak requires source.reference to be a non-empty string.");
  }

  return { endpoint, reference };
}

function parseSpeakText(text: unknown): string | string[] {
  if (typeof text === "string") {
    if (text.trim() === "") {
      throw new Error("speak requires a non-empty text string.");
    }
    return text;
  }

  if (Array.isArray(text)) {
    if (!text.every((entry) => typeof entry === "string")) {
      throw new Error("speak requires every text array entry to be a string.");
    }
    if (!text.some((entry) => entry.trim() !== "")) {
      throw new Error("speak requires at least one non-empty text entry.");
    }
    return text;
  }

  throw new Error("speak requires text to be a string or an array of strings.");
}

export function parseSpeakActionPayload(
  payload: ActionPayload
): SpeakActionPayload {
  if (payload.source !== undefined) {
    if (payload.text !== undefined || payload.tts !== undefined) {
      throw new Error(
        "speak accepts either public text or a server-resolved source, not both."
      );
    }
    return { source: parseSpeechSourceReference(payload.source) };
  }

  const text = parseSpeakText(payload.text);
  const tts = parseTtsConfiguration(payload.tts);

  return { text, tts };
}
