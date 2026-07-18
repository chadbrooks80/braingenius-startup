import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSpeakActionPayload } from "../../src/lib/learning-engine/speech/validation/parseSpeakActionPayload";

const VALID_GOOGLE_TTS = {
  provider: "google",
  model: "chirp-3-hd",
  voice: "en-US-Chirp3-HD-Aoede",
  languageCode: "en-US",
};

test("accepts a non-blank string text", () => {
  const result = parseSpeakActionPayload({ text: "hello", tts: VALID_GOOGLE_TTS });
  assert.deepEqual(result, { text: "hello", tts: VALID_GOOGLE_TTS });
});

test("accepts a string array with at least one non-blank entry", () => {
  const result = parseSpeakActionPayload({
    text: ["", "hello", "  "],
    tts: VALID_GOOGLE_TTS,
  });
  assert.deepEqual(result, {
    text: ["", "hello", "  "],
    tts: VALID_GOOGLE_TTS,
  });
});

test("rejects a blank string", () => {
  assert.throws(() =>
    parseSpeakActionPayload({ text: "   ", tts: VALID_GOOGLE_TTS })
  );
});

test("rejects an all-blank array", () => {
  assert.throws(() =>
    parseSpeakActionPayload({ text: ["", "  "], tts: VALID_GOOGLE_TTS })
  );
});

test("rejects an array containing a non-string entry", () => {
  assert.throws(() =>
    parseSpeakActionPayload({ text: ["hello", 5], tts: VALID_GOOGLE_TTS })
  );
});

test("rejects a non-string, non-array text", () => {
  assert.throws(() =>
    parseSpeakActionPayload({ text: 5, tts: VALID_GOOGLE_TTS })
  );
});

test("rejects a missing tts field", () => {
  assert.throws(() => parseSpeakActionPayload({ text: "hello" }));
});

test("rejects an empty tts configuration instead of treating it as disabled", () => {
  assert.throws(() => parseSpeakActionPayload({ text: "hello", tts: {} }));
});

test("rejects a tts configuration not in the allowlist", () => {
  assert.throws(() =>
    parseSpeakActionPayload({
      text: "hello",
      tts: { ...VALID_GOOGLE_TTS, voice: "unknown-voice" },
    })
  );
});

test("rejects a Lemonfox configuration with a made-up model field", () => {
  assert.throws(() =>
    parseSpeakActionPayload({
      text: "hello",
      tts: { provider: "lemonfox", voice: "sarah", model: "made-up" },
    })
  );
});

test("accepts an opaque server-resolved speech source", () => {
  const result = parseSpeakActionPayload({
    source: { endpoint: "/api/learning/vocabulary/speech", reference: "ref-1" },
  });
  assert.deepEqual(result, {
    source: { endpoint: "/api/learning/vocabulary/speech", reference: "ref-1" },
  });
});

test("rejects a speech source combined with text or tts", () => {
  assert.throws(() =>
    parseSpeakActionPayload({
      source: { endpoint: "/speech", reference: "ref-1" },
      text: "hello",
    })
  );
  assert.throws(() =>
    parseSpeakActionPayload({
      source: { endpoint: "/speech", reference: "ref-1" },
      tts: VALID_GOOGLE_TTS,
    })
  );
});

test("rejects malformed speech sources", () => {
  for (const source of [
    "not-an-object",
    ["/speech", "ref-1"],
    {},
    { endpoint: "/speech" },
    { reference: "ref-1" },
    { endpoint: "/speech", reference: "ref-1", extra: true },
    { endpoint: "https://evil.example/speech", reference: "ref-1" },
    { endpoint: "//evil.example/speech", reference: "ref-1" },
    { endpoint: "", reference: "ref-1" },
    { endpoint: "/speech", reference: "   " },
    { endpoint: "/speech", reference: 4 },
  ]) {
    assert.throws(
      () => parseSpeakActionPayload({ source }),
      Error,
      `expected rejection for ${JSON.stringify(source)}`
    );
  }
});

test("rejects external, protocol-relative, backslash, and non-speech source URLs", () => {
  for (const endpoint of [
    "https://collector.example/speech",
    "//collector.example/speech",
    "/\\collector.example",
    "/\\\\collector.example",
    "api/learning/vocabulary/speech",
    "/api/learning/vocabulary/speech?redirect=https://collector.example",
    "/api/learning/vocabulary/speech#fragment",
    "/api/learning/vocabulary/content",
    "/api/tts",
  ]) {
    assert.throws(
      () =>
        parseSpeakActionPayload({
          source: { endpoint, reference: "opaque-reference" },
        }),
      /same-origin path|permitted speech path/,
      endpoint
    );
  }
});
