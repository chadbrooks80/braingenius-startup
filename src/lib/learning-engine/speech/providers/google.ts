import "server-only";
import type { GoogleTtsConfiguration } from "@/types/learning";
import { TtsUpstreamError } from "../../errors/TtsSynthesisError";
import {
  TTS_MAX_GOOGLE_SYNTHESIS_JSON_BYTES,
  TTS_MAX_MP3_RESPONSE_BYTES,
} from "../ttsUsagePolicy";
import { fetchUpstreamOrThrow } from "./fetchUpstreamOrThrow";
import {
  getGoogleAccessToken,
  readGoogleServiceAccountCredentials,
} from "./googleAuth";
import { isSupportedGoogleTtsConfiguration } from "../supportedTtsConfigurations";
import { readBoundedResponseBody } from "./readBoundedResponseBody";
import type { SynthesizedAudio, TtsProviderDeps } from "./types";

const GOOGLE_TTS_SYNTHESIZE_ENDPOINT =
  "https://texttospeech.googleapis.com/v1/text:synthesize";
const GOOGLE_TTS_SPEAKING_RATE = 0.9;
// Linear-time base64 validation: combined with the length % 4 check below it
// accepts exactly the standard-base64 grammar. A grouped-quantifier pattern
// backtracks catastrophically on multi-megabyte provider responses.
const STANDARD_BASE64_CONTENT_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

function isStandardBase64(value: string): boolean {
  return value.length % 4 === 0 && STANDARD_BASE64_CONTENT_PATTERN.test(value);
}

export async function synthesizeWithGoogle(
  text: string,
  tts: GoogleTtsConfiguration,
  deps: TtsProviderDeps = {}
): Promise<SynthesizedAudio> {
  if (!isSupportedGoogleTtsConfiguration(tts.model, tts.voice, tts.languageCode)) {
    // Reaching here means a caller bypassed parseTtsConfiguration's allowlist
    // check (the route always validates first) — that's an internal contract
    // violation, not a transient upstream failure, so it must not surface as
    // a 502 "provider unavailable" response.
    throw new Error(
      `Google tts configuration is not in the supported allowlist: ${JSON.stringify(tts)}.`
    );
  }

  const fetchImpl = deps.fetchImpl ?? fetch;
  const credentials = readGoogleServiceAccountCredentials();
  const accessToken = await getGoogleAccessToken(
    credentials,
    fetchImpl,
    deps.upstreamTimeoutMs
  );
  const details = { model: tts.model, voice: tts.voice };

  return fetchUpstreamOrThrow(
    "google",
    fetchImpl,
    GOOGLE_TTS_SYNTHESIZE_ENDPOINT,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...(credentials.projectId
          ? { "x-goog-user-project": credentials.projectId }
          : {}),
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: tts.languageCode, name: tts.voice },
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate: GOOGLE_TTS_SPEAKING_RATE,
        },
      }),
    },
    {
      networkFailure: "Failed to reach the Google Cloud Text-to-Speech endpoint.",
      rejection: "Google Cloud Text-to-Speech rejected the request.",
    },
    async (response, signal) => {
      const contentType = response.headers
        .get("Content-Type")
        ?.split(";", 1)[0]
        .trim();
      if (contentType !== "application/json") {
        throw new TtsUpstreamError(
          "google",
          "Google Cloud Text-to-Speech returned a non-JSON response.",
          { ...details, upstreamStatus: response.status }
        );
      }

      const rawBody = await readBoundedResponseBody(
        "google",
        response,
        TTS_MAX_GOOGLE_SYNTHESIS_JSON_BYTES,
        "Google Cloud Text-to-Speech returned an oversized response body.",
        details,
        signal
      );

      let payload: unknown;
      try {
        payload = JSON.parse(Buffer.from(rawBody).toString("utf8"));
      } catch (cause) {
        throw new TtsUpstreamError(
          "google",
          "Google Cloud Text-to-Speech response was not valid JSON.",
          { ...details, upstreamStatus: response.status, cause }
        );
      }

      const audioContent = (payload as { audioContent?: unknown })?.audioContent;
      if (
        typeof audioContent !== "string" ||
        audioContent === "" ||
        !isStandardBase64(audioContent)
      ) {
        throw new TtsUpstreamError(
          "google",
          "Google Cloud Text-to-Speech response did not include valid audio content.",
          { ...details, upstreamStatus: response.status }
        );
      }

      // Valid standard base64 always has a length divisible by four, so this
      // is the exact decoded size. The check happens before materializing the
      // decoded bytes, while the upstream deadline is still active.
      const paddingBytes = audioContent.endsWith("==")
        ? 2
        : audioContent.endsWith("=")
          ? 1
          : 0;
      const decodedByteLength = (audioContent.length / 4) * 3 - paddingBytes;
      if (decodedByteLength > TTS_MAX_MP3_RESPONSE_BYTES) {
        throw new TtsUpstreamError(
          "google",
          "Google Cloud Text-to-Speech returned oversized audio content.",
          { ...details, upstreamStatus: response.status }
        );
      }

      const bytes = new Uint8Array(Buffer.from(audioContent, "base64"));
      if (
        bytes.byteLength === 0 ||
        bytes.byteLength > TTS_MAX_MP3_RESPONSE_BYTES
      ) {
        throw new TtsUpstreamError(
          "google",
          "Google Cloud Text-to-Speech returned invalid audio content.",
          { ...details, upstreamStatus: response.status }
        );
      }

      return {
        bytes,
        contentType: "audio/mpeg" as const,
      };
    },
    details,
    deps.upstreamTimeoutMs
  );
}
