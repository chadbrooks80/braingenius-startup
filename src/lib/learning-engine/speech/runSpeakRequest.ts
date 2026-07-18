import type { ActionPayload, LearningEngineStateSetters } from "@/types/learning";
import { parseSpeakActionPayload } from "./validation/parseSpeakActionPayload";
import { speakText } from "./speechPlaybackService";

export function runSpeakRequest(
  rawPayload: ActionPayload,
  setters: LearningEngineStateSetters
): void {
  const speakActionPayload = parseSpeakActionPayload(rawPayload);

  const started = speakText(speakActionPayload, {
    onDone: () => setters.setIsSpeaking(false),
  });

  setters.setIsSpeaking(started);
}
