import type { ScreenRequest } from "@/types/learning";
import type { VocabularyDefinitionDisplayContent } from "../data/vocabularyContentTypes";
import { vocabularyTts } from "../data/vocabularyTts";

export function createDefinitionDisplayScreenRequest(
  content: VocabularyDefinitionDisplayContent
): ScreenRequest {
  return {
    windowName: "definition-display",
    props: {
      eyebrow: "Meet Your New Word",
      title: content.word,
      primaryLabel: "Definition",
      primaryText: content.definition,
      secondaryLabel: "Examples",
      secondaryItems: content.exampleSentences,
      replayLabel: "Hear pronunciation",
      replayText: content.word,
      tts: vocabularyTts,
    },
    speak: {
      text: [content.word, content.definition, ...content.exampleSentences],
      tts: vocabularyTts,
    },
  };
}
