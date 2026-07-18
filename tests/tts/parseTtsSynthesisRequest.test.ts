import { test } from "node:test";
import assert from "node:assert/strict";
import { parseTtsSynthesisRequest } from "../../src/lib/learning-engine/speech/validation/parseTtsSynthesisRequest";

const VALID_GOOGLE_TTS = {
  provider: "google",
  model: "chirp-3-hd",
  voice: "en-US-Chirp3-HD-Aoede",
  languageCode: "en-US",
};

const VALID_LEMONFOX_TTS = { provider: "lemonfox", voice: "sarah" };

test("accepts a valid Google request", () => {
  const result = parseTtsSynthesisRequest({
    text: "hello world",
    tts: VALID_GOOGLE_TTS,
  });
  assert.deepEqual(result, { text: "hello world", tts: VALID_GOOGLE_TTS });
});

test("accepts a valid Lemonfox request", () => {
  const result = parseTtsSynthesisRequest({
    text: "hello world",
    tts: VALID_LEMONFOX_TTS,
  });
  assert.deepEqual(result, { text: "hello world", tts: VALID_LEMONFOX_TTS });
});

test("rejects a non-object body", () => {
  assert.throws(() => parseTtsSynthesisRequest("not an object"));
  assert.throws(() => parseTtsSynthesisRequest(null));
  assert.throws(() => parseTtsSynthesisRequest(["array"]));
});

test("rejects unknown top-level request fields", () => {
  assert.throws(() =>
    parseTtsSynthesisRequest({
      text: "hello",
      tts: VALID_LEMONFOX_TTS,
      endpoint: "https://attacker.invalid",
      apiKey: "client-supplied",
      speed: 2,
    })
  );
});

test("rejects blank text", () => {
  assert.throws(() =>
    parseTtsSynthesisRequest({ text: "   ", tts: VALID_GOOGLE_TTS })
  );
});

test("rejects non-string text", () => {
  assert.throws(() =>
    parseTtsSynthesisRequest({ text: 123, tts: VALID_GOOGLE_TTS })
  );
});

test("rejects text over 4000 UTF-8 bytes", () => {
  const oversizedText = "a".repeat(4001);
  assert.throws(() =>
    parseTtsSynthesisRequest({ text: oversizedText, tts: VALID_GOOGLE_TTS })
  );
});

test("accepts text at exactly 4000 UTF-8 bytes", () => {
  const exactText = "a".repeat(4000);
  const result = parseTtsSynthesisRequest({
    text: exactText,
    tts: VALID_GOOGLE_TTS,
  });
  assert.equal(result.text, exactText);
});

test("measures UTF-8 bytes, not character count, for multi-byte text", () => {
  // Each "é" is 2 UTF-8 bytes, so 2001 of them is 4002 bytes.
  const multiByteText = "é".repeat(2001);
  assert.throws(() =>
    parseTtsSynthesisRequest({ text: multiByteText, tts: VALID_GOOGLE_TTS })
  );
});

test("rejects an unknown provider", () => {
  assert.throws(() =>
    parseTtsSynthesisRequest({
      text: "hello",
      tts: { provider: "amazon", voice: "sarah" },
    })
  );
});

test("rejects a Google configuration with an unknown field", () => {
  assert.throws(() =>
    parseTtsSynthesisRequest({
      text: "hello",
      tts: { ...VALID_GOOGLE_TTS, speed: 1.5 },
    })
  );
});

test("rejects a Lemonfox configuration with a made-up model field", () => {
  assert.throws(() =>
    parseTtsSynthesisRequest({
      text: "hello",
      tts: { ...VALID_LEMONFOX_TTS, model: "made-up-model" },
    })
  );
});

test("rejects a Google configuration not in the allowlist", () => {
  assert.throws(() =>
    parseTtsSynthesisRequest({
      text: "hello",
      tts: { ...VALID_GOOGLE_TTS, voice: "en-US-Unknown-Voice" },
    })
  );
});

test("rejects a Lemonfox configuration not in the allowlist", () => {
  assert.throws(() =>
    parseTtsSynthesisRequest({
      text: "hello",
      tts: { provider: "lemonfox", voice: "unknown-voice" },
    })
  );
});

test("rejects a missing tts field", () => {
  assert.throws(() => parseTtsSynthesisRequest({ text: "hello" }));
});
