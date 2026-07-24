import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ScreenRenderer } from "../../src/components/learning-engine/ScreenRenderer";
import MultipleChoiceWindow from "../../src/components/learning-engine/windows/MultipleChoice/MultipleChoiceWindow";
import SpellingWindow from "../../src/components/learning-engine/windows/Spelling/SpellingWindow";
import AnswerRecapWindow from "../../src/components/learning-engine/windows/AnswerRecap/AnswerRecapWindow";
import LessonCompleteWindow from "../../src/components/learning-engine/windows/LessonComplete/LessonCompleteWindow";
import { resolveLearningWindow } from "../../src/lib/learning-engine/LearningWindowRegistry";
import { changeLearningEngineScreen } from "../../src/lib/learning-engine/screens/changeLearningEngineScreen";
import { vocabularyTts } from "../../src/learning-modules/vocabulary/data/vocabularyTts";
import { getVocabularyContent } from "../../src/learning-modules/vocabulary/server/getVocabularyContent";
import { createDefinitionDisplayScreenRequest } from "../../src/learning-modules/vocabulary/screens/definitionDisplayScreen";
import { createDefinitionFunFactScreenRequest } from "../../src/learning-modules/vocabulary/screens/definitionFunFactScreen";
import { createSpellingScreenRequest } from "../../src/learning-modules/vocabulary/screens/spellingScreen";
import { createAnswerRecapScreenRequest } from "../../src/learning-modules/vocabulary/screens/answerRecapScreen";
import type { ActiveScreen, AnswerFeedback } from "../../src/types/learning";

const DISPLAY = getVocabularyContent({
  contentType: "definition-display",
  wordListId: "word_list_id",
  wordId: "word-01",
})!;
const FACT = getVocabularyContent({
  contentType: "definition-fun-fact",
  wordListId: "word_list_id",
  wordId: "word-01",
})!;
const SPELLING = getVocabularyContent({
  contentType: "spelling-practice",
  wordListId: "word_list_id",
  wordId: "word-01",
})!;
const RECAP = getVocabularyContent({
  contentType: "answer-recap",
  wordListId: "word_list_id",
  wordId: "word-01",
  exampleIndex: 1,
})!;

test("all vocabulary Learning Window keys resolve", () => {
  for (const windowName of [
    "definition-display",
    "definition-fun-fact",
    "spelling",
    "answer-recap",
    "lesson-complete",
  ] as const) {
    assert.equal(typeof resolveLearningWindow(windowName), "function");
  }
});

test("vocabulary screen builders preserve props and declarative speech queues", () => {
  const display = createDefinitionDisplayScreenRequest(DISPLAY);
  assert.equal(display.windowName, "definition-display");
  assert.deepEqual(display.props.secondaryItems, DISPLAY.exampleSentences);
  assert.equal(display.props.eyebrow, "Meet Your New Word");
  assert.deepEqual(display.speak, {
    text: [DISPLAY.word, DISPLAY.definition, ...DISPLAY.exampleSentences],
    tts: vocabularyTts,
  });

  const fact = createDefinitionFunFactScreenRequest(FACT);
  assert.equal(fact.props.body, FACT.interestingFact);
  assert.deepEqual(fact.speak, {
    text: FACT.interestingFact,
    tts: vocabularyTts,
  });

  const spelling = createSpellingScreenRequest(
    SPELLING,
    true
  );
  assert.equal(spelling.props.badgeLabel, "Spelling review");
  assert.equal(spelling.props.badgeTone, "secondary");
  // Automatic speech and the window's manual replay share one opaque
  // server-resolved reference; the browser never receives the word as text.
  const secureSpeech = {
    source: {
      endpoint: "/api/learning/vocabulary/speech",
      reference: SPELLING.attemptId,
    },
  };
  assert.deepEqual(spelling.speak, secureSpeech);
  assert.deepEqual(spelling.props.speech, secureSpeech);

  const recap = createAnswerRecapScreenRequest(RECAP);
  assert.equal(recap.windowName, "answer-recap");
  assert.deepEqual(recap.speak, {
    text: [RECAP.word, RECAP.definition, RECAP.exampleSentence],
    tts: vocabularyTts,
  });
});

