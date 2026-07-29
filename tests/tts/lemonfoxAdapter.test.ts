import { test } from "node:test";
import assert from "node:assert/strict";
import { synthesizeWithLemonfox } from "../../src/lib/learning-engine/speech/providers/lemonfox";
import {
  TtsConfigurationError,
  TtsUpstreamError,
} from "../../src/lib/learning-engine/errors/TtsSynthesisError";
import { TTS_MAX_MP3_RESPONSE_BYTES } from "../../src/lib/learning-engine/speech/ttsUsagePolicy";
import { withEnvVars } from "./testEnv";

const VALID_LEMONFOX_TTS = { provider: "lemonfox" as const, voice: "sarah" };
const MPEG_HEADERS = { "Content-Type": "audio/mpeg" };

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

test("a raw MP3 body of exactly 5 MiB is accepted while one extra byte is rejected", async (t) => {
  setLemonfoxCredentials(t);

  const exactFetch = (async () =>
    new Response(new Uint8Array(TTS_MAX_MP3_RESPONSE_BYTES).fill(7), {
      status: 200,
      headers: MPEG_HEADERS,
    })) as typeof fetch;
  const audio = await synthesizeWithLemonfox("hello", VALID_LEMONFOX_TTS, {
    fetchImpl: exactFetch,
  });
  assert.equal(audio.bytes.byteLength, TTS_MAX_MP3_RESPONSE_BYTES);

  const oversizedFetch = (async () =>
    new Response(new Uint8Array(TTS_MAX_MP3_RESPONSE_BYTES + 1).fill(7), {
      status: 200,
      headers: MPEG_HEADERS,
    })) as typeof fetch;
  await assert.rejects(
    () =>
      synthesizeWithLemonfox("hello", VALID_LEMONFOX_TTS, {
        fetchImpl: oversizedFetch,
      }),
    TtsUpstreamError
  );
});

test("an oversized declared Content-Length is rejected before the body is read", async (t) => {
  setLemonfoxCredentials(t);
  let bodyReads = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        bodyReads += 1;
        controller.enqueue(new Uint8Array(1024));
      },
    },
    // highWaterMark 0 prevents the spec's eager initial pull, so any read
    // observed here proves the adapter actually consumed the body.
    { highWaterMark: 0 }
  );
  const fetchImpl = (async () =>
    new Response(body, {
      status: 200,
      headers: {
        ...MPEG_HEADERS,
        "Content-Length": String(TTS_MAX_MP3_RESPONSE_BYTES + 1),
      },
    })) as typeof fetch;

  await assert.rejects(
    () => synthesizeWithLemonfox("hello", VALID_LEMONFOX_TTS, { fetchImpl }),
    TtsUpstreamError
  );
  assert.equal(bodyReads, 0, "the body must not be buffered after the declared rejection");
});

test("a falsely small declared Content-Length cannot bypass the streamed byte limit, and overflow cancels the reader", async (t) => {
  setLemonfoxCredentials(t);
  let cancelled = false;
  const chunk = new Uint8Array(1024 * 1024).fill(7);
  const endlessBody = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        controller.enqueue(chunk);
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 }
  );
  const fetchImpl = (async () =>
    new Response(endlessBody, {
      status: 200,
      headers: { ...MPEG_HEADERS, "Content-Length": "10" },
    })) as typeof fetch;

  await assert.rejects(
    () => synthesizeWithLemonfox("hello", VALID_LEMONFOX_TTS, { fetchImpl }),
    TtsUpstreamError
  );
  assert.equal(cancelled, true, "overflow must cancel the upstream reader");
});

test("a missing Content-Length still enforces the streamed byte limit", async (t) => {
  setLemonfoxCredentials(t);
  const chunk = new Uint8Array(1024 * 1024).fill(7);
  let enqueued = 0;
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        enqueued += 1;
        if (enqueued > 6) {
          controller.close();
          return;
        }
        controller.enqueue(chunk);
      },
    },
    { highWaterMark: 0 }
  );
  const fetchImpl = (async () => {
    const response = new Response(body, { status: 200, headers: MPEG_HEADERS });
    response.headers.delete("Content-Length");
    return response;
  }) as typeof fetch;

  await assert.rejects(
    () => synthesizeWithLemonfox("hello", VALID_LEMONFOX_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("headers followed by a stalled Lemonfox body abort within the complete upstream deadline", async (t) => {
  setLemonfoxCredentials(t);
  let cancelled = false;
  const stalledBody = new ReadableStream<Uint8Array>(
    {
      pull() {
        // Headers have arrived, but the provider never produces body bytes.
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 }
  );
  const fetchImpl = (async () =>
    new Response(stalledBody, {
      status: 200,
      headers: MPEG_HEADERS,
    })) as typeof fetch;

  await assert.rejects(
    () =>
      synthesizeWithLemonfox("hello", VALID_LEMONFOX_TTS, {
        fetchImpl,
        upstreamTimeoutMs: 20,
      }),
    TtsUpstreamError
  );
  assert.equal(cancelled, true, "deadline abort must cancel the stalled reader");
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
