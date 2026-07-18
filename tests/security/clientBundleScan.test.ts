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
function collectServerOnlyMarkers(): string[] {
  const words = getWordList("word_list_id")!;
  const markers = new Set<string>(["Spell the word:", "vocabulary-choice-projection-v1"]);

  for (const word of words) {
    markers.add(JSON.stringify(word.word));
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

  const markers = collectServerOnlyMarkers();

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
