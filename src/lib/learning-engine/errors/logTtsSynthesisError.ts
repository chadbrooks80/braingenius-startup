import { TtsConfigurationError, TtsUpstreamError } from "./TtsSynthesisError";

export function logTtsSynthesisError(error: unknown): void {
  if (error instanceof TtsConfigurationError) {
    console.error("[tts] configuration error", {
      provider: error.provider,
      message: error.message,
    });
    return;
  }

  if (error instanceof TtsUpstreamError) {
    console.error("[tts] upstream error", {
      provider: error.provider,
      model: error.model,
      voice: error.voice,
      upstreamStatus: error.upstreamStatus,
      message: error.message,
      cause: error.cause,
    });
    return;
  }

  console.error("[tts] unexpected error", error);
}
