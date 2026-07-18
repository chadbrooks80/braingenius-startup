export type TtsProviderName = "google" | "lemonfox";

export class TtsConfigurationError extends Error {
  provider: TtsProviderName;

  constructor(provider: TtsProviderName, message: string) {
    super(message);
    this.name = "TtsConfigurationError";
    this.provider = provider;
  }
}

export class TtsUpstreamError extends Error {
  provider: TtsProviderName;
  model?: string;
  voice?: string;
  upstreamStatus?: number;

  constructor(
    provider: TtsProviderName,
    message: string,
    details?: {
      model?: string;
      voice?: string;
      upstreamStatus?: number;
      cause?: unknown;
    }
  ) {
    super(message, { cause: details?.cause });
    this.name = "TtsUpstreamError";
    this.provider = provider;
    this.model = details?.model;
    this.voice = details?.voice;
    this.upstreamStatus = details?.upstreamStatus;
  }
}
