import type { ScreenRequest, TtsConfiguration } from "@/types/learning";
import { normalizedRandom } from "@/lib/random/normalizedRandom";
import type { VocabularyDefinitionPracticeContent } from "../data/vocabularyContentTypes";
import { vocabularyTts } from "../data/vocabularyTts";

export function createMultipleChoiceScreenRequest(
  content: VocabularyDefinitionPracticeContent,
  review = false,
  tts: TtsConfiguration | null = vocabularyTts,
  random: () => number = Math.random
): ScreenRequest {
  return {
    windowName: "multiple-choice",
    props: {
      attemptId: content.attemptId,
      badgeLabel: review ? "Definition review" : "Definition practice",
      badgeTone: review ? "secondary" : "primary",
      prompt: "What does this word mean?",
      question: content.question,
      choices: shuffledChoices(content.choices, random),
      tts,
      replayLabel: "Hear pronunciation",
      correctMessage: "Nice work!",
      incorrectMessage: "Not quite!",
    },
    ...(tts === null
      ? {}
      : {
          speak: {
            text: content.question,
            tts,
          },
        }),
  };
}

function shuffledChoices(
  sourceChoices: VocabularyDefinitionPracticeContent["choices"],
  random: () => number
) {
  const choices = [...sourceChoices];

  for (let index = choices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(normalizedRandom(random()) * (index + 1));
    [choices[index], choices[swapIndex]] = [choices[swapIndex], choices[index]];
  }

  return choices;
}
