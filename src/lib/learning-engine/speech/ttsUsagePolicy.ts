import "server-only";
import { MAX_TTS_CHUNK_UTF8_BYTES } from "./chunkSpeechText";

// Fixed Stage 3 monitoring and extreme-abuse policy values. These are
// deliberate product decisions: they interrupt only usage far beyond genuine
// learning and must not be tuned or made environment-configurable here.
export const TTS_ESTIMATED_WORDS_PER_MINUTE = 150;
export const TTS_ESTIMATED_WORDS_PER_HOUR = TTS_ESTIMATED_WORDS_PER_MINUTE * 60;
export const TTS_FIVE_HOUR_WARNING_WORDS = 45_000;
export const TTS_TEN_HOUR_CUTOFF_WORDS = 90_000;
export const TTS_MAX_CALLER_ATTEMPTS_PER_MINUTE = 120;
export const TTS_MAX_CONCURRENT_CALLER_LEASES = 10;
export const TTS_LEASE_DURATION_MS = 30_000;
export const TTS_MAX_PROVIDER_CHUNK_UTF8_BYTES = MAX_TTS_CHUNK_UTF8_BYTES;
export const TTS_MAX_MP3_RESPONSE_BYTES = 5 * 1024 * 1024;
export const TTS_MAX_GOOGLE_SYNTHESIS_JSON_BYTES = 7_100_000;
export const TTS_MAX_GOOGLE_OAUTH_JSON_BYTES = 65_536;

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export type TtsInputMetrics = {
  utf8Bytes: number;
  characters: number;
  words: number;
};

const wordSegmenter = new Intl.Segmenter("en", { granularity: "word" });

/**
 * Deterministic Unicode-aware word count of the exact text sent to the
 * provider. Only word-like segments count; punctuation and whitespace do not.
 */
export function countTtsWords(text: string): number {
  let words = 0;
  for (const segment of wordSegmenter.segment(text)) {
    if (segment.isWordLike) {
      words += 1;
    }
  }
  return words;
}

/**
 * Numeric measurements of provider input. Only these numbers are ever
 * persisted; the text itself is never stored.
 */
export function measureTtsInput(text: string): TtsInputMetrics {
  return {
    utf8Bytes: Buffer.byteLength(text, "utf8"),
    characters: [...text].length,
    words: countTtsWords(text),
  };
}

export function estimatedListeningMinutes(acceptedWords: number): number {
  return acceptedWords / TTS_ESTIMATED_WORDS_PER_MINUTE;
}

export function estimatedListeningHours(acceptedWords: number): number {
  return acceptedWords / TTS_ESTIMATED_WORDS_PER_HOUR;
}

export function utcMinuteFloor(now: Date): Date {
  return new Date(Math.floor(now.getTime() / MINUTE_MS) * MINUTE_MS);
}

export function utcDayFloor(now: Date): Date {
  return new Date(Math.floor(now.getTime() / DAY_MS) * DAY_MS);
}

export function nextUtcMinuteStart(now: Date): Date {
  return new Date(utcMinuteFloor(now).getTime() + MINUTE_MS);
}

export function nextUtcDayStart(now: Date): Date {
  return new Date(utcDayFloor(now).getTime() + DAY_MS);
}

/** Integer Retry-After seconds until the boundary, never below one. */
export function retryAfterSeconds(now: Date, boundary: Date): number {
  return Math.max(1, Math.ceil((boundary.getTime() - now.getTime()) / 1000));
}
