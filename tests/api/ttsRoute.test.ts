import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../../src/app/api/tts/route";

function requestWithBody(body: BodyInit): Request {
  return new Request("http://localhost/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

test("returns a learner-safe 400 response for malformed JSON", async () => {
  const response = await POST(requestWithBody("{"));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "Request body must be valid JSON.",
  });
});

test("returns a generic 400 response for invalid provider configuration", async () => {
  const invalidBodies = [
    { text: "hello" },
    { text: "hello", tts: { provider: "unknown", voice: "test" } },
    {
      text: "hello",
      tts: {
        provider: "google",
        model: "unsupported",
        voice: "unsupported",
        languageCode: "en-US",
      },
    },
  ];

  for (const body of invalidBodies) {
    const response = await POST(requestWithBody(JSON.stringify(body)));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "Invalid TTS request." });
  }
});
