import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomUUID } from "node:crypto";
import { synthesizeWithGoogle } from "../../src/lib/learning-engine/speech/providers/google";
import {
  TtsConfigurationError,
  TtsUpstreamError,
} from "../../src/lib/learning-engine/errors/TtsSynthesisError";
import { withEnvVars } from "./testEnv";

const VALID_GOOGLE_TTS = {
  provider: "google" as const,
  model: "chirp-3-hd",
  voice: "en-US-Chirp3-HD-Aoede",
  languageCode: "en-US",
};

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

test("synthesizeWithGoogle exchanges a token then returns MP3 bytes", async (t) => {
  setGoogleCredentials(t);
  const audioBase64 = Buffer.from("fake-audio-bytes").toString("base64");
  let tokenCalls = 0;
  let synthesizeCalls = 0;

  const fetchImpl = (async (input: string | URL | Request) => {
    if (String(input).includes("oauth2.googleapis.com")) {
      tokenCalls += 1;
      return new Response(JSON.stringify({ access_token: "fake-token" }), {
        status: 200,
      });
    }
    synthesizeCalls += 1;
    return new Response(JSON.stringify({ audioContent: audioBase64 }), {
      status: 200,
    });
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
      return new Response(
        JSON.stringify({ access_token: "fake-token", expires_in: 3600 }),
        { status: 200 }
      );
    }
    synthesizeCalls += 1;
    return new Response(JSON.stringify({ audioContent: audioBase64 }), {
      status: 200,
    });
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
  const fetchImpl = (async (input: string | URL | Request) => {
    if (String(input).includes("oauth2.googleapis.com")) {
      return new Response(JSON.stringify({ access_token: "fake-token" }), {
        status: 200,
      });
    }
    return new Response("server error", { status: 500 });
  }) as typeof fetch;

  await assert.rejects(
    () => synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("synthesizeWithGoogle throws TtsUpstreamError when audioContent is missing", async (t) => {
  setGoogleCredentials(t);
  const fetchImpl = (async (input: string | URL | Request) => {
    if (String(input).includes("oauth2.googleapis.com")) {
      return new Response(JSON.stringify({ access_token: "fake-token" }), {
        status: 200,
      });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  }) as typeof fetch;

  await assert.rejects(
    () => synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("synthesizeWithGoogle throws TtsUpstreamError for malformed base64 audio", async (t) => {
  setGoogleCredentials(t);
  const fetchImpl = (async (input: string | URL | Request) => {
    if (String(input).includes("oauth2.googleapis.com")) {
      return new Response(JSON.stringify({ access_token: "fake-token" }), {
        status: 200,
      });
    }
    return new Response(JSON.stringify({ audioContent: "!!!!" }), {
      status: 200,
    });
  }) as typeof fetch;

  await assert.rejects(
    () => synthesizeWithGoogle("hello", VALID_GOOGLE_TTS, { fetchImpl }),
    TtsUpstreamError
  );
});

test("synthesizeWithGoogle throws TtsUpstreamError for empty decoded audio", async (t) => {
  setGoogleCredentials(t);
  const fetchImpl = (async (input: string | URL | Request) => {
    if (String(input).includes("oauth2.googleapis.com")) {
      return new Response(JSON.stringify({ access_token: "fake-token" }), {
        status: 200,
      });
    }
    return new Response(JSON.stringify({ audioContent: "" }), { status: 200 });
  }) as typeof fetch;

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
