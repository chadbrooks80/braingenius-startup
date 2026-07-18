import type { ScreenRequest } from "@/types/learning";
import type { VocabularyLessonStats } from "../state/VocabularyLessonState";

export function createLessonCompleteScreenRequest(
  stats: VocabularyLessonStats
): ScreenRequest {
  return {
    windowName: "lesson-complete",
    props: {
      title: "Lesson complete",
      message: `All ${stats.totalWords} vocabulary words are mastered.`,
      stats: [
        { label: "Words", value: stats.totalWords },
        { label: "Correct", value: stats.correctCount },
        { label: "Incorrect", value: stats.incorrectCount },
      ],
    },
  };
}
