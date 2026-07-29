import type { ActionPayload, LearningEngineStateSetters } from "@/types/learning";
import type { SpeakTextOptions } from "./SpeechPlaybackController";
import { parseSpeakActionPayload } from "./validation/parseSpeakActionPayload";
import { speakText } from "./speechPlaybackService";

// Pure callback-to-state mapping, extracted so the bridge semantics can be
// proven deterministically against a controller with fake deps (see
// tests/tts/runSpeakRequest.test.ts) without needing an injectable seam for
// the real singleton speech service.
export function createSpeakRequestBridge(
  setters: LearningEngineStateSetters
): Required<Pick<SpeakTextOptions, "onDone" | "onSuccess" | "onFailure">> {
  return {
    onDone: () => setters.setIsSpeaking(false),
    onSuccess: () => setters.setSpeechFailureNotice(null),
    onFailure: (failure) =>
      setters.setSpeechFailureNotice({ requestId: failure.requestId }),
  };
}

export function runSpeakRequest(
  rawPayload: ActionPayload,
  setters: LearningEngineStateSetters
): void {
  const speakActionPayload = parseSpeakActionPayload(rawPayload);

  const started = speakText(speakActionPayload, createSpeakRequestBridge(setters));

  setters.setIsSpeaking(started);
}
