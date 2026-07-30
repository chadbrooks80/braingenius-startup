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
import { createWordSearchCheckpointScreenRequest } from "../../src/learning-modules/vocabulary/screens/wordSearchCheckpointScreen";
import type {
  VocabularyAnswerRecapContent,
  VocabularyDefinitionDisplayContent,
  VocabularyDefinitionFunFactContent,
  VocabularySpellingPracticeContent,
} from "../../src/learning-modules/vocabulary/data/vocabularyContentTypes";
import type { ActiveScreen, AnswerFeedback } from "../../src/types/learning";
import {
  createFakeContentBuildContext,
  createFakeVocabularyList,
  TEST_LIST_ID,
  TEST_OWNER_USER_ID,
  TEST_WORD_SEEDS,
} from "../vocabulary/fakeVocabularyListStore";

const LIST = createFakeVocabularyList(TEST_LIST_ID, TEST_OWNER_USER_ID, TEST_WORD_SEEDS);
const CONTEXT = createFakeContentBuildContext(LIST.words);
const WORD_ID = LIST.words[0].id;

const DISPLAY = (
  await getVocabularyContent(
    {
      capability: "cap",
      lessonId: "lesson",
      contentType: "definition-display",
      wordListId: TEST_LIST_ID,
      wordId: WORD_ID,
      nextCapability: "next",
      attemptId: null,
    },
    CONTEXT
  )
)!.content as VocabularyDefinitionDisplayContent;
const FACT = (
  await getVocabularyContent(
    {
      capability: "cap",
      lessonId: "lesson",
      contentType: "definition-fun-fact",
      wordListId: TEST_LIST_ID,
      wordId: WORD_ID,
      nextCapability: "next",
      attemptId: null,
    },
    CONTEXT
  )
)!.content as VocabularyDefinitionFunFactContent;
const SPELLING = (
  await getVocabularyContent(
    {
      capability: "cap",
      lessonId: "lesson",
      contentType: "spelling-practice",
      wordListId: TEST_LIST_ID,
      wordId: WORD_ID,
      nextCapability: "next",
      attemptId: "00000000-0000-4000-8000-000000000003",
    },
    CONTEXT
  )
)!.content as VocabularySpellingPracticeContent;
const RECAP = (
  await getVocabularyContent(
    {
      capability: "cap",
      lessonId: "lesson",
      contentType: "answer-recap",
      wordListId: TEST_LIST_ID,
      wordId: WORD_ID,
      nextCapability: "next",
      attemptId: null,
      exampleIndex: 1,
    },
    CONTEXT
  )
)!.content as VocabularyAnswerRecapContent;

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

test("the Word Search checkpoint screen builder projects an ungraded, bounds-validated puzzle", () => {
  const screen = createWordSearchCheckpointScreenRequest({
    contentType: "word-search-checkpoint",
    nextCapability: "00000000-0000-4000-8000-000000000001",
    words: ["brilliant", "cautious", "observe", "reluctant", "fortunate"],
  });

  assert.equal(screen.windowName, "word-search");
  assert.deepEqual(screen.props.words, [
    "brilliant",
    "cautious",
    "observe",
    "reluctant",
    "fortunate",
  ]);
  assert.equal(screen.props.emitCompletionAction, false);
  assert.equal(typeof screen.props.gridSize, "number");
  const gridSize = screen.props.gridSize as number;
  assert.ok(gridSize >= 8 && gridSize <= 30);
  assert.ok(gridSize >= "reluctant".length);
  assert.equal(screen.speak, undefined);
});

test("the Word Search checkpoint screen builder accepts every 27-30 letter target at grid size 30", () => {
  for (const length of [27, 28, 29, 30]) {
    const longTarget = "q".repeat(length);
    const screen = createWordSearchCheckpointScreenRequest({
      contentType: "word-search-checkpoint",
      nextCapability: "00000000-0000-4000-8000-000000000001",
      words: [longTarget, "brilliant", "cautious", "observe", "fortunate"],
    });

    assert.equal(screen.props.gridSize, 30);
    assert.deepEqual(screen.props.words, [
      longTarget,
      "brilliant",
      "cautious",
      "observe",
      "fortunate",
    ]);
  }
});

test("the Word Search checkpoint screen builder rejects structurally incompatible groups before rendering", () => {
  for (const core of [
    ["MATH", "HAT", "AT"],
    ["CATER", "LATER", "ATE"],
    ["TEACH", "BEACH", "EACH"],
  ]) {
    assert.throws(
      () =>
        createWordSearchCheckpointScreenRequest({
          contentType: "word-search-checkpoint",
          nextCapability: "00000000-0000-4000-8000-000000000001",
          words: [...core, "observe", "fortunate"],
        }),
      /failed Word Search input validation/
    );
  }
});

test("the Word Search checkpoint screen builder rejects malformed checkpoint content", () => {
  for (const words of [
    ["brilliant", "cautious", "observe", "reluctant"],
    ["brilliant", "BRILLIANT", "observe", "reluctant", "fortunate"],
    ["brilliant", "cautious", "observe", "reluctant", ""],
    ["brilliant", "cautious", "observe", "reluctant", "fort123"],
    ["brilliant", "cautious", "observe", "reluctant", "x"],
    ["brilliant", "cautious", "observe", "reluctant", "q".repeat(31)],
  ]) {
    assert.throws(
      () =>
        createWordSearchCheckpointScreenRequest({
          contentType: "word-search-checkpoint",
          nextCapability: "00000000-0000-4000-8000-000000000001",
          words,
        }),
      /failed Word Search input validation/
    );
  }
});

test("screen changes clear feedback and speech failure state without injecting the notice into a Learning Window", () => {
  const activeScreens: ActiveScreen[] = [];
  const feedbackChanges: Array<AnswerFeedback | null> = [];
  const speechFailureNoticeChanges: unknown[] = [];

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
      setSpeechFailureNotice: (notice) =>
        speechFailureNoticeChanges.push(notice),
    },
    () => {}
  );

  assert.deepEqual(feedbackChanges, [null]);
  assert.deepEqual(speechFailureNoticeChanges, [null]);
  const activeScreen = activeScreens[0];
  assert.ok(activeScreen);
  assert.equal(typeof activeScreen.props.onAction, "function");
  assert.equal("speechFailureNotice" in activeScreen.props, false);

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
