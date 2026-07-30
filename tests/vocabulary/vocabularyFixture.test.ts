import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getVocabularyContent } from "../../src/learning-modules/vocabulary/server/getVocabularyContent";
import { VocabularyContentCapabilityStore } from "../../src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";
import { createMultipleChoiceScreenRequest } from "../../src/learning-modules/vocabulary/screens/multipleChoiceScreen";
import { createSpellingScreenRequest } from "../../src/learning-modules/vocabulary/screens/spellingScreen";
import type { VocabularyDefinitionPracticeContent } from "../../src/learning-modules/vocabulary/data/vocabularyContentTypes";
import {
  createDefaultFakeVocabularyListSource,
  createFakeContentBuildContext,
  createFakeVocabularyList,
  TEST_LIST_ID,
  TEST_OWNER_USER_ID,
  TEST_WORD_SEEDS,
} from "./fakeVocabularyListStore";

const LIST = createFakeVocabularyList(TEST_LIST_ID, TEST_OWNER_USER_ID, TEST_WORD_SEEDS);
const CONTEXT = createFakeContentBuildContext(LIST.words);

test("the seed word set contains 20 complete, unique words with distinct content", () => {
  assert.equal(LIST.words.length, 20);
  assert.equal(new Set(LIST.words.map((word) => word.id)).size, 20);
  assert.equal(new Set(LIST.words.map((word) => word.word)).size, 20);

  for (const word of LIST.words) {
    assert.ok(word.definition?.trim());
    assert.ok(word.spellingDefinition?.trim());
    assert.ok(word.exampleSentence1?.trim());
    assert.ok(word.exampleSentence2?.trim());
    assert.ok(word.exampleSentence3?.trim());
    assert.ok(word.interestingFact?.trim());
  }
});

test("browser-visible manifest and definition-practice projections cannot mechanically reconstruct answers", async () => {
  const store = new VocabularyContentCapabilityStore({
    listSource: createDefaultFakeVocabularyListSource(),
  });
  const manifest = await store.createManifest(
    "00000000-0000-4000-8000-000000000001",
    TEST_OWNER_USER_ID,
    TEST_LIST_ID
  );
  assert.ok(manifest);
  assert.deepEqual(Object.keys(manifest).sort(), [
    "contentType",
    "lessonId",
    "nextCapability",
    "randomSeed",
    "totalWordCount",
    "words",
  ]);
  assert.ok(manifest.words.every((word) => Object.keys(word).length === 1));

  const internalIds = new Set(LIST.words.map((word) => word.id));

  for (const [wordIndex, canonicalWord] of LIST.words.entries()) {
    const attemptId = randomUUID();
    const serverPositions = new Set<number>();
    let lastQuestion: VocabularyDefinitionPracticeContent | null = null;
    let correctChoiceId = "";

    for (let presentation = 1; presentation <= 24; presentation += 1) {
      const built = await getVocabularyContent(
        {
          capability: "cap",
          lessonId: "lesson",
          contentType: "definition-practice",
          wordListId: TEST_LIST_ID,
          wordId: canonicalWord.id,
          nextCapability: "next",
          attemptId,
        },
        CONTEXT,
        createSeededRandomInt(wordIndex * 101 + presentation)
      );
      assert.ok(
        built &&
          built.content.contentType === "definition-practice" &&
          built.answerSnapshot?.answerType === "definition"
      );
      lastQuestion = built.content;
      correctChoiceId = built.answerSnapshot.correctChoiceId;
      serverPositions.add(
        built.content.choices.findIndex((choice) => choice.id === correctChoiceId)
      );
    }
    assert.deepEqual(
      serverPositions,
      new Set([0, 1, 2, 3]),
      `expected the correct choice for "${canonicalWord.word}" to appear in every position across repeated shuffles`
    );

    const question = lastQuestion!;
    assert.deepEqual(Object.keys(question).sort(), [
      "attemptId",
      "choices",
      "contentType",
      "nextCapability",
      "question",
    ]);
    assert.ok(!("definition" in question));
    assert.ok(!("wordId" in question));
    assert.ok(!("correctChoiceId" in question));
    assert.equal(new Set(question.choices.map((choice) => choice.id)).size, 4);
    assert.ok(
      question.choices.every((choice) => /^choice-[0-9a-f]{24}$/.test(choice.id))
    );
    assert.ok(question.choices.every((choice) => !internalIds.has(choice.id)));

    const nonAnswerTeachingStrings = [
      canonicalWord.exampleSentence1,
      canonicalWord.exampleSentence2,
      canonicalWord.exampleSentence3,
      canonicalWord.interestingFact,
    ]
      .filter((value): value is string => typeof value === "string")
      .map(normalize);
    assert.deepEqual(
      question.choices.filter((choice) =>
        nonAnswerTeachingStrings.includes(normalize(choice.text))
      ),
      []
    );

    const nonChoiceMetadata = [
      canonicalWord.id,
      question.attemptId,
      question.nextCapability,
      question.question,
    ];
    assert.ok(
      question.choices.every((choice) =>
        nonChoiceMetadata.every((value) => !value.includes(choice.id))
      )
    );

    const shuffled = createMultipleChoiceScreenRequest(
      question,
      false,
      null,
      createSeededRandom01(wordIndex + 1)
    );
    const visibleChoices = shuffled.props.choices as Array<{ id: string }>;
    assert.equal(
      visibleChoices.filter((choice) => choice.id === correctChoiceId).length,
      1
    );
  }
});

