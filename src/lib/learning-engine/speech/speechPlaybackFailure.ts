// Subject-neutral client playback failure contract shared by every Learning
// Engine speech consumer. Never render this directly and never let it carry
// spoken text, queue contents, provider configuration, or response bodies —
// only the bounded diagnostic fields below may cross into a log call.

export type SpeechPlaybackFailureStage =
  | "unsupported"
  | "request-preparation"
  | "request"
  | "http-response"
  | "audio-blob"
  | "audio-decode"
  | "audio-play";

export type SpeechPlaybackFailure = {
  readonly requestId: number;
  readonly stage: SpeechPlaybackFailureStage;
  readonly httpStatus?: number;
  readonly errorName?: string;
  readonly mediaErrorCode?: number;
};
