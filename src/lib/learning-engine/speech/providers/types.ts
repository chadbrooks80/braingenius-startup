export type SynthesizedAudio = {
  bytes: Uint8Array;
  contentType: "audio/mpeg";
};

export type TtsProviderDeps = {
  fetchImpl?: typeof fetch;
};
