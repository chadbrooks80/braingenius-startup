import { test } from "node:test";
import assert from "node:assert/strict";
import { synthesizeTts } from "../../src/lib/learning-engine/speech/providers/synthesizeTts";
import { withEnvVars } from "./testEnv";

test("synthesizeTts dispatches to Lemonfox when provider is lemonfox", async (t) => {
  withEnvVars(t, { LEMONFOX_API_KEY: "fake-lemonfox-key" });

  const fetchImpl = (async () =>
    new Response(new Uint8Array([9, 9]), {
      status: 200,
      headers: { "Content-Type": "audio/mpeg" },
    })) as typeof fetch;

  const audio = await synthesizeTts(
    {
      text: "hello",
      tts: { provider: "lemonfox", voice: "sarah" },
    },
    { fetchImpl }
  );

  assert.deepEqual(Array.from(audio.bytes), [9, 9]);
});