test("screen changes reset feedback and ScreenRenderer injects live feedback after module props", () => {
  const activeScreens: ActiveScreen[] = [];
  const feedbackChanges: Array<AnswerFeedback | null> = [];

  changeLearningEngineScreen(
    {
      windowName: "lesson-complete",
      props: {
        totalWords: 20,
        gradedAnswerCount: 100,
        correctCount: 90,
        incorrectCount: 10,
      },
    },
    {
      setActiveScreen: (screen) => {
        activeScreens.push(screen);
      },
      setShowHeader: () => {},
      setShowSidebar: () => {},
      setAnswerFeedback: (feedback) => feedbackChanges.push(feedback),
      setIsSpeaking: () => {},
    },
    () => {}
  );

  assert.deepEqual(feedbackChanges, [null]);
  const activeScreen = activeScreens[0];
  assert.ok(activeScreen);
  assert.equal(typeof activeScreen.props.onAction, "function");

  function FeedbackProbe({
    feedback,
  }: {
    feedback: AnswerFeedback | null;
  }) {
    return <span>{JSON.stringify(feedback)}</span>;
  }

  const markup = renderToStaticMarkup(
    <ScreenRenderer
      screen={{
        WindowComponent: FeedbackProbe,
        props: {
          feedback: { correct: false, correctAnswer: "stale" },
        },
      }}
      answerFeedback={{ correct: true }}
      isSpeaking={false}
    />
  );
  assert.match(markup, /true/);
  assert.doesNotMatch(markup, /stale/);
});

test("spelling hides the target before submission and reveals it after an incorrect answer", () => {
  const baseProps = {
    attemptId: "attempt-spelling",
    badgeLabel: "Spelling practice",
    badgeTone: "primary" as const,
    promptLabel: "Definition",
    promptText: "a very bright object far away in space",
    inputLabel: "Type the word you heard",
    submitLabel: "Check",
    replayLabel: "Hear spelling prompt",
    speech: {
      source: {
        endpoint: "/api/learning/vocabulary/speech",
        reference: "attempt-spelling",
      },
    },
    blankMessage: "Enter a spelling before checking your answer.",
    pendingMessage: "Checking your answer…",
    errorMessage: "We couldn't submit your answer. Please try again.",
    correctMessage: "Nice work!",
    incorrectMessage: "Not quite!",
    correctionLabel: "Correct spelling",
    onAction: () => {},
  };

  const unanswered = renderToStaticMarkup(
    <SpellingWindow {...baseProps} feedback={null} />
  );
  assert.doesNotMatch(unanswered, /quasar/);
  assert.match(unanswered, /Type the word you heard/);

  const incorrect = renderToStaticMarkup(
    <SpellingWindow
      {...baseProps}
      feedback={{
        correct: false,
        correctAnswer: "quasar",
      }}
    />
  );
  assert.match(incorrect, /Correct spelling:/);
  assert.match(incorrect, /quasar/);
});

test("recap gates Next during playback and completion output stays neutral", () => {
  const recap = renderToStaticMarkup(
    <AnswerRecapWindow
      label="Answer recap"
      title="brilliant"
      primaryText="extremely intelligent or talented"
      secondaryText="Nia had a brilliant idea."
      replayLabel="Hear answer recap"
      playingMessage="Playing recap…"
      completeMessage="Recap complete"
      speechText={[
        "brilliant",
        "extremely intelligent or talented",
        "Nia had a brilliant idea.",
      ]}
      tts={vocabularyTts}
      isSpeaking
      onAction={() => {}}
    />
  );
  assert.match(recap, /Playing recap/);
  assert.match(recap, /disabled/);

  const completion = renderToStaticMarkup(
    <LessonCompleteWindow
      title="Lesson complete"
      message="All 20 vocabulary words are mastered."
      stats={[
        { label: "Words", value: 20 },
        { label: "Correct", value: 110 },
        { label: "Incorrect", value: 10 },
      ]}
    />
  );
  assert.match(completion, /Lesson complete/);
  assert.doesNotMatch(completion, /trophy|confetti|streak|reward/i);
});

test("multiple-choice and completion windows render non-vocabulary content", () => {
  const multipleChoice = renderToStaticMarkup(
    <MultipleChoiceWindow
      attemptId="math-attempt"
      badgeLabel="Math practice"
      badgeTone="primary"
      prompt="Choose the correct product."
      question="6 × 7"
      choices={[
        { id: "40", text: "40" },
        { id: "42", text: "42" },
      ]}
      tts={null}
      replayLabel="Hear the equation"
      correctMessage="Correct."
      incorrectMessage="Try again."
      feedback={null}
      onAction={() => {}}
    />
  );
  const completion = renderToStaticMarkup(
    <LessonCompleteWindow
      title="Practice complete"
      message="You finished the multiplication set."
      stats={[
        { label: "Problems", value: 12 },
        { label: "Minutes", value: 4 },
      ]}
    />
  );

  assert.match(multipleChoice, /Math practice/);
  assert.match(multipleChoice, /Choose the correct product/);
  assert.doesNotMatch(multipleChoice, /definition|word/i);
  assert.match(completion, /multiplication set/);
  assert.match(completion, /Problems/);
  assert.doesNotMatch(completion, /vocabulary|Words/);
});
