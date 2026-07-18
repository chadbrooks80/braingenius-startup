import { test } from "node:test";
import assert from "node:assert/strict";
import { synthesizeWithLemonfox } from "../../src/lib/learning-engine/speech/providers/lemonfox";
import {
  TtsConfigurationError,
  TtsUpstreamError,
} from "../../src/lib/learning-engine/errors/TtsSynthesisError";
import { withEnvVars } from "./testEnv";

const VALID_LEMONFOX_TTS = { provider: "lemonfox" as const, voice: "sarah" };

function setLemonfoxCredentials(t: { after: (fn: () => void) => void }): void {
  withEnvVars(t, { LEMONFOX_API_KEY: "fake-lemonfox-key" });
}

test("synthesizeWithLemonfox returns MP3 bytes for a valid request", async (t) => {
  setLemonfoxCredentials(t);
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response(new Uint8Array([1, 2, 3, 4]), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    });
  }) as typeof fetch;

  const audio = await synthesizeWithLemonfox("hello", VALID_LEMONFOX_TTS, {
    fetchImpl,
  });

  assert.equal(calls, 1);
  assert.equal(audio.contentType, "audio/mpeg");
  assert.deepEqual(Array.from(audio.bytes), [1, 2, 3, 4]);
});

test("synthesizeWithLemonfox throws TtsConfigurationError when the API key is missing", async (t) => {
  withEnvVars(t, { LEMONFOX_API_KEY: undefined });

  await assert.rejects(
    () =>
      synthesizeWithLemonfox("hello", VALID_LEMONFOX_TTS, {
        fetchImpl: (async () =>
          new Response(new Uint8Array([1]), { status: 200 })) as typeof fetch,
      }),
    TtsConfigurationError
  );
});

test("synthesizeWithLemonfox throws TtsUpstreamError on a non-success status", async (t) => {
  setLemonfoxCredentials(t);
  const fetchImpl = (async () =>
    new Response("bad request", { status: 400 })) as typeof fetch;

  await assert.rejects(
    () => synthesizeWithLemonfox("hello", VALID_LEMONFOX_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("synthesizeWithLemonfox throws TtsUpstreamError on an empty response body", async (t) => {
  setLemonfoxCredentials(t);
  const fetchImpl = (async () =>
    new Response(new Uint8Array(0), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    })) as typeof fetch;

  await assert.rejects(
    () => synthesizeWithLemonfox("hello", VALID_LEMONFOX_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("synthesizeWithLemonfox throws TtsUpstreamError for a non-audio response", async (t) => {
  setLemonfoxCredentials(t);
  const fetchImpl = (async () =>
    new Response("not audio", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })) as typeof fetch;

  await assert.rejects(
    () => synthesizeWithLemonfox("hello", VALID_LEMONFOX_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("synthesizeWithLemonfox rejects a voice outside the allowlist without calling fetch", async (t) => {
  setLemonfoxCredentials(t);
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response(new Uint8Array([1]), { status: 200 });
  }) as typeof fetch;

  await assert.rejects(
    () =>
      synthesizeWithLemonfox(
        "hello",
        { provider: "lemonfox", voice: "unknown-voice" },
        { fetchImpl }
      ),
    (error: unknown) => error instanceof Error && !(error instanceof TtsUpstreamError)
  );
  assert.equal(calls, 0);
});
