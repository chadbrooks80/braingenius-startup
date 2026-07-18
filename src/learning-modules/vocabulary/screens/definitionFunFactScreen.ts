import type { ScreenRequest } from "@/types/learning";
import type { VocabularyDefinitionFunFactContent } from "../data/vocabularyContentTypes";
import { vocabularyTts } from "../data/vocabularyTts";

export function createDefinitionFunFactScreenRequest(
  content: VocabularyDefinitionFunFactContent
): ScreenRequest {
  return {
    windowName: "definition-fun-fact",
    props: {
      eyebrow: "Fun Fact About This Word!",
      title: content.word,
      introLabel: "Did you know that...",
      body: content.interestingFact,
    },
    speak: {
      text: content.interestingFact,
      tts: vocabularyTts,
    },
  };
}