test("cumulative browser-visible data cannot reconstruct the spelling answer", async () => {
  for (const word of LIST.words) {
    const attemptId = randomUUID();
    const built = await getVocabularyContent(
      {
        capability: "cap",
        lessonId: "lesson",
        contentType: "spelling-practice",
        wordListId: TEST_LIST_ID,
        wordId: word.id,
        nextCapability: "next",
        attemptId,
      },
      CONTEXT
    );
    assert.ok(built && built.content.contentType === "spelling-practice");
    const content = built.content;

    // The graded projection carries only the opaque attempt ID and a distinct
    // prompt definition -- never the canonical written word.
    assert.deepEqual(Object.keys(content).sort(), [
      "attemptId",
      "contentType",
      "definition",
      "nextCapability",
    ]);

    const screenRequest = createSpellingScreenRequest(content, false);
    const browserVisible = JSON.stringify({
      content,
      props: screenRequest.props,
      speak: screenRequest.speak,
    }).toLocaleLowerCase("en-US");
    assert.ok(
      !browserVisible.includes(word.word.toLocaleLowerCase("en-US")),
      `spelling screen data leaks "${word.word}"`
    );

    // Speech must use the opaque server-resolved reference, not TTS text.
    const speak = screenRequest.speak!;
    if (!("source" in speak)) {
      assert.fail("spelling speech must use a server-resolved source");
    }
    assert.ok(!("text" in speak));
    assert.equal(speak.source.endpoint, "/api/learning/vocabulary/speech");
    assert.equal(speak.source.reference, content.attemptId);
    assert.deepEqual(screenRequest.props.speech, speak);

    assert.match(
      speak.source.reference,
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
    assert.ok(
      !speak.source.reference.includes(word.word.toLocaleLowerCase("en-US"))
    );

    // The definition shown on the graded screen must not spell the answer.
    assert.ok(
      !content.definition
        .toLocaleLowerCase("en-US")
        .includes(word.word.toLocaleLowerCase("en-US")),
      `definition for "${word.word}" contains the word itself`
    );
  }
});

test("the client module does not import or preload canonical database word content", async () => {
  const moduleSource = await readFile(
    new URL("../../src/learning-modules/vocabulary/index.ts", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(moduleSource, /vocabularyListStore/);
  assert.doesNotMatch(moduleSource, /@\/lib\/db/);
  assert.doesNotMatch(moduleSource, /generated\/prisma/);
  assert.match(moduleSource, /contentType: "manifest"/);
  assert.match(moduleSource, /contentType: "definition-practice"/);
});

function normalize(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/\s+/g, " ");
}

function createSeededRandomInt(seed: number): (maxExclusive: number) => number {
  let state = seed >>> 0;
  return (maxExclusive) => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state % maxExclusive;
  };
}

function createSeededRandom01(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 4_294_967_296;
  };
}
