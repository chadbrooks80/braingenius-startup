import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countTtsWords,
  estimatedListeningHours,
  estimatedListeningMinutes,
  measureTtsInput,
  nextUtcDayStart,
  nextUtcMinuteStart,
  retryAfterSeconds,
  TTS_ESTIMATED_WORDS_PER_MINUTE,
  TTS_FIVE_HOUR_WARNING_WORDS,
  TTS_LEASE_DURATION_MS,
  TTS_MAX_CALLER_ATTEMPTS_PER_MINUTE,
  TTS_MAX_CONCURRENT_CALLER_LEASES,
  TTS_MAX_GOOGLE_OAUTH_JSON_BYTES,
  TTS_MAX_GOOGLE_SYNTHESIS_JSON_BYTES,
  TTS_MAX_MP3_RESPONSE_BYTES,
  TTS_MAX_PROVIDER_CHUNK_UTF8_BYTES,
  TTS_TEN_HOUR_CUTOFF_WORDS,
  utcDayFloor,
  utcMinuteFloor,
} from "../../src/lib/learning-engine/speech/ttsUsagePolicy";

test("the fixed Stage 3 policy values match the promoted specification exactly", () => {
  assert.equal(TTS_ESTIMATED_WORDS_PER_MINUTE, 150);
  assert.equal(TTS_FIVE_HOUR_WARNING_WORDS, 45_000);
  assert.equal(TTS_TEN_HOUR_CUTOFF_WORDS, 90_000);
  assert.equal(TTS_MAX_CALLER_ATTEMPTS_PER_MINUTE, 120);
  assert.equal(TTS_MAX_CONCURRENT_CALLER_LEASES, 10);
  assert.equal(TTS_LEASE_DURATION_MS, 30_000);
  assert.equal(TTS_MAX_PROVIDER_CHUNK_UTF8_BYTES, 5_000);
  assert.equal(TTS_MAX_MP3_RESPONSE_BYTES, 5 * 1024 * 1024);
  assert.equal(TTS_MAX_GOOGLE_SYNTHESIS_JSON_BYTES, 7_100_000);
  assert.equal(TTS_MAX_GOOGLE_OAUTH_JSON_BYTES, 65_536);
});

test("countTtsWords counts only word-like segments deterministically", () => {
  assert.equal(countTtsWords("Hello, world!"), 2);
  assert.equal(countTtsWords("Spell the word: cat. A small animal."), 7);
  assert.equal(countTtsWords("... !!! ---"), 0);
  assert.equal(countTtsWords(""), 0);
  assert.equal(countTtsWords("one  two\n\nthree\tfour"), 4);
  assert.equal(countTtsWords("word ".repeat(150).trim()), 150);
  // Deterministic across calls.
  assert.equal(
    countTtsWords("The same sentence."),
    countTtsWords("The same sentence.")
  );
});

test("measureTtsInput reports exact UTF-8 bytes, code points, and words", () => {
  assert.deepEqual(measureTtsInput("hello"), {
    utf8Bytes: 5,
    characters: 5,
    words: 1,
  });
  // "é" is one code point but two UTF-8 bytes.
  assert.deepEqual(measureTtsInput("éé aa"), {
    utf8Bytes: 7,
    characters: 5,
    words: 2,
  });
});

test("the speech-duration estimate uses exactly 150 words per minute", () => {
  assert.equal(estimatedListeningMinutes(150), 1);
  assert.equal(estimatedListeningMinutes(45_000), 300);
  assert.equal(estimatedListeningHours(45_000), 5);
  assert.equal(estimatedListeningHours(90_000), 10);
  assert.equal(estimatedListeningMinutes(75), 0.5);
});

test("UTC windows floor to exact minute and day boundaries", () => {
  const now = new Date("2026-07-29T10:30:30.750Z");
  assert.equal(utcMinuteFloor(now).toISOString(), "2026-07-29T10:30:00.000Z");
  assert.equal(utcDayFloor(now).toISOString(), "2026-07-29T00:00:00.000Z");
  assert.equal(nextUtcMinuteStart(now).toISOString(), "2026-07-29T10:31:00.000Z");
  assert.equal(nextUtcDayStart(now).toISOString(), "2026-07-30T00:00:00.000Z");
});

test("a time immediately before UTC midnight belongs to the old day and midnight itself to the new day", () => {
  const beforeMidnight = new Date("2026-07-29T23:59:59.999Z");
  const midnight = new Date("2026-07-30T00:00:00.000Z");
  assert.equal(utcDayFloor(beforeMidnight).toISOString(), "2026-07-29T00:00:00.000Z");
  assert.equal(utcDayFloor(midnight).toISOString(), "2026-07-30T00:00:00.000Z");
});

test("retryAfterSeconds rounds up to whole seconds and never returns below one", () => {
  const now = new Date("2026-07-29T10:30:30.500Z");
  assert.equal(retryAfterSeconds(now, new Date("2026-07-29T10:31:00.000Z")), 30);
  assert.equal(retryAfterSeconds(now, new Date("2026-07-29T10:30:30.600Z")), 1);
  assert.equal(retryAfterSeconds(now, now), 1);
});
