import StartupWindow from "@/learning-engine-components/LearningWindows/Startup";
import MultipleChoiceWindow from "@/learning-engine-components/LearningWindows/MultipleChoice";
import LearningErrorWindow from "@/learning-engine-components/LearningWindows/Error";
import DefinitionDisplay from "@/learning-engine-components/LearningWindows/DefinitionDisplay";
import DefinitionFunFact from "@/learning-engine-components/LearningWindows/DefinitionFunFact";
import SpellingWindow from "@/learning-engine-components/LearningWindows/Spelling";
import AnswerRecapWindow from "@/learning-engine-components/LearningWindows/AnswerRecap";
import LessonCompleteWindow from "@/learning-engine-components/LearningWindows/LessonComplete";
import WordSearchWindow from "@/learning-engine-components/LearningWindows/WordSearch";

export const LEARNING_WINDOWS = {
  startup: StartupWindow,
  "multiple-choice": MultipleChoiceWindow,
  "definition-display": DefinitionDisplay,
  "definition-fun-fact": DefinitionFunFact,
  spelling: SpellingWindow,
  "answer-recap": AnswerRecapWindow,
  "lesson-complete": LessonCompleteWindow,
  "word-search": WordSearchWindow,
  error: LearningErrorWindow,
} as const;

export type LearningWindowName = keyof typeof LEARNING_WINDOWS;

export function resolveLearningWindow(windowName: LearningWindowName) {
  const Component = LEARNING_WINDOWS[windowName];

  if (!Component) {
    throw new Error(`Unknown Learning Window: ${windowName}`);
  }

  return Component;
}
