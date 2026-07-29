import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { synthesizeWithGoogle } from "../../src/lib/learning-engine/speech/providers/google";
import {
  TtsConfigurationError,
  TtsUpstreamError,
} from "../../src/lib/learning-engine/errors/TtsSynthesisError";
import {
  TTS_MAX_GOOGLE_OAUTH_JSON_BYTES,
  TTS_MAX_GOOGLE_SYNTHESIS_JSON_BYTES,
  TTS_MAX_MP3_RESPONSE_BYTES,
} from "../../src/lib/learning-engine/speech/ttsUsagePolicy";
import { withEnvVars } from "./testEnv";

const VALID_GOOGLE_TTS = {
  provider: "google" as const,
  model: "chirp-3-hd",
  voice: "en-US-Chirp3-HD-Aoede",
  languageCode: "en-US",
};

const JSON_HEADERS = { "Content-Type": "application/json" };

function jsonResponse(body: string, headers: Record<string, string> = JSON_HEADERS): Response {
  return new Response(body, { status: 200, headers });
}

function tokenResponse(): Response {
  return jsonResponse(JSON.stringify({ access_token: "fake-token" }));
}

// Each call sets a distinct GOOGLE_TTS_CLIENT_EMAIL so the module-level
// access-token cache in googleAuth.ts (keyed by clientEmail) never lets one
// test's cached token satisfy another test's expectations.
function setGoogleCredentials(t: { after: (fn: () => void) => void }): void {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
    publicKeyEncoding: { type: "spki", format: "pem" },
  });

  withEnvVars(t, {
    GOOGLE_TTS_CLIENT_EMAIL: `service-account-${randomUUID()}@example.com`,
    GOOGLE_TTS_PRIVATE_KEY: privateKey,
  });
}

function fetchWithSynthesisResponse(
  synthesisResponse: () => Response
): typeof fetch {
  return (async (input: string | URL | Request) => {
    if (String(input).includes("oauth2.googleapis.com")) {
      return tokenResponse();
    }
    return synthesisResponse();
  }) as typeof fetch;
}

function overflowingJsonResponse(
  maxBytes: number,
  declaredLength?: string
): { response: Response; wasCancelled: () => boolean } {
  let cancelled = false;
  const chunk = new Uint8Array(1024 * 1024).fill(7);
  const body = new ReadableStream<Uint8Array>(
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
  const headers: Record<string, string> = { ...JSON_HEADERS };
  if (declaredLength !== undefined) {
    headers["Content-Length"] = declaredLength;
  }
  const response = new Response(body, { status: 200, headers });
  if (declaredLength === undefined) {
    response.headers.delete("Content-Length");
  }
  return { response, wasCancelled: () => cancelled };
}

function stalledJsonResponse(): {
  response: Response;
  wasCancelled: () => boolean;
} {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>(
    {
      pull() {
        // Headers arrive, then the upstream body never produces a chunk.
      },
      cancel() {
        cancelled = true;
      },
    },
    { highWaterMark: 0 }
  );
  return {
    response: new Response(body, { status: 200, headers: JSON_HEADERS }),
    wasCancelled: () => cancelled,
  };
}

test("synthesizeWithGoogle exchanges a token then returns MP3 bytes", async (t) => {
  setGoogleCredentials(t);
  const audioBase64 = Buffer.from("fake-audio-bytes").toString("base64");
  let tokenCalls = 0;
  let synthesizeCalls = 0;

  const fetchImpl = (async (input: string | URL | Request) => {
    if (String(input).includes("oauth2.googleapis.com")) {
      tokenCalls += 1;
      return tokenResponse();
    }
    synthesizeCalls += 1;
    return jsonResponse(JSON.stringify({ audioContent: audioBase64 }));
  }) as typeof fetch;

  const audio = await synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, {
    fetchImpl,
  });

  assert.equal(tokenCalls, 1);
  assert.equal(synthesizeCalls, 1);
  assert.equal(audio.contentType, "audio/mpeg");
  assert.equal(Buffer.from(audio.bytes).toString(), "fake-audio-bytes");
});

test("synthesizeWithGoogle reuses a cached access token across calls with the same credentials", async (t) => {
  setGoogleCredentials(t);
  const audioBase64 = Buffer.from("fake-audio-bytes").toString("base64");
  let tokenCalls = 0;
  let synthesizeCalls = 0;

  const fetchImpl = (async (input: string | URL | Request) => {
    if (String(input).includes("oauth2.googleapis.com")) {
      tokenCalls += 1;
      return jsonResponse(
        JSON.stringify({ access_token: "fake-token", expires_in: 3600 })
      );
    }
    synthesizeCalls += 1;
    return jsonResponse(JSON.stringify({ audioContent: audioBase64 }));
  }) as typeof fetch;

  await synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, { fetchImpl });
  await synthesizeWithGoogle("world", VALID_GOOGLE_TTS, { fetchImpl });

  assert.equal(tokenCalls, 1, "token endpoint should only be called once");
  assert.equal(synthesizeCalls, 2);
});

