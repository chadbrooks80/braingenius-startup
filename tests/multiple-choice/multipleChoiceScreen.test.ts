import assert from "node:assert/strict";
import test from "node:test";
import { vocabularyTts } from "../../src/learning-modules/vocabulary/data/vocabularyTts";
import type { VocabularyDefinitionPracticeContent } from "../../src/learning-modules/vocabulary/data/vocabularyContentTypes";
import { createMultipleChoiceScreenRequest } from "../../src/learning-modules/vocabulary/screens/multipleChoiceScreen";

const CONTENT: VocabularyDefinitionPracticeContent = {
  contentType: "definition-practice",
  nextCapability: "00000000-0000-4000-8000-000000000001",
  attemptId: "attempt-1",
  question: "brilliant",
  choices: [
    { id: "choice-a", text: "very clever or impressive" },
    { id: "choice-b", text: "quiet and difficult to hear" },
    { id: "choice-c", text: "easy to carry" },
    { id: "choice-d", text: "ready to begin" },
  ],
};

test("production definition construction enables TTS, review mode, and choice shuffling", () => {
  const request = createMultipleChoiceScreenRequest(
    CONTENT,
    true,
    vocabularyTts,
    () => 0
  );

  assert.equal(request.props.tts, vocabularyTts);
  assert.equal(request.props.badgeLabel, "Definition review");
  assert.equal(request.props.badgeTone, "secondary");
  assert.equal(request.props.prompt, "What does this word mean?");
  assert.deepEqual(request.speak, {
    text: CONTENT.question,
    tts: vocabularyTts,
  });
  assert.deepEqual(
    (request.props.choices as VocabularyDefinitionPracticeContent["choices"]).map((choice) => choice.id),
    ["choice-b", "choice-c", "choice-d", "choice-a"]
  );
  assert.deepEqual(CONTENT.choices.map((choice) => choice.id), [
    "choice-a",
    "choice-b",
    "choice-c",
    "choice-d",
  ]);
});

test("production definition construction supports disabled TTS", () => {
  const request = createMultipleChoiceScreenRequest(
    CONTENT,
    false,
    null,
    () => 0.5
  );

  assert.equal(request.props.tts, null);
  assert.equal(request.speak, undefined);
  assert.equal(request.props.question, CONTENT.question);
  assert.equal(request.props.badgeLabel, "Definition practice");
});
