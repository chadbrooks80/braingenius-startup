import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chunkSpeechText,
  MAX_TTS_CHUNK_UTF8_BYTES,
  SpeechChunkingError,
} from "../../src/lib/learning-engine/speech/chunkSpeechText";

const encoder = new TextEncoder();

function byteLength(text: string): number {
  return encoder.encode(text).length;
}

function wordsOf(text: string): string[] {
  return text.split(/\s+/).filter((word) => word !== "");
}

function assertChunkInvariants(source: string, chunks: string[]): void {
  for (const chunk of chunks) {
    assert.notEqual(chunk.trim(), "", "no blank chunks are emitted");
    assert.ok(
      byteLength(chunk) <= MAX_TTS_CHUNK_UTF8_BYTES,
      `chunk of ${byteLength(chunk)} bytes exceeds the provider boundary`
    );
  }
  // Splitting only at whitespace boundaries preserves every word in order,
  // so the summed chunk word sequence equals the passage word sequence.
  assert.deepEqual(chunks.flatMap(wordsOf), wordsOf(source));
}

test("the documented provider chunk boundary is 5,000 UTF-8 bytes", () => {
  assert.equal(MAX_TTS_CHUNK_UTF8_BYTES, 5000);
});

test("short text returns a single chunk and blank text returns no chunks", () => {
  assert.deepEqual(chunkSpeechText("Hello there."), ["Hello there."]);
  assert.deepEqual(chunkSpeechText("   "), []);
  assert.deepEqual(chunkSpeechText(""), []);
});

test("text of exactly 5,000 bytes stays one chunk", () => {
  const text = "a".repeat(5000);
  assert.deepEqual(chunkSpeechText(text), [text]);
});

test("a long passage prefers paragraph boundaries", () => {
  const paragraphA = `${"alpha ".repeat(500)}end-a.`.trim();
  const paragraphB = `${"bravo ".repeat(500)}end-b.`.trim();
  const source = `${paragraphA}\n\n${paragraphB}`;
  assert.ok(byteLength(source) > MAX_TTS_CHUNK_UTF8_BYTES);

  const chunks = chunkSpeechText(source);

  assert.deepEqual(chunks, [paragraphA, paragraphB]);
  assertChunkInvariants(source, chunks);
});

test("adjacent short paragraphs pack together instead of one request per paragraph", () => {
  const paragraphs = Array.from({ length: 6 }, (_, index) =>
    `Paragraph ${index} ${"word ".repeat(200)}`.trim()
  );
  const source = paragraphs.join("\n\n");
  assert.ok(byteLength(source) > MAX_TTS_CHUNK_UTF8_BYTES);

  const chunks = chunkSpeechText(source);

  assert.ok(chunks.length < paragraphs.length, "short paragraphs are packed greedily");
  assertChunkInvariants(source, chunks);
});

test("an oversized single paragraph splits at sentence boundaries with punctuation preserved", () => {
  const sentences = Array.from(
    { length: 40 },
    (_, index) => `Sentence number ${index} has ${"filler ".repeat(30)}words.`
  );
  const source = sentences.join(" ");
  assert.ok(byteLength(source) > MAX_TTS_CHUNK_UTF8_BYTES);

  const chunks = chunkSpeechText(source);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    assert.match(chunk, /\.$/, "sentence-boundary chunks end with their punctuation");
  }
  assertChunkInvariants(source, chunks);
});

test("an oversized single sentence splits at whitespace without splitting any word", () => {
  const source = `${"unsplittableword ".repeat(400)}`.trim();
  assert.ok(byteLength(source) > MAX_TTS_CHUNK_UTF8_BYTES);

  const chunks = chunkSpeechText(source);

  assert.ok(chunks.length > 1);
  for (const chunk of chunks) {
    for (const word of wordsOf(chunk)) {
      assert.equal(word, "unsplittableword", "no word is ever split");
    }
  }
  assertChunkInvariants(source, chunks);
});

test("multi-byte characters are measured in UTF-8 bytes, not code units", () => {
  // Each "é" is two UTF-8 bytes, so 3,000 characters exceed 5,000 bytes.
  const wordOfTwoByteChars = "é".repeat(100);
  const source = Array.from({ length: 30 }, () => wordOfTwoByteChars).join(" ");
  assert.ok(byteLength(source) > MAX_TTS_CHUNK_UTF8_BYTES);

  const chunks = chunkSpeechText(source);

  assert.ok(chunks.length > 1);
  assertChunkInvariants(source, chunks);
});

test("a single uninterrupted token over 5,000 bytes fails safely with a typed error", () => {
  const oversizedToken = "x".repeat(MAX_TTS_CHUNK_UTF8_BYTES + 1);

  assert.throws(() => chunkSpeechText(oversizedToken), SpeechChunkingError);
  assert.throws(
    () => chunkSpeechText(`normal words then ${oversizedToken}`),
    SpeechChunkingError
  );
});

test("chunking is deterministic for identical input", () => {
  const source = Array.from(
    { length: 50 },
    (_, index) => `Sentence ${index} with ${"stable ".repeat(20)}content.`
  ).join(" ");

  assert.deepEqual(chunkSpeechText(source), chunkSpeechText(source));
});
