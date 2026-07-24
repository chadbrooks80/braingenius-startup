import StartupWindow from "@/components/learning-engine/windows/Startup";
import MultipleChoiceWindow from "@/components/learning-engine/windows/MultipleChoice";
import LearningErrorWindow from "@/components/learning-engine/windows/Error";
import DefinitionDisplay from "@/components/learning-engine/windows/DefinitionDisplay";
import DefinitionFunFact from "@/components/learning-engine/windows/DefinitionFunFact";
import SpellingWindow from "@/components/learning-engine/windows/Spelling";
import AnswerRecapWindow from "@/components/learning-engine/windows/AnswerRecap";
import LessonCompleteWindow from "@/components/learning-engine/windows/LessonComplete";
import WordSearchWindow from "@/components/learning-engine/windows/WordSearch";

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
