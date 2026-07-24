"use client";

import MultipleChoiceWindow from "@/components/learning-engine/windows/MultipleChoice";
import DefinitionDisplay from "@/components/learning-engine/windows/DefinitionDisplay";
import DefinitionFunFact from "@/components/learning-engine/windows/DefinitionFunFact";
import SpellingWindow from "@/components/learning-engine/windows/Spelling";
import AnswerRecapWindow from "@/components/learning-engine/windows/AnswerRecap";
import LessonCompleteWindow from "@/components/learning-engine/windows/LessonComplete";
import WordSearchWindow from "@/components/learning-engine/windows/WordSearch";
import { generateWordList } from "@/components/learning-engine/windows/WordSearch/generateWordList";
import type { GenerateWordSearchPuzzle } from "@/components/learning-engine/windows/WordSearch/wordSearchTypes";
import { vocabularyTts } from "@/learning-modules/vocabulary/data/vocabularyTts";

// Playground copy deliberately uses the demo word "anxious", which is not in
// the lesson fixture, so client bundles never carry fixture-identical strings.
const CHOICES = [
  { id: "a", text: "worried or nervous about something that might happen" },
  { id: "b", text: "completely calm and relaxed" },
  { id: "c", text: "excited about a celebration" },
  { id: "d", text: "unable to stop laughing" },
];

const MULTIPLE_CHOICE_COPY = {
  badgeLabel: "Definition practice",
  badgeTone: "primary" as const,
  prompt: "What does this word mean?",
  replayLabel: "Hear pronunciation",
  correctMessage: "Nice work!",
  incorrectMessage: "Not quite!",
};

const SPELLING_COPY = {
  badgeLabel: "Spelling practice",
  badgeTone: "primary" as const,
  promptLabel: "Definition",
  promptText: "worried or nervous about something that might happen",
  inputLabel: "Type the word you heard",
  submitLabel: "Check",
  replayLabel: "Hear spelling prompt",
  // Playground-only reference; the real lesson uses the opaque spelling
  // attempt ID so the browser never receives the word as text.
  speech: {
    source: {
      endpoint: "/api/learning/vocabulary/speech",
      reference: "playground-spelling-reference",
    },
  },
  blankMessage: "Enter a spelling before checking your answer.",
  pendingMessage: "Checking your answer…",
  errorMessage: "We couldn't submit your answer. Please try again.",
  correctMessage: "Nice work!",
  incorrectMessage: "Not quite!",
  correctionLabel: "Correct spelling",
};

const DEFINITION_DISPLAY_EXAMPLE_SENTENCES = [
  "Mia felt anxious before she gave her class presentation.",
  "The anxious puppy paced near the door during the storm.",
  "Taking a slow breath helped Devon feel less anxious.",
];

const WORD_SEARCH_SMALL_WORDS = ["cat", "dog", "sun", "map"];

const WORD_SEARCH_LARGE_WORDS = [
  "fraction",
  "decimal",
  "numerator",
  "denominator",
  "quotient",
  "product",
  "remainder",
  "multiple",
  "divisor",
  "equation",
];

const WORD_SEARCH_LONG_WORDS = [
  "photosynthesis",
  "chlorophyll",
  "sunlight",
  "energy",
];

// Never resolves so the playground keeps showing the loading state.
const NEVER_RESOLVING_PUZZLE: GenerateWordSearchPuzzle = () =>
  new Promise(() => {});

// Fails the first two generations so the temporary-failure state stays
// visible even when development strict mode discards the first attempt,
// then Retry recovers with the real temporary generator.
let playgroundGenerationFailuresRemaining = 2;

const FAILING_THEN_RECOVERING_PUZZLE: GenerateWordSearchPuzzle = async (
  request
) => {
  if (playgroundGenerationFailuresRemaining > 0) {
    playgroundGenerationFailuresRemaining -= 1;
    throw new Error("Playground: simulated puzzle generation failure");
  }

  return generateWordList(request);
};

