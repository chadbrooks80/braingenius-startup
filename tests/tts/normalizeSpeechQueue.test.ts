import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeSpeechQueue } from "../../src/lib/learning-engine/speech/normalizeSpeechQueue";

test("wraps a single string into a one-entry queue", () => {
  assert.deepEqual(normalizeSpeechQueue("hello"), ["hello"]);
});

test("keeps only non-blank entries from an array", () => {
  assert.deepEqual(
    normalizeSpeechQueue(["hello", "", "  ", "world"]),
    ["hello", "world"]
  );
});

test("discards a single blank string", () => {
  assert.deepEqual(normalizeSpeechQueue("   "), []);
});

test("returns an empty queue for an all-blank array", () => {
  assert.deepEqual(normalizeSpeechQueue(["", "   ", ""]), []);
});

test("returns an empty array for an empty array", () => {
  assert.deepEqual(normalizeSpeechQueue([]), []);
});
