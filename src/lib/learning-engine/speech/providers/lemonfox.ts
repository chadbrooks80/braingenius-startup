import type { LemonfoxTtsConfiguration } from "@/types/learning";
import {
  TtsConfigurationError,
  TtsUpstreamError,
} from "../../errors/TtsSynthesisError";
import { fetchUpstreamOrThrow } from "./fetchUpstreamOrThrow";
import { isSupportedLemonfoxTtsConfiguration } from "../supportedTtsConfigurations";
import type { SynthesizedAudio, TtsProviderDeps } from "./types";

const LEMONFOX_SYNTHESIZE_ENDPOINT = "https://api.lemonfox.ai/v1/audio/speech";
const LEMONFOX_SPEED = 0.9;

export async function synthesizeWithLemonfox(
  text: string,
  tts: LemonfoxTtsConfiguration,
  deps: TtsProviderDeps = {}
): Promise<SynthesizedAudio> {
  if (!isSupportedLemonfoxTtsConfiguration(tts.voice)) {
    // Reaching here means a caller bypassed parseTtsConfiguration's allowlist
    // check (the route always validates first) — that's an internal contract
    // violation, not a transient upstream failure, so it must not surface as
    // a 502 "provider unavailable" response.
    throw new Error(
      `Lemonfox tts configuration is not in the supported allowlist: ${JSON.stringify(tts)}.`
    );
  }

  const apiKey = process.env.LEMONFOX_API_KEY;
  if (!apiKey) {
    throw new TtsConfigurationError(
      "lemonfox",
      "LEMONFOX_API_KEY must be configured."
    );
  }

  const fetchImpl = deps.fetchImpl ?? fetch;

  const response = await fetchUpstreamOrThrow(
    "lemonfox",
    fetchImpl,
    LEMONFOX_SYNTHESIZE_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: text,
        voice: tts.voice,
        language: "en-us",
        response_format: "mp3",
        speed: LEMONFOX_SPEED,
      }),
    },
    {
      networkFailure: "Failed to reach the Lemonfox Text-to-Speech endpoint.",
      rejection: "Lemonfox Text-to-Speech rejected the request.",
    },
    { voice: tts.voice }
  );

  const contentType = response.headers.get("Content-Type")?.split(";", 1)[0].trim();
  if (contentType !== "audio/mpeg") {
    throw new TtsUpstreamError(
      "lemonfox",
      "Lemonfox Text-to-Speech returned a non-audio response.",
      { voice: tts.voice, upstreamStatus: response.status }
    );
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new TtsUpstreamError(
      "lemonfox",
      "Lemonfox Text-to-Speech returned an empty response body.",
      { voice: tts.voice, upstreamStatus: response.status }
    );
  }

  return { bytes, contentType: "audio/mpeg" };
}
