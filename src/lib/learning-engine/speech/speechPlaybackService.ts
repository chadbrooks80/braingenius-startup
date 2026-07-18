import type { SpeakActionPayload } from "@/types/learning";
import {
  SpeechPlaybackController,
  type SpeakTextOptions,
} from "./SpeechPlaybackController";

function isSupportedInBrowser(): boolean {
  return typeof window !== "undefined" && typeof window.Audio !== "undefined";
}

const controller = new SpeechPlaybackController({
  isSupported: isSupportedInBrowser,
  fetchImpl: (input, init) => fetch(input, init),
  createAudioElement: () => new Audio(),
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
});

export function speakText(
  request: SpeakActionPayload,
  options?: SpeakTextOptions
): boolean {
  return controller.speakText(request, options);
}

export function cancelSpeech(): void {
  controller.cancelSpeech();
}

export function primeSpeechPlayback(): void {
  controller.primeSpeechPlayback();
}
