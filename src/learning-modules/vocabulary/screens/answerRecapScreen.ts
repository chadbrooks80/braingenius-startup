import type { ScreenRequest } from "@/types/learning";
import type { VocabularyAnswerRecapContent } from "../data/vocabularyContentTypes";
import { vocabularyTts } from "../data/vocabularyTts";

export function createAnswerRecapScreenRequest(
  content: VocabularyAnswerRecapContent
): ScreenRequest {
  const speechText = [
    content.word,
    content.definition,
    content.exampleSentence,
  ];

  return {
    windowName: "answer-recap",
    props: {
      label: "Answer recap",
      title: content.word,
      primaryText: content.definition,
      secondaryText: content.exampleSentence,
      replayLabel: "Hear answer recap",
      playingMessage: "Playing recap…",
      completeMessage: "Recap complete",
      speechText,
      tts: vocabularyTts,
    },
    speak: {
      text: speechText,
      tts: vocabularyTts,
    },
  };
}
