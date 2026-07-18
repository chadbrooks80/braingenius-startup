import type { GoogleTtsConfiguration } from "@/types/learning";
import { TtsUpstreamError } from "../../errors/TtsSynthesisError";
import { fetchUpstreamOrThrow } from "./fetchUpstreamOrThrow";
import {
  getGoogleAccessToken,
  readGoogleServiceAccountCredentials,
} from "./googleAuth";
import { isSupportedGoogleTtsConfiguration } from "../supportedTtsConfigurations";
import type { SynthesizedAudio, TtsProviderDeps } from "./types";

const GOOGLE_TTS_SYNTHESIZE_ENDPOINT =
  "https://texttospeech.googleapis.com/v1/text:synthesize";
const GOOGLE_TTS_SPEAKING_RATE = 0.9;
const STANDARD_BASE64_PATTERN =
  /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

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
  const accessToken = await getGoogleAccessToken(credentials, fetchImpl);

  const response = await fetchUpstreamOrThrow(
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
    { model: tts.model, voice: tts.voice }
  );

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (cause) {
    throw new TtsUpstreamError(
      "google",
      "Google Cloud Text-to-Speech response was not valid JSON.",
      { model: tts.model, voice: tts.voice, upstreamStatus: response.status, cause }
    );
  }

  const audioContent = (payload as { audioContent?: unknown })?.audioContent;
  if (
    typeof audioContent !== "string" ||
    audioContent === "" ||
    !STANDARD_BASE64_PATTERN.test(audioContent)
  ) {
    throw new TtsUpstreamError(
      "google",
      "Google Cloud Text-to-Speech response did not include valid audio content.",
      { model: tts.model, voice: tts.voice, upstreamStatus: response.status }
    );
  }

  const bytes = new Uint8Array(Buffer.from(audioContent, "base64"));
  if (bytes.byteLength === 0) {
    throw new TtsUpstreamError(
      "google",
      "Google Cloud Text-to-Speech returned empty audio content.",
      { model: tts.model, voice: tts.voice, upstreamStatus: response.status }
    );
  }

  return {
    bytes,
    contentType: "audio/mpeg",
  };
}
