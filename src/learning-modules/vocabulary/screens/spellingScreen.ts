import type { ScreenRequest, SpeakActionPayload } from "@/types/learning";
import type { VocabularySpellingPracticeContent } from "../data/vocabularyContentTypes";

const VOCABULARY_SPEECH_ENDPOINT = "/api/learning/vocabulary/speech";

export function createSpellingScreenRequest(
  content: VocabularySpellingPracticeContent,
  review: boolean
): ScreenRequest {
  // The spoken prompt is server-resolved: the browser sends only this opaque
  // reference and receives audio, never the canonical written word.
  const speech: SpeakActionPayload = {
    source: {
      endpoint: VOCABULARY_SPEECH_ENDPOINT,
      reference: content.attemptId,
    },
  };

  return {
    windowName: "spelling",
    props: {
      attemptId: content.attemptId,
      badgeLabel: review ? "Spelling review" : "Spelling practice",
      badgeTone: review ? "secondary" : "primary",
      promptLabel: "Definition",
      promptText: content.definition,
      inputLabel: "Type the word you heard",
      submitLabel: "Check",
      replayLabel: "Hear spelling prompt",
      speech,
      blankMessage: "Enter a spelling before checking your answer.",
      pendingMessage: "Checking your answer…",
      errorMessage: "We couldn't submit your answer. Please try again.",
      correctMessage: "Nice work!",
      incorrectMessage: "Not quite!",
      correctionLabel: "Correct spelling",
    },
    speak: speech,
  };
}
