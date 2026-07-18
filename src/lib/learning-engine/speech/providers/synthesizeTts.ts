import type { TtsSynthesisRequest } from "../validation/parseTtsSynthesisRequest";
import { synthesizeWithGoogle } from "./google";
import { synthesizeWithLemonfox } from "./lemonfox";
import type { SynthesizedAudio, TtsProviderDeps } from "./types";

export async function synthesizeTts(
  request: TtsSynthesisRequest,
  deps: TtsProviderDeps = {}
): Promise<SynthesizedAudio> {
  switch (request.tts.provider) {
    case "google":
      return synthesizeWithGoogle(request.text, request.tts, deps);
    case "lemonfox":
      return synthesizeWithLemonfox(request.text, request.tts, deps);
    default: {
      const exhaustiveCheck: never = request.tts;
      throw new Error(
        `Unsupported TTS provider configuration: ${JSON.stringify(exhaustiveCheck)}.`
      );
    }
  }
}
