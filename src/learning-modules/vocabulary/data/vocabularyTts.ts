import type { GoogleTtsConfiguration } from "@/types/learning";

export const vocabularyTts = {
  provider: "google",
  model: "chirp-3-hd",
  voice: "en-US-Chirp3-HD-Aoede",
  languageCode: "en-US",
} satisfies GoogleTtsConfiguration;