test("synthesizeWithGoogle throws TtsConfigurationError when credentials are missing", async (t) => {
  withEnvVars(t, {
    GOOGLE_TTS_CLIENT_EMAIL: undefined,
    GOOGLE_TTS_PRIVATE_KEY: undefined,
  });

  await assert.rejects(
    () =>
      synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, {
        fetchImpl: (async () =>
          new Response(null, { status: 200 })) as typeof fetch,
      }),
    TtsConfigurationError
  );
});

test("synthesizeWithGoogle throws TtsUpstreamError when the token exchange is rejected", async (t) => {
  setGoogleCredentials(t);
  const fetchImpl = (async () =>
    new Response("unauthorized", { status: 401 })) as typeof fetch;

  await assert.rejects(
    () => synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("synthesizeWithGoogle throws TtsUpstreamError when synthesis is rejected", async (t) => {
  setGoogleCredentials(t);
  const fetchImpl = fetchWithSynthesisResponse(
    () => new Response("server error", { status: 500 })
  );

  await assert.rejects(
    () => synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("synthesizeWithGoogle throws TtsUpstreamError when audioContent is missing", async (t) => {
  setGoogleCredentials(t);
  const fetchImpl = fetchWithSynthesisResponse(() =>
    jsonResponse(JSON.stringify({}))
  );

  await assert.rejects(
    () => synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("synthesizeWithGoogle throws TtsUpstreamError for malformed base64 audio", async (t) => {
  setGoogleCredentials(t);
  const fetchImpl = fetchWithSynthesisResponse(() =>
    jsonResponse(JSON.stringify({ audioContent: "!!!!" }))
  );

  await assert.rejects(
    () => synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("synthesizeWithGoogle throws TtsUpstreamError for empty decoded audio", async (t) => {
  setGoogleCredentials(t);
  const fetchImpl = fetchWithSynthesisResponse(() =>
    jsonResponse(JSON.stringify({ audioContent: "" }))
  );

  await assert.rejects(
    () => synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("synthesizeWithGoogle rejects a configuration outside the allowlist without calling fetch", async (t) => {
  setGoogleCredentials(t);
  let fetchCalls = 0;
  const fetchImpl = (async () => {
    fetchCalls += 1;
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  await assert.rejects(
    () =>
      synthesizeWithGoogle(
        "hello",
        { ...VALID_GOOGLE_TTS, voice: "en-US-Unknown-Voice" },
        { fetchImpl }
      ),
    (error: unknown) => error instanceof Error && !(error instanceof TtsUpstreamError)
  );
  assert.equal(fetchCalls, 0);
});

test("synthesizeWithGoogle rejects a non-JSON synthesis content type", async (t) => {
  setGoogleCredentials(t);
  const audioBase64 = Buffer.from("fake-audio-bytes").toString("base64");
  const fetchImpl = fetchWithSynthesisResponse(() =>
    jsonResponse(JSON.stringify({ audioContent: audioBase64 }), {
      "Content-Type": "text/plain",
    })
  );

  await assert.rejects(
    () => synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("a synthesis JSON body exactly at the raw limit is handled while one byte over is rejected", async (t) => {
  setGoogleCredentials(t);
  const audioBase64 = Buffer.from("fake-audio-bytes").toString("base64");

  // Pad an ignored JSON field so the complete body lands exactly on, then
  // one byte past, the documented 7,100,000-byte boundary.
  const buildBody = (targetBytes: number): string => {
    const skeleton = JSON.stringify({ audioContent: audioBase64, pad: "" });
    return JSON.stringify({
      audioContent: audioBase64,
      pad: "x".repeat(targetBytes - Buffer.byteLength(skeleton, "utf8")),
    });
  };

  const atLimitBody = buildBody(TTS_MAX_GOOGLE_SYNTHESIS_JSON_BYTES);
  assert.equal(
    Buffer.byteLength(atLimitBody, "utf8"),
    TTS_MAX_GOOGLE_SYNTHESIS_JSON_BYTES
  );
  const atLimit = await synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, {
    fetchImpl: fetchWithSynthesisResponse(() => jsonResponse(atLimitBody)),
  });
  assert.equal(Buffer.from(atLimit.bytes).toString(), "fake-audio-bytes");

  const overLimitBody = buildBody(TTS_MAX_GOOGLE_SYNTHESIS_JSON_BYTES + 1);
  await assert.rejects(
    () =>
      synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, {
        fetchImpl: fetchWithSynthesisResponse(() => jsonResponse(overLimitBody)),
      }),
    TtsUpstreamError
  );
});

test("oversized base64 audio is rejected before decoding while exactly 5 MiB decodes successfully", async (t) => {
  setGoogleCredentials(t);

  const exactAudio = Buffer.alloc(TTS_MAX_MP3_RESPONSE_BYTES, 7).toString("base64");
  const exact = await synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, {
    fetchImpl: fetchWithSynthesisResponse(() =>
      jsonResponse(JSON.stringify({ audioContent: exactAudio }))
    ),
  });
  assert.equal(exact.bytes.byteLength, TTS_MAX_MP3_RESPONSE_BYTES);

  const oversizedAudio = Buffer.alloc(TTS_MAX_MP3_RESPONSE_BYTES + 1, 7).toString(
    "base64"
  );
  await assert.rejects(
    () =>
      synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, {
        fetchImpl: fetchWithSynthesisResponse(() =>
          jsonResponse(JSON.stringify({ audioContent: oversizedAudio }))
        ),
      }),
    TtsUpstreamError
  );
});

test("an OAuth token JSON body over 65,536 bytes is rejected", async (t) => {
  setGoogleCredentials(t);
  const oversizedToken = JSON.stringify({
    access_token: "fake-token",
    pad: "x".repeat(TTS_MAX_GOOGLE_OAUTH_JSON_BYTES),
  });
  const fetchImpl = (async (input: string | URL | Request) => {
    if (String(input).includes("oauth2.googleapis.com")) {
      return jsonResponse(oversizedToken);
    }
    throw new Error("synthesis must not be reached after an oversized token body");
  }) as typeof fetch;

  await assert.rejects(
    () => synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("a non-JSON OAuth token content type is rejected", async (t) => {
  setGoogleCredentials(t);
  const fetchImpl = (async () =>
    new Response(JSON.stringify({ access_token: "fake-token" }), {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    })) as typeof fetch;

  await assert.rejects(
    () => synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("an oversized declared Content-Length is rejected before the synthesis body is read", async (t) => {
  setGoogleCredentials(t);
  let bodyReads = 0;
  const neverEndingBody = new ReadableStream<Uint8Array>(
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
  const fetchImpl = fetchWithSynthesisResponse(
    () =>
      new Response(neverEndingBody, {
        status: 200,
        headers: {
          ...JSON_HEADERS,
          "Content-Length": String(TTS_MAX_GOOGLE_SYNTHESIS_JSON_BYTES + 1),
        },
      })
  );

  await assert.rejects(
    () => synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, { fetchImpl }),
    TtsUpstreamError
  );
  assert.equal(bodyReads, 0, "the body must not be buffered after the declared rejection");
});

test("Google synthesis without Content-Length still rejects streamed overflow", async (t) => {
  setGoogleCredentials(t);
  const overflow = overflowingJsonResponse(
    TTS_MAX_GOOGLE_SYNTHESIS_JSON_BYTES
  );

  await assert.rejects(
    () =>
      synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, {
        fetchImpl: fetchWithSynthesisResponse(() => overflow.response),
      }),
    TtsUpstreamError
  );
  assert.equal(
    overflow.wasCancelled(),
    true,
    "streamed overflow must cancel the Google synthesis reader"
  );
});

test("a falsely small Google synthesis Content-Length cannot bypass streaming bounds and overflow cancels the reader", async (t) => {
  setGoogleCredentials(t);
  const overflow = overflowingJsonResponse(
    TTS_MAX_GOOGLE_SYNTHESIS_JSON_BYTES,
    "10"
  );

  await assert.rejects(
    () =>
      synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, {
        fetchImpl: fetchWithSynthesisResponse(() => overflow.response),
      }),
    TtsUpstreamError
  );
  assert.equal(overflow.wasCancelled(), true);
});

test("Google OAuth streaming bounds reject absent and falsely small lengths and cancel overflow", async (t) => {
  for (const declaredLength of [undefined, "10"] as const) {
    setGoogleCredentials(t);
    const overflow = overflowingJsonResponse(
      TTS_MAX_GOOGLE_OAUTH_JSON_BYTES,
      declaredLength
    );
    const fetchImpl = (async (input: string | URL | Request) => {
      if (String(input).includes("oauth2.googleapis.com")) {
        return overflow.response;
      }
      throw new Error("synthesis must not run after OAuth overflow");
    }) as typeof fetch;

    await assert.rejects(
      () => synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, { fetchImpl }),
      TtsUpstreamError
    );
    assert.equal(
      overflow.wasCancelled(),
      true,
      `OAuth overflow must cancel with Content-Length ${String(declaredLength)}`
    );
  }
});

test("Google synthesis headers followed by a stalled body abort within the complete deadline", async (t) => {
  setGoogleCredentials(t);
  const stalled = stalledJsonResponse();

  await assert.rejects(
    () =>
      synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, {
        fetchImpl: fetchWithSynthesisResponse(() => stalled.response),
        upstreamTimeoutMs: 20,
      }),
    TtsUpstreamError
  );
  assert.equal(stalled.wasCancelled(), true);
});

test("Google OAuth headers followed by a stalled body abort before synthesis and within the complete deadline", async (t) => {
  setGoogleCredentials(t);
  const stalled = stalledJsonResponse();
  let synthesisCalls = 0;
  const fetchImpl = (async (input: string | URL | Request) => {
    if (String(input).includes("oauth2.googleapis.com")) {
      return stalled.response;
    }
    synthesisCalls += 1;
    return jsonResponse("{}");
  }) as typeof fetch;

  await assert.rejects(
    () =>
      synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, {
        fetchImpl,
        upstreamTimeoutMs: 20,
      }),
    TtsUpstreamError
  );
  assert.equal(stalled.wasCancelled(), true);
  assert.equal(synthesisCalls, 0);
});