export default function PlaygroundPage() {
  return (
    <div className="flex flex-col gap-6 py-6">
      <MultipleChoiceWindow
        {...MULTIPLE_CHOICE_COPY}
        attemptId="playground-unanswered"
        question="anxious"
        choices={CHOICES}
        tts={vocabularyTts}
        feedback={null}
        onAction={() => {}}
      />
      <MultipleChoiceWindow
        {...MULTIPLE_CHOICE_COPY}
        attemptId="playground-answered"
        question="anxious"
        choices={CHOICES}
        tts={vocabularyTts}
        feedback={{ correctChoiceId: "a" }}
        onAction={() => {}}
      />
      <MultipleChoiceWindow
        {...MULTIPLE_CHOICE_COPY}
        attemptId="playground-review"
        badgeLabel="Definition review"
        badgeTone="secondary"
        question="anxious"
        choices={CHOICES}
        tts={vocabularyTts}
        feedback={null}
        onAction={() => {}}
      />
      <MultipleChoiceWindow
        attemptId="playground-math"
        badgeLabel="Math practice"
        badgeTone="primary"
        prompt="Choose the correct product."
        question="6 × 7"
        choices={[
          { id: "40", text: "40" },
          { id: "42", text: "42" },
          { id: "46", text: "46" },
          { id: "48", text: "48" },
        ]}
        tts={null}
        replayLabel="Hear the equation"
        correctMessage="Correct."
        incorrectMessage="Try the next one."
        feedback={null}
        onAction={() => {}}
      />
      <DefinitionDisplay
        eyebrow="Meet Your New Word"
        title="anxious"
        primaryLabel="Definition"
        primaryText="worried or nervous about something that might happen"
        secondaryLabel="Examples"
        secondaryItems={DEFINITION_DISPLAY_EXAMPLE_SENTENCES}
        replayLabel="Hear pronunciation"
        replayText="anxious"
        tts={vocabularyTts}
        onAction={() => {}}
      />
      <DefinitionFunFact
        eyebrow="Fun Fact About This Word!"
        title="anxious"
        introLabel="Did you know that..."
        body="Anxious is often used for a feeling of worry before an important event."
        onAction={() => {}}
      />
      <SpellingWindow
        {...SPELLING_COPY}
        attemptId="playground-spelling-practice"
        feedback={null}
        onAction={() => {}}
      />
      <SpellingWindow
        {...SPELLING_COPY}
        attemptId="playground-spelling-incorrect"
        badgeLabel="Spelling review"
        badgeTone="secondary"
        feedback={{
          correct: false,
          correctAnswer: "anxious",
        }}
        onAction={() => {}}
      />
      <AnswerRecapWindow
        label="Answer recap"
        title="anxious"
        primaryText="worried or nervous about something that might happen"
        secondaryText="Mia felt anxious before she gave her class presentation."
        replayLabel="Hear answer recap"
        playingMessage="Playing recap…"
        completeMessage="Recap complete"
        speechText={[
          "anxious",
          "worried or nervous about something that might happen",
          "Mia felt anxious before she gave her class presentation.",
        ]}
        tts={vocabularyTts}
        isSpeaking={false}
        onAction={() => {}}
      />
      <LessonCompleteWindow
        title="Lesson complete"
        message="All 20 vocabulary words are mastered."
        stats={[
          { label: "Words", value: 20 },
          { label: "Correct", value: 132 },
          { label: "Incorrect", value: 14 },
        ]}
      />
      <LessonCompleteWindow
        title="Practice complete"
        message="You finished today's multiplication set."
        stats={[
          { label: "Problems", value: 12 },
          { label: "Correct", value: 11 },
          { label: "Minutes", value: 4 },
        ]}
      />
      <WordSearchWindow
        gridSize={8}
        words={WORD_SEARCH_SMALL_WORDS}
        title="Word search: small puzzle"
        onAction={() => {}}
      />
      <WordSearchWindow
        gridSize={30}
        words={WORD_SEARCH_LARGE_WORDS}
        title="Word search: large puzzle"
        onAction={() => {}}
      />
      <WordSearchWindow
        gridSize={8}
        words={WORD_SEARCH_SMALL_WORDS}
        title="Word search: loading"
        generatePuzzle={NEVER_RESOLVING_PUZZLE}
        onAction={() => {}}
      />
      <WordSearchWindow
        gridSize={8}
        words={WORD_SEARCH_SMALL_WORDS}
        title="Word search: generation failure"
        generatePuzzle={FAILING_THEN_RECOVERING_PUZZLE}
        onAction={() => {}}
      />
      <WordSearchWindow
        gridSize={8}
        words={WORD_SEARCH_SMALL_WORDS}
        title="Word search: active selection"
        initialSelection={{
          start: { row: 1, col: 1 },
          end: { row: 1, col: 4 },
        }}
        onAction={() => {}}
      />
      <WordSearchWindow
        gridSize={8}
        words={WORD_SEARCH_SMALL_WORDS}
        title="Word search: partly complete"
        initialFoundWords={["cat", "dog"]}
        onAction={() => {}}
      />
      <WordSearchWindow
        gridSize={8}
        words={WORD_SEARCH_SMALL_WORDS}
        title="Word search: completed"
        initialFoundWords={WORD_SEARCH_SMALL_WORDS}
        onAction={() => {}}
      />
      <WordSearchWindow
        gridSize={16}
        words={WORD_SEARCH_LONG_WORDS}
        title="Word search: long words"
        onAction={() => {}}
      />
      <div className="mx-auto w-full max-w-[360px]">
        <WordSearchWindow
          gridSize={10}
          words={WORD_SEARCH_SMALL_WORDS}
          title="Word search: narrow screen"
          onAction={() => {}}
        />
      </div>
    </div>
  );
}
