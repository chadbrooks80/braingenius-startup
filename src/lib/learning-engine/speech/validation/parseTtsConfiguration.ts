import type { TtsConfiguration } from "@/types/learning";
import {
  isSupportedGoogleTtsConfiguration,
  isSupportedLemonfoxTtsConfiguration,
} from "../supportedTtsConfigurations";

const GOOGLE_FIELDS = ["provider", "model", "voice", "languageCode"] as const;
const LEMONFOX_FIELDS = ["provider", "voice"] as const;

function assertNoUnknownFields(
  raw: Record<string, unknown>,
  allowedFields: readonly string[],
  providerLabel: string
): void {
  const unknownFields = Object.keys(raw).filter(
    (field) => !allowedFields.includes(field)
  );

  if (unknownFields.length > 0) {
    throw new Error(
      `${providerLabel} TTS configuration has unknown field(s): ${unknownFields.join(", ")}.`
    );
  }
}

function assertNonBlankString(value: unknown, fieldLabel: string): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${fieldLabel} must be a non-empty string.`);
  }
  return value;
}

export function parseTtsConfiguration(raw: unknown): TtsConfiguration {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("tts must be an object.");
  }

  const config = raw as Record<string, unknown>;

  if (config.provider === "google") {
    assertNoUnknownFields(config, GOOGLE_FIELDS, "Google");

    const model = assertNonBlankString(config.model, "Google tts.model");
    const voice = assertNonBlankString(config.voice, "Google tts.voice");
    const languageCode = assertNonBlankString(
      config.languageCode,
      "Google tts.languageCode"
    );

    if (!isSupportedGoogleTtsConfiguration(model, voice, languageCode)) {
      throw new Error(
        "Google tts configuration is not in the supported allowlist."
      );
    }

    return { provider: "google", model, voice, languageCode };
  }

  if (config.provider === "lemonfox") {
    assertNoUnknownFields(config, LEMONFOX_FIELDS, "Lemonfox");

    const voice = assertNonBlankString(config.voice, "Lemonfox tts.voice");

    if (!isSupportedLemonfoxTtsConfiguration(voice)) {
      throw new Error(
        "Lemonfox tts configuration is not in the supported allowlist."
      );
    }

    return { provider: "lemonfox", voice };
  }

  throw new Error(
    `tts.provider must be "google" or "lemonfox", received: ${JSON.stringify(config.provider)}.`
  );
}
