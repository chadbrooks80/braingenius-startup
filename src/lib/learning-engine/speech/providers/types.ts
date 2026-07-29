export type SynthesizedAudio = {
  bytes: Uint8Array;
  contentType: "audio/mpeg";
};

export type TtsProviderDeps = {
  fetchImpl?: typeof fetch;
  /** Deterministic test override; production always uses the fixed 10 seconds. */
  upstreamTimeoutMs?: number;
};
