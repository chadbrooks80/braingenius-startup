import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { getVocabularyAnswer } from "../../src/learning-modules/vocabulary/data/getCorrectAnswer";
import { getWordList } from "../../src/learning-modules/vocabulary/data/getWordList";
import { createMultipleChoiceScreenRequest } from "../../src/learning-modules/vocabulary/screens/multipleChoiceScreen";
import { createSpellingScreenRequest } from "../../src/learning-modules/vocabulary/screens/spellingScreen";
import { getVocabularyContent } from "../../src/learning-modules/vocabulary/server/getVocabularyContent";
import { VocabularyContentCapabilityStore } from "../../src/learning-modules/vocabulary/server/VocabularyContentCapabilityStore";

const WORDS = getWordList("word_list_id")!;

test("the canonical server fixture contains 20 complete unique words and answer coverage", async () => {
  const words = getWordList("word_list_id");
  assert.ok(words);
  assert.equal(words.length, 20);
  assert.equal(new Set(words.map((word) => word.id)).size, 20);
  assert.equal(new Set(words.map((word) => word.word)).size, 20);
  assert.ok(words.every((word) => word.id !== word.word));

  const attemptIds = words.flatMap((word) => [
    word.definitionAttemptId,
    word.spellingAttemptId,
  ]);
  assert.equal(new Set(attemptIds).size, 40);

  for (const word of words) {
    assert.equal(word.exampleSentences.length, 3);
    assert.ok(word.exampleSentences.every((sentence) => sentence.trim() !== ""));
    assert.equal(word.choices.length, 4);
    assert.equal(new Set(word.choices.map((choice) => choice.id)).size, 4);
    assert.ok(word.choices.every((choice) => choice.text.trim() !== ""));

    const publicQuestion = getVocabularyContent({
      contentType: "definition-practice",
      wordListId: "word_list_id",
      wordId: word.id,
    })!;
    const definitionResult = getVocabularyAnswer({
      answerType: "definition",
      attemptId: word.definitionAttemptId,
      selectedChoiceId: publicQuestion.choices[0].id,
    });
    assert.ok(definitionResult?.answerType === "definition");
    const spellingResult = getVocabularyAnswer({
      answerType: "spelling",
      attemptId: word.spellingAttemptId,
      answer: word.word,
    });
    assert.deepEqual(spellingResult, {
      answerType: "spelling",
      correct: true,
    });
  }

  const fixtureSource = await readFile(
    new URL(
      "../../src/learning-modules/vocabulary/data/getWordList.ts",
      import.meta.url
    ),
    "utf8"
  );
  assert.match(fixtureSource, /import "server-only"/);
});

test("browser-visible projections cannot mechanically reconstruct definition answers", () => {
  const manifest = new VocabularyContentCapabilityStore().createManifest(
    "00000000-0000-4000-8000-000000000001",
    "word_list_id"
  )!;
  assert.deepEqual(Object.keys(manifest).sort(), [
    "contentType",
    "lessonId",
    "nextCapability",
    "randomSeed",
    "words",
  ]);
  assert.ok(manifest.words.every((word) => Object.keys(word).length === 1));

  const correctPositions = new Set<number>();
  for (const [wordIndex, fixtureWord] of WORDS.entries()) {
    const wordId = fixtureWord.id;
    const display = getVocabularyContent({
      contentType: "definition-display",
      wordListId: "word_list_id",
      wordId,
    })!;
    const fact = getVocabularyContent({
      contentType: "definition-fun-fact",
      wordListId: "word_list_id",
      wordId,
    })!;
    const questionRequest = {
      contentType: "definition-practice" as const,
      wordListId: "word_list_id",
      wordId,
    };
    const question = getVocabularyContent(
      questionRequest,
      createSeededRandomInt(wordIndex + 1)
    )!;
    const answer = getVocabularyAnswer({
      answerType: "definition",
      attemptId: question.attemptId,
      selectedChoiceId: question.choices[0].id,
    });
    assert.ok(answer?.answerType === "definition");

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
    assert.ok(
      question.choices.every((choice) =>
        /^choice-[0-9a-f]{24}$/.test(choice.id)
      )
    );

    const canonicalWord = WORDS[wordIndex];
    const internalChoiceIds = new Set(
      canonicalWord.choices.map((choice) => choice.id)
    );
    assert.ok(
      question.choices.every((choice) => !internalChoiceIds.has(choice.id))
    );

    const teachingStrings = [
      display.word,
      display.definition,
      ...display.exampleSentences,
      fact.word,
      fact.interestingFact,
    ].map(normalize);
    const exactTeachingMatches = question.choices.filter((choice) =>
      teachingStrings.includes(normalize(choice.text))
    );
    assert.deepEqual(exactTeachingMatches, []);

    const nonChoiceMetadata = [
      wordId,
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
      () => Number.parseInt(wordId.slice(-2), 10) / 20
    );
    const visibleChoices = shuffled.props.choices as Array<{ id: string }>;
    correctPositions.add(
      visibleChoices.findIndex((choice) => choice.id === answer.correctChoiceId)
    );

    const serverPositions = new Set<number>();
    for (let presentation = 1; presentation <= 24; presentation += 1) {
      const projected = getVocabularyContent(
        questionRequest,
        createSeededRandomInt(wordIndex * 101 + presentation)
      )!;
      serverPositions.add(
        projected.choices.findIndex(
          (choice) => choice.id === answer.correctChoiceId
        )
      );
    }
    assert.deepEqual(serverPositions, new Set([0, 1, 2, 3]));
  }

  assert.deepEqual(correctPositions, new Set([0, 1, 2, 3]));
});

test("cumulative browser-visible data cannot reconstruct the spelling answer", () => {
  const words = getWordList("word_list_id")!;
  const introductionDefinitions = new Set(
    words.map((word) => normalize(word.definition))
  );

  for (const word of words) {
    const content = getVocabularyContent({
      contentType: "spelling-practice",
      wordListId: "word_list_id",
      wordId: word.id,
    })!;

    // The graded projection carries only the opaque attempt ID and a distinct
    // prompt definition — never the canonical written word or an exact join
    // key from an introduction response.
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

    // The reference is an opaque random identifier that neither contains nor
    // deterministically encodes the word.
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
    assert.ok(
      !introductionDefinitions.has(normalize(content.definition)),
      `spelling prompt for "${word.word}" repeats an introduction definition`
    );
  }
});

test("the client module does not import or preload the canonical word fixture", async () => {
  const moduleSource = await readFile(
    new URL("../../src/learning-modules/vocabulary/index.ts", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(moduleSource, /getWordList/);
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
