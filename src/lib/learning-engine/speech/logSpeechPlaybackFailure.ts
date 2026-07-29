import type { SpeechPlaybackFailure } from "./speechPlaybackFailure";

// The one client diagnostic reporter for speech playback failures. Emits
// exactly the bounded fields on SpeechPlaybackFailure — never the raw caught
// error, response, blob, spoken text, or provider configuration.
export function logSpeechPlaybackFailure(failure: SpeechPlaybackFailure): void {
  console.warn("speech_playback_failure", {
    event: "speech_playback_failure",
    requestId: failure.requestId,
    stage: failure.stage,
    occurredAt: new Date().toISOString(),
    ...(failure.httpStatus === undefined
      ? {}
      : { httpStatus: failure.httpStatus }),
    ...(failure.errorName === undefined ? {} : { errorName: failure.errorName }),
    ...(failure.mediaErrorCode === undefined
      ? {}
      : { mediaErrorCode: failure.mediaErrorCode }),
  });
}
