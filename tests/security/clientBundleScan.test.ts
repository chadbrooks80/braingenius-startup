import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { getWordList } from "../../src/learning-modules/vocabulary/data/getWordList";

const BUILD_DIR = path.join(process.cwd(), ".next");
const CLIENT_STATIC_DIR = path.join(BUILD_DIR, "static");

// Strings that exist only in server-only fixture and resolution code. Their
// presence in any browser-delivered chunk means answer-bearing data or a
// server-only helper was bundled for the client.
//
// Standalone learner words (e.g. "transform") are deliberately excluded:
// ordinary English words collide with normal browser-bundle code and
// framework/runtime identifiers, producing false positives without proving
// an actual answer leak. Every remaining marker is either an opaque
// identifier or a multi-word phrase distinctive enough that it cannot
// reasonably collide with unrelated code.
function collectServerOnlyMarkers(): string[] {
  const words = getWordList("word_list_id")!;
  const markers = new Set<string>(["Spell the word:", "vocabulary-choice-projection-v1"]);

  for (const word of words) {
    markers.add(word.definition);
    markers.add(word.interestingFact);
    markers.add(word.definitionAttemptId);
    markers.add(word.spellingAttemptId);
    for (const sentence of word.exampleSentences) {
      markers.add(sentence);
    }
    for (const choice of word.choices) {
      markers.add(`"${choice.id}"`);
      markers.add(choice.text);
    }
  }

  return [...markers];
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

test("marker collection excludes ambiguous standalone learner words and keeps high-confidence server-only markers", () => {
  const markers = collectServerOnlyMarkers();
  const words = getWordList("word_list_id")!;

  assert.ok(markers.length > 0, "expected at least one server-only marker");
  assert.equal(new Set(markers).size, markers.length, "markers must be deduplicated");

  for (const word of words) {
    assert.ok(
      !markers.includes(word.word) && !markers.includes(JSON.stringify(word.word)),
      `standalone learner word "${word.word}" must not be collected as a marker`
    );
  }

  assert.ok(markers.includes("Spell the word:"));
  assert.ok(markers.includes("vocabulary-choice-projection-v1"));

  const transformWord = words.find((word) => word.word === "transform")!;
  assert.ok(markers.includes(transformWord.definitionAttemptId));
  assert.ok(markers.includes(transformWord.spellingAttemptId));
  assert.ok(markers.includes(`"${transformWord.choices[0].id}"`));
  assert.ok(markers.includes(transformWord.definition));
});

test("credential env-var marker collection contains only variable names, never values", () => {
  const markers = collectCredentialEnvVarMarkers();

  assert.ok(markers.length > 0, "expected at least one credential env-var marker");
  assert.equal(new Set(markers).size, markers.length, "markers must be deduplicated");

  for (const marker of markers) {
    assert.ok(/^[A-Z0-9_]+$/.test(marker), `"${marker}" must be a bare env-var name`);
  }
});

test("production client bundles contain no canonical fixture answers or server-only resolution helpers", async (t) => {
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
