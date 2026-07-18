export const supportedTtsConfigurations = {
  google: [
    {
      model: "chirp-3-hd",
      voice: "en-US-Chirp3-HD-Aoede",
      languageCode: "en-US",
    },
  ],
  lemonfox: [{ voice: "sarah" }],
} as const;

export function isSupportedGoogleTtsConfiguration(
  model: string,
  voice: string,
  languageCode: string
): boolean {
  return supportedTtsConfigurations.google.some(
    (entry) =>
      entry.model === model &&
      entry.voice === voice &&
      entry.languageCode === languageCode
  );
}

export function isSupportedLemonfoxTtsConfiguration(voice: string): boolean {
  return supportedTtsConfigurations.lemonfox.some(
    (entry) => entry.voice === voice
  );
}
