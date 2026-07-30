import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const BUILD_DIR = path.join(process.cwd(), ".next");
const CLIENT_STATIC_DIR = path.join(BUILD_DIR, "static");

// Server-only string constants that must never reach a browser-delivered
// chunk. Vocabulary's canonical word content no longer exists as a static
// production fixture -- it is loaded per-request from `ModVocabList`/
// `ModVocabListWord` and never embedded in any client or server bundle -- so
// this scan now covers the remaining server-only string constants (the
// protected-speech prompt prefix and the public-choice-ID HMAC namespace)
// plus credential env-var names.
function collectServerOnlyMarkers(): string[] {
  return ["Spell the word:", "vocabulary-choice-projection-v1"];
}

// Names (never values) of environment variables that gate credentialed
// server modules protected by a `server-only` boundary (Stripe, Resend,
// Google/Lemonfox TTS, the database connection, and the NextAuth secret). A
// server module that reads one of these normally never reaches a client
// chunk in source form, so the literal property-access name appearing in
// browser output is a stable signal that the module's `server-only` guard
// was bypassed and it was bundled for the client.
function collectCredentialEnvVarMarkers(): string[] {
  return [
    "STRIPE_SECRET_KEY",
    "RESEND_API_KEY",
    "GOOGLE_TTS_CLIENT_EMAIL",
    "GOOGLE_TTS_PRIVATE_KEY",
    "LEMONFOX_API_KEY",
    "DATABASE_URL",
    "NEXTAUTH_SECRET",
  ];
}

test("credential env-var marker collection contains only variable names, never values", () => {
  const markers = collectCredentialEnvVarMarkers();

  assert.ok(markers.length > 0, "expected at least one credential env-var marker");
  assert.equal(new Set(markers).size, markers.length, "markers must be deduplicated");

  for (const marker of markers) {
    assert.ok(/^[A-Z0-9_]+$/.test(marker), `"${marker}" must be a bare env-var name`);
  }
});

test("production client bundles contain no server-only resolution helpers or credential markers", async (t) => {
  if (!existsSync(path.join(BUILD_DIR, "BUILD_ID"))) {
    t.skip("no production build output; run `npm run build` before this scan");
    return;
  }

  const entries = await readdir(CLIENT_STATIC_DIR, {
    recursive: true,
    withFileTypes: true,
  });
  const clientChunks = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => path.join(entry.parentPath, entry.name));

  assert.ok(clientChunks.length > 0, "expected browser chunks in .next/static");

  const markers = [...collectServerOnlyMarkers(), ...collectCredentialEnvVarMarkers()];

  for (const chunkPath of clientChunks) {
    const chunk = await readFile(chunkPath, "utf8");
    for (const marker of markers) {
      assert.ok(
        !chunk.includes(marker),
        `client chunk ${path.relative(BUILD_DIR, chunkPath)} contains server-only data: ${marker}`
      );
    }
  }
});
